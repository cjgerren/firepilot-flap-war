import 'dotenv/config';
import express from 'express';
import Stripe from 'stripe';
import {
  CLIENT_URL,
  STRIPE_APP_NAME,
  STRIPE_SECRET_KEY,
  configError,
  hasStripeConfig,
} from '../config.js';
import { findCurrencyPack } from '../catalog.js';
import {
  applyCurrencyPurchase,
  isCurrencyPurchaseServiceConfigured,
} from '../services/currencyPurchases.js';

const router = express.Router();

const stripe = hasStripeConfig ? new Stripe(STRIPE_SECRET_KEY) : null;

router.post('/create-checkout-session', async (req, res) => {
  if (!stripe) {
    return res
      .status(503)
      .json(configError('Payments are not configured for this installation.'));
  }

  const { packId, currencyType, userId } = req.body;

  if (!['coins', 'diamonds'].includes(currencyType)) {
    return res.status(400).json({ error: 'Invalid or missing currencyType' });
  }

  if (!packId || typeof packId !== 'string') {
    return res.status(400).json({ error: 'Invalid or missing packId' });
  }

  const pack = findCurrencyPack(currencyType, packId);

  if (!pack) {
    return res.status(400).json({ error: 'Unknown currency pack' });
  }

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'Missing userId' });
  }

  try {
    const quantity = currencyType === 'diamonds' ? pack.diamonds : pack.coins;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${quantity} ${STRIPE_APP_NAME} ${currencyType === 'diamonds' ? 'Diamonds' : 'Coins'}`,
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
        userId,
      },
      success_url: `${CLIENT_URL}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${CLIENT_URL}/?checkout=cancelled`,
      payment_intent_data: {
        description: `${STRIPE_APP_NAME} • ${currencyType} • ${packId}`,
        setup_future_usage: undefined,
      },
      customer_creation: 'always',
      consent_collection: {
        terms_of_service: 'none',
      },
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', {
      type: err?.type,
      code: err?.code,
      message: err?.message,
      requestId: err?.requestId,
    });

    return res.status(500).json({
      error: 'Stripe error',
      message: err?.message || 'Unable to create Stripe Checkout session.',
      code: err?.code,
      type: err?.type,
    });
  }
});

router.post('/sync-checkout-session', async (req, res) => {
  if (!stripe || !isCurrencyPurchaseServiceConfigured()) {
    return res
      .status(503)
      .json(configError('Checkout syncing is not configured for this installation.'));
  }

  const { sessionId } = req.body;

  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'Missing sessionId' });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      return res.status(409).json({
        error: 'Checkout session is not complete.',
        paymentStatus: session.payment_status,
        status: session.status,
      });
    }

    const userId = session.metadata?.userId;
    const currencyType = session.metadata?.currencyType;
    const quantity = Number(session.metadata?.quantity || 0);

    if (!userId || !['coins', 'diamonds'].includes(currencyType) || !quantity) {
      return res.status(400).json({ error: 'Checkout session is missing currency metadata.' });
    }

    const result = await applyCurrencyPurchase({
      userId,
      currencyType,
      quantity,
      source: 'stripe',
      referenceId: session.id,
      sessionId: session.id,
    });

    return res.json({
      ok: true,
      alreadyProcessed: result.alreadyProcessed,
    });
  } catch (err) {
    console.error('Stripe checkout sync error:', {
      type: err?.type,
      code: err?.code,
      message: err?.message,
      requestId: err?.requestId,
    });

    return res.status(500).json({
      error: 'Stripe checkout sync error',
      message: err?.message || 'Unable to sync Stripe Checkout session.',
      code: err?.code,
      type: err?.type,
    });
  }
});

export default router;
