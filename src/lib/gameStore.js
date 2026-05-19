import { SKINS } from './skins';
import { WEAPONS, UPGRADES, SPECIALS, COMBO_PACKS, VEHICLES } from './gameItems';
import { getDefaultSelectedWeapon, getStarterWeaponIds } from '../config/gameConfig.js';

// Persistent game store backed by localStorage

const DEV_KEYS = {
  enabled: 'fp_dev_profile_enabled',
  backup: 'fp_dev_profile_backup',
};

const DEV_BALANCE = 999999999;
const DEFAULT_STARTER_WEAPONS = getStarterWeaponIds();
const DEFAULT_WEAPON = getDefaultSelectedWeapon();

const KEYS = {
  coins: 'nd_coins',
  diamonds: 'nd_diamonds',

  // Skins
  owned: 'nd_owned',
  selected: 'nd_selected',

  // Stats
  highScore: 'nd_highscore',
  totalKills: 'nd_totalkills',
  badges: 'nd_badges',
  milestoneClaims: 'nd_milestone_claims',
  dailyMissionState: 'nd_daily_missions',

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
  selectedCombo: 'nd_sel_combo',           // currently equipped combo id

  // Vehicles / future-proofing
  ownedVehicles: 'nd_owned_vehicles',
  selectedVehicle: 'nd_sel_vehicle',

  // Shop bookkeeping
  purchaseHistory: 'nd_purchase_history',
};

export const SCORE_MILESTONES = [
  { score: 50, reward: 80, badgeId: 'bronze_wings', badgeName: 'Bronze Wings' },
  { score: 100, reward: 180, badgeId: 'silver_wings', badgeName: 'Silver Wings' },
  { score: 200, reward: 420, badgeId: 'gold_wings', badgeName: 'Gold Wings' },
  { score: 300, reward: 680, badgeId: 'platinum_wings', badgeName: 'Platinum Wings' },
  { score: 400, reward: 950, badgeId: 'legend_wings', badgeName: 'Legend Wings' },
];

// ───────────────────────────────────────────────────────────────────────────────
// Generic helpers
// ───────────────────────────────────────────────────────────────────────────────

function readJSON(key, fallback) {
  try {
    const raw = lsGetItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  lsSetItem(key, JSON.stringify(value));
}

function lsGetItem(key, fallback = null) {
  try {
    return localStorage.getItem(key);
  } catch {
    return fallback;
  }
}

function lsSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function lsRemoveItem(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function notifyLocalSaveChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('firepilot-local-save-changed'));
  window.dispatchEvent(new Event('firepilot-local-save-updated'));
}

function notifyLocalSaveUpdated() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('firepilot-local-save-updated'));
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

function getLocalDateKey(ts = nowTs()) {
  const date = new Date(ts);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function hashString(value = '') {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function daysToMs(days) {
  return Math.max(0, Number(days) || 0) * 24 * 60 * 60 * 1000;
}

export function isDeveloperProfileActive() {
  return lsGetItem(DEV_KEYS.enabled) === '1';
}

export function setDeveloperProfileActive(enabled) {
  if (enabled) {
    lsSetItem(DEV_KEYS.enabled, '1');
  } else {
    lsRemoveItem(DEV_KEYS.enabled);
  }
}

function getAllSkinIds() {
  return SKINS.map((item) => item.id);
}

function getAllWeaponIds() {
  return WEAPONS.map((item) => item.id);
}

function getAllUpgradeInventory() {
  return Object.fromEntries(UPGRADES.map((item) => [item.id, 99]));
}

function getAllSpecialInventory() {
  return Object.fromEntries(SPECIALS.map((item) => [item.id, 99]));
}

function getAllComboIds() {
  return COMBO_PACKS.map((item) => item.id);
}

function getAllVehicleIds() {
  return VEHICLES.map((item) => item.id);
}

function buildFreshLocalSave() {
  return {
    coins: 0,
    diamonds: 0,
    ownedSkins: ['default'],
    selectedSkin: 'default',
    highScore: 0,
    totalKills: 0,
    badges: [],
    milestoneClaims: [],
    dailyMissionState: null,
    ownedWeapons: [...DEFAULT_STARTER_WEAPONS],
    selectedWeapon: DEFAULT_WEAPON,
    ownedUpgrades: {},
    equippedUpgrades: {},
    ownedSpecials: {},
    selectedSpecial: '',
    equippedSpecials: {},
    ownedCombos: [],
    comboAccess: {},
    selectedCombo: '',
    ownedVehicles: ['default_jet'],
    selectedVehicle: 'default_jet',
    purchaseHistory: [],
  };
}

function buildFullAccessSave({
  baseSave,
  coins = DEV_BALANCE,
  diamonds = DEV_BALANCE,
  source = 'local-dev',
  note = 'Full access granted',
} = {}) {
  const current = baseSave && typeof baseSave === 'object' ? baseSave : exportLocalSave();
  const currentHistory = Array.isArray(current.purchaseHistory) ? current.purchaseHistory : [];

  return {
    ...current,
    coins: Math.max(clampInt(current.coins, 0), clampInt(coins, DEV_BALANCE)),
    diamonds: Math.max(clampInt(current.diamonds, 0), clampInt(diamonds, DEV_BALANCE)),
    ownedSkins: getAllSkinIds(),
    selectedSkin: current.selectedSkin ?? 'default',
    ownedWeapons: getAllWeaponIds(),
    selectedWeapon: current.selectedWeapon ?? DEFAULT_WEAPON,
    ownedUpgrades: getAllUpgradeInventory(),
    equippedUpgrades: sanitizeObject(current.equippedUpgrades),
    ownedSpecials: getAllSpecialInventory(),
    selectedSpecial: current.selectedSpecial ?? '',
    equippedSpecials: sanitizeObject(current.equippedSpecials),
    badges: Array.isArray(current.badges) ? current.badges : [],
    milestoneClaims: Array.isArray(current.milestoneClaims) ? current.milestoneClaims : [],
    dailyMissionState:
      current.dailyMissionState && typeof current.dailyMissionState === 'object'
        ? current.dailyMissionState
        : null,
    ownedCombos: getAllComboIds(),
    comboAccess: sanitizeObject(current.comboAccess),
    selectedCombo: current.selectedCombo ?? '',
    ownedVehicles: getAllVehicleIds(),
    selectedVehicle: current.selectedVehicle ?? 'default_jet',
    purchaseHistory: [
      ...currentHistory,
      {
        ts: nowTs(),
        source,
        kind: 'full_access',
        note,
      },
    ].slice(-200),
  };
}

function saveLooksLikeDeveloperProfile(save) {
  if (!save || typeof save !== 'object') return false;

  const hasDevBalance =
    clampInt(save.coins, 0) >= DEV_BALANCE || clampInt(save.diamonds, 0) >= DEV_BALANCE;
  const hasAllSkins = sanitizeArray(save.ownedSkins, []).length >= getAllSkinIds().length;
  const hasAllWeapons =
    sanitizeArray(save.ownedWeapons, []).length >= getAllWeaponIds().length;
  const hasAllVehicles =
    sanitizeArray(save.ownedVehicles, []).length >= getAllVehicleIds().length;
  const hasAllCombos =
    sanitizeArray(save.ownedCombos, []).length >= getAllComboIds().length;
  const purchaseHistory = Array.isArray(save.purchaseHistory) ? save.purchaseHistory : [];
  const hasDeveloperMarker = purchaseHistory.some(
    (entry) => entry?.source === 'local-dev' || entry?.kind === 'developer_profile'
  );

  return (
    hasDeveloperMarker ||
    (hasDevBalance && hasAllSkins && hasAllWeapons && hasAllVehicles && hasAllCombos)
  );
}

export function activateDeveloperProfile() {
  if (!isDeveloperProfileActive()) {
    writeJSON(DEV_KEYS.backup, exportLocalSave());
  }

  setDeveloperProfileActive(true);
  importLocalSave(
    buildFullAccessSave({
      baseSave: buildFreshLocalSave(),
      source: 'local-dev',
      note: 'Developer profile activated',
    })
  );
}

export function deactivateDeveloperProfile() {
  const backup = readJSON(DEV_KEYS.backup, null);
  setDeveloperProfileActive(false);

  if (backup && typeof backup === 'object' && !saveLooksLikeDeveloperProfile(backup)) {
    importLocalSave(backup);
  } else {
    importLocalSave(buildFreshLocalSave());
  }

  lsRemoveItem(DEV_KEYS.backup);
}

// ───────────────────────────────────────────────────────────────────────────────
// Coins
// ───────────────────────────────────────────────────────────────────────────────

export function getCoins() {
  if (isDeveloperProfileActive()) return DEV_BALANCE;
  return clampInt(lsGetItem(KEYS.coins), 0);
}

export function setCoins(amount) {
  if (isDeveloperProfileActive()) return DEV_BALANCE;
  const safe = Math.max(0, clampInt(amount, 0));
  lsSetItem(KEYS.coins, String(safe));
  notifyLocalSaveChanged();
  return safe;
}

export function addCoins(amount) {
  if (isDeveloperProfileActive()) return DEV_BALANCE;
  const next = Math.max(0, getCoins() + clampInt(amount, 0));
  lsSetItem(KEYS.coins, String(next));
  notifyLocalSaveChanged();
  return next;
}

export function spendCoins(amount) {
  if (isDeveloperProfileActive()) return true;
  const cost = Math.max(0, clampInt(amount, 0));
  const current = getCoins();
  if (current < cost) return false;
  lsSetItem(KEYS.coins, String(current - cost));
  notifyLocalSaveChanged();
  return true;
}

export function canAfford(amount) {
  if (isDeveloperProfileActive()) return true;
  return getCoins() >= Math.max(0, clampInt(amount, 0));
}

export function getDiamonds() {
  if (isDeveloperProfileActive()) return DEV_BALANCE;
  return clampInt(lsGetItem(KEYS.diamonds), 0);
}

export function setDiamonds(amount) {
  if (isDeveloperProfileActive()) return DEV_BALANCE;
  const safe = Math.max(0, clampInt(amount, 0));
  lsSetItem(KEYS.diamonds, String(safe));
  notifyLocalSaveChanged();
  return safe;
}

export function addDiamonds(amount) {
  if (isDeveloperProfileActive()) return DEV_BALANCE;
  const next = Math.max(0, getDiamonds() + clampInt(amount, 0));
  lsSetItem(KEYS.diamonds, String(next));
  notifyLocalSaveChanged();
  return next;
}

export function spendDiamonds(amount) {
  if (isDeveloperProfileActive()) return true;
  const cost = Math.max(0, clampInt(amount, 0));
  const current = getDiamonds();

  if (current < cost) return false;

  lsSetItem(KEYS.diamonds, String(current - cost));
  notifyLocalSaveChanged();
  return true;
}

export function canAffordDiamonds(amount) {
  if (isDeveloperProfileActive()) return true;
  return getDiamonds() >= Math.max(0, clampInt(amount, 0));
}

// ───────────────────────────────────────────────────────────────────────────────
// Skins
// ───────────────────────────────────────────────────────────────────────────────

export function getOwnedSkins() {
  if (isDeveloperProfileActive()) return getAllSkinIds();
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
  const selected = lsGetItem(KEYS.selected) || 'default';
  return hasSkin(selected) ? selected : 'default';
}

export function setSelectedSkin(id) {
  if (!id || !hasSkin(id)) return false;
  lsSetItem(KEYS.selected, id);
  return true;
}

// ───────────────────────────────────────────────────────────────────────────────
// Stats
// ───────────────────────────────────────────────────────────────────────────────

export function getHighScore() {
  return clampInt(lsGetItem(KEYS.highScore), 0);
}

export function setHighScore(score) {
  const safeScore = Math.max(0, clampInt(score, 0));
  const current = getHighScore();
  if (safeScore > current) {
    lsSetItem(KEYS.highScore, String(safeScore));
  }
  return Math.max(safeScore, current);
}

export function getTotalKills() {
  return clampInt(lsGetItem(KEYS.totalKills), 0);
}

export function addKills(n) {
  const next = Math.max(0, getTotalKills() + clampInt(n, 0));
  lsSetItem(KEYS.totalKills, String(next));
  return next;
}

export function getBadges() {
  const badges = readJSON(KEYS.badges, []);
  return Array.isArray(badges) ? badges : [];
}

function setBadges(badges) {
  writeJSON(KEYS.badges, Array.isArray(badges) ? badges : []);
}

function getClaimedMilestones() {
  const claims = readJSON(KEYS.milestoneClaims, []);
  return Array.isArray(claims) ? claims : [];
}

function setClaimedMilestones(claims) {
  writeJSON(KEYS.milestoneClaims, Array.isArray(claims) ? claims : []);
}

function buildDailyMissionState(dateKey) {
  const seed = hashString(dateKey);
  const scoreTargets = [90, 120, 150, 190];
  const killTargets = [24, 36, 48, 64];
  const runTargets = [3, 4, 5, 6];
  const scoreTarget = scoreTargets[seed % scoreTargets.length];
  const killTarget = killTargets[(seed >> 2) % killTargets.length];
  const runTarget = runTargets[(seed >> 4) % runTargets.length];

  return {
    dateKey,
    missions: [
      {
        id: 'score_reach',
        title: 'Pilot Peak',
        description: `Reach score ${scoreTarget} in one run`,
        type: 'score_reach',
        target: scoreTarget,
        progress: 0,
        reward: Math.round(scoreTarget * 1.2),
        completed: false,
        claimed: false,
      },
      {
        id: 'kills_total',
        title: 'Hunter Sweep',
        description: `Defeat ${killTarget} enemies today`,
        type: 'kills_total',
        target: killTarget,
        progress: 0,
        reward: Math.round(killTarget * 3.1),
        completed: false,
        claimed: false,
      },
      {
        id: 'runs_total',
        title: 'Flight Cadence',
        description: `Finish ${runTarget} runs today`,
        type: 'runs_total',
        target: runTarget,
        progress: 0,
        reward: 80 + runTarget * 22,
        completed: false,
        claimed: false,
      },
    ],
  };
}

function getOrCreateDailyMissionState() {
  const todayKey = getLocalDateKey();
  const state = readJSON(KEYS.dailyMissionState, null);
  if (!state || state.dateKey !== todayKey || !Array.isArray(state.missions)) {
    const fresh = buildDailyMissionState(todayKey);
    writeJSON(KEYS.dailyMissionState, fresh);
    return fresh;
  }
  return state;
}

export function getDailyMissionState() {
  return getOrCreateDailyMissionState();
}

export function claimDailyMission(missionId) {
  if (!missionId) return { ok: false, reason: 'missing_mission_id' };
  const state = getOrCreateDailyMissionState();
  const missions = Array.isArray(state.missions) ? state.missions : [];
  const mission = missions.find((entry) => entry.id === missionId);
  if (!mission) return { ok: false, reason: 'mission_not_found' };
  if (!mission.completed) return { ok: false, reason: 'mission_not_completed' };
  if (mission.claimed) return { ok: false, reason: 'already_claimed' };

  mission.claimed = true;
  writeJSON(KEYS.dailyMissionState, state);
  addCoins(Math.max(0, clampInt(mission.reward, 0)));
  addPurchaseRecord({
    kind: 'daily_mission_reward',
    itemId: mission.id,
    reward: mission.reward,
  });

  return { ok: true, reward: mission.reward, mission };
}

function applyScoreMilestones(score) {
  const safeScore = Math.max(0, clampInt(score, 0));
  const claimed = new Set(getClaimedMilestones());
  const badges = getBadges();
  const existingBadgeIds = new Set(badges.map((entry) => entry.id));
  let coinsAwarded = 0;
  const newlyUnlockedBadges = [];
  const newlyClaimedMilestones = [];

  for (const milestone of SCORE_MILESTONES) {
    if (safeScore < milestone.score || claimed.has(milestone.score)) continue;

    claimed.add(milestone.score);
    coinsAwarded += milestone.reward;
    newlyClaimedMilestones.push(milestone.score);

    if (!existingBadgeIds.has(milestone.badgeId)) {
      const badge = {
        id: milestone.badgeId,
        name: milestone.badgeName,
        score: milestone.score,
        reward: milestone.reward,
        earnedAt: nowTs(),
      };
      badges.unshift(badge);
      existingBadgeIds.add(milestone.badgeId);
      newlyUnlockedBadges.push(badge);
    }
  }

  if (newlyClaimedMilestones.length > 0) {
    setClaimedMilestones([...claimed].sort((a, b) => a - b));
  }

  if (newlyUnlockedBadges.length > 0) {
    setBadges(badges.slice(0, 80));
  }

  if (coinsAwarded > 0) {
    addCoins(coinsAwarded);
  }

  return {
    coinsAwarded,
    newlyUnlockedBadges,
    newlyClaimedMilestones,
  };
}

function updateDailyMissionsFromRun(score, kills) {
  const safeScore = Math.max(0, clampInt(score, 0));
  const safeKills = Math.max(0, clampInt(kills, 0));
  const state = getOrCreateDailyMissionState();
  const missions = Array.isArray(state.missions) ? state.missions : [];
  const newlyCompleted = [];
  let dirty = false;

  for (const mission of missions) {
    const previousProgress = clampInt(mission.progress, 0);
    const previousCompleted = Boolean(mission.completed);

    if (mission.type === 'score_reach') {
      mission.progress = Math.max(previousProgress, safeScore);
    } else if (mission.type === 'kills_total') {
      mission.progress = previousProgress + safeKills;
    } else if (mission.type === 'runs_total') {
      mission.progress = previousProgress + 1;
    }

    mission.progress = Math.max(0, mission.progress);
    mission.completed = mission.progress >= clampInt(mission.target, 0);

    if (mission.progress !== previousProgress || mission.completed !== previousCompleted) {
      dirty = true;
    }

    if (!previousCompleted && mission.completed) {
      newlyCompleted.push(mission.id);
    }
  }

  if (dirty) {
    writeJSON(KEYS.dailyMissionState, state);
  }

  return {
    dateKey: state.dateKey,
    missions,
    newlyCompleted,
  };
}

// ───────────────────────────────────────────────────────────────────────────────
// Weapons
// ───────────────────────────────────────────────────────────────────────────────

export function getOwnedWeapons() {
  if (isDeveloperProfileActive()) return getAllWeaponIds();
  const owned = readJSON(KEYS.ownedWeapons, [...DEFAULT_STARTER_WEAPONS]);
  return Array.isArray(owned) && owned.length ? owned : [...DEFAULT_STARTER_WEAPONS];
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
  const selected = lsGetItem(KEYS.selectedWeapon) || DEFAULT_WEAPON;
  return hasWeapon(selected) ? selected : DEFAULT_WEAPON;
}

export function setSelectedWeapon(id) {
  if (!id || !hasWeapon(id)) return false;
  lsSetItem(KEYS.selectedWeapon, id);
  return true;
}

// ───────────────────────────────────────────────────────────────────────────────
// Upgrades inventory
// ───────────────────────────────────────────────────────────────────────────────

export function getUpgradeInventory() {
  if (isDeveloperProfileActive()) return getAllUpgradeInventory();
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
  if (isDeveloperProfileActive()) return getAllSpecialInventory();
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
  const selected = lsGetItem(KEYS.selectedSpecial) || '';
  return selected && hasSpecial(selected) ? selected : '';
}

export function setSelectedSpecial(id) {
  if (!id) {
    lsSetItem(KEYS.selectedSpecial, '');
    return true;
  }
  if (!hasSpecial(id)) return false;
  lsSetItem(KEYS.selectedSpecial, id);
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
  if (isDeveloperProfileActive()) return getAllComboIds();
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
  ensureSelectedComboIsValid(id);
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

export function getActiveComboIds() {
  const ids = new Set([
    ...getOwnedCombos(),
    ...Object.keys(getComboAccess()),
  ]);

  return [...ids].filter((id) => isComboActive(id));
}

function ensureSelectedComboIsValid(preferredId = '') {
  const activeIds = getActiveComboIds();

  if (activeIds.length === 0) {
    lsRemoveItem(KEYS.selectedCombo);
    return '';
  }

  const current = lsGetItem(KEYS.selectedCombo) || '';
  const next =
    (preferredId && activeIds.includes(preferredId) && preferredId) ||
    (current && activeIds.includes(current) && current) ||
    activeIds[0];

  lsSetItem(KEYS.selectedCombo, next);
  return next;
}

export function getSelectedCombo() {
  const selected = lsGetItem(KEYS.selectedCombo) || '';
  if (selected && isComboActive(selected)) return selected;
  return ensureSelectedComboIsValid();
}

export function setSelectedCombo(id) {
  if (!id) {
    lsRemoveItem(KEYS.selectedCombo);
    notifyLocalSaveChanged();
    return true;
  }

  if (!isComboActive(id)) return false;
  lsSetItem(KEYS.selectedCombo, id);
  notifyLocalSaveChanged();
  return true;
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
  ensureSelectedComboIsValid(id);
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
  ensureSelectedComboIsValid(id);
  return true;
}

export function clearComboRental(id) {
  if (!id) return false;
  const access = getComboAccess();
  if (!access[id]) return false;
  delete access[id];
  setComboAccess(access);
  ensureSelectedComboIsValid();
  return true;
}

// ───────────────────────────────────────────────────────────────────────────────
// Vehicles
// ───────────────────────────────────────────────────────────────────────────────

export function getOwnedVehicles() {
  if (isDeveloperProfileActive()) return getAllVehicleIds();
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
  const selected = lsGetItem(KEYS.selectedVehicle) || 'default_jet';
  return hasVehicle(selected) ? selected : 'default_jet';
}

export function setSelectedVehicle(id) {
  if (!id || !hasVehicle(id)) return false;
  lsSetItem(KEYS.selectedVehicle, id);
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

  const coinsEarned = calculateRunCoinReward(safeScore, safeKills);
  addCoins(coinsEarned);
  addKills(safeKills);
  const newHigh = setHighScore(safeScore);
  const milestoneProgress = applyScoreMilestones(safeScore);
  const dailyMissionProgress = updateDailyMissionsFromRun(safeScore, safeKills);

  return {
    coinsEarned,
    milestoneCoinsAwarded: milestoneProgress.coinsAwarded,
    newlyUnlockedBadges: milestoneProgress.newlyUnlockedBadges,
    newlyClaimedMilestones: milestoneProgress.newlyClaimedMilestones,
    dailyMissionProgress,
    newHigh,
  };
}

export function calculateRunCoinReward(score, kills) {
  const safeScore = Math.max(0, clampInt(score, 0));
  const safeKills = Math.max(0, clampInt(kills, 0));

  const baseReward = safeScore + safeKills * 2;
  const scoreBonusMultiplier =
    safeScore >= 320 ? 1.25 :
    safeScore >= 260 ? 1.05 :
    safeScore >= 180 ? 0.8 :
    safeScore >= 120 ? 0.55 :
    safeScore >= 60 ? 0.3 :
    0;
  const scoreBonus = Math.round(safeScore * scoreBonusMultiplier);
  const killStreakBonus = Math.floor(safeKills / 20) * 30;

  return baseReward + scoreBonus + killStreakBonus;
}

// ───────────────────────────────────────────────────────────────────────────────
// Save export / import
// ───────────────────────────────────────────────────────────────────────────────

export function exportLocalSave() {
  return {
    coins: getCoins(),
    diamonds: getDiamonds(),

    ownedSkins: getOwnedSkins(),
    selectedSkin: getSelectedSkin(),

    highScore: getHighScore(),
    totalKills: getTotalKills(),
    badges: getBadges(),
    milestoneClaims: getClaimedMilestones(),
    dailyMissionState: getDailyMissionState(),

    ownedWeapons: getOwnedWeapons(),
    selectedWeapon: getSelectedWeapon(),

    ownedUpgrades: getUpgradeInventory(),
    equippedUpgrades: getEquippedUpgrades(),

    ownedSpecials: getSpecialInventory(),
    selectedSpecial: getSelectedSpecial(),
    equippedSpecials: getEquippedSpecials(),

    ownedCombos: getOwnedCombos(),
    comboAccess: getComboAccess(),
    selectedCombo: getSelectedCombo(),

    ownedVehicles: getOwnedVehicles(),
    selectedVehicle: getSelectedVehicle(),

    purchaseHistory: getPurchaseHistory(),
  };
}

export function importLocalSave(save) {
  if (!save || typeof save !== 'object') return;

  lsSetItem(KEYS.coins, String(clampInt(save.coins, 0)));
  lsSetItem(KEYS.diamonds, String(clampInt(save.diamonds, 0)));

  writeJSON(KEYS.owned, Array.isArray(save.ownedSkins) ? save.ownedSkins : ['default']);
  lsSetItem(KEYS.selected, save.selectedSkin ?? 'default');

  lsSetItem(KEYS.highScore, String(clampInt(save.highScore, 0)));
  lsSetItem(KEYS.totalKills, String(clampInt(save.totalKills, 0)));
  writeJSON(KEYS.badges, sanitizeArray(save.badges, []));
  writeJSON(KEYS.milestoneClaims, sanitizeArray(save.milestoneClaims, []));
  writeJSON(
    KEYS.dailyMissionState,
    save.dailyMissionState && typeof save.dailyMissionState === 'object'
      ? save.dailyMissionState
      : buildDailyMissionState(getLocalDateKey())
  );

  writeJSON(
    KEYS.ownedWeapons,
    Array.isArray(save.ownedWeapons) && save.ownedWeapons.length
      ? save.ownedWeapons
      : [...DEFAULT_STARTER_WEAPONS]
  );
  lsSetItem(KEYS.selectedWeapon, save.selectedWeapon ?? DEFAULT_WEAPON);

  writeJSON(KEYS.ownedUpgrades, sanitizeObject(save.ownedUpgrades));
  writeJSON(KEYS.equippedUpgrades, sanitizeObject(save.equippedUpgrades));

  writeJSON(KEYS.ownedSpecials, sanitizeObject(save.ownedSpecials));
  lsSetItem(KEYS.selectedSpecial, save.selectedSpecial ?? '');
  writeJSON(KEYS.equippedSpecials, sanitizeObject(save.equippedSpecials));

  writeJSON(KEYS.ownedCombos, sanitizeArray(save.ownedCombos, []));
  writeJSON(KEYS.comboAccess, sanitizeObject(save.comboAccess));
  lsSetItem(KEYS.selectedCombo, save.selectedCombo ?? '');
  ensureSelectedComboIsValid(save.selectedCombo ?? '');

  writeJSON(
    KEYS.ownedVehicles,
    Array.isArray(save.ownedVehicles) ? save.ownedVehicles : ['default_jet']
  );
  lsSetItem(KEYS.selectedVehicle, save.selectedVehicle ?? 'default_jet');

  writeJSON(
    KEYS.purchaseHistory,
    Array.isArray(save.purchaseHistory) ? save.purchaseHistory : []
  );

  notifyLocalSaveUpdated();
}

export function grantFullAccessToLocalSave(options = {}) {
  const nextSave = buildFullAccessSave({
    source: 'owner-grant',
    note: 'Owner full access granted',
    ...options,
  });
  importLocalSave(nextSave);
  notifyLocalSaveChanged();
  return nextSave;
}

// ───────────────────────────────────────────────────────────────────────────────
// Optional reset helper for testing
// ───────────────────────────────────────────────────────────────────────────────

export function resetEconomyProgress() {
  lsRemoveItem(DEV_KEYS.enabled);
  lsRemoveItem(DEV_KEYS.backup);
  lsRemoveItem(KEYS.coins);
  lsRemoveItem(KEYS.diamonds);

  lsRemoveItem(KEYS.owned);
  lsRemoveItem(KEYS.selected);

  lsRemoveItem(KEYS.highScore);
  lsRemoveItem(KEYS.totalKills);
  lsRemoveItem(KEYS.badges);
  lsRemoveItem(KEYS.milestoneClaims);
  lsRemoveItem(KEYS.dailyMissionState);

  lsRemoveItem(KEYS.ownedWeapons);
  lsRemoveItem(KEYS.selectedWeapon);

  lsRemoveItem(KEYS.ownedUpgrades);
  lsRemoveItem(KEYS.equippedUpgrades);

  lsRemoveItem(KEYS.ownedSpecials);
  lsRemoveItem(KEYS.selectedSpecial);
  lsRemoveItem(KEYS.equippedSpecials);

  lsRemoveItem(KEYS.ownedCombos);
  lsRemoveItem(KEYS.comboAccess);
  lsRemoveItem(KEYS.selectedCombo);

  lsRemoveItem(KEYS.ownedVehicles);
  lsRemoveItem(KEYS.selectedVehicle);

  lsRemoveItem(KEYS.purchaseHistory);

  notifyLocalSaveUpdated();
}
