import express from 'express';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import {
  STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  configError,
  hasStripeWebhookConfig,
  hasSupabaseServiceConfig,
} from '../config.js';

const router = express.Router();

const stripe = hasStripeWebhookConfig ? new Stripe(STRIPE_SECRET_KEY) : null;

const supabase = hasSupabaseServiceConfig
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

function normalizeExistingRow(row) {
  if (!row) {
    return {
      coins: 0,
      diamonds: 0,
      owned_skins: ['default'],
      selected_skin: 'default',
      high_score: 0,
      total_kills: 0,
      owned_weapons: ['blaster'],
      selected_weapon: 'blaster',
      owned_upgrades: {},
      equipped_upgrades: {},
      owned_specials: {},
      selected_special: '',
      equipped_specials: {},
      owned_combos: [],
      combo_access: {},
      owned_vehicles: ['default_jet'],
      selected_vehicle: 'default_jet',
      purchase_history: [],
    };
  }

  return {
    coins: Number(row.coins ?? 0),
    diamonds: Number(row.diamonds ?? 0),
    owned_skins: Array.isArray(row.owned_skins) ? row.owned_skins : ['default'],
    selected_skin: row.selected_skin ?? 'default',
    high_score: Number(row.high_score ?? 0),
    total_kills: Number(row.total_kills ?? 0),
    owned_weapons: Array.isArray(row.owned_weapons) ? row.owned_weapons : ['blaster'],
    selected_weapon: row.selected_weapon ?? 'blaster',
    owned_upgrades:
      row.owned_upgrades && typeof row.owned_upgrades === 'object'
        ? row.owned_upgrades
        : {},
    equipped_upgrades:
      row.equipped_upgrades && typeof row.equipped_upgrades === 'object'
        ? row.equipped_upgrades
        : {},
    owned_specials:
      row.owned_specials && typeof row.owned_specials === 'object'
        ? row.owned_specials
        : {},
    selected_special: row.selected_special ?? '',
    equipped_specials:
      row.equipped_specials && typeof row.equipped_specials === 'object'
        ? row.equipped_specials
        : {},
    owned_combos: Array.isArray(row.owned_combos) ? row.owned_combos : [],
    combo_access:
      row.combo_access && typeof row.combo_access === 'object' ? row.combo_access : {},
    owned_vehicles: Array.isArray(row.owned_vehicles)
      ? row.owned_vehicles
      : ['default_jet'],
    selected_vehicle: row.selected_vehicle ?? 'default_jet',
    purchase_history: Array.isArray(row.purchase_history) ? row.purchase_history : [],
  };
}

async function applyCurrencyPurchase({ userId, currencyType, quantity, sessionId }) {
  if (!supabase) {
    throw new Error('Supabase service config is missing.');
  }

  if (!['coins', 'diamonds'].includes(currencyType)) {
    throw new Error(`Unsupported currency type "${currencyType}" in session ${sessionId}`);
  }

  if (!quantity || Number.isNaN(quantity) || quantity <= 0) {
    throw new Error(`Invalid ${currencyType} value "${quantity}" in session ${sessionId}`);
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
  const alreadyProcessed = current.purchase_history.some(
    (entry) => entry?.source === 'stripe' && entry?.sessionId === sessionId
  );

  if (alreadyProcessed) {
    console.log(`[WEBHOOK] Session ${sessionId} already processed for user ${userId}.`);
    return;
  }

  const nextBalance = current[currencyType] + quantity;
  const nextPurchaseHistory = [
    ...current.purchase_history,
    {
      source: 'stripe',
      kind: currencyType,
      quantity,
      sessionId,
      purchasedAt: new Date().toISOString(),
    },
  ];

  const payload = {
    user_id: userId,
    coins: current.coins,
    diamonds: current.diamonds,
    owned_skins: current.owned_skins,
    selected_skin: current.selected_skin,
    high_score: current.high_score,
    total_kills: current.total_kills,
    owned_weapons: current.owned_weapons,
    selected_weapon: current.selected_weapon,
    owned_upgrades: current.owned_upgrades,
    equipped_upgrades: current.equipped_upgrades,
    owned_specials: current.owned_specials,
    selected_special: current.selected_special,
    equipped_specials: current.equipped_specials,
    owned_combos: current.owned_combos,
    combo_access: current.combo_access,
    owned_vehicles: current.owned_vehicles,
    selected_vehicle: current.selected_vehicle,
    purchase_history: nextPurchaseHistory,
    updated_at: new Date().toISOString(),
  };

  payload[currencyType] = nextBalance;

  const { error: upsertError } = await supabase
    .from('player_saves')
    .upsert(payload, { onConflict: 'user_id' });

  if (upsertError) {
    throw new Error(`Failed to update player_saves: ${upsertError.message}`);
  }

  console.log(
    `[WEBHOOK] Added ${quantity} ${currencyType} to user ${userId}. New balance: ${nextBalance}`
  );
}

router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe || !supabase) {
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

        if (!userId) {
          console.error(`[WEBHOOK] Missing metadata.userId on session ${session.id}`);
          break;
        }

        if (!['coins', 'diamonds'].includes(currencyType)) {
          console.error(
            `[WEBHOOK] Missing or invalid metadata.currencyType on session ${session.id}`
          );
          break;
        }

        if (!quantity) {
          console.error(
            `[WEBHOOK] Missing or invalid metadata.quantity on session ${session.id}`
          );
          break;
        }

        if (session.payment_status !== 'paid' && session.status !== 'complete') {
          console.log(
            `[WEBHOOK] Session ${session.id} not fully paid/complete yet. payment_status=${session.payment_status}, status=${session.status}`
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
