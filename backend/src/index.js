import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import stripeRoutes from './routes/stripe.js';
import webhookRoutes from './routes/webhook.js';

dotenv.config();

const app = express();

app.use(cors());

// Stripe webhook MUST be before express.json()
app.use('/api/webhook', webhookRoutes);

app.use(express.json());

app.use('/api/stripe', stripeRoutes);

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});