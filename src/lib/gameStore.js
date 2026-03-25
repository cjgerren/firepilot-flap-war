// Persistent game store backed by localStorage

const KEYS = {
  coins: 'nd_coins',
  owned: 'nd_owned',
  selected: 'nd_selected',
  highScore: 'nd_highscore',
  totalKills: 'nd_totalkills',
  // Loadout (equipped before a run)
  ownedWeapons: 'nd_owned_weapons',
  selectedWeapon: 'nd_sel_weapon',
  ownedUpgrades: 'nd_owned_upgrades',  // { id -> qty }
  equippedUpgrades: 'nd_eq_upgrades',  // { shield1: qty, shield2: qty, tunnelbomb: qty }
};

export function getCoins() {
  return parseInt(localStorage.getItem(KEYS.coins) || '0', 10);
}
export function addCoins(amount) {
  const next = getCoins() + amount;
  localStorage.setItem(KEYS.coins, String(next));
  return next;
}
export function spendCoins(amount) {
  const current = getCoins();
  if (current < amount) return false;
  localStorage.setItem(KEYS.coins, String(current - amount));
  return true;
}

export function getOwnedSkins() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.owned) || '["default"]');
  } catch { return ['default']; }
}
export function ownSkin(id) {
  const owned = getOwnedSkins();
  if (!owned.includes(id)) {
    owned.push(id);
    localStorage.setItem(KEYS.owned, JSON.stringify(owned));
  }
}

export function getSelectedSkin() {
  return localStorage.getItem(KEYS.selected) || 'default';
}
export function setSelectedSkin(id) {
  localStorage.setItem(KEYS.selected, id);
}

export function getHighScore() {
  return parseInt(localStorage.getItem(KEYS.highScore) || '0', 10);
}
export function setHighScore(score) {
  const current = getHighScore();
  if (score > current) localStorage.setItem(KEYS.highScore, String(score));
  return Math.max(score, current);
}

export function getTotalKills() {
  return parseInt(localStorage.getItem(KEYS.totalKills) || '0', 10);
}
export function addKills(n) {
  const next = getTotalKills() + n;
  localStorage.setItem(KEYS.totalKills, String(next));
  return next;
}

// ─── Weapons ──────────────────────────────────────────────────────────────────
export function getOwnedWeapons() {
  try { return JSON.parse(localStorage.getItem(KEYS.ownedWeapons) || '["blaster"]'); }
  catch { return ['blaster']; }
}
export function ownWeapon(id) {
  const owned = getOwnedWeapons();
  if (!owned.includes(id)) { owned.push(id); localStorage.setItem(KEYS.ownedWeapons, JSON.stringify(owned)); }
}
export function getSelectedWeapon() {
  return localStorage.getItem(KEYS.selectedWeapon) || 'blaster';
}
export function setSelectedWeapon(id) {
  localStorage.setItem(KEYS.selectedWeapon, id);
}

// ─── Upgrades inventory ───────────────────────────────────────────────────────
export function getUpgradeInventory() {
  try { return JSON.parse(localStorage.getItem(KEYS.ownedUpgrades) || '{}'); }
  catch { return {}; }
}
export function addUpgradeToInventory(id) {
  const inv = getUpgradeInventory();
  inv[id] = (inv[id] || 0) + 1;
  localStorage.setItem(KEYS.ownedUpgrades, JSON.stringify(inv));
}
export function getEquippedUpgrades() {
  try { return JSON.parse(localStorage.getItem(KEYS.equippedUpgrades) || '{}'); }
  catch { return {}; }
}
export function setEquippedUpgrades(obj) {
  localStorage.setItem(KEYS.equippedUpgrades, JSON.stringify(obj));
}
export function consumeEquippedUpgrade(id) {
  const eq = getEquippedUpgrades();
  if (eq[id] > 0) { eq[id]--; if (eq[id] === 0) delete eq[id]; setEquippedUpgrades(eq); }
}

// Called at end of each game — awards coins and updates stats
export function processGameOver(score, kills) {
  const coins = score + kills * 2; // 1 coin/point + 2 bonus per kill
  addCoins(coins);
  addKills(kills);
  const newHigh = setHighScore(score);
  return { coinsEarned: coins, newHigh };

}

export function exportLocalSave() {
  return {
    coins: getCoins(),
    ownedSkins: getOwnedSkins(),
    selectedSkin: getSelectedSkin(),
    highScore: getHighScore(),
    totalKills: getTotalKills(),
    ownedWeapons: getOwnedWeapons(),
    selectedWeapon: getSelectedWeapon(),
    ownedUpgrades: getUpgradeInventory(),
    equippedUpgrades: getEquippedUpgrades(),
  };
}

export function importLocalSave(save) {
  if (!save) return;

  localStorage.setItem(KEYS.coins, String(save.coins ?? 0));
  localStorage.setItem(KEYS.owned, JSON.stringify(save.ownedSkins ?? ['default']));
  localStorage.setItem(KEYS.selected, save.selectedSkin ?? 'default');
  localStorage.setItem(KEYS.highScore, String(save.highScore ?? 0));
  localStorage.setItem(KEYS.totalKills, String(save.totalKills ?? 0));
  localStorage.setItem(KEYS.ownedWeapons, JSON.stringify(save.ownedWeapons ?? ['blaster']));
  localStorage.setItem(KEYS.selectedWeapon, save.selectedWeapon ?? 'blaster');
  localStorage.setItem(KEYS.ownedUpgrades, JSON.stringify(save.ownedUpgrades ?? {}));
  localStorage.setItem(KEYS.equippedUpgrades, JSON.stringify(save.equippedUpgrades ?? {}));
}