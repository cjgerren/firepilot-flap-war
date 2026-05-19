import Stripe from 'npm:stripe@18.5.0';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { applyCurrencyPurchase } from '../_shared/currencyPurchases.ts';
import { jsonResponse } from '../_shared/http.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') || '';
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';
const STRIPE_APP_NAME = Deno.env.get('STRIPE_APP_NAME') || 'FirePilot';

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  if (!stripe || !STRIPE_WEBHOOK_SECRET) {
    return jsonResponse({ error: 'Stripe webhook is not configured.' }, 503);
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ error: 'Supabase admin env is not configured.' }, 503);
  }

  const signature = req.headers.get('stripe-signature') || '';
  if (!signature) {
    return jsonResponse({ error: 'Missing stripe-signature header.' }, 400);
  }

  const payload = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook signature validation failed.';
    return jsonResponse({ error: message }, 400);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const currencyType = session.metadata?.currencyType;
        const quantity = Number(session.metadata?.quantity || 0);
        const appName = session.metadata?.app_name || STRIPE_APP_NAME;

        if (!userId || !['coins', 'diamonds'].includes(String(currencyType)) || !quantity) {
          console.error(
            `[WEBHOOK][${appName}] Invalid metadata on session ${session.id}. userId=${userId}, currencyType=${currencyType}, quantity=${quantity}`
          );
          break;
        }

        if (session.payment_status !== 'paid' && session.status !== 'complete') {
          break;
        }

        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        await applyCurrencyPurchase({
          supabaseAdmin,
          userId,
          currencyType: currencyType as 'coins' | 'diamonds',
          quantity,
          source: 'stripe',
          sessionId: session.id,
          referenceId: session.id,
        });
        break;
      }

      default:
        break;
    }

    return jsonResponse({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook handler error.';
    return jsonResponse({ error: message }, 500);
  }
});
