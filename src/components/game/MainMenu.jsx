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
  Settings,
  Gamepad2,
  Volume2,
  Wifi,
  Home,
} from 'lucide-react';
import Armory from './Armory.jsx';
import { 
  getCoins, 
  getHighScore,
  spendCoins,
  ownCombo,
  rentCombo,
  isComboActive
} from '../../lib/gameStore';

import { COMBO_PACKS } from '../../lib/gameItems';
import { buyCoins, COIN_PACKS } from '../../lib/payments';
import { useAuth } from '../../lib/AuthContext';

const DEFAULT_SETTINGS = {
  flapKey: 'Space',
  shootKey: 'KeyF',
  blastKey: 'KeyB',
  bombKey: 'KeyT',
  musicEnabled: true,
  sfxEnabled: true,
  musicVolume: 0.6,
  sfxVolume: 0.8,
  onlineMode: true,
};

function loadSettings() {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem('firepilot_settings');
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(nextSettings) {
  window.localStorage.setItem('firepilot_settings', JSON.stringify(nextSettings));
  window.dispatchEvent(new Event('firepilot-settings-changed'));
}

function prettyKeyName(code) {
  if (!code) return 'UNBOUND';
  return code
    .replace('Key', '')
    .replace('Digit', '')
    .replace('Arrow', 'Arrow ')
    .replace('Space', 'Space');
}

function StatChip({ icon, label, value, color, border, bg }) {
  return (
    <div
      className="rounded-2xl px-4 py-3 min-w-0"
      style={{
        background: bg,
        border,
        boxShadow: `0 0 18px ${color}18`,
      }}
    >
      <div className="flex items-center gap-2 mb-1" style={{ color }}>
        {icon}
        <span className="font-mono text-[11px] tracking-wider">{label}</span>
      </div>
      <div
        className="font-display text-lg md:text-xl font-black truncate"
        style={{ color }}
      >
        {value}
      </div>
    </div>
  );
}

function ToggleRow({ label, description, value, onChange, accent = '#00ffff' }) {
  return (
    <div
      className="flex items-center justify-between gap-4 rounded-2xl px-4 py-3"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div>
        <div
          className="font-display text-sm font-bold tracking-wide"
          style={{ color: '#ffffff' }}
        >
          {label}
        </div>
        <div
          className="font-mono text-[11px] mt-1"
          style={{ color: 'rgba(255,255,255,0.58)' }}
        >
          {description}
        </div>
      </div>
      <button
        onClick={() => onChange(!value)}
        className="px-3 py-2 rounded-xl font-mono text-xs font-bold tracking-wider transition-all hover:scale-105 active:scale-95"
        style={{
          background: value ? `${accent}22` : 'rgba(255,255,255,0.04)',
          border: value
            ? `1px solid ${accent}`
            : '1px solid rgba(255,255,255,0.12)',
          color: value ? accent : 'rgba(255,255,255,0.7)',
          minWidth: 78,
        }}
      >
        {value ? 'ON' : 'OFF'}
      </button>
    </div>
  );
}

function KeyBindButton({ label, settingKey, actionKey, listeningFor, onListen }) {
  const active = listeningFor === settingKey;

  return (
    <button
      onClick={() => onListen(settingKey)}
      className="rounded-2xl px-4 py-3 text-left transition-all hover:scale-[1.02] active:scale-[0.99]"
      style={{
        background: active ? 'rgba(0,255,255,0.09)' : 'rgba(255,255,255,0.03)',
        border: active
          ? '1px solid rgba(0,255,255,0.42)'
          : '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div
        className="font-mono text-[11px] mb-1"
        style={{ color: 'rgba(255,255,255,0.58)' }}
      >
        {label}
      </div>
      <div
        className="font-display text-sm font-black tracking-wider"
        style={{ color: active ? '#00ffff' : '#ffffff' }}
      >
        {active ? 'PRESS ANY KEY...' : prettyKeyName(actionKey)}
      </div>
    </button>
  );
}

function MenuActionButton({ icon, label, onClick, primary = false, accent = '#ffffff' }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-display text-sm md:text-base font-bold tracking-wider transition-all hover:scale-[1.02] active:scale-[0.98]"
      style={
        primary
          ? {
              background:
                'linear-gradient(135deg,hsla(180,100%,50%,0.18),hsla(300,100%,50%,0.12))',
              border: '1px solid #00ffff',
              color: '#00ffff',
              boxShadow: '0 0 25px hsla(180,100%,50%,0.2)',
            }
          : {
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${accent}55`,
              color: accent,
            }
      }
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export default function MainMenu({
  gameState,
  score,
  kills,
  coinsEarned,
  onStart,
  onReturnToMenu,
  onSkinChange,
}) {
  const [showShop, setShowShop] = useState(false);
  const [showCoinShop, setShowCoinShop] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [coins, setCoins] = useState(getCoins());
  const [buyingPackId, setBuyingPackId] = useState(null);
  const [settingsDraft, setSettingsDraft] = useState(loadSettings());
  const [listeningFor, setListeningFor] = useState(null);
  const { user, isLoadingAuth } = useAuth();
  const [showComboShop, setShowComboShop] = useState(false);

  const highScore = getHighScore();

  const refreshCoins = () => setCoins(getCoins());

  useEffect(() => {
    const handleStorageChange = () => {
      refreshCoins();
      setSettingsDraft(loadSettings());
    };

    const handleFocus = () => {
      refreshCoins();
      setSettingsDraft(loadSettings());
    };

    const handleSettingsChanged = () => setSettingsDraft(loadSettings());

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('firepilot-settings-changed', handleSettingsChanged);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('firepilot-settings-changed', handleSettingsChanged);
    };
  }, []);

  useEffect(() => {
    if (!showSettings || !listeningFor) return undefined;

    const handleKeyDown = (event) => {
      event.preventDefault();
      event.stopPropagation();

      const next = {
        ...settingsDraft,
        [listeningFor]: event.code,
      };

      setSettingsDraft(next);
      saveSettings(next);
      setListeningFor(null);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [showSettings, listeningFor, settingsDraft]);

  const coinPacks = useMemo(() => {
    const fallbackPacks = [
      { id: 'coins_100', coins: 100, amount: 199, tag: null },
      { id: 'coins_200', coins: 200, amount: 299, tag: 'Starter' },
      { id: 'coins_500', coins: 500, amount: 599, tag: 'Popular' },
      { id: 'coins_1200', coins: 1200, amount: 1199, tag: null },
      { id: 'coins_2500', coins: 2500, amount: 1999, tag: 'Best Value' },
      { id: 'coins_5000', coins: 5000, amount: 3499, tag: 'Mega Pack' },
    ];

    const sourcePacks =
      Array.isArray(COIN_PACKS) && COIN_PACKS.length > 0 ? COIN_PACKS : fallbackPacks;

    return sourcePacks.map((pack) => ({
      ...pack,
      id: pack.id || `coins_${pack.coins}`,
      displayPrice:
        pack.priceLabel ||
        (typeof pack.amount === 'number' ? `$${(pack.amount / 100).toFixed(2)}` : ''),
      displayLabel: pack.label || `${pack.coins.toLocaleString()} Coins`,
      tag:
        pack.tag ??
        {
          200: 'Starter',
          500: 'Popular',
          2500: 'Best Value',
          5000: 'Mega Pack',
        }[pack.coins] ??
        null,
    }));
  }, []);

  const handleCoinPurchase = async (pack) => {
    if (isLoadingAuth) {
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

  const updateSetting = (key, value) => {
    const next = { ...settingsDraft, [key]: value };
    setSettingsDraft(next);
    saveSettings(next);
  };

  const resetSettings = () => {
    setSettingsDraft(DEFAULT_SETTINGS);
    saveSettings(DEFAULT_SETTINGS);
    setListeningFor(null);
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
              style={{ ...panelBaseStyle, maxHeight: '90vh' }}
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
                    Pick a coin pack and see the price before checkout.
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
                          <div className="flex items-center gap-2 mb-1">
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
                            {pack.displayLabel.toUpperCase()}
                          </p>
                        </div>

                        <div
                          className="rounded-xl px-3 py-2 mb-4"
                          style={{
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.08)',
                          }}
                        >
                          <div
                            className="font-mono text-[11px]"
                            style={{ color: 'rgba(255,255,255,0.58)' }}
                          >
                            PRICE
                          </div>
                          <div
                            className="font-display text-xl font-black"
                            style={{
                              color: '#00ffff',
                              textShadow: '0 0 10px rgba(0,255,255,0.2)',
                            }}
                          >
                            {pack.displayPrice || 'Unavailable'}
                          </div>
                        </div>

                        <button
                          onClick={() => handleCoinPurchase(pack)}
                          disabled={isLoadingAuth || isBuying}
                          className="w-full px-4 py-2.5 rounded-xl font-display text-sm font-bold tracking-wider transition-all hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed"
                          style={{
                            background:
                              'linear-gradient(135deg, rgba(0,255,255,0.18), rgba(255,0,255,0.12))',
                            border: '1px solid rgba(0,255,255,0.45)',
                            color: '#00ffff',
                            opacity: isLoadingAuth || isBuying ? 0.65 : 1,
                          }}
                        >
                          {isBuying ? 'OPENING CHECKOUT...' : 'BUY NOW'}
                        </button>
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

const renderComboShopModal = () => (
  <AnimatePresence>
    {showComboShop && (
      <>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setShowComboShop(false)}
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
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="w-full max-w-3xl rounded-2xl overflow-hidden flex flex-col"
            style={{ ...panelBaseStyle, maxHeight: '90vh' }}
          >
            <div className="p-5 border-b border-white/10 flex justify-between">
              <h2 className="font-display text-xl font-black text-cyan-300">
                COMBO PACKS
              </h2>

            <div className="px-5 pt-3">
              <button
                onClick={() => setShowComboShop(false)}
                className="px-3 py-2 rounded-xl font-mono text-xs font-bold"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#ffffff',
                }}
              >
                BACK TO MENU
              </button>
            </div>

              <button onClick={() => setShowComboShop(false)}>
                <X />
              </button>
            </div>

            <div className="overflow-y-auto p-5 grid gap-4">
              {COMBO_PACKS.map((combo) => {
                const active = isComboActive(combo.id);

                return (
                  <div
                    key={combo.id}
                    className="p-4 rounded-xl"
                    style={{
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: 'rgba(255,255,255,0.03)',
                    }}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <div className="font-bold text-white">
                        {combo.name}
                      </div>
                      <div className="text-yellow-400 font-mono">
                        {combo.cost} coins
                      </div>
                    </div>

                    <div className="text-xs text-white/60 mb-3">
                      {combo.desc}
                    </div>

                    {active && (
                      <div className="text-green-400 text-xs mb-2">
                        ACTIVE
                      </div>
                    )}

                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => {
                          if (!spendCoins(combo.cost)) {
                            alert('Not enough coins');
                            return;
                          }
                          ownCombo(combo.id);
                          setCoins(getCoins());
                        }}
                        className="px-3 py-2 rounded bg-cyan-500/20 border border-cyan-400 text-cyan-300"
                      >
                        BUY
                      </button>

                      <button
                        onClick={() => {
                          if (!spendCoins(Math.floor(combo.cost * 0.4))) {
                            alert('Not enough coins');
                            return;
                          }
                          rentCombo(combo.id, 7 * 24 * 60 * 60 * 1000);
                          setCoins(getCoins());
                        }}
                        className="px-3 py-2 rounded bg-purple-500/20 border border-purple-400 text-purple-300"
                      >
                        RENT WEEK
                      </button>

                      <button
                        onClick={() => {
                          if (!spendCoins(Math.floor(combo.cost * 0.7))) {
                            alert('Not enough coins');
                            return;
                          }
                          rentCombo(combo.id, 30 * 24 * 60 * 60 * 1000);
                          setCoins(getCoins());
                        }}
                        className="px-3 py-2 rounded bg-pink-500/20 border border-pink-400 text-pink-300"
                      >
                        RENT MONTH
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>
      </>
    )}
  </AnimatePresence>
);

  const renderSettingsModal = () => (
    <AnimatePresence>
      {showSettings && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setShowSettings(false);
              setListeningFor(null);
            }}
            className="fixed inset-0"
            style={{
              zIndex: 1000002,
              background: 'rgba(0,0,0,0.72)',
              backdropFilter: 'blur(6px)',
            }}
          />

          <div
            className="fixed inset-0 flex items-center justify-center p-4"
            style={{ zIndex: 1000003 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: 'spring', stiffness: 220, damping: 20 }}
              className="w-full max-w-4xl rounded-3xl overflow-hidden flex flex-col"
              style={{ ...panelBaseStyle, maxHeight: '90vh' }}
            >
              <div className="flex items-start justify-between gap-4 p-5 md:p-6 border-b border-white/10">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Settings className="w-5 h-5" style={{ color: '#00ffff' }} />
                    <h2
                      className="font-display text-2xl font-black tracking-wider"
                      style={{
                        color: '#00ffff',
                        textShadow: '0 0 18px rgba(0,255,255,0.25)',
                      }}
                    >
                      PILOT SETTINGS
                    </h2>
                  </div>
                  <p
                    className="font-mono text-xs md:text-sm"
                    style={{ color: 'rgba(255,255,255,0.65)' }}
                  >
                    Change controls, audio behavior, and run preferences.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setShowSettings(false);
                    setListeningFor(null);
                  }}
                  className="flex items-center justify-center rounded-lg transition-all hover:scale-105 active:scale-95 shrink-0"
                  style={{
                    width: 40,
                    height: 40,
                    border: '1px solid rgba(255,255,255,0.14)',
                    background: 'rgba(255,255,255,0.05)',
                    color: '#ffffff',
                  }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="overflow-y-auto p-5 md:p-6 grid grid-cols-1 xl:grid-cols-2 gap-5">
                <div className="space-y-4">
                  <div
                    className="rounded-2xl p-4"
                    style={{
                      background: 'rgba(0,255,255,0.04)',
                      border: '1px solid rgba(0,255,255,0.14)',
                    }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Gamepad2 className="w-4 h-4" style={{ color: '#00ffff' }} />
                      <div
                        className="font-display text-lg font-black tracking-wider"
                        style={{ color: '#00ffff' }}
                      >
                        CONTROLS
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <KeyBindButton
                        label="FLAP"
                        settingKey="flapKey"
                        actionKey={settingsDraft.flapKey}
                        listeningFor={listeningFor}
                        onListen={setListeningFor}
                      />
                      <KeyBindButton
                        label="SHOOT"
                        settingKey="shootKey"
                        actionKey={settingsDraft.shootKey}
                        listeningFor={listeningFor}
                        onListen={setListeningFor}
                      />
                      <KeyBindButton
                        label="BLAST"
                        settingKey="blastKey"
                        actionKey={settingsDraft.blastKey}
                        listeningFor={listeningFor}
                        onListen={setListeningFor}
                      />
                      <KeyBindButton
                        label="TUNNEL BOMB"
                        settingKey="bombKey"
                        actionKey={settingsDraft.bombKey}
                        listeningFor={listeningFor}
                        onListen={setListeningFor}
                      />
                    </div>
                    <p
                      className="font-mono text-[11px] mt-3"
                      style={{ color: 'rgba(255,255,255,0.58)' }}
                    >
                      Click any control tile, then press any keyboard key to rebind it.
                    </p>
                  </div>

                  <div
                    className="rounded-2xl p-4"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Volume2 className="w-4 h-4" style={{ color: '#ffdd00' }} />
                      <div
                        className="font-display text-lg font-black tracking-wider"
                        style={{ color: '#ffdd00' }}
                      >
                        AUDIO
                      </div>
                    </div>

                    <div className="space-y-3">
                      <ToggleRow
                        label="Music"
                        description="Enable menu and gameplay music."
                        value={settingsDraft.musicEnabled}
                        onChange={(value) => updateSetting('musicEnabled', value)}
                        accent="#00ffff"
                      />
                      <ToggleRow
                        label="Sound Effects"
                        description="Enable gunfire, hits, power-ups, and explosions."
                        value={settingsDraft.sfxEnabled}
                        onChange={(value) => updateSetting('sfxEnabled', value)}
                        accent="#ffdd00"
                      />

                      <div
                        className="rounded-2xl px-4 py-3"
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.08)',
                        }}
                      >
                        <div
                          className="font-display text-sm font-bold tracking-wide"
                          style={{ color: '#ffffff' }}
                        >
                          Music Volume
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={settingsDraft.musicVolume}
                          onChange={(e) =>
                            updateSetting('musicVolume', Number(e.target.value))
                          }
                          className="w-full mt-3"
                        />
                      </div>

                      <div
                        className="rounded-2xl px-4 py-3"
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.08)',
                        }}
                      >
                        <div
                          className="font-display text-sm font-bold tracking-wide"
                          style={{ color: '#ffffff' }}
                        >
                          SFX Volume
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={settingsDraft.sfxVolume}
                          onChange={(e) =>
                            updateSetting('sfxVolume', Number(e.target.value))
                          }
                          className="w-full mt-3"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div
                    className="rounded-2xl p-4"
                    style={{
                      background: 'rgba(255,0,255,0.04)',
                      border: '1px solid rgba(255,0,255,0.14)',
                    }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Wifi className="w-4 h-4" style={{ color: '#ff66ff' }} />
                      <div
                        className="font-display text-lg font-black tracking-wider"
                        style={{ color: '#ff66ff' }}
                      >
                        RUN MODE
                      </div>
                    </div>
                    <ToggleRow
                      label="Online Play"
                      description="Cloud save and account-backed progression stay enabled when on."
                      value={settingsDraft.onlineMode}
                      onChange={(value) => updateSetting('onlineMode', value)}
                      accent="#ff66ff"
                    />
                    <p
                      className="font-mono text-[11px] mt-3"
                      style={{ color: 'rgba(255,255,255,0.58)' }}
                    >
                      Offline mode is a local-preference flag for now.
                    </p>
                  </div>

                  <div
                    className="rounded-2xl p-4"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <div
                      className="font-display text-lg font-black tracking-wider mb-3"
                      style={{ color: '#ffffff' }}
                    >
                      CURRENT BINDINGS
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {[
                        ['Flap', prettyKeyName(settingsDraft.flapKey)],
                        ['Shoot', prettyKeyName(settingsDraft.shootKey)],
                        ['Blast', prettyKeyName(settingsDraft.blastKey)],
                        ['Bomb', prettyKeyName(settingsDraft.bombKey)],
                      ].map(([label, value]) => (
                        <div
                          key={label}
                          className="rounded-2xl px-4 py-3"
                          style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.08)',
                          }}
                        >
                          <div
                            className="font-mono text-[11px]"
                            style={{ color: 'rgba(255,255,255,0.55)' }}
                          >
                            {label}
                          </div>
                          <div
                            className="font-display text-sm font-black tracking-wide mt-1"
                            style={{ color: '#00ffff' }}
                          >
                            {value}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div
                    className="rounded-2xl p-4"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <div
                      className="font-display text-lg font-black tracking-wider mb-2"
                      style={{ color: '#ffffff' }}
                    >
                      QUICK NOTES
                    </div>
                    <ul
                      className="space-y-2 font-mono text-[11px]"
                      style={{ color: 'rgba(255,255,255,0.62)' }}
                    >
                      <li>- Coin prices are shown before checkout.</li>
                      <li>- Launch enters a fair ready state before gravity starts.</li>
                      <li>- Game over includes a Main Menu button.</li>
                    </ul>

                    <button
                      onClick={resetSettings}
                      className="mt-4 px-4 py-2 rounded-xl font-display text-sm font-bold tracking-wider transition-all hover:scale-105 active:scale-95"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        color: '#ffffff',
                      }}
                    >
                      RESET TO DEFAULTS
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );

  const renderIdleMenu = () => (
    <div className="w-full h-full flex items-center justify-center px-4 py-5 md:px-6 md:py-6">
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="w-full max-w-[760px]"
      >
        <div className="text-center mb-5 md:mb-6">
          <h1
            className="font-display text-[2.25rem] md:text-[4.25rem] leading-none font-black tracking-wider"
            style={{
              color: '#00ffff',
              textShadow: '0 0 24px #00ffff88, 0 0 50px #00ffff33',
            }}
          >
            FIREPILOT: FLAP WAR
          </h1>
          <p
            className="font-mono text-[10px] md:text-xs tracking-[0.25em] mt-3"
            style={{ color: '#ff00ff', textShadow: '0 0 10px #ff00ff55' }}
          >
            {'>> NAVIGATE THE DATA STREAM <<'}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <StatChip
            icon={<Trophy className="w-4 h-4" />}
            label="BEST"
            value={highScore}
            color="#00ffff"
            border="1px solid hsla(180,100%,50%,0.2)"
            bg="hsla(180,100%,50%,0.06)"
          />
          <StatChip
            icon={<Coins className="w-4 h-4" />}
            label="COINS"
            value={coins}
            color="#ffdd00"
            border="1px solid hsla(50,100%,50%,0.2)"
            bg="hsla(50,100%,50%,0.06)"
          />
          <StatChip
            icon={<Zap className="w-4 h-4" />}
            label="CONTROL"
            value={prettyKeyName(settingsDraft.shootKey)}
            color="#ff66ff"
            border="1px solid rgba(255,0,255,0.18)"
            bg="rgba(255,0,255,0.05)"
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <MenuActionButton
            onClick={onStart}
            icon={<Play className="w-5 h-5" />}
            label="LAUNCH"
            primary
          />
          <MenuActionButton
            onClick={() => setShowShop(true)}
            icon={<ShoppingBag className="w-4 h-4" />}
            label="ARMORY"
            accent="#ffdd00"
          />
          <MenuActionButton
            onClick={() => setShowCoinShop(true)}
            icon={<Coins className="w-4 h-4" />}
            label="BUY COINS"
            accent="#ffdd00"
          />
          <MenuActionButton
            onClick={() => setShowComboShop(true)}
            icon={<Zap className="w-4 h-4" />}
            label="COMBO PACKS"
            accent="#00ffff"
          />
          <MenuActionButton
            onClick={() => setShowSettings(true)}
            icon={<Settings className="w-4 h-4" />}
            label="SETTINGS"
            accent="#ffffff"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div
            className="rounded-2xl p-4 min-w-0"
            style={{
              background: 'rgba(0,255,255,0.04)',
              border: '1px solid rgba(0,255,255,0.12)',
            }}
          >
            <p
              className="font-mono text-xs font-bold mb-1"
              style={{ color: 'hsla(180,100%,50%,0.7)' }}
            >
              FAIR START
            </p>
            <p
              className="font-mono text-[11px] leading-5"
              style={{ color: 'rgba(255,255,255,0.6)' }}
            >
              Launch arms the run. Your first flap, click, tap, or fire input starts gameplay.
            </p>
          </div>

          <div
            className="rounded-2xl p-4 min-w-0"
            style={{
              background: 'rgba(255,221,0,0.04)',
              border: '1px solid rgba(255,221,0,0.12)',
            }}
          >
            <p
              className="font-mono text-xs font-bold mb-1"
              style={{ color: 'hsla(50,100%,50%,0.8)' }}
            >
              CONTROLS
            </p>
            <p
              className="font-mono text-[11px] leading-5"
              style={{ color: 'rgba(255,255,255,0.6)' }}
            >
              Flap: {prettyKeyName(settingsDraft.flapKey)}. Shoot: {prettyKeyName(settingsDraft.shootKey)}.
              Change everything in Settings.
            </p>
          </div>

          <div
            className="rounded-2xl p-4 min-w-0"
            style={{
              background: 'rgba(255,0,255,0.04)',
              border: '1px solid rgba(255,0,255,0.12)',
            }}
          >
            <p
              className="font-mono text-xs font-bold mb-1"
              style={{ color: 'hsla(300,100%,70%,0.8)' }}
            >
              LOADOUT
            </p>
            <p
              className="font-mono text-[11px] leading-5"
              style={{ color: 'rgba(255,255,255,0.6)' }}
            >
              Equip skins, weapons, and upgrades from the Armory before the run.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={gameState}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden"
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
        {renderSettingsModal()}
        {renderComboShopModal()}

        {gameState === 'idle' && renderIdleMenu()}

        {gameState === 'gameover' && (
          <div className="w-full h-full flex flex-col items-center justify-center px-4">
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
                    style={{ color: s.color, textShadow: `0 0 12px ${s.color}66` }}
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
                style={{ color: '#ffff00', textShadow: '0 0 15px #ffff0066' }}
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
                onClick={onReturnToMenu}
                className="flex items-center gap-3 px-8 py-3 rounded-xl font-display text-base font-bold tracking-wider hover:scale-105 active:scale-95 transition-all"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  color: '#ffffff',
                }}
              >
                <Home className="w-5 h-5" /> MAIN MENU
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