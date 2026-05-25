import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function loadApiBaseUrlModule() {
  vi.resetModules();
  return import('../../src/lib/apiBaseUrl.js');
}

describe('apiBaseUrl', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv('VITE_API_BASE_URL', '');
    vi.stubEnv('VITE_RELEASE_PLATFORM', '');
    vi.stubEnv('VITE_IOS_APP_STORE_BUILD', '');
  });

  afterEach(() => {
    delete global.window;
  });

  it('uses configured env base URL when provided', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.firepilotwar.com');
    const { getApiBaseUrl, hasApiBaseUrl } = await loadApiBaseUrlModule();
    expect(getApiBaseUrl()).toBe('https://api.firepilotwar.com');
    expect(hasApiBaseUrl()).toBe(true);
  });

  it('returns local backend URL in non-browser runtime', async () => {
    const { getApiBaseUrl } = await loadApiBaseUrlModule();
    expect(getApiBaseUrl()).toBe('http://127.0.0.1:3000/api');
  });

  it('returns local backend URL for localhost browser hostnames', async () => {
    global.window = {
      location: {
        hostname: 'localhost',
        origin: 'http://localhost:5173',
      },
    };
    const { getApiBaseUrl } = await loadApiBaseUrlModule();
    expect(getApiBaseUrl()).toBe('http://127.0.0.1:3000/api');
  });

  it('returns origin scoped /api path for non-local web hosts', async () => {
    global.window = {
      location: {
        hostname: 'firepilotwar.com',
        origin: 'https://firepilotwar.com',
      },
    };
    const { getApiBaseUrl } = await loadApiBaseUrlModule();
    expect(getApiBaseUrl()).toBe('https://firepilotwar.com/api');
  });

  it('returns empty URL in ios app-store mode when no env override exists', async () => {
    vi.stubEnv('VITE_RELEASE_PLATFORM', 'ios-appstore');
    const { getApiBaseUrl, hasApiBaseUrl } = await loadApiBaseUrlModule();
    expect(getApiBaseUrl()).toBe('');
    expect(hasApiBaseUrl()).toBe(false);
  });
});
