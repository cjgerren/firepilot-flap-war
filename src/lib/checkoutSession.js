/**
 * Stripe Checkout can report status "complete" before money settles
 * (async methods, or a session that finished without payment_status paid).
 * Currency must be granted only when payment_status is "paid".
 */
export function isPaidCheckoutSession(session) {
  return session?.payment_status === 'paid';
}
