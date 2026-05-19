import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const targets = [
  path.join(root, 'dist'),
  path.join(root, 'ios', 'App', 'App', 'public'),
];

const forbidden = [
  'VITE_ENABLE_DEV_LOGIN=true',
  'local-dev-firepilot',
  'dev@firepilot.local',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1',
];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

const files = [];

for (const target of targets) {
  try {
    files.push(...await walk(target));
  } catch {
    // The iOS public directory exists after mobile sync. Dist exists after build.
  }
}

const problems = [];

function parseEnv(text) {
  const result = new Map();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    result.set(key, value);
  }
  return result;
}

const envPath = path.join(root, '.env.appstore-ios');
try {
  const envText = await readFile(envPath, 'utf8');
  const env = parseEnv(envText);
  const supabaseUrl = env.get('VITE_SUPABASE_URL');
  const supabaseAnonKey = env.get('VITE_SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    problems.push('.env.appstore-ios is missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
  } else {
    try {
      const parsed = new URL(supabaseUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        problems.push('.env.appstore-ios VITE_SUPABASE_URL must use http or https');
      }
    } catch {
      problems.push('.env.appstore-ios VITE_SUPABASE_URL is not a valid URL');
    }
  }
} catch {
  problems.push('.env.appstore-ios is missing');
}

for (const file of files) {
  if (!/\.(html|js|json|css|plist|xml)$/i.test(file)) continue;

  const content = await readFile(file, 'utf8').catch(() => '');

  for (const marker of forbidden) {
    if (content.includes(marker)) {
      problems.push(`${path.relative(root, file)} contains ${marker}`);
    }
  }
}

if (problems.length > 0) {
  console.error('iOS App Store build verification failed:');
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log('iOS App Store build verification passed.');
