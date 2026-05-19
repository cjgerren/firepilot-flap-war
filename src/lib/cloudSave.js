import { supabase, hasSupabaseConfig } from '@/api/supabaseClient';
import { exportLocalSave, importLocalSave } from '@/lib/gameStore';
import { getDefaultSelectedWeapon, getStarterWeaponIds } from '@/config/gameConfig';

const DEFAULT_STARTER_WEAPONS = getStarterWeaponIds();
const DEFAULT_WEAPON = getDefaultSelectedWeapon();

export async function getCurrentUser() {
  if (!hasSupabaseConfig || !supabase) {
    return null;
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    console.error('getCurrentUser getSession error:', sessionError);
    return null;
  }

  if (!session?.user) {
    return null;
  }

  return session.user;
}

function cloudSaveRowToLocalSave(data) {
  return {
    coins: data.coins ?? 0,
    diamonds: data.diamonds ?? 0,
    ownedSkins: data.owned_skins ?? ['default'],
    selectedSkin: data.selected_skin ?? 'default',
    highScore: data.high_score ?? 0,
    totalKills: data.total_kills ?? 0,
    ownedWeapons: data.owned_weapons ?? DEFAULT_STARTER_WEAPONS,
    selectedWeapon: data.selected_weapon ?? DEFAULT_WEAPON,
    ownedUpgrades: data.owned_upgrades ?? {},
    equippedUpgrades: data.equipped_upgrades ?? {},
    ownedSpecials: data.owned_specials ?? {},
    selectedSpecial: data.selected_special ?? '',
    equippedSpecials: data.equipped_specials ?? {},
    ownedCombos: data.owned_combos ?? [],
    comboAccess: data.combo_access ?? {},
    ownedVehicles: data.owned_vehicles ?? ['default_jet'],
    selectedVehicle: data.selected_vehicle ?? 'default_jet',
    purchaseHistory: data.purchase_history ?? [],
  };
}

function importCloudSaveRow(data) {
  importLocalSave(cloudSaveRowToLocalSave(data));

  window.dispatchEvent(new Event('storage'));
}

function getProtectedCreditKey(entry) {
  if (entry?.source === 'stripe' && entry?.sessionId) {
    return `stripe:${entry.sessionId}`;
  }

  if (entry?.source === 'manual-credit') {
    if (entry.creditId) {
      return `manual-credit:${entry.creditId}`;
    }

    if (entry.grantedAt) {
      return `manual-credit:${entry.grantedAt}:${entry.kind}:${entry.quantity}`;
    }
  }

  return null;
}

function getProtectedCreditKeys(history) {
  const ids = new Set();

  if (!Array.isArray(history)) return ids;

  for (const entry of history) {
    const key = getProtectedCreditKey(entry);

    if (key) {
      ids.add(key);
    }
  }

  return ids;
}

function getHistoryEntryKey(entry) {
  const protectedKey = getProtectedCreditKey(entry);
  if (protectedKey) return protectedKey;

  if (!entry || typeof entry !== 'object') return null;

  return [
    entry.ts ?? '',
    entry.kind ?? '',
    entry.itemId ?? '',
    entry.cost ?? '',
    entry.qty ?? '',
    entry.mode ?? '',
    entry.source ?? '',
  ].join(':');
}

function getHistoryEntryKeys(history) {
  const ids = new Set();

  if (!Array.isArray(history)) return ids;

  for (const entry of history) {
    const key = getHistoryEntryKey(entry);

    if (key) {
      ids.add(key);
    }
  }

  return ids;
}

function isCurrencySpendEntry(entry) {
  if (!entry || typeof entry !== 'object') return false;
  if (!['skin', 'weapon', 'upgrade', 'special', 'vehicle', 'combo'].includes(entry.kind)) {
    return false;
  }

  return Math.max(0, Number(entry.cost || 0)) > 0;
}

function getCurrencySpendType(entry) {
  return entry.currencyType || entry.currency || 'coins';
}

function hasUnseenLocalCurrencySpend(localHistory, cloudHistory, currencyType = 'coins') {
  const cloudKeys = getHistoryEntryKeys(cloudHistory);

  if (!Array.isArray(localHistory)) return false;

  return localHistory.some((entry) => {
    if (!isCurrencySpendEntry(entry)) return false;
    if (getCurrencySpendType(entry) !== currencyType) return false;

    const key = getHistoryEntryKey(entry);
    return key && !cloudKeys.has(key);
  });
}

function hasUnseenCloudActivity(cloudHistory, localHistory) {
  const localKeys = getHistoryEntryKeys(localHistory);

  if (!Array.isArray(cloudHistory)) return false;

  return cloudHistory.some((entry) => {
    if (getProtectedCreditKey(entry)) return false;

    const key = getHistoryEntryKey(entry);
    return key && !localKeys.has(key);
  });
}

function getUnseenProtectedCredits(cloudHistory, localHistory) {
  const localCreditKeys = getProtectedCreditKeys(localHistory);

  if (!Array.isArray(cloudHistory)) return [];

  return cloudHistory.filter((entry) => {
    const key = getProtectedCreditKey(entry);
    return key && !localCreditKeys.has(key);
  });
}

function getHistoryEntriesMissingFrom(sourceHistory, targetHistory) {
  const targetKeys = getHistoryEntryKeys(targetHistory);

  if (!Array.isArray(sourceHistory)) return [];

  return sourceHistory.filter((entry) => {
    const key = getHistoryEntryKey(entry);
    return key && !targetKeys.has(key);
  });
}

function getProtectedCreditTotals(credits) {
  return credits.reduce(
    (totals, entry) => {
      if (!getProtectedCreditKey(entry)) {
        return totals;
      }

      const quantity = Math.max(0, Number(entry.quantity || 0));

      if (entry.kind === 'coins') {
        totals.coins += quantity;
      }

      if (entry.kind === 'diamonds') {
        totals.diamonds += quantity;
      }

      return totals;
    },
    { coins: 0, diamonds: 0 }
  );
}

function mergeLocalAndCloudSave(local, cloudRow) {
  const cloud = cloudSaveRowToLocalSave(cloudRow);
  const localHistory = Array.isArray(local.purchaseHistory) ? local.purchaseHistory : [];
  const cloudHistory = Array.isArray(cloud.purchaseHistory) ? cloud.purchaseHistory : [];
  const unseenProtectedCredits = getUnseenProtectedCredits(cloudHistory, localHistory);
  const unseenProtectedTotals = getProtectedCreditTotals(unseenProtectedCredits);
  const missingCloudHistory = getHistoryEntriesMissingFrom(cloudHistory, localHistory);
  const purchaseHistory = [...localHistory, ...missingCloudHistory].slice(-200);
  const hasUnpushedCoinSpend = hasUnseenLocalCurrencySpend(
    localHistory,
    cloudHistory,
    'coins'
  );
  const hasUnpushedDiamondSpend = hasUnseenLocalCurrencySpend(
    localHistory,
    cloudHistory,
    'diamonds'
  );
  const localCoins = Math.max(0, Number(local.coins ?? 0)) + unseenProtectedTotals.coins;
  const localDiamonds = Math.max(0, Number(local.diamonds ?? 0)) + unseenProtectedTotals.diamonds;
  const cloudCoins = Math.max(0, Number(cloud.coins ?? 0));
  const cloudDiamonds = Math.max(0, Number(cloud.diamonds ?? 0));
  const base = hasUnpushedCoinSpend || hasUnpushedDiamondSpend ? local : cloud;

  return {
    ...base,
    coins: hasUnpushedCoinSpend ? localCoins : Math.max(localCoins, cloudCoins),
    diamonds: hasUnpushedDiamondSpend ? localDiamonds : Math.max(localDiamonds, cloudDiamonds),
    highScore: Math.max(Number(local.highScore ?? 0), Number(cloud.highScore ?? 0)),
    totalKills: Math.max(Number(local.totalKills ?? 0), Number(cloud.totalKills ?? 0)),
    purchaseHistory,
  };
}

export async function pullCloudSaveToLocal() {
  if (!hasSupabaseConfig || !supabase) return { ok: false, reason: 'cloud-disabled' };

  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: 'no-user' };

  const { data, error } = await supabase
    .from('player_saves')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('pullCloudSaveToLocal error:', error);
    return { ok: false, reason: error.message };
  }

  if (!data) {
    return { ok: false, reason: 'no-cloud-save' };
  }

  importLocalSave(mergeLocalAndCloudSave(exportLocalSave(), data));
  window.dispatchEvent(new Event('storage'));

  return { ok: true, source: 'cloud-merged' };
}

export async function pushLocalSaveToCloud() {
  if (!hasSupabaseConfig || !supabase) return { ok: false, reason: 'cloud-disabled' };

  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: 'no-user' };

  const local = exportLocalSave();
  const { data: currentCloud, error: fetchError } = await supabase
    .from('player_saves')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (fetchError) {
    console.error('pushLocalSaveToCloud fetch error:', fetchError);
    return { ok: false, reason: fetchError.message };
  }

  if (currentCloud && hasUnseenCloudActivity(currentCloud.purchase_history, local.purchaseHistory)) {
    importCloudSaveRow(currentCloud);
    return { ok: true, source: 'cloud-stale-local-replaced' };
  }

  const unseenProtectedCredits = getUnseenProtectedCredits(
    currentCloud?.purchase_history,
    local.purchaseHistory
  );
  const unseenProtectedTotals = getProtectedCreditTotals(unseenProtectedCredits);
  const purchaseHistory = [
    ...(Array.isArray(local.purchaseHistory) ? local.purchaseHistory : []),
    ...unseenProtectedCredits,
  ].slice(-200);
  const hasUnpushedCoinSpend = hasUnseenLocalCurrencySpend(
    local.purchaseHistory,
    currentCloud?.purchase_history,
    'coins'
  );
  const hasUnpushedDiamondSpend = hasUnseenLocalCurrencySpend(
    local.purchaseHistory,
    currentCloud?.purchase_history,
    'diamonds'
  );
  const localCoins = Math.max(0, Number(local.coins ?? 0)) + unseenProtectedTotals.coins;
  const localDiamonds = Math.max(0, Number(local.diamonds ?? 0)) + unseenProtectedTotals.diamonds;
  const cloudCoins = Math.max(0, Number(currentCloud?.coins ?? 0));
  const cloudDiamonds = Math.max(0, Number(currentCloud?.diamonds ?? 0));

  const payload = {
    user_id: user.id,
    coins: hasUnpushedCoinSpend ? localCoins : Math.max(localCoins, cloudCoins),
    diamonds: hasUnpushedDiamondSpend ? localDiamonds : Math.max(localDiamonds, cloudDiamonds),
    owned_skins: local.ownedSkins ?? ['default'],
    selected_skin: local.selectedSkin ?? 'default',
    high_score: local.highScore ?? 0,
    total_kills: local.totalKills ?? 0,
    owned_weapons: local.ownedWeapons ?? DEFAULT_STARTER_WEAPONS,
    selected_weapon: local.selectedWeapon ?? DEFAULT_WEAPON,
    owned_upgrades: local.ownedUpgrades ?? {},
    equipped_upgrades: local.equippedUpgrades ?? {},
    owned_specials: local.ownedSpecials ?? {},
    selected_special: local.selectedSpecial ?? '',
    equipped_specials: local.equippedSpecials ?? {},
    owned_combos: local.ownedCombos ?? [],
    combo_access: local.comboAccess ?? {},
    owned_vehicles: local.ownedVehicles ?? ['default_jet'],
    selected_vehicle: local.selectedVehicle ?? 'default_jet',
    purchase_history: purchaseHistory,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('player_saves')
    .upsert(payload, { onConflict: 'user_id' });

  if (error) {
    console.error('pushLocalSaveToCloud error:', error);
    return { ok: false, reason: error.message };
  }

  if (
    unseenProtectedCredits.length > 0 ||
    payload.coins !== local.coins ||
    payload.diamonds !== local.diamonds
  ) {
    importLocalSave({
      ...local,
      coins: payload.coins,
      diamonds: payload.diamonds,
      purchaseHistory,
    });
    window.dispatchEvent(new Event('storage'));
  }

  return { ok: true };
}

export async function ensureSaveLoaded() {
  if (!hasSupabaseConfig || !supabase) {
    return { ok: true, source: 'local-only' };
  }

  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: 'no-user' };

  const pulled = await pullCloudSaveToLocal();

  if (pulled.ok) {
    const pushed = await pushLocalSaveToCloud();
    if (pushed.ok) {
      return { ok: true, source: 'cloud-merged-and-pushed' };
    }

    return pushed;
  }

  if (pulled.reason === 'no-cloud-save') {
    const pushed = await pushLocalSaveToCloud();
    if (pushed.ok) {
      return { ok: true, source: 'local-seeded-cloud' };
    }
    return pushed;
  }

  return pulled;
}
