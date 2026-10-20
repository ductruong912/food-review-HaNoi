import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { getLocalSupabaseEnvironment } from './local-supabase.mjs';

const [command, ...args] = process.argv.slice(2);
if (!['dev', 'build', 'start'].includes(command)) {
  console.error('Usage: node scripts/with-local-supabase.mjs <dev|build|start> [Next.js arguments]');
  process.exit(2);
}

let local;
try {
  local = getLocalSupabaseEnvironment();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const nextBin = resolve('node_modules', 'next', 'dist', 'bin', 'next');
const child = spawn(process.execPath, [nextBin, command, ...args], {
  cwd: process.cwd(),
  env: { ...process.env, ...local.appEnvironment, NEXT_LOCAL_SUPABASE_TEST: '1' },
  stdio: 'inherit',
});
child.on('error', (error) => {
  console.error(`Could not start Next.js: ${error.message}`);
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
