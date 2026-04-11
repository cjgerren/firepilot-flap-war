import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { findCurrencyPack } from '../catalog.js';
import {
  REVENUECAT_WEBHOOK_AUTH,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_URL,
  configError,
  hasSupabaseServiceConfig,
} from '../config.js';

const router = express.Router();

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

function getAuthorized(authHeader) {
  if (!REVENUECAT_WEBHOOK_AUTH) return false;
  if (authHeader === REVENUECAT_WEBHOOK_AUTH) return true;
  return authHeader === `Bearer ${REVENUECAT_WEBHOOK_AUTH}`;
}

async function applyStorePurchase({ userId, currencyType, quantity, transactionId, productId }) {
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
    (entry) => entry?.source === 'revenuecat' && entry?.transactionId === transactionId
  );

  if (alreadyProcessed) {
    return;
  }

  const nextBalance = current[currencyType] + quantity;
  const nextPurchaseHistory = [
    ...current.purchase_history,
    {
      source: 'revenuecat',
      kind: currencyType,
      quantity,
      productId,
      transactionId,
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
}

router.post('/webhook', express.json({ type: '*/*' }), async (req, res) => {
  if (!supabase) {
    return res
      .status(503)
      .json(configError('RevenueCat webhook processing is not configured.'));
  }

  if (!getAuthorized(req.headers.authorization || '')) {
    return res.status(401).json({ error: 'Unauthorized RevenueCat webhook' });
  }

  const event = req.body?.event || req.body;
  const productId = event?.product_id || event?.product_identifier || event?.store_product_id;
  const userId = event?.app_user_id || event?.original_app_user_id;
  const transactionId = event?.transaction_id || event?.id;

  if (!productId || !userId || !transactionId) {
    return res.status(200).json({ received: true, ignored: 'missing purchase metadata' });
  }

  const currencyType = productId.startsWith('diamonds_') ? 'diamonds' : 'coins';
  const pack = findCurrencyPack(currencyType, productId);

  if (!pack) {
    return res.status(200).json({ received: true, ignored: 'unknown product' });
  }

  const quantity = currencyType === 'diamonds' ? pack.diamonds : pack.coins;

  try {
    await applyStorePurchase({
      userId,
      currencyType,
      quantity,
      transactionId,
      productId,
    });

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('[REVENUECAT] Webhook handler error:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
