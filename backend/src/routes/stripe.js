import 'dotenv/config';
import express from 'express';
import Stripe from 'stripe';
import { CLIENT_URL, STRIPE_SECRET_KEY, configError, hasStripeConfig } from '../config.js';
import { findCurrencyPack } from '../catalog.js';

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
              name: `${quantity} FirePilot ${currencyType === 'diamonds' ? 'Diamonds' : 'Coins'}`,
            },
            unit_amount: pack.amount,
          },
          quantity: 1,
        },
      ],
      metadata: {
        packId,
        currencyType,
        quantity: String(quantity),
        userId,
      },
      success_url: `${CLIENT_URL}/?checkout=success`,
      cancel_url: `${CLIENT_URL}/?checkout=cancelled`,
      payment_intent_data: {
        setup_future_usage: undefined,
      },
      customer_creation: 'always',
      consent_collection: {
        terms_of_service: 'none',
      },
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    return res.status(500).json({ error: 'Stripe error' });
  }
});

export default router;
