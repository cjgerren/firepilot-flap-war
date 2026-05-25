import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadReleaseConfig() {
  vi.resetModules();
  return import('../../src/lib/releaseConfig.js');
}

describe('releaseConfig', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to web with external purchases enabled', async () => {
    const config = await loadReleaseConfig();
    expect(config.releasePlatform).toBe('web');
    expect(config.isIosAppStoreBuild).toBe(false);
    expect(config.areExternalPurchasesEnabled).toBe(true);
  });

  it('disables external purchases for ios app store builds', async () => {
    vi.stubEnv('VITE_RELEASE_PLATFORM', 'ios-appstore');
    const config = await loadReleaseConfig();
    expect(config.isIosAppStoreBuild).toBe(true);
    expect(config.areExternalPurchasesEnabled).toBe(false);
  });

  it('disables external purchases when explicit env flag is true', async () => {
    vi.stubEnv('VITE_DISABLE_EXTERNAL_PURCHASES', 'true');
    const config = await loadReleaseConfig();
    expect(config.areExternalPurchasesEnabled).toBe(false);
  });

  it('reads multiplayer env toggles and transport/region', async () => {
    vi.stubEnv('VITE_MULTIPLAYER_ENABLED', 'true');
    vi.stubEnv('VITE_MULTIPLAYER_DARK_MODE', 'true');
    vi.stubEnv('VITE_MULTIPLAYER_TRANSPORT', 'wss');
    vi.stubEnv('VITE_MULTIPLAYER_REGION', 'eu-west');
    const config = await loadReleaseConfig();
    expect(config.isMultiplayerEnabled).toBe(true);
    expect(config.isMultiplayerDarkModeEnabled).toBe(true);
    expect(config.multiplayerTransport).toBe('wss');
    expect(config.multiplayerRegion).toBe('eu-west');
  });
});

