import express from 'express';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function normalizeExistingRow(row) {
  if (!row) {
    return {
      coins: 0,
      owned_skins: ['default'],
      selected_skin: 'default',
      high_score: 0,
      total_kills: 0,
      owned_weapons: ['basic'],
      selected_weapon: 'basic',
      owned_upgrades: {},
      equipped_upgrades: {},
    };
  }

  return {
    coins: Number(row.coins ?? 0),
    owned_skins: Array.isArray(row.owned_skins) ? row.owned_skins : ['default'],
    selected_skin: row.selected_skin ?? 'default',
    high_score: Number(row.high_score ?? 0),
    total_kills: Number(row.total_kills ?? 0),
    owned_weapons: Array.isArray(row.owned_weapons) ? row.owned_weapons : ['basic'],
    selected_weapon: row.selected_weapon ?? 'basic',
    owned_upgrades:
      row.owned_upgrades && typeof row.owned_upgrades === 'object'
        ? row.owned_upgrades
        : {},
    equipped_upgrades:
      row.equipped_upgrades && typeof row.equipped_upgrades === 'object'
        ? row.equipped_upgrades
        : {},
  };
}

async function applyCoinPurchase({ userId, coinsToAdd, sessionId }) {
  if (!coinsToAdd || Number.isNaN(coinsToAdd) || coinsToAdd <= 0) {
    throw new Error(`Invalid coins value "${coinsToAdd}" in session ${sessionId}`);
  }

  const { data: existingRow, error: fetchError } = await supabase
    .from('player_saves')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Failed to fetch player_saves row: ${fetchError.message}`);
  }

  const current = normalizeExistingRow(existingRow);
  const nextCoins = current.coins + coinsToAdd;

  const payload = {
    user_id: userId,
    coins: nextCoins,
    owned_skins: current.owned_skins,
    selected_skin: current.selected_skin,
    high_score: current.high_score,
    total_kills: current.total_kills,
    owned_weapons: current.owned_weapons,
    selected_weapon: current.selected_weapon,
    owned_upgrades: current.owned_upgrades,
    equipped_upgrades: current.equipped_upgrades,
    updated_at: new Date().toISOString(),
  };

  const { error: upsertError } = await supabase
    .from('player_saves')
    .upsert(payload, { onConflict: 'user_id' });

  if (upsertError) {
    throw new Error(`Failed to update player_saves: ${upsertError.message}`);
  }

  console.log(
    `[WEBHOOK] Added ${coinsToAdd} coins to user ${userId}. New balance: ${nextCoins}`
  );
}

router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
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
        const coinsToAdd = Number(session.metadata?.coins || 0);

        if (!userId) {
          console.error(`[WEBHOOK] Missing metadata.userId on session ${session.id}`);
          break;
        }

        if (!coinsToAdd) {
          console.error(`[WEBHOOK] Missing or invalid metadata.coins on session ${session.id}`);
          break;
        }

        if (session.payment_status !== 'paid' && session.status !== 'complete') {
          console.log(
            `[WEBHOOK] Session ${session.id} not fully paid/complete yet. payment_status=${session.payment_status}, status=${session.status}`
          );
          break;
        }

        await applyCoinPurchase({
          userId,
          coinsToAdd,
          sessionId: session.id,
        });

        break;
      }

      default:
        console.log(`[WEBHOOK] Ignored event type: ${event.type}`);
        break;
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('[WEBHOOK] Handler error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

export default router;