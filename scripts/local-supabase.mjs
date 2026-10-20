import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const projectId = 'food-review-hanoi-local-test';
const apiPort = 55321;

export function runSupabaseCli(args, maxBuffer = 1024 * 1024) {
  return spawnSync(process.execPath, [
    join(process.cwd(), 'node_modules', 'supabase', 'dist', 'supabase.js'),
    ...args,
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      SUPABASE_HOME: process.env.SUPABASE_HOME || join(tmpdir(), `${projectId}-cli-home`),
    },
    maxBuffer,
  });
}

export function getLocalSupabaseEnvironment() {
  const result = runSupabaseCli(['status', '--output', 'env']);

  if (result.error || result.status !== 0) {
    throw new Error('Supabase local is not running or its CLI status could not be read. Start it with `npm run supabase:start`.');
  }

  const variables = Object.fromEntries(
    result.stdout.split(/\r?\n/).flatMap((line) => {
      const match = line.match(/^([A-Z0-9_]+)="?([^"\r\n]+)"?$/);
      return match ? [[match[1], match[2]]] : [];
    }),
  );
  const url = variables.API_URL;
  const anonKey = variables.ANON_KEY || variables.PUBLISHABLE_KEY;
  const serviceRoleKey = variables.SERVICE_ROLE_KEY;
  const mailpitUrl = variables.MAILPIT_URL;

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error('Supabase local returned an invalid API URL; refusing to run any tests or app commands.');
  }

  if (!['localhost', '127.0.0.1', '::1'].includes(parsedUrl.hostname) || parsedUrl.port !== String(apiPort)) {
    throw new Error(`Refusing to run against a non-local or unexpected Supabase API (expected loopback port ${apiPort}).`);
  }

  const config = requireConfig();
  if (!config.includes(`project_id = "${projectId}"`)) {
    throw new Error(`Refusing to run: supabase/config.toml must target the isolated project ${projectId}.`);
  }
  if (!anonKey || !serviceRoleKey || !mailpitUrl) {
    throw new Error('Supabase local status is missing a required local API key or Mailpit URL.');
  }

  let parsedMailpitUrl;
  try {
    parsedMailpitUrl = new URL(mailpitUrl);
  } catch {
    throw new Error('Supabase local returned an invalid Mailpit URL.');
  }
  if (!['localhost', '127.0.0.1', '::1'].includes(parsedMailpitUrl.hostname) || parsedMailpitUrl.port !== '55324') {
    throw new Error('Refusing to read email from a non-local or unexpected Mailpit endpoint.');
  }

  return {
    url: url.replace(/\/$/, ''),
    anonKey,
    serviceRoleKey,
    mailpitUrl: mailpitUrl.replace(/\/$/, ''),
    appEnvironment: {
      NEXT_PUBLIC_SUPABASE_URL: url.replace(/\/$/, ''),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
    },
  };
}

function requireConfig() {
  return readFileSync(join(process.cwd(), 'supabase', 'config.toml'), 'utf8');
}
