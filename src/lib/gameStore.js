// Persistent game store backed by localStorage

const KEYS = {
  coins: 'nd_coins',
  diamonds: 'nd_diamonds',

  // Skins
  owned: 'nd_owned',
  selected: 'nd_selected',

  // Stats
  highScore: 'nd_highscore',
  totalKills: 'nd_totalkills',

  // Weapons
  ownedWeapons: 'nd_owned_weapons',
  selectedWeapon: 'nd_sel_weapon',

  // Upgrades
  ownedUpgrades: 'nd_owned_upgrades',      // { id -> qty }
  equippedUpgrades: 'nd_eq_upgrades',      // { id -> qty }

  // Specials (consumables)
  ownedSpecials: 'nd_owned_specials',      // { id -> qty }
  selectedSpecial: 'nd_sel_special',
  equippedSpecials: 'nd_eq_specials',      // { id -> qty }

  // Combos
  ownedCombos: 'nd_owned_combos',          // permanent ownership: [comboId]
  comboAccess: 'nd_combo_access',          // rentals: { comboId: { mode, purchasedAt, expiresAt } }

  // Vehicles / future-proofing
  ownedVehicles: 'nd_owned_vehicles',
  selectedVehicle: 'nd_sel_vehicle',

  // Shop bookkeeping
  purchaseHistory: 'nd_purchase_history',
};

// ───────────────────────────────────────────────────────────────────────────────
// Generic helpers
// ───────────────────────────────────────────────────────────────────────────────

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function clampInt(value, fallback = 0) {
  const n = parseInt(value ?? fallback, 10);
  return Number.isFinite(n) ? n : fallback;
}

function sanitizeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function sanitizeArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function nowTs() {
  return Date.now();
}

function daysToMs(days) {
  return Math.max(0, Number(days) || 0) * 24 * 60 * 60 * 1000;
}

// ───────────────────────────────────────────────────────────────────────────────
// Coins
// ───────────────────────────────────────────────────────────────────────────────

export function getCoins() {
  return clampInt(localStorage.getItem(KEYS.coins), 0);
}

export function setCoins(amount) {
  const safe = Math.max(0, clampInt(amount, 0));
  localStorage.setItem(KEYS.coins, String(safe));
  return safe;
}

export function addCoins(amount) {
  const next = Math.max(0, getCoins() + clampInt(amount, 0));
  localStorage.setItem(KEYS.coins, String(next));
  return next;
}

export function spendCoins(amount) {
  const cost = Math.max(0, clampInt(amount, 0));
  const current = getCoins();
  if (current < cost) return false;
  localStorage.setItem(KEYS.coins, String(current - cost));
  return true;
}

export function canAfford(amount) {
  return getCoins() >= Math.max(0, clampInt(amount, 0));
}

export function getDiamonds() {
  return clampInt(localStorage.getItem(KEYS.diamonds), 0);
}

export function setDiamonds(amount) {
  const safe = Math.max(0, clampInt(amount, 0));
  localStorage.setItem(KEYS.diamonds, String(safe));
  return safe;
}

export function addDiamonds(amount) {
  const next = Math.max(0, getDiamonds() + clampInt(amount, 0));
  localStorage.setItem(KEYS.diamonds, String(next));
  return next;
}

export function spendDiamonds(amount) {
  const cost = Math.max(0, clampInt(amount, 0));
  const current = getDiamonds();

  if (current < cost) return false;

  localStorage.setItem(KEYS.diamonds, String(current - cost));
  return true;
}

export function canAffordDiamonds(amount) {
  return getDiamonds() >= Math.max(0, clampInt(amount, 0));
}

// ───────────────────────────────────────────────────────────────────────────────
// Skins
// ───────────────────────────────────────────────────────────────────────────────

export function getOwnedSkins() {
  const owned = readJSON(KEYS.owned, ['default']);
  return Array.isArray(owned) && owned.length ? owned : ['default'];
}

export function hasSkin(id) {
  return getOwnedSkins().includes(id);
}

export function ownSkin(id) {
  if (!id) return;
  const owned = getOwnedSkins();
  if (!owned.includes(id)) {
    owned.push(id);
    writeJSON(KEYS.owned, owned);
  }
}

export function getSelectedSkin() {
  const selected = localStorage.getItem(KEYS.selected) || 'default';
  return hasSkin(selected) ? selected : 'default';
}

export function setSelectedSkin(id) {
  if (!id || !hasSkin(id)) return false;
  localStorage.setItem(KEYS.selected, id);
  return true;
}

// ───────────────────────────────────────────────────────────────────────────────
// Stats
// ───────────────────────────────────────────────────────────────────────────────

export function getHighScore() {
  return clampInt(localStorage.getItem(KEYS.highScore), 0);
}

export function setHighScore(score) {
  const safeScore = Math.max(0, clampInt(score, 0));
  const current = getHighScore();
  if (safeScore > current) {
    localStorage.setItem(KEYS.highScore, String(safeScore));
  }
  return Math.max(safeScore, current);
}

export function getTotalKills() {
  return clampInt(localStorage.getItem(KEYS.totalKills), 0);
}

export function addKills(n) {
  const next = Math.max(0, getTotalKills() + clampInt(n, 0));
  localStorage.setItem(KEYS.totalKills, String(next));
  return next;
}

// ───────────────────────────────────────────────────────────────────────────────
// Weapons
// ───────────────────────────────────────────────────────────────────────────────

export function getOwnedWeapons() {
  const owned = readJSON(KEYS.ownedWeapons, ['blaster']);
  return Array.isArray(owned) && owned.length ? owned : ['blaster'];
}

export function hasWeapon(id) {
  return getOwnedWeapons().includes(id);
}

export function ownWeapon(id) {
  if (!id) return;
  const owned = getOwnedWeapons();
  if (!owned.includes(id)) {
    owned.push(id);
    writeJSON(KEYS.ownedWeapons, owned);
  }
}

export function getSelectedWeapon() {
  const selected = localStorage.getItem(KEYS.selectedWeapon) || 'blaster';
  return hasWeapon(selected) ? selected : 'blaster';
}

export function setSelectedWeapon(id) {
  if (!id || !hasWeapon(id)) return false;
  localStorage.setItem(KEYS.selectedWeapon, id);
  return true;
}

// ───────────────────────────────────────────────────────────────────────────────
// Upgrades inventory
// ───────────────────────────────────────────────────────────────────────────────

export function getUpgradeInventory() {
  return sanitizeObject(readJSON(KEYS.ownedUpgrades, {}));
}

export function getUpgradeQty(id) {
  return getUpgradeInventory()[id] || 0;
}

export function hasUpgrade(id) {
  return getUpgradeQty(id) > 0;
}

export function addUpgradeToInventory(id, qty = 1) {
  if (!id) return;
  const safeQty = Math.max(1, clampInt(qty, 1));
  const inv = getUpgradeInventory();
  inv[id] = (inv[id] || 0) + safeQty;
  writeJSON(KEYS.ownedUpgrades, inv);
}

export function removeUpgradeFromInventory(id, qty = 1) {
  if (!id) return;
  const safeQty = Math.max(1, clampInt(qty, 1));
  const inv = getUpgradeInventory();
  if (!inv[id]) return;
  inv[id] -= safeQty;
  if (inv[id] <= 0) delete inv[id];
  writeJSON(KEYS.ownedUpgrades, inv);
}

export function getEquippedUpgrades() {
  return sanitizeObject(readJSON(KEYS.equippedUpgrades, {}));
}

export function setEquippedUpgrades(obj) {
  writeJSON(KEYS.equippedUpgrades, sanitizeObject(obj));
}

export function getEquippedUpgradeQty(id) {
  return getEquippedUpgrades()[id] || 0;
}

export function equipUpgrade(id, qty = 1) {
  if (!id) return false;

  const safeQty = Math.max(1, clampInt(qty, 1));
  const inv = getUpgradeInventory();
  const eq = getEquippedUpgrades();

  const stock = inv[id] || 0;
  const alreadyEquipped = eq[id] || 0;
  const available = stock - alreadyEquipped;

  if (available < safeQty) return false;

  eq[id] = alreadyEquipped + safeQty;
  setEquippedUpgrades(eq);
  return true;
}

export function unequipUpgrade(id, qty = 1) {
  if (!id) return false;

  const safeQty = Math.max(1, clampInt(qty, 1));
  const eq = getEquippedUpgrades();

  if (!eq[id]) return false;

  eq[id] -= safeQty;
  if (eq[id] <= 0) delete eq[id];
  setEquippedUpgrades(eq);
  return true;
}

export function consumeEquippedUpgrade(id, qty = 1) {
  if (!id) return false;

  const safeQty = Math.max(1, clampInt(qty, 1));
  const eq = getEquippedUpgrades();
  const inv = getUpgradeInventory();

  if (!eq[id] || eq[id] < safeQty) return false;
  if (!inv[id] || inv[id] < safeQty) return false;

  eq[id] -= safeQty;
  if (eq[id] <= 0) delete eq[id];

  inv[id] -= safeQty;
  if (inv[id] <= 0) delete inv[id];

  setEquippedUpgrades(eq);
  writeJSON(KEYS.ownedUpgrades, inv);
  return true;
}

// ───────────────────────────────────────────────────────────────────────────────
// Specials inventory
// ───────────────────────────────────────────────────────────────────────────────

export function getSpecialInventory() {
  return sanitizeObject(readJSON(KEYS.ownedSpecials, {}));
}

export function getSpecialQty(id) {
  return getSpecialInventory()[id] || 0;
}

export function hasSpecial(id) {
  return getSpecialQty(id) > 0;
}

export function addSpecialToInventory(id, qty = 1) {
  if (!id) return;
  const safeQty = Math.max(1, clampInt(qty, 1));
  const inv = getSpecialInventory();
  inv[id] = (inv[id] || 0) + safeQty;
  writeJSON(KEYS.ownedSpecials, inv);
}

export function removeSpecialFromInventory(id, qty = 1) {
  if (!id) return;
  const safeQty = Math.max(1, clampInt(qty, 1));
  const inv = getSpecialInventory();
  if (!inv[id]) return;
  inv[id] -= safeQty;
  if (inv[id] <= 0) delete inv[id];
  writeJSON(KEYS.ownedSpecials, inv);
}

export function consumeSpecial(id, qty = 1) {
  if (!id) return false;

  const safeQty = Math.max(1, clampInt(qty, 1));
  const inv = getSpecialInventory();
  if (!inv[id] || inv[id] < safeQty) return false;

  inv[id] -= safeQty;
  if (inv[id] <= 0) delete inv[id];
  writeJSON(KEYS.ownedSpecials, inv);

  const equipped = getEquippedSpecials();
  if (equipped[id]) {
    equipped[id] -= safeQty;
    if (equipped[id] <= 0) delete equipped[id];
    setEquippedSpecials(equipped);
  }

  return true;
}

export function getSelectedSpecial() {
  const selected = localStorage.getItem(KEYS.selectedSpecial) || '';
  return selected && hasSpecial(selected) ? selected : '';
}

export function setSelectedSpecial(id) {
  if (!id) {
    localStorage.setItem(KEYS.selectedSpecial, '');
    return true;
  }
  if (!hasSpecial(id)) return false;
  localStorage.setItem(KEYS.selectedSpecial, id);
  return true;
}

export function getEquippedSpecials() {
  return sanitizeObject(readJSON(KEYS.equippedSpecials, {}));
}

export function setEquippedSpecials(obj) {
  writeJSON(KEYS.equippedSpecials, sanitizeObject(obj));
}

export function equipSpecial(id, qty = 1) {
  if (!id) return false;

  const safeQty = Math.max(1, clampInt(qty, 1));
  const inv = getSpecialInventory();
  const eq = getEquippedSpecials();

  const stock = inv[id] || 0;
  const alreadyEquipped = eq[id] || 0;
  const available = stock - alreadyEquipped;

  if (available < safeQty) return false;

  eq[id] = alreadyEquipped + safeQty;
  setEquippedSpecials(eq);
  return true;
}

export function unequipSpecial(id, qty = 1) {
  if (!id) return false;

  const safeQty = Math.max(1, clampInt(qty, 1));
  const eq = getEquippedSpecials();

  if (!eq[id]) return false;

  eq[id] -= safeQty;
  if (eq[id] <= 0) delete eq[id];
  setEquippedSpecials(eq);
  return true;
}

// ───────────────────────────────────────────────────────────────────────────────
// Combos: permanent unlocks + timed rentals
// ───────────────────────────────────────────────────────────────────────────────

export function getOwnedCombos() {
  const owned = readJSON(KEYS.ownedCombos, []);
  return sanitizeArray(owned, []);
}

export function hasPermanentCombo(id) {
  return getOwnedCombos().includes(id);
}

export function ownCombo(id) {
  if (!id) return;
  const owned = getOwnedCombos();
  if (!owned.includes(id)) {
    owned.push(id);
    writeJSON(KEYS.ownedCombos, owned);
  }
}

export function getComboAccess() {
  const raw = sanitizeObject(readJSON(KEYS.comboAccess, {}));
  const now = nowTs();
  const cleaned = {};
  let changed = false;

  for (const [comboId, access] of Object.entries(raw)) {
    if (!access || typeof access !== 'object') {
      changed = true;
      continue;
    }

    const expiresAt = Number(access.expiresAt || 0);
    const mode = access.mode || 'weekly';
    const purchasedAt = Number(access.purchasedAt || 0);

    if (!expiresAt || expiresAt <= now) {
      changed = true;
      continue;
    }

    cleaned[comboId] = {
      mode,
      purchasedAt,
      expiresAt,
    };
  }

  if (changed) {
    writeJSON(KEYS.comboAccess, cleaned);
  }

  return cleaned;
}

export function setComboAccess(obj) {
  writeJSON(KEYS.comboAccess, sanitizeObject(obj));
}

export function getComboRental(id) {
  if (!id) return null;
  const access = getComboAccess();
  return access[id] || null;
}

export function hasActiveComboRental(id) {
  if (!id) return false;
  return !!getComboRental(id);
}

export function hasComboAccess(id) {
  if (!id) return false;
  return hasPermanentCombo(id) || hasActiveComboRental(id);
}

export function rentCombo(id, durationMs) {
  if (!id) return;

  const access = getComboAccess();

  access[id] = {
    mode: 'rental',
    purchasedAt: Date.now(),
    expiresAt: Date.now() + durationMs,
  };

  setComboAccess(access);
}

export function isComboActive(id) {
  if (!id) return false;

  if (hasPermanentCombo(id)) return true;

  const rental = getComboRental(id);
  if (!rental) return false;

  return rental.expiresAt > Date.now();
}

export function getComboAccessState(id) {
  if (!id) {
    return {
      hasAccess: false,
      permanent: false,
      rental: null,
      expired: false,
    };
  }

  if (hasPermanentCombo(id)) {
    return {
      hasAccess: true,
      permanent: true,
      rental: null,
      expired: false,
    };
  }

  const rental = getComboRental(id);
  if (rental) {
    return {
      hasAccess: true,
      permanent: false,
      rental,
      expired: false,
    };
  }

  return {
    hasAccess: false,
    permanent: false,
    rental: null,
    expired: false,
  };
}

export function getComboTimeLeftMs(id) {
  const rental = getComboRental(id);
  if (!rental) return 0;
  return Math.max(0, rental.expiresAt - nowTs());
}

export function getComboTimeLeftDays(id) {
  return Math.ceil(getComboTimeLeftMs(id) / (24 * 60 * 60 * 1000));
}

export function grantComboRental(id, mode = 'weekly', days = 7) {
  if (!id) return false;

  const safeDays = Math.max(1, clampInt(days, 7));
  const access = getComboAccess();
  const current = access[id];
  const now = nowTs();

  const baseStart = current && current.expiresAt > now ? current.expiresAt : now;
  access[id] = {
    mode,
    purchasedAt: now,
    expiresAt: baseStart + daysToMs(safeDays),
  };

  setComboAccess(access);
  return true;
}

export function clearComboRental(id) {
  if (!id) return false;
  const access = getComboAccess();
  if (!access[id]) return false;
  delete access[id];
  setComboAccess(access);
  return true;
}

// ───────────────────────────────────────────────────────────────────────────────
// Vehicles
// ───────────────────────────────────────────────────────────────────────────────

export function getOwnedVehicles() {
  const owned = readJSON(KEYS.ownedVehicles, ['default_jet']);
  return Array.isArray(owned) && owned.length ? owned : ['default_jet'];
}

export function hasVehicle(id) {
  return getOwnedVehicles().includes(id);
}

export function ownVehicle(id) {
  if (!id) return;
  const owned = getOwnedVehicles();
  if (!owned.includes(id)) {
    owned.push(id);
    writeJSON(KEYS.ownedVehicles, owned);
  }
}

export function getSelectedVehicle() {
  const selected = localStorage.getItem(KEYS.selectedVehicle) || 'default_jet';
  return hasVehicle(selected) ? selected : 'default_jet';
}

export function setSelectedVehicle(id) {
  if (!id || !hasVehicle(id)) return false;
  localStorage.setItem(KEYS.selectedVehicle, id);
  return true;
}

// ───────────────────────────────────────────────────────────────────────────────
// Purchase history
// ───────────────────────────────────────────────────────────────────────────────

export function getPurchaseHistory() {
  const history = readJSON(KEYS.purchaseHistory, []);
  return Array.isArray(history) ? history : [];
}

export function addPurchaseRecord(record) {
  const history = getPurchaseHistory();
  history.push({
    ts: nowTs(),
    ...record,
  });

  const MAX_HISTORY = 200;
  if (history.length > MAX_HISTORY) {
    history.splice(0, history.length - MAX_HISTORY);
  }

  writeJSON(KEYS.purchaseHistory, history);
}

// ───────────────────────────────────────────────────────────────────────────────
// Generic purchase helpers
// ───────────────────────────────────────────────────────────────────────────────

export function purchaseSkin(item) {
  if (!item?.id) return { ok: false, reason: 'invalid_item' };
  if (hasSkin(item.id)) return { ok: true, alreadyOwned: true };

  const cost = clampInt(item.cost ?? item.coins ?? 0, 0);
  if (!spendCoins(cost)) return { ok: false, reason: 'not_enough_coins' };

  ownSkin(item.id);
  addPurchaseRecord({ kind: 'skin', itemId: item.id, cost });
  return { ok: true };
}

export function purchaseWeapon(item) {
  if (!item?.id) return { ok: false, reason: 'invalid_item' };
  if (hasWeapon(item.id)) return { ok: true, alreadyOwned: true };

  const cost = clampInt(item.cost ?? item.coins ?? 0, 0);
  if (!spendCoins(cost)) return { ok: false, reason: 'not_enough_coins' };

  ownWeapon(item.id);
  addPurchaseRecord({ kind: 'weapon', itemId: item.id, cost });
  return { ok: true };
}

export function purchaseUpgrade(item, qty = 1) {
  if (!item?.id) return { ok: false, reason: 'invalid_item' };

  const safeQty = Math.max(1, clampInt(qty, 1));
  const unitCost = clampInt(item.cost ?? item.coins ?? 0, 0);
  const totalCost = unitCost * safeQty;

  if (!spendCoins(totalCost)) return { ok: false, reason: 'not_enough_coins' };

  addUpgradeToInventory(item.id, safeQty);
  addPurchaseRecord({
    kind: 'upgrade',
    itemId: item.id,
    qty: safeQty,
    cost: totalCost,
  });

  return { ok: true };
}

export function purchaseSpecial(item, qty = 1) {
  if (!item?.id) return { ok: false, reason: 'invalid_item' };

  const safeQty = Math.max(1, clampInt(qty, 1));
  const unitCost = clampInt(item.cost ?? item.coins ?? 0, 0);
  const totalCost = unitCost * safeQty;

  if (!spendCoins(totalCost)) return { ok: false, reason: 'not_enough_coins' };

  addSpecialToInventory(item.id, safeQty);
  addPurchaseRecord({
    kind: 'special',
    itemId: item.id,
    qty: safeQty,
    cost: totalCost,
  });

  return { ok: true };
}

export function purchaseVehicle(item) {
  if (!item?.id) return { ok: false, reason: 'invalid_item' };
  if (hasVehicle(item.id)) return { ok: true, alreadyOwned: true };

  const cost = clampInt(item.cost ?? item.coins ?? 0, 0);
  if (!spendCoins(cost)) return { ok: false, reason: 'not_enough_coins' };

  ownVehicle(item.id);
  addPurchaseRecord({ kind: 'vehicle', itemId: item.id, cost });
  return { ok: true };
}

// Backward-compatible helper:
// defaults to permanent unlock if old UI still calls purchaseCombo(combo)
export function purchaseCombo(combo) {
  return purchaseComboAccess(combo, 'permanent');
}

// New combo purchase helper:
// mode = 'weekly' | 'monthly' | 'permanent'
export function purchaseComboAccess(combo, mode = 'permanent') {
  if (!combo?.id) return { ok: false, reason: 'invalid_item' };

  if (mode === 'permanent') {
    if (hasPermanentCombo(combo.id)) {
      return { ok: true, alreadyOwned: true, mode: 'permanent' };
    }

    const permanentPricing = combo.pricing?.permanent || null;
    const cost = clampInt(
      permanentPricing?.coins ?? combo.cost ?? combo.coins ?? 0,
      0
    );

    if (!spendCoins(cost)) {
      return { ok: false, reason: 'not_enough_coins' };
    }

    ownCombo(combo.id);
    addPurchaseRecord({
      kind: 'combo',
      itemId: combo.id,
      mode: 'permanent',
      cost,
    });

    return { ok: true, mode: 'permanent' };
  }

  const rentalPricing = combo.pricing?.[mode];
  if (!rentalPricing) {
    return { ok: false, reason: 'invalid_mode' };
  }

  const cost = clampInt(rentalPricing.coins ?? 0, 0);
  const days = clampInt(rentalPricing.days ?? (mode === 'monthly' ? 30 : 7), 7);

  if (!spendCoins(cost)) {
    return { ok: false, reason: 'not_enough_coins' };
  }

  grantComboRental(combo.id, mode, days);

  addPurchaseRecord({
    kind: 'combo',
    itemId: combo.id,
    mode,
    cost,
    days,
  });

  return { ok: true, mode };
}

// ───────────────────────────────────────────────────────────────────────────────
// End-of-run processing
// ───────────────────────────────────────────────────────────────────────────────

export function processGameOver(score, kills) {
  const safeScore = Math.max(0, clampInt(score, 0));
  const safeKills = Math.max(0, clampInt(kills, 0));

  const coinsEarned = safeScore + safeKills * 2;
  addCoins(coinsEarned);
  addKills(safeKills);
  const newHigh = setHighScore(safeScore);

  return {
    coinsEarned,
    newHigh,
  };
}

// ───────────────────────────────────────────────────────────────────────────────
// Save export / import
// ───────────────────────────────────────────────────────────────────────────────

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

    ownedSpecials: getSpecialInventory(),
    selectedSpecial: getSelectedSpecial(),
    equippedSpecials: getEquippedSpecials(),

    ownedCombos: getOwnedCombos(),
    comboAccess: getComboAccess(),

    ownedVehicles: getOwnedVehicles(),
    selectedVehicle: getSelectedVehicle(),

    purchaseHistory: getPurchaseHistory(),
  };
}

export function importLocalSave(save) {
  if (!save || typeof save !== 'object') return;

  localStorage.setItem(KEYS.coins, String(clampInt(save.coins, 0)));

  writeJSON(KEYS.owned, Array.isArray(save.ownedSkins) ? save.ownedSkins : ['default']);
  localStorage.setItem(KEYS.selected, save.selectedSkin ?? 'default');

  localStorage.setItem(KEYS.highScore, String(clampInt(save.highScore, 0)));
  localStorage.setItem(KEYS.totalKills, String(clampInt(save.totalKills, 0)));

  writeJSON(
    KEYS.ownedWeapons,
    Array.isArray(save.ownedWeapons) ? save.ownedWeapons : ['blaster']
  );
  localStorage.setItem(KEYS.selectedWeapon, save.selectedWeapon ?? 'blaster');

  writeJSON(KEYS.ownedUpgrades, sanitizeObject(save.ownedUpgrades));
  writeJSON(KEYS.equippedUpgrades, sanitizeObject(save.equippedUpgrades));

  writeJSON(KEYS.ownedSpecials, sanitizeObject(save.ownedSpecials));
  localStorage.setItem(KEYS.selectedSpecial, save.selectedSpecial ?? '');
  writeJSON(KEYS.equippedSpecials, sanitizeObject(save.equippedSpecials));

  writeJSON(KEYS.ownedCombos, sanitizeArray(save.ownedCombos, []));
  writeJSON(KEYS.comboAccess, sanitizeObject(save.comboAccess));

  writeJSON(
    KEYS.ownedVehicles,
    Array.isArray(save.ownedVehicles) ? save.ownedVehicles : ['default_jet']
  );
  localStorage.setItem(KEYS.selectedVehicle, save.selectedVehicle ?? 'default_jet');

  writeJSON(
    KEYS.purchaseHistory,
    Array.isArray(save.purchaseHistory) ? save.purchaseHistory : []
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Optional reset helper for testing
// ───────────────────────────────────────────────────────────────────────────────

export function resetEconomyProgress() {
  localStorage.removeItem(KEYS.coins);

  localStorage.removeItem(KEYS.owned);
  localStorage.removeItem(KEYS.selected);

  localStorage.removeItem(KEYS.highScore);
  localStorage.removeItem(KEYS.totalKills);

  localStorage.removeItem(KEYS.ownedWeapons);
  localStorage.removeItem(KEYS.selectedWeapon);

  localStorage.removeItem(KEYS.ownedUpgrades);
  localStorage.removeItem(KEYS.equippedUpgrades);

  localStorage.removeItem(KEYS.ownedSpecials);
  localStorage.removeItem(KEYS.selectedSpecial);
  localStorage.removeItem(KEYS.equippedSpecials);

  localStorage.removeItem(KEYS.ownedCombos);
  localStorage.removeItem(KEYS.comboAccess);

  localStorage.removeItem(KEYS.ownedVehicles);
  localStorage.removeItem(KEYS.selectedVehicle);

  localStorage.removeItem(KEYS.purchaseHistory);
}