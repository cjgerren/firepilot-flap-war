import express from 'express';
import Stripe from 'stripe';
import {
  STRIPE_APP_NAME,
  STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET,
  configError,
  hasStripeWebhookConfig,
} from '../config.js';
import {
  applyCurrencyPurchase,
  isCurrencyPurchaseServiceConfigured,
} from '../services/currencyPurchases.js';

const router = express.Router();

const stripe = hasStripeWebhookConfig ? new Stripe(STRIPE_SECRET_KEY) : null;

router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe || !isCurrencyPurchaseServiceConfigured()) {
    return res
      .status(503)
      .json(configError('Webhook processing is not configured for this installation.'));
  }

  const sig = req.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('[WEBHOOK] Signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;

        const userId = session.metadata?.userId;
        const currencyType = session.metadata?.currencyType;
        const quantity = Number(session.metadata?.quantity || 0);
        const appName = session.metadata?.app_name || STRIPE_APP_NAME;

        if (!userId) {
          console.error(`[WEBHOOK][${appName}] Missing metadata.userId on session ${session.id}`);
          break;
        }

        if (!['coins', 'diamonds'].includes(currencyType)) {
          console.error(
            `[WEBHOOK][${appName}] Missing or invalid metadata.currencyType on session ${session.id}`
          );
          break;
        }

        if (!quantity) {
          console.error(
            `[WEBHOOK][${appName}] Missing or invalid metadata.quantity on session ${session.id}`
          );
          break;
        }

        if (session.payment_status !== 'paid' && session.status !== 'complete') {
          console.log(
            `[WEBHOOK][${appName}] Session ${session.id} not fully paid/complete yet. payment_status=${session.payment_status}, status=${session.status}`
          );
          break;
        }

        await applyCurrencyPurchase({
          userId,
          currencyType,
          quantity,
          sessionId: session.id,
        });

        break;
      }

      default:
        console.log(`[WEBHOOK][${STRIPE_APP_NAME}] Ignored event type: ${event.type}`);
        break;
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('[WEBHOOK] Handler error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
