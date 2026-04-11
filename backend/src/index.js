import express from 'express';
import cors from 'cors';

import stripeRoutes from './routes/stripe.js';
import webhookRoutes from './routes/webhook.js';
import revenueCatRoutes from './routes/revenuecat.js';
import { CORS_ORIGINS, PORT } from './config.js';

const app = express();

app.use(cors({
  origin(origin, callback) {
    if (!origin || CORS_ORIGINS.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS blocked origin: ${origin}`));
  },
}));

// Stripe webhook MUST be before express.json()
app.use('/api/webhook', webhookRoutes);
app.use('/api/revenuecat', revenueCatRoutes);

app.use(express.json());

app.use('/api/stripe', stripeRoutes);

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
