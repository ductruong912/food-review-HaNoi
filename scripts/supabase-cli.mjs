import { spawn } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { getLocalSupabaseEnvironment } from './local-supabase.mjs';

const [command, ...args] = process.argv.slice(2);
const cliCommands = {
  start: ['start'],
  stop: ['stop'],
  migrations: ['migration', 'list', '--local'],
  lint: ['db', 'lint', '--local'],
};
if ((!Object.hasOwn(cliCommands, command) && command !== 'status') || args.length > 0) {
  console.error('Usage: npm run supabase:<start|stop|status|migrations|lint>');
  process.exit(2);
}

const projectId = 'food-review-hanoi-local-test';
const apiPort = 55321;
const studioPort = 55323;
const mailpitPort = 55324;

if (command === 'status') {
  try {
    getLocalSupabaseEnvironment();
    printEndpoints('Supabase local is running.');
  } catch {
    console.log('Supabase local could not be verified as running. Start it with `npm run supabase:start`.');
  }
  process.exit(0);
}

if (command === 'start') {
  console.log('Starting the isolated Supabase local stack; generated keys are kept out of terminal output.');
} else if (command === 'stop') {
  console.log('Stopping the isolated Supabase local stack.');
}

const child = spawn(process.execPath, [resolve('node_modules', 'supabase', 'dist', 'supabase.js'), ...cliCommands[command]], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    SUPABASE_HOME: process.env.SUPABASE_HOME || join(tmpdir(), `${projectId}-cli-home`),
  },
  // Supabase CLI's `start` and `status` include local API keys in their output.
  // Capture and redact failure diagnostics; never forward raw CLI output.
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});
let cliOutput = '';
for (const stream of [child.stdout, child.stderr]) {
  stream.on('data', (chunk) => {
    cliOutput = `${cliOutput}${chunk.toString()}`.slice(-32_000);
  });
}

child.on('error', () => {
  console.error('Could not start Supabase CLI. Run `npm ci` and confirm Docker Desktop is available.');
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  if (code !== 0 || signal) {
    console.error(`Supabase CLI ${command} failed (exit ${code ?? signal ?? 'unknown'}).`);
    printSafeDiagnostics(cliOutput);
    process.exitCode = 1;
    return;
  }

  if (command === 'start') {
    try {
      getLocalSupabaseEnvironment();
      printEndpoints('Supabase local started successfully.');
    } catch {
      console.error('Supabase CLI completed, but the isolated local API and Mailpit endpoints could not be verified.');
      process.exitCode = 1;
    }
  } else if (command === 'stop') {
    console.log('Supabase local stopped.');
  } else if (command === 'migrations') {
    printMigrationRows(cliOutput);
  } else {
    const lines = cliOutput.split(/\r?\n/).filter((line) => /^Linting schema:|^No schema errors found/.test(line.trim()));
    if (lines.length) console.log(lines.join('\n'));
    else console.log('Supabase local database lint completed successfully.');
  }
});

function printEndpoints(message) {
  console.log(`${message}\n  API:     http://127.0.0.1:${apiPort}\n  Studio:  http://127.0.0.1:${studioPort}\n  Mailpit: http://127.0.0.1:${mailpitPort}\n  Project: ${projectId}`);
}

function printSafeDiagnostics(output) {
  const safeLines = output.split(/\r?\n/)
    .filter((line) => line.trim() && !/\b(anon(?:ymous)?|service.?role|publishable|secret|jwt|token|password|api.?key|credential)\b/i.test(line))
    .filter((line) => /docker|container|daemon|engine|connect|connection|pipe|permission|denied|port|timeout|failed|error|migrat|database|network|pull|start|stop|already|in use|cannot|could not|not found|unavailable/i.test(line))
    .map((line) => line.replace(/\b(?:eyJ[A-Za-z0-9_-]{16,}|sb_(?:publishable|secret)_[A-Za-z0-9_-]{12,})\b/g, '[redacted]'))
    .slice(-12);

  if (safeLines.length) console.error(safeLines.join('\n'));
}

function printMigrationRows(output) {
  const migrationBlock = output.match(/\{"migrations":\[.*?\],"message":"Migrations listed"\}/s)?.[0];
  if (!migrationBlock) {
    console.error('Supabase local returned an unreadable migration list.');
    process.exitCode = 1;
    return;
  }

  let migrations;
  try {
    migrations = JSON.parse(migrationBlock).migrations;
  } catch {
    console.error('Supabase local returned an unreadable migration list.');
    process.exitCode = 1;
    return;
  }

  console.log('Local migration | Database migration');
  for (const migration of migrations) {
    const localTimestamp = /^\d{14}$/.test(migration.local || '') ? migration.local : 'missing';
    const databaseTimestamp = /^\d{14}$/.test(migration.remote || '') ? migration.remote : 'missing';
    console.log(`${localTimestamp} | ${databaseTimestamp}`);
  }
}
