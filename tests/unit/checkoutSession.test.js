import { describe, expect, it } from 'vitest';
import { isPaidCheckoutSession } from '../../src/lib/checkoutSession.js';

describe('isPaidCheckoutSession', () => {
  it('accepts a paid session even if status is still open', () => {
    expect(isPaidCheckoutSession({ payment_status: 'paid', status: 'open' })).toBe(true);
  });

  it('rejects a complete session that is not paid', () => {
    expect(isPaidCheckoutSession({ payment_status: 'unpaid', status: 'complete' })).toBe(false);
  });

  it('rejects missing sessions', () => {
    expect(isPaidCheckoutSession(null)).toBe(false);
    expect(isPaidCheckoutSession({})).toBe(false);
  });
});
