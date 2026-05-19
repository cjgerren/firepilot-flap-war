import { createClient } from '@supabase/supabase-js';
import {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  hasSupabaseServiceConfig,
} from '../config.js';

const supabase = hasSupabaseServiceConfig
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

export function isCurrencyPurchaseServiceConfigured() {
  return Boolean(supabase);
}

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

export async function applyCurrencyPurchase({
  userId,
  currencyType,
  quantity,
  source = 'stripe',
  referenceId,
  sessionId,
  orderId = null,
  metadata = {},
}) {
  if (!supabase) {
    throw new Error('Supabase service config is missing.');
  }

  if (!userId || typeof userId !== 'string') {
    throw new Error(`Missing user id for session ${sessionId}`);
  }

  if (!['coins', 'diamonds'].includes(currencyType)) {
    throw new Error(`Unsupported currency type "${currencyType}" in session ${sessionId}`);
  }

  if (!quantity || Number.isNaN(quantity) || quantity <= 0) {
    throw new Error(`Invalid ${currencyType} value "${quantity}" in session ${sessionId}`);
  }

  const normalizedReferenceId =
    typeof referenceId === 'string' && referenceId.trim()
      ? referenceId.trim()
      : typeof sessionId === 'string' && sessionId.trim()
        ? sessionId.trim()
        : null;

  if (!normalizedReferenceId) {
    throw new Error('Missing purchase reference id.');
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
    (entry) => entry?.source === source && entry?.referenceId === normalizedReferenceId
  );

  if (alreadyProcessed) {
    console.log(
      `[PAYMENTS] Purchase ${source}:${normalizedReferenceId} already processed for user ${userId}.`
    );
    return {
      ok: true,
      alreadyProcessed: true,
      balance: current[currencyType],
    };
  }

  const nextBalance = current[currencyType] + quantity;
  const nextPurchaseHistory = [
    ...current.purchase_history,
    {
      source,
      kind: currencyType,
      quantity,
      referenceId: normalizedReferenceId,
      sessionId: sessionId || null,
      orderId,
      purchasedAt: new Date().toISOString(),
      ...metadata,
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
    `[PAYMENTS] Added ${quantity} ${currencyType} to user ${userId} via ${source}. New balance: ${nextBalance}`
  );

  return {
    ok: true,
    alreadyProcessed: false,
    balance: nextBalance,
  };
}
