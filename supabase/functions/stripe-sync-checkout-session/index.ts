import Stripe from 'npm:stripe@18.5.0';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { applyCurrencyPurchase } from '../_shared/currencyPurchases.ts';
import { jsonResponse, optionsResponse } from '../_shared/http.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') || '';

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return optionsResponse();
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  if (!stripe) {
    return jsonResponse({ error: 'Stripe is not configured.' }, 503);
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
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

  let body: { sessionId?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400);
  }

  const sessionId = body?.sessionId;
  if (!sessionId || typeof sessionId !== 'string') {
    return jsonResponse({ error: 'Missing sessionId' }, 400);
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      return jsonResponse(
        {
          error: 'Checkout session is not complete.',
          paymentStatus: session.payment_status,
          status: session.status,
        },
        409
      );
    }

    const userId = session.metadata?.userId || '';
    const currencyType = session.metadata?.currencyType;
    const quantity = Number(session.metadata?.quantity || 0);

    if (userId !== user.id) {
      return jsonResponse({ error: 'Checkout session does not belong to this user.' }, 403);
    }
    if (!['coins', 'diamonds'].includes(String(currencyType))) {
      return jsonResponse({ error: 'Checkout session is missing currency metadata.' }, 400);
    }
    if (!quantity) {
      return jsonResponse({ error: 'Checkout session quantity is invalid.' }, 400);
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const result = await applyCurrencyPurchase({
      supabaseAdmin,
      userId,
      currencyType: currencyType as 'coins' | 'diamonds',
      quantity,
      source: 'stripe',
      referenceId: session.id,
      sessionId: session.id,
    });

    return jsonResponse({
      ok: true,
      alreadyProcessed: result.alreadyProcessed,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to sync Stripe Checkout session.';
    return jsonResponse({ error: 'Stripe checkout sync error', message }, 500);
  }
});
