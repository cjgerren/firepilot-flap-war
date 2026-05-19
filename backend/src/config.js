import 'dotenv/config';

const env = process.env;
const cleanEnv = (value) => (value || '').trim();

export const PORT = Number(env.PORT || 3000);

export const CLIENT_URL = cleanEnv(env.CLIENT_URL) || 'http://127.0.0.1:5173';
const BUILT_IN_CORS_ORIGINS = [
  'https://localhost',
  'http://localhost',
  'capacitor://localhost',
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'https://firepilotwar.com',
  'https://www.firepilotwar.com',
  'https://firepilot-flap-war-git-main-cjgerrens-projects.vercel.app',
  'https://firepilot-flap-war-git-release-v1-prep-cjgerrens-projects.vercel.app',
];

export const CORS_ORIGINS = Array.from(new Set([
  CLIENT_URL,
  ...BUILT_IN_CORS_ORIGINS,
  ...(env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
]));

export const STRIPE_SECRET_KEY = cleanEnv(env.STRIPE_SECRET_KEY);
export const STRIPE_APP_NAME = cleanEnv(env.STRIPE_APP_NAME) || 'FirePilot';
export const STRIPE_WEBHOOK_SECRET = cleanEnv(env.STRIPE_WEBHOOK_SECRET);
export const SUPABASE_URL = cleanEnv(env.SUPABASE_URL);
export const SUPABASE_SERVICE_ROLE_KEY = cleanEnv(env.SUPABASE_SERVICE_ROLE_KEY);
export const GOOGLE_PLAY_PACKAGE_NAME = cleanEnv(env.GOOGLE_PLAY_PACKAGE_NAME);
export const GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL = cleanEnv(
  env.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL
);
export const GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY = cleanEnv(
  env.GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY
).replace(/\\n/g, '\n');

export const hasStripeConfig = Boolean(STRIPE_SECRET_KEY);
export const hasStripeWebhookConfig = Boolean(STRIPE_SECRET_KEY && STRIPE_WEBHOOK_SECRET);
export const hasSupabaseServiceConfig = Boolean(
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
);
export const hasGooglePlayConfig = Boolean(
  GOOGLE_PLAY_PACKAGE_NAME &&
  GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL &&
  GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY
);

export function configError(message) {
  return {
    error: message,
  };
}
