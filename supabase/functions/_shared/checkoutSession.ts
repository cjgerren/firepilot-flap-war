export function isPaidCheckoutSession(session: { payment_status?: string | null } | null | undefined) {
  return session?.payment_status === 'paid';
}
