export function isPaidCheckoutSession(session) {
  return session?.payment_status === 'paid';
}
