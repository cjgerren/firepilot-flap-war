import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, Check } from 'lucide-react';
import { SKINS, drawPlayerSkin } from '../../lib/skins.js';
import {
  WEAPONS,
  UPGRADES,
  SPECIALS,
  COMBO_PACKS,
} from '../../lib/gameItems.js';
import {
  getFeaturedComboIds,
  getFeaturedSkinIds,
  getFeaturedSpecialIds,
  getFeaturedUpgradeIds,
  getFeaturedWeaponIds,
} from '../../config/gameConfig.js';
import {
  getCoins,
  getOwnedSkins,
  ownSkin,
  getSelectedSkin,
  setSelectedSkin,
  getOwnedWeapons,
  getSelectedWeapon,
  setSelectedWeapon,
  getUpgradeInventory,
  getEquippedUpgrades,
  setEquippedUpgrades,
  getHighScore,
  getSpecialInventory,
  getSelectedSpecial,
  setSelectedSpecial,
  getOwnedCombos,
  getSelectedCombo,
  setSelectedCombo,
  isComboActive,
  purchaseSkin,
  purchaseWeapon,
  purchaseUpgrade,
  purchaseSpecial,
  purchaseCombo,
} from '../../lib/gameStore.js';

const getVisibleReleaseItems = (items) =>
  items.filter((item) => item.live !== false);

const WEB_COMING_SOON_BADGE = 'MORE NEXT RELEASE';
const WEB_SHOP_READY_BADGE = ['SHOP', 'READY'].join(' ');
const COMING_SOON_NOTICE = 'More coming in the next release.';

const getCoinCost = (item) =>
  Math.max(0, Number(item?.cost ?? item?.coins ?? item?.pricing?.permanent?.coins ?? 0));

const getDiamondCost = (item) =>
  Math.max(0, Number(item?.diamonds ?? item?.pricing?.permanent?.diamonds ?? 0));

const sortByCheapest = (items) =>
  [...items].sort((a, b) => {
    const coinDelta = getCoinCost(a) - getCoinCost(b);
    if (coinDelta !== 0) return coinDelta;
    const diamondDelta = getDiamondCost(a) - getDiamondCost(b);
    if (diamondDelta !== 0) return diamondDelta;
    return String(a?.name || '').localeCompare(String(b?.name || ''));
  });

const formatCostLabel = (item) => {
  const coins = getCoinCost(item);
  const diamonds = getDiamondCost(item);
  if (diamonds > 0 && coins > 0) return `⚡ ${coins} coins or 💎 ${diamonds} diamonds`;
  if (diamonds > 0) return `💎 ${diamonds} diamonds`;
  return `⚡ ${coins} coins`;
};

const FEATURED_WEAPON_IDS = new Set(getFeaturedWeaponIds());
const FEATURED_SKIN_IDS = new Set(getFeaturedSkinIds());
const FEATURED_UPGRADE_IDS = new Set(getFeaturedUpgradeIds());
const FEATURED_SPECIAL_IDS = new Set(getFeaturedSpecialIds());
const FEATURED_COMBO_IDS = new Set(getFeaturedComboIds());

const sortFeaturedFirstBySet = (items, featuredSet) => {
  const featured = [];
  const regular = [];

  items.forEach((item) => {
    if (FEATURED_WEAPON_IDS.has(item.id)) {
      featured.push(item);
    } else {
      regular.push(item);
    }
  });

  return [...sortByCheapest(featured), ...sortByCheapest(regular)];
};

const sortWeaponsForArmory = (items) => sortFeaturedFirstBySet(items, FEATURED_WEAPON_IDS);
const sortSkinsForArmory = (items) => sortFeaturedFirstBySet(items, FEATURED_SKIN_IDS);
const sortUpgradesForArmory = (items) => sortFeaturedFirstBySet(items, FEATURED_UPGRADE_IDS);
const sortSpecialsForArmory = (items) => sortFeaturedFirstBySet(items, FEATURED_SPECIAL_IDS);
const sortCombosForArmory = (items) => sortFeaturedFirstBySet(items, FEATURED_COMBO_IDS);

const ARMORY_ITEM_LABELS = new Map([
  ...WEAPONS.map((item) => [`weapon:${item.id}`, item.name]),
  ...UPGRADES.map((item) => [`upgrade:${item.id}`, item.name]),
  ...SPECIALS.map((item) => [`special:${item.id}`, item.name]),
]);

function formatComboEntryLabel(entry) {
  if (!entry?.id) return 'Unknown';
  const key = `${entry.category || 'item'}:${entry.id}`;
  return ARMORY_ITEM_LABELS.get(key) || entry.id.replaceAll('_', ' ').toUpperCase();
}

// ── Skin canvas preview ────────────────────────────────────────────────────────
function SkinPreview({ skin, frame }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 80, 80);
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, 80, 80);

    ctx.globalAlpha = 0.1;
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 0.5;

    for (let i = 0; i < 80; i += 16) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 80);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(80, i);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    drawPlayerSkin(ctx, 40, 40, 0, 3, skin, frame);
  }, [skin, frame]);

  return <canvas ref={ref} width={80} height={80} className="rounded-lg flex-shrink-0" />;
}

// ── Reusable shop card ────────────────────────────────────────────────────────
function ShopCard({
  isSelected,
  isOwned,
  isAffordable = true,
  onClick,
  children,
  accentColor = '#00ffff',
  badge,
}) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="relative rounded-xl p-3 cursor-pointer"
      style={{
        background: isSelected
          ? 'linear-gradient(135deg, hsla(180,100%,50%,0.15), hsla(300,100%,50%,0.1))'
          : 'hsla(230,25%,10%,0.8)',
        border: isSelected
          ? `1px solid ${accentColor}`
          : isOwned
            ? '1px solid hsla(180,100%,50%,0.2)'
            : '1px solid hsla(0,0%,100%,0.08)',
        opacity: !isOwned && !isAffordable ? 0.55 : 1,
        overflow: 'hidden',
      }}
    >
      {isSelected && (
        <div
          className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
          style={{ background: accentColor }}
        >
          <Check className="w-3 h-3" style={{ color: '#001a1a' }} />
        </div>
      )}

      {badge && !isSelected && (
        <div
          className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-xs font-mono font-bold"
          style={{
            background: 'hsla(120,100%,40%,0.2)',
            color: '#00ff88',
            fontSize: 9,
          }}
        >
          {badge}
        </div>
      )}

      {children}
    </motion.div>
  );
}

function StatusBadge({
  isSelected,
  isOwned,
  isMilestone,
  costLabel,
  milestoneScore,
  isAffordable,
  qty,
  customText,
}) {
  if (customText) {
    return (
      <span
        className="inline-block px-2 py-0.5 rounded text-xs font-mono"
        style={{ background: 'hsla(180,100%,50%,0.12)', color: '#00ffff' }}
      >
        {customText}
      </span>
    );
  }

  if (isSelected) {
    return (
      <span
        className="inline-block px-2 py-0.5 rounded text-xs font-mono font-bold"
        style={{ background: 'hsla(180,100%,50%,0.2)', color: '#00ffff' }}
      >
        EQUIPPED
      </span>
    );
  }

  if (isOwned && qty !== undefined) {
    return (
      <span
        className="inline-block px-2 py-0.5 rounded text-xs font-mono"
        style={{ background: 'hsla(120,100%,40%,0.15)', color: '#00ff88' }}
      >
        OWNED ({qty})
      </span>
    );
  }

  if (isOwned) {
    return (
      <span
        className="inline-block px-2 py-0.5 rounded text-xs font-mono"
        style={{ background: 'hsla(120,100%,40%,0.15)', color: '#00ff88' }}
      >
        OWNED
      </span>
    );
  }

  if (isMilestone) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono"
        style={{ background: 'hsla(50,100%,50%,0.1)', color: '#ffdd00' }}
      >
        <Lock className="w-2.5 h-2.5" />
        Score {milestoneScore}+
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono"
      style={{
        background: isAffordable ? 'hsla(50,100%,50%,0.1)' : 'hsla(0,100%,50%,0.1)',
        color: isAffordable ? '#ffdd00' : '#ff6666',
      }}
    >
      {costLabel}
    </span>
  );
}

// ── Tab: Skins ────────────────────────────────────────────────────────────────
function SkinsTab({ coins, setCoins, notify, onSkinChange, frame }) {
  const [owned, setOwned] = useState(getOwnedSkins());
  const [selected, setSelected] = useState(getSelectedSkin());
  const highScore = getHighScore();
  const sortedSkins = sortSkinsForArmory([...SKINS]);

  const isUnlocked = (skin) =>
    owned.includes(skin.id) || (skin.unlockScore > 0 && highScore >= skin.unlockScore);

  const handleSkinClick = (skin) => {
    const unlocked = isUnlocked(skin);

    if (unlocked) {
      setSelected(skin.id);
      setSelectedSkin(skin.id);
      onSkinChange(skin.id);
      return;
    }

    const result = purchaseSkin(skin);
    if (!result.ok) {
      notify('Not enough coins!', 'error');
      return;
    }

    ownSkin(skin.id);
    setCoins(getCoins());
    setOwned(getOwnedSkins());
    setSelected(skin.id);
    setSelectedSkin(skin.id);
    onSkinChange(skin.id);
    notify(`${skin.name} unlocked!`, 'success');
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {sortedSkins.map((skin) => {
        const unlocked = isUnlocked(skin);
        const isSelected = selected === skin.id;
        const isMilestone = skin.unlockScore > 0 && !owned.includes(skin.id);

        return (
          <ShopCard
            key={skin.id}
            isSelected={isSelected}
            isOwned={unlocked}
            isAffordable={coins >= skin.cost}
            onClick={() => handleSkinClick(skin)}
          >
            <div className="flex gap-3 items-start">
              <SkinPreview skin={skin} frame={frame} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 mb-0.5">
                  <span className="text-base">{skin.emoji}</span>
                  <span
                    className="font-display text-xs font-bold truncate"
                    style={{ color: unlocked ? '#00ffff' : '#668888' }}
                  >
                    {skin.name}
                  </span>
                </div>
                <p
                  className="font-mono leading-relaxed mb-2"
                  style={{ color: 'hsla(180,50%,60%,0.6)', fontSize: 9 }}
                >
                  {skin.desc}
                </p>
                <StatusBadge
                  isSelected={isSelected}
                  isOwned={unlocked}
                  isMilestone={isMilestone}
                  costLabel={formatCostLabel(skin)}
                  milestoneScore={skin.unlockScore}
                  isAffordable={coins >= skin.cost}
                />
              </div>
            </div>
          </ShopCard>
        );
      })}
    </div>
  );
}

// ── Tab: Weapons ──────────────────────────────────────────────────────────────
function WeaponsTab({ coins, setCoins, notify }) {
  const [owned, setOwned] = useState(getOwnedWeapons());
  const [selected, setSelected] = useState(getSelectedWeapon());
  const visibleWeapons = sortWeaponsForArmory(getVisibleReleaseItems(WEAPONS));

  const handleWeaponClick = (weapon) => {
    const isOwned = owned.includes(weapon.id);
    if (weapon.live === false) {
      notify(COMING_SOON_NOTICE, 'error');
      return;
    }

    if (isOwned) {
      setSelected(weapon.id);
      setSelectedWeapon(weapon.id);
      notify(`${weapon.name} equipped!`, 'success');
      return;
    }

    const result = purchaseWeapon(weapon);
    if (!result.ok) {
      notify('Not enough coins!', 'error');
      return;
    }

    const nextOwned = getOwnedWeapons();
    setOwned(nextOwned);
    setCoins(getCoins());

    setSelected(weapon.id);
    setSelectedWeapon(weapon.id);
    notify(`${weapon.name} unlocked and equipped!`, 'success');
  };

  return (
    <div className="grid grid-cols-1 gap-3">
      {visibleWeapons.map((weapon) => {
        const isOwned = owned.includes(weapon.id);
        const isSelected = selected === weapon.id;
        const color = weapon.color || '#ffff00';
        const canEquip = weapon.live !== false;
        const badge = weapon.live === false ? WEB_COMING_SOON_BADGE : null;

        return (
          <ShopCard
            key={weapon.id}
            isSelected={isSelected}
            isOwned={isOwned}
            isAffordable={coins >= weapon.cost}
            onClick={() => handleWeaponClick(weapon)}
            accentColor={color}
            badge={badge}
          >
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  background: 'hsla(0,0%,0%,0.4)',
                  border: `1px solid ${color}44`,
                }}
              >
                <span className="text-3xl">{weapon.emoji}</span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span
                    className="font-display text-sm font-bold"
                    style={{ color: isOwned ? color : '#668888' }}
                  >
                    {weapon.name}
                  </span>

                  {weapon.type === 'lightning' && (
                    <span
                      className="px-1.5 py-0.5 rounded font-mono"
                      style={{
                        fontSize: 9,
                        background: 'hsla(0,0%,100%,0.1)',
                        color: '#aaaaaa',
                      }}
                    >
                      CHARGE-BASED
                    </span>
                  )}

                  {weapon.live === false && (
                    <span
                      className="px-1.5 py-0.5 rounded font-mono"
                      style={{
                        fontSize: 9,
                        background: 'hsla(35,100%,50%,0.12)',
                        color: '#ffbb66',
                      }}
                    >
                      {WEB_SHOP_READY_BADGE}
                    </span>
                  )}
                </div>

                <p
                  className="font-mono mb-2"
                  style={{ color: 'hsla(180,50%,60%,0.6)', fontSize: 10 }}
                >
                  {weapon.desc}
                </p>

                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge
                    isSelected={isSelected}
                    isOwned={isOwned}
                    costLabel={formatCostLabel(weapon)}
                    isAffordable={coins >= weapon.cost}
                    customText={
                      weapon.live === false
                        ? 'More coming in the next release.'
                        : isOwned && !canEquip
                        ? 'OWNED'
                        : undefined
                    }
                  />
                </div>
              </div>
            </div>
          </ShopCard>
        );
      })}
    </div>
  );
}

// ── Tab: Upgrades ─────────────────────────────────────────────────────────────
function UpgradesTab({ coins, setCoins, notify }) {
  const [inv, setInv] = useState(getUpgradeInventory());
  const [equipped, setEquipped] = useState(getEquippedUpgrades());
  const visibleUpgrades = sortUpgradesForArmory(getVisibleReleaseItems(UPGRADES));

  const refresh = () => {
    setInv(getUpgradeInventory());
    setEquipped(getEquippedUpgrades());
  };

  const handleBuy = (upgrade) => {
    if (upgrade.live === false) {
      notify(COMING_SOON_NOTICE, 'error');
      return;
    }

    const result = purchaseUpgrade(upgrade, 1);
    if (!result.ok) {
      notify('Not enough coins!', 'error');
      return;
    }

    setCoins(getCoins());
    refresh();
    notify(`${upgrade.name} added to inventory!`, 'success');
  };

  const handleEquip = (upgrade) => {
    if (upgrade.live === false) {
      notify(COMING_SOON_NOTICE, 'error');
      return;
    }

    const stock = inv[upgrade.id] || 0;
    const eq = equipped[upgrade.id] || 0;
    const available = stock - eq;

    if (available <= 0) {
      notify('None available to equip. Buy first.', 'error');
      return;
    }

    const next = { ...equipped, [upgrade.id]: eq + 1 };
    setEquippedUpgrades(next);
    setEquipped(next);
    notify(`${upgrade.name} equipped for next run!`, 'success');
  };

  const handleUnequip = (upgrade) => {
    const eq = equipped[upgrade.id] || 0;
    if (eq <= 0) return;

    const next = { ...equipped, [upgrade.id]: eq - 1 };
    if (next[upgrade.id] <= 0) delete next[upgrade.id];

    setEquippedUpgrades(next);
    setEquipped(next);
    notify(`${upgrade.name} unequipped.`, 'success');
  };

  return (
    <div className="grid grid-cols-1 gap-3">
      {visibleUpgrades.map((upgrade) => {
        const qty = inv[upgrade.id] || 0;
        const eqQty = equipped[upgrade.id] || 0;
        const color =
          upgrade.id === 'shield1'
            ? '#00ccff'
            : upgrade.id === 'shield2'
              ? '#aa44ff'
              : upgrade.id === 'tunnelbomb'
                ? '#ff6600'
                : '#00ffff';

        return (
          <ShopCard
            key={upgrade.id}
            isSelected={eqQty > 0}
            isOwned={qty > 0}
            isAffordable={coins >= upgrade.cost}
            onClick={() => {}}
            accentColor={color}
            badge={upgrade.live === false ? WEB_COMING_SOON_BADGE : null}
          >
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  background: 'hsla(0,0%,0%,0.4)',
                  border: `1px solid ${color}44`,
                }}
              >
                <span className="text-3xl">{upgrade.emoji}</span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span
                    className="font-display text-sm font-bold"
                    style={{ color: qty > 0 ? color : '#668888' }}
                  >
                    {upgrade.name}
                  </span>

                  {upgrade.live === false && (
                    <span
                      className="px-1.5 py-0.5 rounded font-mono"
                      style={{
                        fontSize: 9,
                        background: 'hsla(35,100%,50%,0.12)',
                        color: '#ffbb66',
                      }}
                    >
                      MORE NEXT RELEASE
                    </span>
                  )}
                </div>

                <p
                  className="font-mono mb-2"
                  style={{ color: 'hsla(180,50%,60%,0.6)', fontSize: 10 }}
                >
                  {upgrade.desc}
                </p>

                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <StatusBadge
                    isSelected={eqQty > 0}
                    isOwned={qty > 0}
                    costLabel={formatCostLabel(upgrade)}
                    isAffordable={coins >= upgrade.cost}
                    qty={qty}
                  />
                  {eqQty > 0 && (
                    <span
                      className="inline-block px-2 py-0.5 rounded text-xs font-mono"
                      style={{
                        background: 'hsla(180,100%,50%,0.12)',
                        color: '#00ffff',
                      }}
                    >
                      EQUIPPED ({eqQty})
                    </span>
                  )}
                </div>

                <div className="flex gap-2 flex-wrap">
                  <button
                    disabled={upgrade.live === false}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBuy(upgrade);
                    }}
                    className="px-3 py-1.5 rounded-lg font-mono text-xs font-bold"
                    style={{
                      background: upgrade.live === false ? 'hsla(0,0%,100%,0.08)' : 'hsla(50,100%,50%,0.12)',
                      color: upgrade.live === false ? 'rgba(255,255,255,0.52)' : '#ffdd00',
                      border: upgrade.live === false
                        ? '1px solid rgba(255,255,255,0.2)'
                        : '1px solid hsla(50,100%,50%,0.25)',
                      cursor: upgrade.live === false ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {upgrade.live === false ? 'MORE NEXT RELEASE' : 'BUY'}
                  </button>

                  <button
                    disabled={upgrade.live === false}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEquip(upgrade);
                    }}
                    className="px-3 py-1.5 rounded-lg font-mono text-xs font-bold"
                    style={{
                      background: upgrade.live === false ? 'hsla(0,0%,100%,0.08)' : 'hsla(180,100%,50%,0.12)',
                      color: upgrade.live === false ? 'rgba(255,255,255,0.52)' : '#00ffff',
                      border: upgrade.live === false
                        ? '1px solid rgba(255,255,255,0.2)'
                        : '1px solid hsla(180,100%,50%,0.25)',
                      cursor: upgrade.live === false ? 'not-allowed' : 'pointer',
                    }}
                  >
                    EQUIP
                  </button>

                  {eqQty > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUnequip(upgrade);
                      }}
                      className="px-3 py-1.5 rounded-lg font-mono text-xs font-bold"
                      style={{
                        background: 'hsla(0,100%,60%,0.12)',
                        color: '#ff7777',
                        border: '1px solid hsla(0,100%,60%,0.25)',
                      }}
                    >
                      UNEQUIP
                    </button>
                  )}
                </div>
              </div>
            </div>
          </ShopCard>
        );
      })}
    </div>
  );
}

// ── Tab: Specials ─────────────────────────────────────────────────────────────
function SpecialsTab({ coins, setCoins, notify }) {
  const [inv, setInv] = useState(getSpecialInventory());
  const [selected, setSelected] = useState(getSelectedSpecial());
  const visibleSpecials = sortSpecialsForArmory(getVisibleReleaseItems(SPECIALS));

  const refresh = () => {
    setInv(getSpecialInventory());
    setSelected(getSelectedSpecial());
  };

  const handleBuy = (special) => {
    if (special.live === false) {
      notify(COMING_SOON_NOTICE, 'error');
      return;
    }

    const result = purchaseSpecial(special, 1);
    if (!result.ok) {
      notify('Not enough coins!', 'error');
      return;
    }

    setCoins(getCoins());
    refresh();
    notify(`${special.name} added to inventory!`, 'success');
  };

  const handleSelect = (special) => {
    if (special.live === false) {
      notify(COMING_SOON_NOTICE, 'error');
      return;
    }

    const qty = inv[special.id] || 0;
    if (qty <= 0) {
      notify('Buy one first.', 'error');
      return;
    }

    setSelectedSpecial(special.id);
    setSelected(special.id);
    notify(`${special.name} selected for runs. Trigger it with Q or Special control.`, 'success');
  };

  return (
    <div className="grid grid-cols-1 gap-3">
      {visibleSpecials.map((special) => {
        const qty = inv[special.id] || 0;
        const isSelected = selected === special.id;
        const isOwned = qty > 0;
        const color =
          special.subgroup === 'escape'
            ? '#99ddff'
            : special.subgroup === 'defense'
              ? '#88ffcc'
              : special.subgroup === 'offense'
                ? '#ff9966'
                : '#ccbbff';

        return (
          <ShopCard
            key={special.id}
            isSelected={isSelected}
            isOwned={isOwned}
            isAffordable={coins >= special.cost}
            onClick={() => handleSelect(special)}
            accentColor={color}
            badge="SPECIAL"
          >
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  background: 'hsla(0,0%,0%,0.4)',
                  border: `1px solid ${color}44`,
                }}
              >
                <span className="text-3xl">{special.emoji}</span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span
                    className="font-display text-sm font-bold"
                    style={{ color: isOwned ? color : '#668888' }}
                  >
                    {special.name}
                  </span>
                  <span
                    className="px-1.5 py-0.5 rounded font-mono"
                    style={{
                      fontSize: 9,
                      background: 'hsla(35,100%,50%,0.12)',
                      color: '#ffbb66',
                    }}
                  >
                    {String(special.subgroup || '').toUpperCase()}
                  </span>
                </div>

                <p
                  className="font-mono mb-2"
                  style={{ color: 'hsla(180,50%,60%,0.6)', fontSize: 10 }}
                >
                  {special.desc}
                </p>

                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <StatusBadge
                    isSelected={isSelected}
                    isOwned={isOwned}
                    costLabel={formatCostLabel(special)}
                    isAffordable={coins >= special.cost}
                    qty={qty}
                  />
                  {typeof special.uses === 'number' && (
                    <span
                      className="inline-block px-2 py-0.5 rounded text-xs font-mono"
                      style={{
                        background: 'hsla(280,100%,50%,0.1)',
                        color: '#ddb3ff',
                      }}
                    >
                      {special.uses} USE{special.uses === 1 ? '' : 'S'}
                    </span>
                  )}
                </div>

                <div className="flex gap-2 flex-wrap">
                  <button
                    disabled={special.live === false}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBuy(special);
                    }}
                    className="px-3 py-1.5 rounded-lg font-mono text-xs font-bold"
                    style={{
                      background: special.live === false ? 'hsla(0,0%,100%,0.08)' : 'hsla(50,100%,50%,0.12)',
                      color: special.live === false ? 'rgba(255,255,255,0.52)' : '#ffdd00',
                      border: special.live === false
                        ? '1px solid rgba(255,255,255,0.2)'
                        : '1px solid hsla(50,100%,50%,0.25)',
                      cursor: special.live === false ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {special.live === false ? 'MORE NEXT RELEASE' : 'BUY'}
                  </button>

                  {isOwned && (
                    <button
                      disabled={special.live === false}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelect(special);
                      }}
                      className="px-3 py-1.5 rounded-lg font-mono text-xs font-bold"
                      style={{
                        background: 'hsla(180,100%,50%,0.12)',
                        color: '#00ffff',
                        border: '1px solid hsla(180,100%,50%,0.25)',
                      }}
                    >
                      SELECT
                    </button>
                  )}
                </div>
              </div>
            </div>
          </ShopCard>
        );
      })}
    </div>
  );
}

// ── Tab: Combo Packs ──────────────────────────────────────────────────────────
function CombosTab({ coins, setCoins, notify }) {
  const [ownedCombos, setOwnedCombos] = useState(getOwnedCombos());
  const [selectedComboId, setSelectedComboId] = useState(getSelectedCombo());
  const visibleCombos = sortCombosForArmory(getVisibleReleaseItems(COMBO_PACKS));

  const refresh = () => {
    setOwnedCombos(getOwnedCombos());
    setSelectedComboId(getSelectedCombo());
  };

  const handleEquip = (combo) => {
    if (!isComboActive(combo.id)) {
      notify('Buy or rent this combo first.', 'error');
      return;
    }

    if (setSelectedCombo(combo.id)) {
      setSelectedComboId(combo.id);
      notify(`${combo.name} equipped for next run!`, 'success');
      return;
    }

    notify('Could not equip combo.', 'error');
  };

  const handleBuy = (combo) => {
    if (combo.live === false) {
      notify(COMING_SOON_NOTICE, 'error');
      return;
    }

    const result = purchaseCombo(combo);
    if (!result.ok && !result.alreadyOwned) {
      notify('Not enough coins!', 'error');
      return;
    }

    if (result.alreadyOwned) {
      handleEquip(combo);
      return;
    }

    setCoins(getCoins());
    setSelectedCombo(combo.id);
    refresh();
    notify(`${combo.name} purchased and equipped!`, 'success');
  };

  return (
    <div className="grid grid-cols-1 gap-3">
      {visibleCombos.map((combo) => {
        const isOwned = ownedCombos.includes(combo.id);
        const hasAccess = isComboActive(combo.id);
        const isEquipped = selectedComboId === combo.id && hasAccess;
        const isAffordable = coins >= combo.cost;

        return (
          <ShopCard
            key={combo.id}
            isSelected={isEquipped}
            isOwned={hasAccess}
            isAffordable={isAffordable}
            onClick={() => (hasAccess ? handleEquip(combo) : handleBuy(combo))}
            accentColor="#ff66ff"
            badge="BUNDLE"
          >
            <div className="flex items-start gap-4">
              <div
                className="w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  background: 'hsla(0,0%,0%,0.4)',
                  border: '1px solid rgba(255, 102, 255, 0.3)',
                }}
              >
                <span className="text-3xl">{combo.emoji}</span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span
                    className="font-display text-sm font-bold"
                    style={{ color: hasAccess ? '#ff99ff' : '#ffffff' }}
                  >
                    {combo.name}
                  </span>
                  {isEquipped && (
                    <span
                      className="px-1.5 py-0.5 rounded font-mono"
                      style={{
                        fontSize: 9,
                        background: 'hsla(180,100%,50%,0.15)',
                        color: '#00ffff',
                      }}
                    >
                      EQUIPPED
                    </span>
                  )}
                  {!isEquipped && hasAccess && (
                    <span
                      className="px-1.5 py-0.5 rounded font-mono"
                      style={{
                        fontSize: 9,
                        background: 'hsla(120,100%,40%,0.15)',
                        color: '#00ff88',
                      }}
                    >
                      OWNED
                    </span>
                  )}
                </div>

                <p
                  className="font-mono mb-2"
                  style={{ color: 'hsla(180,50%,60%,0.6)', fontSize: 10 }}
                >
                  {combo.desc}
                </p>

                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <StatusBadge
                    isOwned={hasAccess}
                    costLabel={formatCostLabel(combo)}
                    isAffordable={isAffordable}
                    customText={hasAccess ? (isEquipped ? 'EQUIPPED FOR NEXT RUN' : 'AVAILABLE TO EQUIP') : undefined}
                  />
                </div>

                <div
                  className="rounded-lg px-3 py-2 mb-2"
                  style={{
                    background: 'hsla(0,0%,100%,0.03)',
                    border: '1px solid hsla(0,0%,100%,0.06)',
                  }}
                >
                  <div
                    className="font-mono text-[10px] mb-1"
                    style={{ color: 'hsla(180,100%,50%,0.5)' }}
                  >
                    INCLUDES
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {combo.contents.map((entry) => (
                      <span
                        key={`${combo.id}-${entry.category}-${entry.id}`}
                        className="px-2 py-0.5 rounded text-xs font-mono max-w-full break-words"
                        style={{
                          background: 'hsla(180,100%,50%,0.08)',
                          color: '#b8ffff',
                        }}
                      >
                        {formatComboEntryLabel(entry)} ×{entry.qty || 1}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  {!hasAccess && (
                    <button
                      disabled={combo.live === false}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleBuy(combo);
                      }}
                      className="px-3 py-1.5 rounded-lg font-mono text-xs font-bold"
                      style={{
                        background: combo.live === false ? 'hsla(0,0%,100%,0.08)' : 'hsla(300,100%,50%,0.12)',
                        color: combo.live === false ? 'rgba(255,255,255,0.52)' : '#ff99ff',
                        border: combo.live === false
                          ? '1px solid rgba(255,255,255,0.2)'
                          : '1px solid hsla(300,100%,50%,0.25)',
                        cursor: combo.live === false ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {combo.live === false ? 'MORE NEXT RELEASE' : 'BUY BUNDLE'}
                    </button>
                  )}
                  {hasAccess && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEquip(combo);
                      }}
                      className="px-3 py-1.5 rounded-lg font-mono text-xs font-bold"
                      style={{
                        background: isEquipped ? 'hsla(180,100%,50%,0.2)' : 'hsla(180,100%,50%,0.12)',
                        color: '#00ffff',
                        border: '1px solid hsla(180,100%,50%,0.28)',
                      }}
                    >
                      {isEquipped ? 'EQUIPPED' : 'EQUIP'}
                    </button>
                  )}
                </div>

              </div>
            </div>
          </ShopCard>
        );
      })}
    </div>
  );
}

// ── Main Armory component ─────────────────────────────────────────────────────
export default function Armory({ onClose, onSkinChange }) {
  const [coins, setCoins] = useState(getCoins());
  const [tab, setTab] = useState('skins');
  const [notification, setNotification] = useState(null);
  const [frame, setFrame] = useState(0);
  const highScore = getHighScore();
  const handleClose = (event) => {
    if (event?.preventDefault) event.preventDefault();
    if (event?.stopPropagation) event.stopPropagation();
    onClose?.();
  };

  useEffect(() => {
    const id = setInterval(() => setFrame((f) => f + 1), 50);
    return () => clearInterval(id);
  }, []);

  const notify = (msg, type) => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 2500);
  };

  const TABS = [
    { id: 'skins', label: '🎨 SKINS' },
    getVisibleReleaseItems(WEAPONS).length > 0 && { id: 'weapons', label: '🔫 WEAPONS' },
    getVisibleReleaseItems(UPGRADES).length > 0 && { id: 'upgrades', label: '⚙️ UPGRADES' },
    getVisibleReleaseItems(SPECIALS).length > 0 && { id: 'specials', label: '⚡ SPECIALS' },
    getVisibleReleaseItems(COMBO_PACKS).length > 0 && { id: 'combos', label: '🔥 COMBOS' },
  ].filter(Boolean);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-20 flex flex-col overflow-x-hidden"
      style={{
        background: 'rgba(7,7,26,1)',
        paddingTop: 'max(calc(env(safe-area-inset-top) + 14px), 34px)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 0px)',
      }}
    >
      <button
        type="button"
        onClick={handleClose}
        onTouchEnd={handleClose}
        onPointerUp={handleClose}
        className="absolute z-50 rounded-xl transition-colors hover:bg-white/10"
        style={{
          top: 'max(calc(env(safe-area-inset-top) + 10px), 22px)',
          right: '12px',
          width: 52,
          height: 52,
          minWidth: 52,
          minHeight: 52,
          background: 'rgba(5, 12, 22, 0.82)',
          border: '1px solid rgba(0,255,255,0.42)',
          boxShadow: '0 0 16px rgba(0,255,255,0.22)',
          touchAction: 'manipulation',
          WebkitTapHighlightColor: 'transparent',
        }}
        aria-label="Close armory"
      >
        <X className="w-6 h-6 mx-auto" style={{ color: '#00ffff' }} />
      </button>

      <div
        className="flex items-center justify-between gap-2 px-4 py-3 border-b overflow-x-hidden"
        style={{
          borderColor: 'hsla(180,100%,50%,0.15)',
          paddingRight: 64,
        }}
      >
        <div className="min-w-0">
          <h2
            className="font-display text-lg font-black tracking-widest truncate"
            style={{ color: '#00ffff', textShadow: '0 0 15px #00ffff66' }}
          >
            ARMORY
          </h2>
          <p
            className="font-mono text-xs"
            style={{ color: 'hsla(180,100%,50%,0.4)' }}
          >
            Best: {highScore} pts
          </p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
            style={{
              background: 'hsla(50,100%,50%,0.1)',
              border: '1px solid hsla(50,100%,50%,0.3)',
            }}
          >
            <span style={{ color: '#ffdd00' }}>⚡</span>
            <span
              className="font-display font-bold text-sm"
              style={{ color: '#ffdd00' }}
            >
              {coins}
            </span>
          </div>

        </div>
      </div>

      <div
        className="flex flex-wrap border-b"
        style={{ borderColor: 'hsla(180,100%,50%,0.1)' }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-3 py-2 font-mono text-[10px] sm:text-xs whitespace-nowrap transition-all flex-1 basis-1/3 sm:flex-none sm:basis-auto"
            style={{
              color: tab === t.id ? '#00ffff' : 'hsla(180,100%,50%,0.5)',
              borderBottom:
                tab === t.id
                  ? '2px solid #00ffff'
                  : '2px solid transparent',
              background: tab === t.id ? 'hsla(180,100%,50%,0.08)' : 'transparent',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4">
        {tab === 'skins' && (
          <SkinsTab
            coins={coins}
            setCoins={setCoins}
            notify={notify}
            onSkinChange={onSkinChange}
            frame={frame}
          />
        )}
        {tab === 'weapons' && <WeaponsTab coins={coins} setCoins={setCoins} notify={notify} />}
        {tab === 'upgrades' && <UpgradesTab coins={coins} setCoins={setCoins} notify={notify} />}
        {tab === 'specials' && <SpecialsTab coins={coins} setCoins={setCoins} notify={notify} />}
        {tab === 'combos' && <CombosTab coins={coins} setCoins={setCoins} notify={notify} />}
      </div>

      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-5 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg font-mono text-xs"
            style={{
              background:
                notification.type === 'error'
                  ? 'hsla(0,100%,50%,0.15)'
                  : 'hsla(120,100%,40%,0.15)',
              color: notification.type === 'error' ? '#ff6666' : '#00ff88',
              border:
                notification.type === 'error'
                  ? '1px solid hsla(0,100%,50%,0.3)'
                  : '1px solid hsla(120,100%,40%,0.3)',
            }}
          >
            {notification.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
