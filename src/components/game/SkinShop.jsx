import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, Check, ShoppingCart, Coins } from 'lucide-react';
import { SKINS, drawPlayerSkin } from '../../lib/skins';
import { getCoins, spendCoins, getOwnedSkins, ownSkin, getSelectedSkin, setSelectedSkin, getHighScore } from '../../lib/gameStore';

function SkinPreview({ skin, frame }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 80, 80);
    // Dark bg
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, 80, 80);
    // Subtle grid
    ctx.globalAlpha = 0.1;
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 80; i += 16) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 80); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(80, i); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    drawPlayerSkin(ctx, 40, 40, 0, 3, skin, frame);
  }, [skin, frame]);

  return <canvas ref={canvasRef} width={80} height={80} className="rounded-lg" />;
}

export default function SkinShop({ onClose, onSkinChange }) {
  const [coins, setCoins] = useState(getCoins());
  const [owned, setOwned] = useState(getOwnedSkins());
  const [selected, setSelected] = useState(getSelectedSkin());
  const [frame, setFrame] = useState(0);
  const [notification, setNotification] = useState(null);
  const highScore = getHighScore();

  // Animate previews
  useEffect(() => {
    const id = setInterval(() => setFrame(f => f + 1), 50);
    return () => clearInterval(id);
  }, []);

  const isUnlocked = (skin) => {
    if (owned.includes(skin.id)) return true;
    if (skin.unlockScore > 0 && highScore >= skin.unlockScore) return true;
    return false;
  };

  const canAfford = (skin) => coins >= skin.cost;

  const handleSelect = (skin) => {
    if (!isUnlocked(skin)) return;
    setSelected(skin.id);
    setSelectedSkin(skin.id);
    onSkinChange(skin.id);
  };

  const handleBuy = (skin) => {
    if (isUnlocked(skin)) { handleSelect(skin); return; }
    if (!canAfford(skin)) {
      setNotification({ msg: 'Not enough coins!', type: 'error' });
      setTimeout(() => setNotification(null), 2000);
      return;
    }
    spendCoins(skin.cost);
    ownSkin(skin.id);
    setCoins(getCoins());
    setOwned(getOwnedSkins());
    handleSelect(skin);
    setNotification({ msg: `${skin.name} unlocked!`, type: 'success' });
    setTimeout(() => setNotification(null), 2500);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-20 flex flex-col"
      style={{ background: 'rgba(7,7,26,0.97)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'hsla(180,100%,50%,0.15)' }}>
        <div>
          <h2 className="font-display text-xl font-black tracking-widest" style={{ color: '#00ffff', textShadow: '0 0 15px #00ffff66' }}>
            SKIN SHOP
          </h2>
          <p className="font-mono text-xs mt-0.5" style={{ color: 'hsla(180,100%,50%,0.45)' }}>
            Best Score: {highScore} pts
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'hsla(50,100%,50%,0.1)', border: '1px solid hsla(50,100%,50%,0.3)' }}>
            <span style={{ color: '#ffdd00', fontSize: 16 }}>⚡</span>
            <span className="font-display font-bold" style={{ color: '#ffdd00' }}>{coins}</span>
            <span className="font-mono text-xs" style={{ color: 'hsla(50,100%,50%,0.6)' }}>COINS</span>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg transition-colors hover:bg-white/10">
            <X className="w-5 h-5" style={{ color: '#00ffff' }} />
          </button>
        </div>
      </div>

      {/* Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }}
            className="mx-6 mt-3 px-4 py-2 rounded-lg text-center font-mono text-sm"
            style={{
              background: notification.type === 'success' ? 'hsla(120,100%,40%,0.15)' : 'hsla(0,100%,60%,0.15)',
              border: `1px solid ${notification.type === 'success' ? '#00ff4466' : '#ff004466'}`,
              color: notification.type === 'success' ? '#00ff44' : '#ff4444',
            }}
          >
            {notification.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
        {SKINS.map(skin => {
          const unlocked = isUnlocked(skin);
          const isSelected = selected === skin.id;
          const affordable = canAfford(skin);
          const milestoneUnlock = skin.unlockScore > 0 && !owned.includes(skin.id);

          return (
            <motion.div
              key={skin.id}
              whileHover={{ scale: unlocked ? 1.02 : 1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleBuy(skin)}
              className="relative rounded-xl p-3 cursor-pointer transition-all"
              style={{
                background: isSelected
                  ? 'linear-gradient(135deg, hsla(180,100%,50%,0.15), hsla(300,100%,50%,0.1))'
                  : 'hsla(230,25%,10%,0.8)',
                border: isSelected
                  ? '1px solid hsla(180,100%,50%,0.6)'
                  : unlocked
                    ? '1px solid hsla(180,100%,50%,0.2)'
                    : '1px solid hsla(0,0%,100%,0.08)',
                opacity: !unlocked && !affordable ? 0.6 : 1,
              }}
            >
              {/* Selected badge */}
              {isSelected && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: '#00ffff' }}>
                  <Check className="w-3 h-3" style={{ color: '#001a1a' }} />
                </div>
              )}

              <div className="flex gap-3 items-start">
                <SkinPreview skin={skin} frame={frame} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-base">{skin.emoji}</span>
                    <span className="font-display text-xs font-bold truncate" style={{ color: unlocked ? '#00ffff' : '#668888' }}>
                      {skin.name}
                    </span>
                  </div>
                  <p className="font-mono text-xs leading-relaxed mb-2" style={{ color: 'hsla(180,50%,60%,0.6)', fontSize: 10 }}>
                    {skin.desc}
                  </p>

                  {/* Status badge */}
                  {isSelected ? (
                    <span className="inline-block px-2 py-0.5 rounded text-xs font-mono font-bold" style={{ background: 'hsla(180,100%,50%,0.2)', color: '#00ffff' }}>
                      EQUIPPED
                    </span>
                  ) : unlocked ? (
                    <span className="inline-block px-2 py-0.5 rounded text-xs font-mono" style={{ background: 'hsla(120,100%,40%,0.15)', color: '#00ff88' }}>
                      OWNED — tap to equip
                    </span>
                  ) : milestoneUnlock ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono" style={{ background: 'hsla(50,100%,50%,0.1)', color: '#ffdd00' }}>
                      <Lock className="w-2.5 h-2.5" />
                      Score {skin.unlockScore}+
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono" style={{
                      background: affordable ? 'hsla(50,100%,50%,0.1)' : 'hsla(0,100%,50%,0.1)',
                      color: affordable ? '#ffdd00' : '#ff6666'
                    }}>
                      ⚡ {skin.cost} coins
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="px-6 py-3 text-center" style={{ borderTop: '1px solid hsla(180,100%,50%,0.1)' }}>
        <p className="font-mono text-xs" style={{ color: 'hsla(180,100%,50%,0.3)' }}>
          Earn coins by playing: 1 coin/score point + 2 per kill
        </p>
      </div>
    </motion.div>
  );
}