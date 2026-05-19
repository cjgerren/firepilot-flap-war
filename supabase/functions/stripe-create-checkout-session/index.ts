import Stripe from 'npm:stripe@18.5.0';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { findCurrencyPack, type CurrencyType } from '../_shared/catalog.ts';
import { jsonResponse, optionsResponse } from '../_shared/http.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') || '';
const STRIPE_APP_NAME = Deno.env.get('STRIPE_APP_NAME') || 'FirePilot';
const WEB_CLIENT_URL = Deno.env.get('WEB_CLIENT_URL') || '';

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

function getClientUrl(req: Request) {
  const origin = req.headers.get('origin') || '';
  if (WEB_CLIENT_URL) return WEB_CLIENT_URL;
  if (origin) return origin;
  return 'https://firepilotwar.com';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return optionsResponse();
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  if (!stripe) {
    return jsonResponse({ error: 'Stripe is not configured.' }, 503);
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return jsonResponse({ error: 'Supabase env is not configured.' }, 503);
  }

  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader) {
    return jsonResponse({ error: 'Missing auth token.' }, 401);
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    return jsonResponse({ error: 'Invalid auth session.' }, 401);
  }

  let body: { packId?: string; currencyType?: CurrencyType; userId?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400);
  }

  const packId = body?.packId;
  const currencyType = body?.currencyType;
  const claimedUserId = body?.userId;

  if (!packId || typeof packId !== 'string') {
    return jsonResponse({ error: 'Invalid or missing packId' }, 400);
  }
  if (!currencyType || !['coins', 'diamonds'].includes(currencyType)) {
    return jsonResponse({ error: 'Invalid or missing currencyType' }, 400);
  }
  if (claimedUserId && claimedUserId !== user.id) {
    return jsonResponse({ error: 'User mismatch.' }, 403);
  }

  const pack = findCurrencyPack(currencyType, packId);
  if (!pack) {
    return jsonResponse({ error: 'Unknown currency pack' }, 400);
  }

  const quantity = currencyType === 'diamonds' ? pack.diamonds : pack.coins;
  const clientUrl = getClientUrl(req);

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${quantity} ${STRIPE_APP_NAME} ${
                currencyType === 'diamonds' ? 'Diamonds' : 'Coins'
              }`,
            },
            unit_amount: pack.amount,
          },
          quantity: 1,
        },
      ],
      metadata: {
        app_name: STRIPE_APP_NAME,
        packId,
        currencyType,
        quantity: String(quantity),
        userId: user.id,
      },
      success_url: `${clientUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientUrl}/?checkout=cancelled`,
      payment_intent_data: {
        description: `${STRIPE_APP_NAME} • ${currencyType} • ${packId}`,
        setup_future_usage: undefined,
      },
      customer_creation: 'always',
      consent_collection: {
        terms_of_service: 'none',
      },
    });

    return jsonResponse({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create checkout session.';
    return jsonResponse({ error: 'Stripe error', message }, 500);
  }
});
