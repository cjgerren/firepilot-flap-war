import 'dotenv/config';

const env = process.env;

export const PORT = Number(env.PORT || 3000);

export const CLIENT_URL = env.CLIENT_URL || 'http://127.0.0.1:5173';
export const CORS_ORIGINS = [
  CLIENT_URL,
  ...(env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
];

export const STRIPE_SECRET_KEY = env.STRIPE_SECRET_KEY || '';
export const STRIPE_WEBHOOK_SECRET = env.STRIPE_WEBHOOK_SECRET || '';
export const REVENUECAT_WEBHOOK_AUTH = env.REVENUECAT_WEBHOOK_AUTH || '';
export const SUPABASE_URL = env.SUPABASE_URL || '';
export const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || '';

export const hasStripeConfig = Boolean(STRIPE_SECRET_KEY);
export const hasStripeWebhookConfig = Boolean(STRIPE_SECRET_KEY && STRIPE_WEBHOOK_SECRET);
export const hasSupabaseServiceConfig = Boolean(
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
);

export function configError(message) {
  return {
    error: message,
  };
}
