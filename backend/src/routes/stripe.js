import 'dotenv/config';
import express from 'express';
import Stripe from 'stripe';

const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

router.post('/create-checkout-session', async (req, res) => {
  const { amount, coins, userId } = req.body;

  if (!amount || !Number.isInteger(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Invalid or missing amount' });
  }

  if (!coins || !Number.isInteger(coins) || coins <= 0) {
    return res.status(400).json({ error: 'Invalid or missing coins' });
  }

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'Missing userId' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
  payment_method_types: ['card'],
  mode: 'payment',
  line_items: [
    {
      price_data: {
        currency: 'usd',
        product_data: {
          name: `${coins} FirePilot Coins`,
        },
        unit_amount: amount,
      },
      quantity: 1,
    },
  ],
  metadata: {
    coins: String(coins),
    userId,
  },
  success_url: `${process.env.CLIENT_URL}/?checkout=success`,
  cancel_url: `${process.env.CLIENT_URL}/?checkout=cancelled`,
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