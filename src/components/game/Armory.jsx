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
  purchaseSkin,
  purchaseWeapon,
  purchaseUpgrade,
  purchaseSpecial,
  purchaseCombo,
} from '../../lib/gameStore.js';

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
  cost,
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
      ⚡ {cost} coins
    </span>
  );
}

// ── Tab: Skins ────────────────────────────────────────────────────────────────
function SkinsTab({ coins, setCoins, notify, onSkinChange, frame }) {
  const [owned, setOwned] = useState(getOwnedSkins());
  const [selected, setSelected] = useState(getSelectedSkin());
  const highScore = getHighScore();

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
      {SKINS.map((skin) => {
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
                  cost={skin.cost}
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

  const handleWeaponClick = (weapon) => {
    const isOwned = owned.includes(weapon.id);

    if (isOwned) {
      if (!weapon.live) {
        notify(`${weapon.name} is owned, but gameplay support is coming next.`, 'error');
        return;
      }

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

    if (weapon.live) {
      setSelected(weapon.id);
      setSelectedWeapon(weapon.id);
      notify(`${weapon.name} unlocked and equipped!`, 'success');
    } else {
      notify(`${weapon.name} purchased. Gameplay behavior will be added next.`, 'success');
    }
  };

  return (
    <div className="grid grid-cols-1 gap-3">
      {WEAPONS.map((weapon) => {
        const isOwned = owned.includes(weapon.id);
        const isSelected = selected === weapon.id;
        const color = weapon.color || '#ffff00';
        const canEquip = weapon.live;
        const badge = weapon.live ? null : 'COMING SOON';

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

                  {!weapon.live && (
                    <span
                      className="px-1.5 py-0.5 rounded font-mono"
                      style={{
                        fontSize: 9,
                        background: 'hsla(35,100%,50%,0.12)',
                        color: '#ffbb66',
                      }}
                    >
                      SHOP READY
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
                    cost={weapon.cost}
                    isAffordable={coins >= weapon.cost}
                    customText={
                      isOwned && !canEquip
                        ? 'OWNED — gameplay coming soon'
                        : undefined
                    }
                  />
                  {typeof weapon.usd === 'number' && weapon.usd > 0 && (
                    <span
                      className="inline-block px-2 py-0.5 rounded text-xs font-mono"
                      style={{
                        background: 'hsla(200,100%,50%,0.1)',
                        color: '#99ddff',
                      }}
                    >
                      ${weapon.usd.toFixed(2)}
                    </span>
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

// ── Tab: Upgrades ─────────────────────────────────────────────────────────────
function UpgradesTab({ coins, setCoins, notify }) {
  const [inv, setInv] = useState(getUpgradeInventory());
  const [equipped, setEquipped] = useState(getEquippedUpgrades());

  const refresh = () => {
    setInv(getUpgradeInventory());
    setEquipped(getEquippedUpgrades());
  };

  const handleBuy = (upgrade) => {
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
      {UPGRADES.map((upgrade) => {
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
            badge={!upgrade.live ? 'CATALOG' : null}
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

                  {!upgrade.live && (
                    <span
                      className="px-1.5 py-0.5 rounded font-mono"
                      style={{
                        fontSize: 9,
                        background: 'hsla(35,100%,50%,0.12)',
                        color: '#ffbb66',
                      }}
                    >
                      FUTURE EFFECT
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
                    cost={upgrade.cost}
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
                  {typeof upgrade.usd === 'number' && upgrade.usd > 0 && (
                    <span
                      className="inline-block px-2 py-0.5 rounded text-xs font-mono"
                      style={{
                        background: 'hsla(200,100%,50%,0.1)',
                        color: '#99ddff',
                      }}
                    >
                      ${upgrade.usd.toFixed(2)}
                    </span>
                  )}
                </div>

                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBuy(upgrade);
                    }}
                    className="px-3 py-1.5 rounded-lg font-mono text-xs font-bold"
                    style={{
                      background: 'hsla(50,100%,50%,0.12)',
                      color: '#ffdd00',
                      border: '1px solid hsla(50,100%,50%,0.25)',
                    }}
                  >
                    BUY
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEquip(upgrade);
                    }}
                    className="px-3 py-1.5 rounded-lg font-mono text-xs font-bold"
                    style={{
                      background: 'hsla(180,100%,50%,0.12)',
                      color: '#00ffff',
                      border: '1px solid hsla(180,100%,50%,0.25)',
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

  const refresh = () => {
    setInv(getSpecialInventory());
    setSelected(getSelectedSpecial());
  };

  const handleBuy = (special) => {
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
    const qty = inv[special.id] || 0;
    if (qty <= 0) {
      notify('Buy one first.', 'error');
      return;
    }

    setSelectedSpecial(special.id);
    setSelected(special.id);
    notify(`${special.name} selected. Gameplay support comes next.`, 'success');
  };

  return (
    <div className="grid grid-cols-1 gap-3">
      {SPECIALS.map((special) => {
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
            badge="COMING SOON"
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
                    cost={special.cost}
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
                  {typeof special.usd === 'number' && special.usd > 0 && (
                    <span
                      className="inline-block px-2 py-0.5 rounded text-xs font-mono"
                      style={{
                        background: 'hsla(200,100%,50%,0.1)',
                        color: '#99ddff',
                      }}
                    >
                      ${special.usd.toFixed(2)}
                    </span>
                  )}
                </div>

                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBuy(special);
                    }}
                    className="px-3 py-1.5 rounded-lg font-mono text-xs font-bold"
                    style={{
                      background: 'hsla(50,100%,50%,0.12)',
                      color: '#ffdd00',
                      border: '1px solid hsla(50,100%,50%,0.25)',
                    }}
                  >
                    BUY
                  </button>

                  {isOwned && (
                    <button
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

  const refresh = () => {
    setOwnedCombos(getOwnedCombos());
  };

  const handleBuy = (combo) => {
    const result = purchaseCombo(combo);
    if (!result.ok && !result.alreadyOwned) {
      notify('Not enough coins!', 'error');
      return;
    }

    if (result.alreadyOwned) {
      notify('You already own this combo.', 'error');
      return;
    }

    setCoins(getCoins());
    refresh();
    notify(`${combo.name} purchased!`, 'success');
  };

  return (
    <div className="grid grid-cols-1 gap-3">
      {COMBO_PACKS.map((combo) => {
        const isOwned = ownedCombos.includes(combo.id);
        const isAffordable = coins >= combo.cost;

        return (
          <ShopCard
            key={combo.id}
            isSelected={false}
            isOwned={isOwned}
            isAffordable={isAffordable}
            onClick={() => handleBuy(combo)}
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
                    style={{ color: isOwned ? '#ff99ff' : '#ffffff' }}
                  >
                    {combo.name}
                  </span>
                  {isOwned && (
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
                    isOwned={isOwned}
                    cost={combo.cost}
                    isAffordable={isAffordable}
                    customText={isOwned ? 'BUNDLE PURCHASED' : undefined}
                  />
                  {typeof combo.usd === 'number' && combo.usd > 0 && (
                    <span
                      className="inline-block px-2 py-0.5 rounded text-xs font-mono"
                      style={{
                        background: 'hsla(200,100%,50%,0.1)',
                        color: '#99ddff',
                      }}
                    >
                      ${combo.usd.toFixed(2)}
                    </span>
                  )}
                  {typeof combo.valueUsd === 'number' && combo.valueUsd > 0 && (
                    <span
                      className="inline-block px-2 py-0.5 rounded text-xs font-mono"
                      style={{
                        background: 'hsla(120,100%,40%,0.12)',
                        color: '#99ffbb',
                      }}
                    >
                      VALUE ${combo.valueUsd.toFixed(2)}
                    </span>
                  )}
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
                        className="px-2 py-0.5 rounded text-xs font-mono"
                        style={{
                          background: 'hsla(180,100%,50%,0.08)',
                          color: '#b8ffff',
                        }}
                      >
                        {entry.id} ×{entry.qty || 1}
                      </span>
                    ))}
                  </div>
                </div>

                {!isOwned && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBuy(combo);
                    }}
                    className="px-3 py-1.5 rounded-lg font-mono text-xs font-bold"
                    style={{
                      background: 'hsla(300,100%,50%,0.12)',
                      color: '#ff99ff',
                      border: '1px solid hsla(300,100%,50%,0.25)',
                    }}
                  >
                    BUY BUNDLE
                  </button>
                )}
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
    { id: 'weapons', label: '🔫 WEAPONS' },
    { id: 'upgrades', label: '⚙️ UPGRADES' },
    { id: 'specials', label: '⚡ SPECIALS' },
    { id: 'combos', label: '🔥 COMBOS' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-20 flex flex-col"
      style={{ background: 'rgba(7,7,26,0.97)' }}
    >
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'hsla(180,100%,50%,0.15)' }}
      >
        <div>
          <h2
            className="font-display text-lg font-black tracking-widest"
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

        <div className="flex items-center gap-3">
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

          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" style={{ color: '#00ffff' }} />
          </button>
        </div>
      </div>

      <div
        className="flex border-b overflow-x-auto"
        style={{ borderColor: 'hsla(180,100%,50%,0.1)' }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex-1 py-2 px-3 font-mono text-xs font-bold transition-all whitespace-nowrap"
            style={{
              color: tab === t.id ? '#00ffff' : 'hsla(180,100%,50%,0.35)',
              borderBottom: tab === t.id ? '2px solid #00ffff' : '2px solid transparent',
              background: tab === t.id ? 'hsla(180,100%,50%,0.05)' : 'transparent',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className="mx-4 mt-2 px-4 py-1.5 rounded-lg text-center font-mono text-xs"
            style={{
              background:
                notification.type === 'success'
                  ? 'hsla(120,100%,40%,0.15)'
                  : 'hsla(0,100%,60%,0.15)',
              border: `1px solid ${
                notification.type === 'success' ? '#00ff4466' : '#ff004466'
              }`,
              color: notification.type === 'success' ? '#00ff44' : '#ff4444',
            }}
          >
            {notification.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto p-3">
        {tab === 'skins' && (
          <SkinsTab
            coins={coins}
            setCoins={setCoins}
            notify={notify}
            onSkinChange={onSkinChange}
            frame={frame}
          />
        )}

        {tab === 'weapons' && (
          <WeaponsTab
            coins={coins}
            setCoins={setCoins}
            notify={notify}
          />
        )}

        {tab === 'upgrades' && (
          <UpgradesTab
            coins={coins}
            setCoins={setCoins}
            notify={notify}
          />
        )}

        {tab === 'specials' && (
          <SpecialsTab
            coins={coins}
            setCoins={setCoins}
            notify={notify}
          />
        )}

        {tab === 'combos' && (
          <CombosTab
            coins={coins}
            setCoins={setCoins}
            notify={notify}
          />
        )}
      </div>

      <div
        className="px-4 py-2 text-center"
        style={{ borderTop: '1px solid hsla(180,100%,50%,0.08)' }}
      >
        <p
          className="font-mono text-[10px]"
          style={{ color: 'hsla(180,100%,50%,0.45)' }}
        >
          Weapons marked SHOP READY / COMING SOON can be purchased now, but their
          gameplay behavior will be wired in the next phase.
        </p>
      </div>
    </motion.div>
  );
}