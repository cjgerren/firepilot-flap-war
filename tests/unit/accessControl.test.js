import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadAccessControl() {
  vi.resetModules();
  return import('../../src/lib/accessControl.js');
}

describe('accessControl', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv('VITE_OWNER_EMAILS', '');
    vi.stubEnv('VITE_OWNER_USER_IDS', '');
  });

  it('matches owner by email (case-insensitive)', async () => {
    vi.stubEnv('VITE_OWNER_EMAILS', 'owner@example.com');
    const { isOwnerUser } = await loadAccessControl();
    expect(isOwnerUser({ email: 'OWNER@example.com', id: 'abc' })).toBe(true);
  });

  it('matches owner by user id', async () => {
    vi.stubEnv('VITE_OWNER_USER_IDS', 'uid-123,uid-999');
    const { isOwnerUser } = await loadAccessControl();
    expect(isOwnerUser({ email: 'x@y.com', id: 'uid-999' })).toBe(true);
  });

  it('never grants owner to local developer mode', async () => {
    vi.stubEnv('VITE_OWNER_EMAILS', 'owner@example.com');
    const { isOwnerUser } = await loadAccessControl();
    expect(
      isOwnerUser({
        email: 'owner@example.com',
        id: 'uid-123',
        isLocalDeveloper: true,
      })
    ).toBe(false);
  });

  it('reports config presence correctly', async () => {
    let access = await loadAccessControl();
    expect(access.hasOwnerAccessConfig()).toBe(false);

    vi.stubEnv('VITE_OWNER_EMAILS', 'owner@example.com');
    access = await loadAccessControl();
    expect(access.hasOwnerAccessConfig()).toBe(true);
  });
});
