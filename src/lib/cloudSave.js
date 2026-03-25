import { supabase } from '@/api/supabaseClient';
import { exportLocalSave, importLocalSave } from '@/lib/gameStore';

export async function getCurrentUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error('getCurrentUser error:', error);
    return null;
  }

  return user ?? null;
}

export async function pullCloudSaveToLocal() {
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
    coins: data.coins,
    ownedSkins: data.owned_skins,
    selectedSkin: data.selected_skin,
    highScore: data.high_score,
    totalKills: data.total_kills,
    ownedWeapons: data.owned_weapons,
    selectedWeapon: data.selected_weapon,
    ownedUpgrades: data.owned_upgrades,
    equippedUpgrades: data.equipped_upgrades,
  });

  return { ok: true, source: 'cloud' };
}

export async function pushLocalSaveToCloud() {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: 'no-user' };

  const local = exportLocalSave();

  const payload = {
    user_id: user.id,
    coins: local.coins,
    owned_skins: local.ownedSkins,
    selected_skin: local.selectedSkin,
    high_score: local.highScore,
    total_kills: local.totalKills,
    owned_weapons: local.ownedWeapons,
    selected_weapon: local.selectedWeapon,
    owned_upgrades: local.ownedUpgrades,
    equipped_upgrades: local.equippedUpgrades,
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