import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  ShoppingBag,
  Trophy,
  Zap,
  RotateCcw,
  Coins,
  X,
} from 'lucide-react';
import Armory from './Armory.jsx';
import { getCoins, getHighScore } from '../../lib/gameStore';
import { buyCoins, COIN_PACKS } from '../../lib/payments';
import { useAuth } from '../../lib/AuthContext';

export default function MainMenu({
  gameState,
  score,
  kills,
  coinsEarned,
  onStart,
  onSkinChange,
}) {
  const [showShop, setShowShop] = useState(false);
  const [showCoinShop, setShowCoinShop] = useState(false);
  const [coins, setCoins] = useState(getCoins());
  const [buyingPackId, setBuyingPackId] = useState(null);
  const { user, loading } = useAuth();

  const highScore = getHighScore();

  const refreshCoins = () => setCoins(getCoins());

  useEffect(() => {
    const handleStorageChange = () => {
      refreshCoins();
    };

    const handleFocus = () => {
      refreshCoins();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const coinPacks = useMemo(() => {
    const fallbackPacks = [
      { id: '100', coins: 100, price: '$1.99' },
      { id: '200', coins: 200, price: '$2.99', tag: 'Starter' },
      { id: '500', coins: 500, price: '$5.99', tag: 'Popular' },
      { id: '1200', coins: 1200, price: '$11.99' },
      { id: '2500', coins: 2500, price: '$19.99', tag: 'Best Value' },
      { id: '5000', coins: 5000, price: '$34.99', tag: 'Mega Pack' },
    ];

    if (!Array.isArray(COIN_PACKS) || COIN_PACKS.length === 0) {
      return fallbackPacks;
    }

    return COIN_PACKS.map((pack, index) => {
      const tagMap = {
        100: null,
        200: 'Starter',
        500: 'Popular',
        1200: null,
        2500: 'Best Value',
        5000: 'Mega Pack',
      };

      const priceLabel =
        pack.priceLabel ||
        pack.label ||
        (typeof pack.amount === 'number'
          ? `$${(pack.amount / 100).toFixed(2)}`
          : fallbackPacks[index]?.price || '');

      return {
        ...pack,
        id: pack.id || String(pack.coins),
        price: priceLabel,
        tag: pack.tag ?? tagMap[pack.coins] ?? null,
      };
    });
  }, []);

  const handleCoinPurchase = async (pack) => {
    if (loading) {
      alert('Auth is still loading. Please wait a moment and try again.');
      return;
    }

    if (!user?.id) {
      alert('You must be logged in to buy coins.');
      return;
    }

    try {
      setBuyingPackId(pack.id || String(pack.coins));
      await buyCoins(pack, user.id);
    } finally {
      setBuyingPackId(null);
    }
  };

  const panelBaseStyle = {
    background: 'rgba(7, 10, 20, 0.92)',
    border: '1px solid rgba(0, 255, 255, 0.22)',
    boxShadow: '0 0 35px rgba(0, 255, 255, 0.16)',
    backdropFilter: 'blur(10px)',
  };

  const renderCoinShopModal = () => (
    <AnimatePresence>
      {showCoinShop && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowCoinShop(false)}
            className="fixed inset-0"
            style={{
              zIndex: 1000000,
              background: 'rgba(0,0,0,0.72)',
              backdropFilter: 'blur(6px)',
            }}
          />

          <div
            className="fixed inset-0 flex items-center justify-center p-4"
            style={{ zIndex: 1000001 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: 'spring', stiffness: 220, damping: 20 }}
              className="w-full max-w-3xl rounded-2xl overflow-hidden flex flex-col"
              style={{
                ...panelBaseStyle,
                maxHeight: '90vh',
              }}
            >
              <div className="flex items-start justify-between gap-4 p-5 md:p-6 border-b border-white/10">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Coins className="w-5 h-5" style={{ color: '#ffdd00' }} />
                    <h2
                      className="font-display text-2xl font-black tracking-wider"
                      style={{
                        color: '#ffdd00',
                        textShadow: '0 0 18px rgba(255, 221, 0, 0.28)',
                      }}
                    >
                      BUY COINS
                    </h2>
                  </div>
                  <p
                    className="font-mono text-xs md:text-sm"
                    style={{ color: 'rgba(255,255,255,0.65)' }}
                  >
                    Power up your run with more coins for weapons, upgrades, and skins.
                  </p>
                </div>

                <button
                  onClick={() => setShowCoinShop(false)}
                  className="flex items-center justify-center rounded-lg transition-all hover:scale-105 active:scale-95 shrink-0"
                  style={{
                    width: 40,
                    height: 40,
                    border: '1px solid rgba(255,255,255,0.14)',
                    background: 'rgba(255,255,255,0.05)',
                    color: '#ffffff',
                  }}
                  aria-label="Close coin shop"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="overflow-y-auto p-5 md:p-6">
                <div
                  className="flex items-center justify-between rounded-xl px-4 py-3 mb-5"
                  style={{
                    background: 'rgba(255, 221, 0, 0.07)',
                    border: '1px solid rgba(255, 221, 0, 0.18)',
                  }}
                >
                  <span
                    className="font-mono text-xs md:text-sm"
                    style={{ color: 'rgba(255,255,255,0.75)' }}
                  >
                    Current Balance
                  </span>
                  <span
                    className="font-display text-lg font-black"
                    style={{
                      color: '#ffdd00',
                      textShadow: '0 0 12px rgba(255, 221, 0, 0.24)',
                    }}
                  >
                    {coins} COINS
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {coinPacks.map((pack) => {
                    const packId = pack.id || String(pack.coins);
                    const isBuying = buyingPackId === packId;

                    return (
                      <motion.div
                        key={packId}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="relative rounded-2xl p-4"
                        style={{
                          background:
                            'linear-gradient(135deg, rgba(255,221,0,0.08), rgba(0,255,255,0.05))',
                          border: '1px solid rgba(255,255,255,0.1)',
                          boxShadow: '0 0 18px rgba(255,255,255,0.04)',
                        }}
                      >
                        {pack.tag && (
                          <div
                            className="absolute right-3 top-3 rounded-full px-2.5 py-1"
                            style={{
                              background:
                                pack.tag === 'Best Value'
                                  ? 'rgba(0,255,255,0.14)'
                                  : 'rgba(255,0,255,0.12)',
                              border:
                                pack.tag === 'Best Value'
                                  ? '1px solid rgba(0,255,255,0.28)'
                                  : '1px solid rgba(255,0,255,0.24)',
                            }}
                          >
                            <span
                              className="font-mono text-[10px] font-bold tracking-wider"
                              style={{
                                color: pack.tag === 'Best Value' ? '#00ffff' : '#ff66ff',
                              }}
                            >
                              {pack.tag.toUpperCase()}
                            </span>
                          </div>
                        )}

                        <div className="mb-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span style={{ color: '#ffdd00', fontSize: 18 }}>⚡</span>
                            <h3
                              className="font-display text-2xl font-black"
                              style={{ color: '#ffffff' }}
                            >
                              {pack.coins.toLocaleString()}
                            </h3>
                          </div>
                          <p
                            className="font-mono text-xs tracking-wider"
                            style={{ color: 'rgba(255,255,255,0.58)' }}
                          >
                            COINS
                          </p>
                        </div>

                        <div className="flex items-end justify-between gap-3">
                          <div>
                            <p
                              className="font-display text-xl font-black"
                              style={{
                                color: '#00ffff',
                                textShadow: '0 0 10px rgba(0,255,255,0.2)',
                              }}
                            >
                              {pack.price}
                            </p>
                          </div>

                          <button
                            onClick={() => handleCoinPurchase(pack)}
                            disabled={loading || isBuying}
                            className="px-4 py-2.5 rounded-xl font-display text-sm font-bold tracking-wider transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed"
                            style={{
                              background:
                                'linear-gradient(135deg, rgba(0,255,255,0.18), rgba(255,0,255,0.12))',
                              border: '1px solid rgba(0,255,255,0.45)',
                              color: '#00ffff',
                              opacity: loading || isBuying ? 0.65 : 1,
                            }}
                          >
                            {isBuying ? 'OPENING...' : 'BUY NOW'}
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={gameState}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 flex flex-col items-center justify-center"
        style={{ zIndex: 999999 }}
      >
        <AnimatePresence>
          {showShop && (
            <Armory
              onClose={() => {
                setShowShop(false);
                refreshCoins();
              }}
              onSkinChange={onSkinChange}
            />
          )}
        </AnimatePresence>

        {renderCoinShopModal()}

        {gameState === 'idle' && (
          <div className="flex flex-col items-center">
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.05 }}
              className="text-center mb-6"
            >
              <h1
                className="font-display text-5xl font-black tracking-wider"
                style={{
                  color: '#00ffff',
                  textShadow: '0 0 24px #00ffff88, 0 0 50px #00ffff33',
                }}
              >
                FIREPILOT: FLAP WAR v1.0
              </h1>
              <p
                className="font-mono text-xs tracking-widest mt-1"
                style={{
                  color: '#ff00ff',
                  textShadow: '0 0 10px #ff00ff55',
                }}
              >
                {'>> NAVIGATE THE DATA STREAM <<'}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="flex gap-4 mb-6"
            >
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                style={{
                  background: 'hsla(180,100%,50%,0.07)',
                  border: '1px solid hsla(180,100%,50%,0.2)',
                }}
              >
                <Trophy className="w-3.5 h-3.5" style={{ color: '#00ffff' }} />
                <span className="font-mono text-xs" style={{ color: '#00ffff' }}>
                  BEST: {highScore}
                </span>
              </div>
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                style={{
                  background: 'hsla(50,100%,50%,0.07)',
                  border: '1px solid hsla(50,100%,50%,0.2)',
                }}
              >
                <span style={{ color: '#ffdd00', fontSize: 13 }}>⚡</span>
                <span className="font-mono text-xs" style={{ color: '#ffdd00' }}>
                  {coins} COINS
                </span>
              </div>
            </motion.div>

            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex flex-col items-center gap-3"
            >
              <button
                onClick={onStart}
                className="flex items-center gap-3 px-10 py-4 rounded-xl font-display text-xl font-bold tracking-wider transition-all hover:scale-105 active:scale-95"
                style={{
                  background:
                    'linear-gradient(135deg,hsla(180,100%,50%,0.18),hsla(300,100%,50%,0.12))',
                  border: '1px solid #00ffff',
                  color: '#00ffff',
                  boxShadow: '0 0 25px hsla(180,100%,50%,0.25)',
                }}
              >
                <Play className="w-5 h-5" /> LAUNCH
              </button>

              <button
                onClick={() => setShowShop(true)}
                className="flex items-center gap-3 px-8 py-3 rounded-xl font-display text-sm font-bold tracking-wider transition-all hover:scale-105 active:scale-95"
                style={{
                  background: 'hsla(50,100%,50%,0.08)',
                  border: '1px solid hsla(50,100%,50%,0.35)',
                  color: '#ffdd00',
                }}
              >
                <ShoppingBag className="w-4 h-4" /> ARMORY
              </button>

              <button
                onClick={() => setShowCoinShop(true)}
                className="flex items-center gap-3 px-8 py-3 rounded-xl font-display text-sm font-bold tracking-wider transition-all hover:scale-105 active:scale-95"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(255,221,0,0.12), rgba(0,255,255,0.08))',
                  border: '1px solid rgba(255,221,0,0.4)',
                  color: '#ffdd00',
                  boxShadow: '0 0 18px rgba(255,221,0,0.14)',
                }}
              >
                <Coins className="w-4 h-4" /> BUY COINS
              </button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="mt-5 flex gap-6"
            >
              <div className="text-center">
                <p
                  className="font-mono text-xs font-bold mb-0.5"
                  style={{ color: 'hsla(180,100%,50%,0.6)' }}
                >
                  FLY
                </p>
                <p
                  className="font-mono"
                  style={{ color: 'hsla(180,100%,50%,0.35)', fontSize: 10 }}
                >
                  SPACE / LEFT TAP
                </p>
              </div>
              <div className="text-center">
                <p
                  className="font-mono text-xs font-bold mb-0.5"
                  style={{ color: 'hsla(60,100%,50%,0.6)' }}
                >
                  SHOOT
                </p>
                <p
                  className="font-mono"
                  style={{ color: 'hsla(60,100%,50%,0.35)', fontSize: 10 }}
                >
                  F / RIGHT TAP
                </p>
              </div>
            </motion.div>
          </div>
        )}

        {gameState === 'gameover' && (
          <div className="flex flex-col items-center">
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 14 }}
              className="text-center mb-4"
            >
              <h2
                className="font-display text-4xl font-black tracking-wider"
                style={{ color: '#ff0066', textShadow: '0 0 20px #ff006688' }}
              >
                SYSTEM CRASH
              </h2>
              <p
                className="font-mono text-xs tracking-widest mt-1"
                style={{ color: '#ff006666' }}
              >
                CONNECTION TERMINATED
              </p>
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="grid grid-cols-3 gap-4 mb-4"
            >
              {[
                {
                  label: 'SCORE',
                  value: score,
                  color: '#00ffff',
                  icon: <Zap className="w-3.5 h-3.5" />,
                },
                {
                  label: 'BEST',
                  value: highScore,
                  color: '#ff00ff',
                  icon: <Trophy className="w-3.5 h-3.5" />,
                },
                {
                  label: 'KILLS',
                  value: kills,
                  color: '#ff4400',
                  icon: <Zap className="w-3.5 h-3.5" />,
                },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <div
                    className="flex items-center justify-center gap-1 mb-1"
                    style={{ color: s.color, opacity: 0.6 }}
                  >
                    {s.icon}
                    <span className="font-mono text-xs">{s.label}</span>
                  </div>
                  <p
                    className="font-display text-2xl font-black"
                    style={{
                      color: s.color,
                      textShadow: `0 0 12px ${s.color}66`,
                    }}
                  >
                    {s.value}
                  </p>
                </div>
              ))}
            </motion.div>

            {coinsEarned > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.35, type: 'spring' }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg mb-4"
                style={{
                  background: 'hsla(50,100%,50%,0.1)',
                  border: '1px solid hsla(50,100%,50%,0.3)',
                }}
              >
                <span style={{ color: '#ffdd00' }}>⚡</span>
                <span
                  className="font-mono text-sm font-bold"
                  style={{ color: '#ffdd00' }}
                >
                  +{coinsEarned} coins earned!
                </span>
                <span
                  className="font-mono text-xs"
                  style={{ color: 'hsla(50,100%,50%,0.5)' }}
                >
                  ({coins} total)
                </span>
              </motion.div>
            )}

            {score >= highScore && score > 0 && (
              <motion.p
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: 'spring' }}
                className="font-display text-sm font-bold tracking-widest mb-4"
                style={{
                  color: '#ffff00',
                  textShadow: '0 0 15px #ffff0066',
                }}
              >
                ★ NEW HIGH SCORE ★
              </motion.p>
            )}

            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex flex-col items-center gap-3"
            >
              <button
                onClick={onStart}
                className="flex items-center gap-3 px-8 py-4 rounded-xl font-display text-lg font-bold tracking-wider hover:scale-105 active:scale-95 transition-all"
                style={{
                  background:
                    'linear-gradient(135deg,hsla(180,100%,50%,0.15),hsla(300,100%,50%,0.1))',
                  border: '1px solid #00ffff',
                  color: '#00ffff',
                  boxShadow: '0 0 20px hsla(180,100%,50%,0.2)',
                }}
              >
                <RotateCcw className="w-5 h-5" /> REBOOT
              </button>

              <button
                onClick={() => setShowShop(true)}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-mono text-sm hover:scale-105 active:scale-95 transition-all"
                style={{
                  background: 'hsla(50,100%,50%,0.08)',
                  border: '1px solid hsla(50,100%,50%,0.3)',
                  color: '#ffdd00',
                }}
              >
                <ShoppingBag className="w-4 h-4" /> Armory ({coins} ⚡)
              </button>

              <button
                onClick={() => setShowCoinShop(true)}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-mono text-sm hover:scale-105 active:scale-95 transition-all"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(255,221,0,0.12), rgba(0,255,255,0.08))',
                  border: '1px solid rgba(255,221,0,0.35)',
                  color: '#ffdd00',
                  boxShadow: '0 0 16px rgba(255,221,0,0.12)',
                }}
              >
                <Coins className="w-4 h-4" /> Buy Coins
              </button>
            </motion.div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}