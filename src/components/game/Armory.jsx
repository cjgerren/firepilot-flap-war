import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, Check } from 'lucide-react';
import { SKINS, drawPlayerSkin } from '../../lib/skins.js';
import { WEAPONS, UPGRADES } from '../../lib/gameItems.js';
import {
  getCoins, spendCoins,
  getOwnedSkins, ownSkin, getSelectedSkin, setSelectedSkin,
  getOwnedWeapons, ownWeapon, getSelectedWeapon, setSelectedWeapon,
  getUpgradeInventory, addUpgradeToInventory, getEquippedUpgrades, setEquippedUpgrades,
  getHighScore,
} from '../../lib/gameStore';

// ── Skin canvas preview ────────────────────────────────────────────────────────
function SkinPreview({ skin, frame }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 80, 80);
    ctx.fillStyle = '#0a0a1a'; ctx.fillRect(0, 0, 80, 80);
    ctx.globalAlpha = 0.1; ctx.strokeStyle = '#00ffff'; ctx.lineWidth = 0.5;
    for (let i = 0; i < 80; i += 16) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 80); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(80, i); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    drawPlayerSkin(ctx, 40, 40, 0, 3, skin, frame);
  }, [skin, frame]);
  return <canvas ref={ref} width={80} height={80} className="rounded-lg flex-shrink-0" />;
}

// ── Reusable shop card ────────────────────────────────────────────────────────
function ShopCard({ isSelected, isOwned, isAffordable, onClick, children, accentColor = '#00ffff', badge }) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="relative rounded-xl p-3 cursor-pointer"
      style={{
        background: isSelected
          ? `linear-gradient(135deg, hsla(180,100%,50%,0.15), hsla(300,100%,50%,0.1))`
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
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: accentColor }}>
          <Check className="w-3 h-3" style={{ color: '#001a1a' }} />
        </div>
      )}
      {badge && !isSelected && (
        <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-xs font-mono font-bold"
          style={{ background: 'hsla(120,100%,40%,0.2)', color: '#00ff88', fontSize: 9 }}>
          {badge}
        </div>
      )}
      {children}
    </motion.div>
  );
}

function StatusBadge({ isSelected, isOwned, isMilestone, cost, milestoneScore, isAffordable, qty }) {
  if (isSelected) return <span className="inline-block px-2 py-0.5 rounded text-xs font-mono font-bold" style={{ background: 'hsla(180,100%,50%,0.2)', color: '#00ffff' }}>EQUIPPED</span>;
  if (isOwned && qty !== undefined) return <span className="inline-block px-2 py-0.5 rounded text-xs font-mono" style={{ background: 'hsla(120,100%,40%,0.15)', color: '#00ff88' }}>OWNED ({qty}) — tap to select</span>;
  if (isOwned) return <span className="inline-block px-2 py-0.5 rounded text-xs font-mono" style={{ background: 'hsla(120,100%,40%,0.15)', color: '#00ff88' }}>OWNED — tap to equip</span>;
  if (isMilestone) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono" style={{ background: 'hsla(50,100%,50%,0.1)', color: '#ffdd00' }}><Lock className="w-2.5 h-2.5" />Score {milestoneScore}+</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono" style={{ background: isAffordable ? 'hsla(50,100%,50%,0.1)' : 'hsla(0,100%,50%,0.1)', color: isAffordable ? '#ffdd00' : '#ff6666' }}>⚡ {cost} coins</span>;
}

// ── Tab: Skins ─────────────────────────────────────────────────────────────────
function SkinsTab({ coins, setCoins, notify, onSkinChange, frame }) {
  const [owned, setOwned] = useState(getOwnedSkins());
  const [selected, setSelected] = useState(getSelectedSkin());
  const highScore = getHighScore();

  const isUnlocked = (s) => owned.includes(s.id) || (s.unlockScore > 0 && highScore >= s.unlockScore);

  const handleBuy = (skin) => {
    const unlocked = isUnlocked(skin);
    if (unlocked) {
      setSelected(skin.id); setSelectedSkin(skin.id); onSkinChange(skin.id); return;
    }
    if (coins < skin.cost) { notify('Not enough coins!', 'error'); return; }
    spendCoins(skin.cost); ownSkin(skin.id);
    setCoins(getCoins()); setOwned(getOwnedSkins());
    setSelected(skin.id); setSelectedSkin(skin.id); onSkinChange(skin.id);
    notify(`${skin.name} unlocked!`, 'success');
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {SKINS.map(skin => {
        const unlocked = isUnlocked(skin);
        const isSelected = selected === skin.id;
        const isMilestone = skin.unlockScore > 0 && !owned.includes(skin.id);
        return (
          <ShopCard key={skin.id} isSelected={isSelected} isOwned={unlocked} isAffordable={coins >= skin.cost} onClick={() => handleBuy(skin)}>
            <div className="flex gap-3 items-start">
              <SkinPreview skin={skin} frame={frame} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 mb-0.5">
                  <span className="text-base">{skin.emoji}</span>
                  <span className="font-display text-xs font-bold truncate" style={{ color: unlocked ? '#00ffff' : '#668888' }}>{skin.name}</span>
                </div>
                <p className="font-mono leading-relaxed mb-2" style={{ color: 'hsla(180,50%,60%,0.6)', fontSize: 9 }}>{skin.desc}</p>
                <StatusBadge isSelected={isSelected} isOwned={unlocked} isMilestone={isMilestone} cost={skin.cost} milestoneScore={skin.unlockScore} isAffordable={coins >= skin.cost} />
              </div>
            </div>
          </ShopCard>
        );
      })}
    </div>
  );
}

// ── Tab: Weapons ───────────────────────────────────────────────────────────────
function WeaponsTab({ coins, setCoins, notify }) {
  const [owned, setOwned] = useState(getOwnedWeapons());
  const [selected, setSelected] = useState(getSelectedWeapon());

  const handleBuy = (w) => {
    if (owned.includes(w.id)) {
      setSelected(w.id); setSelectedWeapon(w.id); return;
    }
    if (coins < w.cost) { notify('Not enough coins!', 'error'); return; }
    spendCoins(w.cost); ownWeapon(w.id);
    setCoins(getCoins()); setOwned(getOwnedWeapons());
    setSelected(w.id); setSelectedWeapon(w.id);
    notify(`${w.name} unlocked!`, 'success');
  };

  const weaponColors = { blaster: '#ffff00', blaster2: '#ff8800', rocket: '#ff4400', auto: '#00ffff', lightning: '#ffffff' };

  return (
    <div className="grid grid-cols-1 gap-3">
      {WEAPONS.map(w => {
        const isOwned = owned.includes(w.id);
        const isSelected = selected === w.id;
        const color = weaponColors[w.id] || '#ffff00';
        return (
          <ShopCard key={w.id} isSelected={isSelected} isOwned={isOwned} isAffordable={coins >= w.cost} onClick={() => handleBuy(w)} accentColor={color}>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `hsla(0,0%,0%,0.4)`, border: `1px solid ${color}44` }}>
                <span className="text-3xl">{w.emoji}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-display text-sm font-bold" style={{ color: isOwned ? color : '#668888' }}>{w.name}</span>
                  {w.type === 'lightning' && <span className="px-1.5 py-0.5 rounded font-mono" style={{ fontSize: 9, background: 'hsla(0,0%,100%,0.1)', color: '#aaaaaa' }}>CHARGE-BASED</span>}
                </div>
                <p className="font-mono mb-2" style={{ color: 'hsla(180,50%,60%,0.6)', fontSize: 10 }}>{w.desc}</p>
                <StatusBadge isSelected={isSelected} isOwned={isOwned} cost={w.cost} isAffordable={coins >= w.cost} />
              </div>
            </div>
          </ShopCard>
        );
      })}
    </div>
  );
}

// ── Tab: Upgrades ──────────────────────────────────────────────────────────────
function UpgradesTab({ coins, setCoins, notify }) {
  const [inv, setInv] = useState(getUpgradeInventory());
  const [equipped, setEquipped] = useState(getEquippedUpgrades());

  const refreshInv = () => { setInv(getUpgradeInventory()); setEquipped(getEquippedUpgrades()); };

  const handleBuy = (u) => {
    if (coins < u.cost) { notify('Not enough coins!', 'error'); return; }
    spendCoins(u.cost); addUpgradeToInventory(u.id);
    setCoins(getCoins()); refreshInv();
    notify(`${u.name} added to inventory!`, 'success');
  };

  const handleEquip = (u) => {
    const stock = inv[u.id] || 0;
    const eq = equipped[u.id] || 0;
    const available = stock - eq;
    if (available <= 0) { notify('None in inventory! Buy first.', 'error'); return; }
    const newEq = { ...equipped, [u.id]: eq + 1 };
    setEquippedUpgrades(newEq); setEquipped(newEq);
    notify(`${u.name} equipped for next run!`, 'success');
  };

  const handleUnequip = (u) => {
    const eq = equipped[u.id] || 0;
    if (eq <= 0) return;
    const newEq = { ...equipped, [u.id]: eq - 1 };
    if (newEq[u.id] === 0) delete newEq[u.id];
    setEquippedUpgrades(newEq); setEquipped(newEq);
  };

  const upgradeColors = { shield1: '#00ccff', shield2: '#aa44ff', tunnelbomb: '#ff6600' };

  return (
    <div className="grid grid-cols-1 gap-3">
      {UPGRADES.map(u => {
        const stock = inv[u.id] || 0;
        const eq = equipped[u.id] || 0;
        const available = stock - eq;
        const color = upgradeColors[u.id] || '#00ffff';

        return (
          <div key={u.id} className="rounded-xl p-3" style={{ background: 'hsla(230,25%,10%,0.8)', border: `1px solid hsla(0,0%,100%,0.08)` }}>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `hsla(0,0%,0%,0.4)`, border: `1px solid ${color}44` }}>
                <span className="text-3xl">{u.emoji}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-display text-sm font-bold" style={{ color }}>{u.name}</span>
                  <span className="px-1.5 py-0.5 rounded font-mono" style={{ fontSize: 9, background: 'hsla(0,0%,100%,0.1)', color: '#aaaaaa' }}>CONSUMABLE</span>
                </div>
                <p className="font-mono mb-2" style={{ color: 'hsla(180,50%,60%,0.6)', fontSize: 10 }}>{u.desc}</p>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Buy */}
                  <button onClick={() => handleBuy(u)}
                    className="px-3 py-1 rounded font-mono text-xs transition-all hover:scale-105 active:scale-95"
                    style={{ background: coins >= u.cost ? `hsla(0,0%,100%,0.08)` : 'hsla(0,100%,50%,0.08)', border: `1px solid ${coins >= u.cost ? color + '55' : '#ff444455'}`, color: coins >= u.cost ? color : '#ff6666' }}>
                    ⚡ {u.cost} — BUY
                  </button>

                  {/* Equip / unequip controls */}
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => handleUnequip(u)}
                      className="w-6 h-6 rounded font-mono text-xs flex items-center justify-center transition-all hover:scale-110"
                      style={{ background: 'hsla(0,100%,50%,0.1)', border: '1px solid #ff444433', color: '#ff6666' }}>−</button>
                    <span className="font-mono text-xs" style={{ color: eq > 0 ? color : '#446666', minWidth: 60, textAlign: 'center' }}>
                      {eq > 0 ? `${eq} EQUIPPED` : 'NOT EQUIPPED'}
                    </span>
                    <button onClick={() => handleEquip(u)}
                      className="w-6 h-6 rounded font-mono text-xs flex items-center justify-center transition-all hover:scale-110"
                      style={{ background: `hsla(0,0%,100%,0.08)`, border: `1px solid ${color}44`, color }}>+</button>
                  </div>

                  {/* Inventory count */}
                  <span className="font-mono text-xs" style={{ color: '#446666' }}>
                    ({available} avail.)
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <p className="font-mono text-center text-xs mt-1" style={{ color: 'hsla(180,100%,50%,0.3)' }}>
        Equip upgrades before each run. Consumables are used up when activated.
      </p>
    </div>
  );
}

// ── Main Armory component ──────────────────────────────────────────────────────
export default function Armory({ onClose, onSkinChange }) {
  const [coins, setCoins] = useState(getCoins());
  const [tab, setTab] = useState('skins');
  const [notification, setNotification] = useState(null);
  const [frame, setFrame] = useState(0);
  const highScore = getHighScore();

  useEffect(() => {
    const id = setInterval(() => setFrame(f => f + 1), 50);
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
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 z-20 flex flex-col"
      style={{ background: 'rgba(7,7,26,0.97)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'hsla(180,100%,50%,0.15)' }}>
        <div>
          <h2 className="font-display text-lg font-black tracking-widest" style={{ color: '#00ffff', textShadow: '0 0 15px #00ffff66' }}>ARMORY</h2>
          <p className="font-mono text-xs" style={{ color: 'hsla(180,100%,50%,0.4)' }}>Best: {highScore} pts</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: 'hsla(50,100%,50%,0.1)', border: '1px solid hsla(50,100%,50%,0.3)' }}>
            <span style={{ color: '#ffdd00' }}>⚡</span>
            <span className="font-display font-bold text-sm" style={{ color: '#ffdd00' }}>{coins}</span>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" style={{ color: '#00ffff' }} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b" style={{ borderColor: 'hsla(180,100%,50%,0.1)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex-1 py-2 font-mono text-xs font-bold transition-all"
            style={{
              color: tab === t.id ? '#00ffff' : 'hsla(180,100%,50%,0.35)',
              borderBottom: tab === t.id ? '2px solid #00ffff' : '2px solid transparent',
              background: tab === t.id ? 'hsla(180,100%,50%,0.05)' : 'transparent',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }}
            className="mx-4 mt-2 px-4 py-1.5 rounded-lg text-center font-mono text-xs"
            style={{
              background: notification.type === 'success' ? 'hsla(120,100%,40%,0.15)' : 'hsla(0,100%,60%,0.15)',
              border: `1px solid ${notification.type === 'success' ? '#00ff4466' : '#ff004466'}`,
              color: notification.type === 'success' ? '#00ff44' : '#ff4444',
            }}>
            {notification.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {tab === 'skins' && <SkinsTab coins={coins} setCoins={setCoins} notify={notify} onSkinChange={onSkinChange} frame={frame} />}
        {tab === 'weapons' && <WeaponsTab coins={coins} setCoins={setCoins} notify={notify} />}
        {tab === 'upgrades' && <UpgradesTab coins={coins} setCoins={setCoins} notify={notify} />}
      </div>

      <div className="px-4 py-2 text-center" style={{ borderTop: '1px solid hsla(180,100%,50%,0.08)' }}>
        <p className="font-mono text-xs" style={{ color: 'hsla(180,100%,50%,0.25)' }}>
          Earn coins: 1/score pt + 2/kill
        </p>
      </div>
    </motion.div>
  );
}