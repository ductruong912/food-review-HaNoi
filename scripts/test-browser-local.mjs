import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { getLocalSupabaseEnvironment } from './local-supabase.mjs';

const appUrl = 'http://localhost:3100';
let server;
let browserTests;
let local;
let serverOutput = '';

try {
  local = getLocalSupabaseEnvironment();
  if (!(await isPortFree('127.0.0.1', 3100))) {
    throw new Error('Port 3100 is already occupied; stop that listener before local browser checks.');
  }

  server = spawn(process.execPath, [
    resolve('node_modules', 'next', 'dist', 'bin', 'next'), 'dev',
    '--hostname', '127.0.0.1', '--port', '3100',
  ], {
    cwd: process.cwd(),
    env: { ...process.env, ...local.appEnvironment, NEXT_LOCAL_SUPABASE_TEST: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  for (const stream of [server.stdout, server.stderr]) {
    stream.on('data', (chunk) => {
      serverOutput = `${serverOutput}${chunk.toString()}`.slice(-120_000);
    });
  }
  await waitForApp(server);

  browserTests = spawn(process.execPath, [resolve('tests', 'browser.mjs')], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...local.appEnvironment,
      NEXT_LOCAL_SUPABASE_TEST: '1',
      TEST_URL: appUrl,
      HEADLESS: process.env.HEADLESS || '1',
    },
    stdio: 'inherit',
    windowsHide: true,
  });
  const exitCode = await new Promise((resolveExit, reject) => {
    browserTests.once('error', reject);
    browserTests.once('exit', (code, signal) => resolveExit(code ?? (signal ? 1 : 0)));
  });
  process.exitCode = exitCode;
} catch (error) {
  console.error(error?.message || 'Local browser tests failed.');
  const diagnostics = serverOutput.split(/\r?\n/).filter((line) => /\b(error|exception|fatal|status.?500)\b/i.test(line)).slice(-24);
  if (diagnostics.length) {
    const safeLines = diagnostics.map((line) => {
      for (const secret of [local?.anonKey, local?.serviceRoleKey].filter(Boolean)) line = line.replaceAll(secret, '[redacted local key]');
      return line.replace(/eyJ[A-Za-z0-9._-]{30,}/g, '[redacted JWT]');
    });
    console.error('Next.js local server diagnostics:\n' + safeLines.join('\n'));
  }
  process.exitCode = 1;
} finally {
  if (browserTests && browserTests.exitCode === null) browserTests.kill();
  await stopTree(server);
}

async function isPortFree(host, port) {
  return new Promise((resolvePort) => {
    const socket = createServer();
    socket.once('error', () => resolvePort(false));
    socket.listen(port, host, () => socket.close(() => resolvePort(true)));
  });
}

async function waitForApp(child) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('Next.js local test server exited before becoming ready.');
    try {
      const response = await fetch(`${appUrl}/profile`);
      if (response.ok) return;
    } catch { /* Wait for Next dev to bind and compile. */ }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
  }
  throw new Error('Next.js did not become ready at localhost:3100 within 90 seconds.');
}

async function stopTree(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
      stdio: 'ignore', windowsHide: true,
    });
    await new Promise((resolveExit) => killer.once('exit', resolveExit));
    return;
  }
  child.kill('SIGTERM');
  await new Promise((resolveExit) => child.once('exit', resolveExit));
}
