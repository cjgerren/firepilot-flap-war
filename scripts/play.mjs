import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import http from 'node:http';
import https from 'node:https';

const rootDir = process.cwd();
const backendDir = path.join(rootDir, 'backend');
const isWindows = process.platform === 'win32';
const npmCmd = 'npm';
const children = [];

function hasNodeModules(dir) {
  return fs.existsSync(path.join(dir, 'node_modules'));
}

function spawnNpm(args, options = {}) {
  if (isWindows) {
    // Node 24 on Windows can throw EINVAL when spawning npm.cmd directly.
    return spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `${npmCmd} ${args.join(' ')}`], {
      ...options,
      shell: false,
    });
  }

  return spawn(npmCmd, args, {
    ...options,
    shell: false,
  });
}

function runCommand(args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawnNpm(args, {
      cwd,
      stdio: 'inherit',
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Command failed: ${npmCmd} ${args.join(' ')} (${code})`));
    });

    child.on('error', reject);
  });
}

function spawnProcess(args, cwd, label) {
  const child = spawnNpm(args, {
    cwd,
    stdio: 'inherit',
    env: {
      ...process.env,
      FORCE_COLOR: '1',
    },
  });

  child.on('error', (error) => {
    console.error(`[${label}] failed to start:`, error.message);
  });

  children.push(child);
  return child;
}

function httpGet(url) {
  return httpGetWithStatus(url).then((statusCode) => {
    if (statusCode >= 200 && statusCode < 500) {
      return true;
    }

    throw new Error(`Unexpected status: ${statusCode}`);
  });
}

function httpGetWithStatus(url) {
  const client = url.startsWith('https:') ? https : http;

  return new Promise((resolve, reject) => {
    const req = client.get(url, (res) => {
      res.resume();
      if (res.statusCode) {
        resolve(res.statusCode);
        return;
      }

      reject(new Error('No response status code'));
    });

    req.on('error', reject);
    req.setTimeout(1500, () => {
      req.destroy(new Error('Timed out'));
    });
  });
}

async function isUrlReady(url, acceptStatus = (statusCode) => statusCode >= 200 && statusCode < 500) {
  try {
    const statusCode = await httpGetWithStatus(url);
    return acceptStatus(statusCode);
  } catch {
    return false;
  }
}

async function waitForUrl(url, attempts = 60) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      await httpGet(url);
      return true;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return false;
}

function openBrowser(url) {
  if (process.env.CI) return;

  const openArgs =
    process.platform === 'win32'
      ? ['cmd', '/c', 'start', '', url]
      : process.platform === 'darwin'
        ? ['open', url]
        : ['xdg-open', url];

  const command = openArgs[0];
  const args = openArgs.slice(1);

  const child = spawn(command, args, {
    stdio: 'ignore',
    detached: true,
    shell: false,
  });

  child.unref();
}

function shutdown(signal) {
  for (const child of children) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
}

process.on('SIGINT', () => {
  shutdown('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  shutdown('SIGTERM');
  process.exit(0);
});

async function ensureDependencies() {
  if (!hasNodeModules(rootDir)) {
    console.log('Installing root dependencies...');
    await runCommand(['install'], rootDir);
  }

  if (!hasNodeModules(backendDir)) {
    console.log('Installing backend dependencies...');
    await runCommand(['install'], backendDir);
  }
}

async function main() {
  await ensureDependencies();

  const backendUrl = 'http://127.0.0.1:3000/api/health';
  const frontendUrl = 'http://127.0.0.1:5173';
  const backendAlreadyRunning = await isUrlReady(backendUrl, (statusCode) => statusCode === 200);

  console.log('Starting FirePilot backend...');
  if (!backendAlreadyRunning) {
    spawnProcess(['run', 'dev'], backendDir, 'backend');
  } else {
    console.log('FirePilot backend is already running on port 3000.');
  }

  const backendReady = await waitForUrl(backendUrl, 30);
  if (!backendReady) {
    console.warn('Backend healthcheck did not come up in time. Continuing anyway.');
  }

  const frontendAlreadyRunning = await isUrlReady(frontendUrl);

  console.log('Starting FirePilot frontend...');
  if (!frontendAlreadyRunning) {
    spawnProcess(['run', 'dev:frontend'], rootDir, 'frontend');
  } else {
    console.log('FirePilot frontend is already running on port 5173.');
  }

  const gameUrl = frontendUrl;
  const frontendReady = await waitForUrl(gameUrl, 45);

  if (frontendReady) {
    console.log(`Opening ${gameUrl}`);
    openBrowser(gameUrl);
  } else {
    console.warn(`Frontend did not respond in time. Open ${gameUrl} manually.`);
  }
}

main().catch((error) => {
  console.error(error.message);
  shutdown('SIGTERM');
  process.exit(1);
});
