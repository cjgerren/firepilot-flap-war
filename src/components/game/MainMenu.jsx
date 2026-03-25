import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, ShoppingBag, Trophy, Zap, RotateCcw } from 'lucide-react';
import Armory from './Armory.jsx';
import { getCoins, getHighScore } from '../../lib/gameStore';

export default function MainMenu({ gameState, score, kills, coinsEarned, onStart, onSkinChange }) {
  const [showShop, setShowShop] = useState(false);
  const [coins, setCoins] = useState(getCoins());
  const highScore = getHighScore();

  const refreshCoins = () => setCoins(getCoins());

  if (gameState !== 'idle' && gameState !== 'gameover') return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={gameState}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 flex flex-col items-center justify-center z-10"
        style={{ background: gameState === 'gameover'
          ? 'radial-gradient(ellipse at center, hsla(0,80%,10%,0.75) 0%, hsla(230,25%,7%,0.92) 100%)'
          : 'radial-gradient(ellipse at center, hsla(230,25%,10%,0.75) 0%, hsla(230,25%,7%,0.92) 100%)'
        }}
      >
        {/* Shop overlay */}
        <AnimatePresence>
          {showShop && (
            <Armory
              onClose={() => { setShowShop(false); refreshCoins(); }}
              onSkinChange={onSkinChange}
            />
          )}
        </AnimatePresence>

        {/* ── IDLE SCREEN ── */}
        {gameState === 'idle' && (
          <div className="flex flex-col items-center">
            <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.05 }} className="text-center mb-6">
              <h1 className="font-display text-5xl font-black tracking-wider"
                style={{ color: '#00ffff', textShadow: '0 0 24px #00ffff88, 0 0 50px #00ffff33' }}>
                FIREPILOT: FLAP WAR v1.0
              </h1>
              <p className="font-mono text-xs tracking-widest mt-1" style={{ color: '#ff00ff', textShadow: '0 0 10px #ff00ff55' }}>
                {'>> NAVIGATE THE DATA STREAM <<'}
              </p>
            </motion.div>

            {/* Stats row */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
              className="flex gap-4 mb-6">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                style={{ background: 'hsla(180,100%,50%,0.07)', border: '1px solid hsla(180,100%,50%,0.2)' }}>
                <Trophy className="w-3.5 h-3.5" style={{ color: '#00ffff' }} />
                <span className="font-mono text-xs" style={{ color: '#00ffff' }}>BEST: {highScore}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                style={{ background: 'hsla(50,100%,50%,0.07)', border: '1px solid hsla(50,100%,50%,0.2)' }}>
                <span style={{ color: '#ffdd00', fontSize: 13 }}>⚡</span>
                <span className="font-mono text-xs" style={{ color: '#ffdd00' }}>{coins} COINS</span>
              </div>
            </motion.div>

            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2 }}
              className="flex flex-col items-center gap-3">
              <button onClick={onStart} className="flex items-center gap-3 px-10 py-4 rounded-xl font-display text-xl font-bold tracking-wider transition-all hover:scale-105 active:scale-95"
                style={{ background: 'linear-gradient(135deg,hsla(180,100%,50%,0.18),hsla(300,100%,50%,0.12))', border: '1px solid #00ffff', color: '#00ffff', boxShadow: '0 0 25px hsla(180,100%,50%,0.25)' }}>
                <Play className="w-5 h-5" /> LAUNCH
              </button>
              <button onClick={() => setShowShop(true)} className="flex items-center gap-3 px-8 py-3 rounded-xl font-display text-sm font-bold tracking-wider transition-all hover:scale-105 active:scale-95"
                style={{ background: 'hsla(50,100%,50%,0.08)', border: '1px solid hsla(50,100%,50%,0.35)', color: '#ffdd00' }}>
                <ShoppingBag className="w-4 h-4" /> ARMORY
              </button>
            </motion.div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mt-5 flex gap-6">
              <div className="text-center">
                <p className="font-mono text-xs font-bold mb-0.5" style={{ color: 'hsla(180,100%,50%,0.6)' }}>FLY</p>
                <p className="font-mono" style={{ color: 'hsla(180,100%,50%,0.35)', fontSize: 10 }}>SPACE / LEFT TAP</p>
              </div>
              <div className="text-center">
                <p className="font-mono text-xs font-bold mb-0.5" style={{ color: 'hsla(60,100%,50%,0.6)' }}>SHOOT</p>
                <p className="font-mono" style={{ color: 'hsla(60,100%,50%,0.35)', fontSize: 10 }}>F / RIGHT TAP</p>
              </div>
            </motion.div>
          </div>
        )}

        {/* ── GAME OVER SCREEN ── */}
        {gameState === 'gameover' && (
          <div className="flex flex-col items-center">
            <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 14 }} className="text-center mb-4">
              <h2 className="font-display text-4xl font-black tracking-wider"
                style={{ color: '#ff0066', textShadow: '0 0 20px #ff006688' }}>
                SYSTEM CRASH
              </h2>
              <p className="font-mono text-xs tracking-widest mt-1" style={{ color: '#ff006666' }}>CONNECTION TERMINATED</p>
            </motion.div>

            {/* Stats */}
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
              className="grid grid-cols-3 gap-4 mb-4">
              {[
                { label: 'SCORE', value: score, color: '#00ffff', icon: <Zap className="w-3.5 h-3.5" /> },
                { label: 'BEST', value: highScore, color: '#ff00ff', icon: <Trophy className="w-3.5 h-3.5" /> },
                { label: 'KILLS', value: kills, color: '#ff4400', icon: <Zap className="w-3.5 h-3.5" /> },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1" style={{ color: s.color, opacity: 0.6 }}>
                    {s.icon}
                    <span className="font-mono text-xs">{s.label}</span>
                  </div>
                  <p className="font-display text-2xl font-black" style={{ color: s.color, textShadow: `0 0 12px ${s.color}66` }}>{s.value}</p>
                </div>
              ))}
            </motion.div>

            {/* Coins earned */}
            {coinsEarned > 0 && (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.35, type: 'spring' }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg mb-4"
                style={{ background: 'hsla(50,100%,50%,0.1)', border: '1px solid hsla(50,100%,50%,0.3)' }}>
                <span style={{ color: '#ffdd00' }}>⚡</span>
                <span className="font-mono text-sm font-bold" style={{ color: '#ffdd00' }}>+{coinsEarned} coins earned!</span>
                <span className="font-mono text-xs" style={{ color: 'hsla(50,100%,50%,0.5)' }}>({coins} total)</span>
              </motion.div>
            )}

            {score >= highScore && score > 0 && (
              <motion.p initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: 'spring' }}
                className="font-display text-sm font-bold tracking-widest mb-4"
                style={{ color: '#ffff00', textShadow: '0 0 15px #ffff0066' }}>
                ★ NEW HIGH SCORE ★
              </motion.p>
            )}

            <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.4 }}
              className="flex flex-col items-center gap-3">
              <button onClick={onStart} className="flex items-center gap-3 px-8 py-4 rounded-xl font-display text-lg font-bold tracking-wider hover:scale-105 active:scale-95 transition-all"
                style={{ background: 'linear-gradient(135deg,hsla(180,100%,50%,0.15),hsla(300,100%,50%,0.1))', border: '1px solid #00ffff', color: '#00ffff', boxShadow: '0 0 20px hsla(180,100%,50%,0.2)' }}>
                <RotateCcw className="w-5 h-5" /> REBOOT
              </button>
              <button onClick={() => setShowShop(true)} className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-mono text-sm hover:scale-105 active:scale-95 transition-all"
                style={{ background: 'hsla(50,100%,50%,0.08)', border: '1px solid hsla(50,100%,50%,0.3)', color: '#ffdd00' }}>
                <ShoppingBag className="w-4 h-4" /> Armory ({coins} ⚡)
              </button>
            </motion.div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}