import { supabase, hasSupabaseConfig } from '@/api/supabaseClient';
import { exportLocalSave, importLocalSave } from '@/lib/gameStore';

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

  importLocalSave({
    coins: data.coins ?? 0,
    diamonds: data.diamonds ?? 0,
    ownedSkins: data.owned_skins ?? ['default'],
    selectedSkin: data.selected_skin ?? 'default',
    highScore: data.high_score ?? 0,
    totalKills: data.total_kills ?? 0,
    ownedWeapons: data.owned_weapons ?? ['blaster'],
    selectedWeapon: data.selected_weapon ?? 'blaster',
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
  });

  window.dispatchEvent(new Event('storage'));

  return { ok: true, source: 'cloud' };
}

export async function pushLocalSaveToCloud() {
  if (!hasSupabaseConfig || !supabase) return { ok: false, reason: 'cloud-disabled' };

  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: 'no-user' };

  const local = exportLocalSave();

  const payload = {
    user_id: user.id,
    coins: local.coins ?? 0,
    diamonds: local.diamonds ?? 0,
    owned_skins: local.ownedSkins ?? ['default'],
    selected_skin: local.selectedSkin ?? 'default',
    high_score: local.highScore ?? 0,
    total_kills: local.totalKills ?? 0,
    owned_weapons: local.ownedWeapons ?? ['blaster'],
    selected_weapon: local.selectedWeapon ?? 'blaster',
    owned_upgrades: local.ownedUpgrades ?? {},
    equipped_upgrades: local.equippedUpgrades ?? {},
    owned_specials: local.ownedSpecials ?? {},
    selected_special: local.selectedSpecial ?? '',
    equipped_specials: local.equippedSpecials ?? {},
    owned_combos: local.ownedCombos ?? [],
    combo_access: local.comboAccess ?? {},
    owned_vehicles: local.ownedVehicles ?? ['default_jet'],
    selected_vehicle: local.selectedVehicle ?? 'default_jet',
    purchase_history: local.purchaseHistory ?? [],
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('player_saves')
    .upsert(payload, { onConflict: 'user_id' });

  if (error) {
    console.error('pushLocalSaveToCloud error:', error);
    return { ok: false, reason: error.message };
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
    return { ok: true, source: 'cloud' };
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
