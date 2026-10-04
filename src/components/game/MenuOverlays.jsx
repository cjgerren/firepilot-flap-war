import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Gamepad2,
  LogIn,
  Mic,
  Settings,
  Smartphone,
  UserPlus,
  Volume2,
  Wifi,
  X,
} from 'lucide-react';
import {
  addPurchaseRecord,
  getCoins,
  getDiamonds,
  isComboActive,
  ownCombo,
  rentCombo,
  setSelectedCombo,
  spendCoins,
  spendDiamonds,
} from '../../lib/gameStore';

function stopAuthKeyPropagation(event) {
  event.stopPropagation();
}

function prettyKeyName(code) {
  if (!code) return 'UNBOUND';
  return code
    .replace('Key', '')
    .replace('Digit', '')
    .replace('Arrow', 'Arrow ')
    .replace('Space', 'Space');
}


export default function MenuOverlays({
  showAuthModal,
  closeAuthModal,
  panelBaseStyle,
  authMode,
  purchasesEnabledForPlatform,
  isDeveloperLoginEnabled,
  handleDeveloperAuth,
  authSubmitting,
  setAuthMode,
  setAuthErrorMessage,
  setAuthInfoMessage,
  hasSupabaseConfig,
  authErrorMessage,
  authInfoMessage,
  handleAuthSubmit,
  authEmail,
  setAuthEmail,
  authPassword,
  setAuthPassword,
  showComboShop,
  setShowComboShop,
  visibleComboPacks,
  selectedComboId,
  refreshSelectedCombo,
  setCoins,
  setDiamonds,
  showSettings,
  setShowSettings,
  setListeningFor,
  listeningFor,
  isMobileDevice,
  settingsDraft,
  updateSetting,
  updateSettings,
  resetSettings,
  isOwnerAccount,
  handleGrantOwnerAccess,
  isGrantingOwnerAccess,
  handleClearDeveloperState,
}) {
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

function ChoiceButton({ label, description, active, onClick, accent = '#00ffff' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg px-4 py-3 text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
      style={{
        background: active ? `${accent}18` : 'rgba(255,255,255,0.03)',
        border: active ? `1px solid ${accent}66` : '1px solid rgba(255,255,255,0.08)',
        color: active ? accent : 'rgba(225,235,242,0.78)',
      }}
    >
      <div className="font-display text-sm font-black tracking-wide">{label}</div>
      <div
        className="font-mono text-[11px] leading-5 mt-1"
        style={{ color: active ? 'rgba(255,255,255,0.78)' : 'rgba(255,255,255,0.55)' }}
      >
        {description}
      </div>
    </button>
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

  const renderAuthModal = () => (
    <AnimatePresence>
      {showAuthModal && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeAuthModal}
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
              className="w-full max-w-md rounded-[32px] p-6 md:p-7"
              style={panelBaseStyle}
            >
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <div
                    className="font-mono text-[10px] tracking-[0.24em] mb-2"
                    style={{ color: 'rgba(157,220,255,0.74)' }}
                  >
                    PILOT AUTH
                  </div>
                  <h2
                    className="font-display text-3xl font-black tracking-[0.16em]"
                    style={{ color: '#edf8ff' }}
                  >
                    {authMode === 'login' ? 'SIGN IN' : 'REGISTER'}
                  </h2>
                  <p
                    className="font-mono text-xs leading-5 mt-3"
                    style={{ color: 'rgba(225,235,242,0.66)' }}
                  >
                    {authMode === 'login'
                      ? purchasesEnabledForPlatform
                        ? 'Authenticate without leaving the game. Purchases can resume automatically after sign-in.'
                        : 'Authenticate without leaving the game. Cloud progress resumes after sign-in.'
                      : 'Create an account here, then continue straight back into the game.'}
                  </p>
                </div>

                <button
                  onClick={closeAuthModal}
                  className="flex items-center justify-center rounded-lg transition-all hover:scale-105 active:scale-95 shrink-0"
                  style={{
                    width: 40,
                    height: 40,
                    border: '1px solid rgba(255,255,255,0.14)',
                    background: 'rgba(255,255,255,0.05)',
                    color: '#ffffff',
                  }}
                  aria-label="Close auth modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {isDeveloperLoginEnabled && (
                <div
                  className="rounded-2xl px-4 py-4 mb-5"
                  style={{
                    background: 'rgba(255,199,133,0.07)',
                    border: '1px solid rgba(255,199,133,0.18)',
                  }}
                >
                  <div
                    className="font-mono text-[11px] tracking-wider mb-1"
                    style={{ color: '#ffc785' }}
                  >
                    LOCAL DEVELOPER ACCESS
                  </div>
                  <div
                    className="font-mono text-xs leading-5 mb-3"
                    style={{ color: 'rgba(255,255,255,0.72)' }}
                  >
                    Instant local sign-in with every unlock, infinite coins, and infinite diamonds.
                  </div>
                  <button
                    type="button"
                    onClick={handleDeveloperAuth}
                    disabled={authSubmitting}
                    className="w-full rounded-2xl px-4 py-3 font-display text-sm font-bold tracking-[0.18em] transition-all disabled:cursor-not-allowed"
                    style={{
                      background:
                        'linear-gradient(135deg, rgba(255,199,133,0.2), rgba(157,220,255,0.12))',
                      border: '1px solid rgba(255,199,133,0.32)',
                      color: '#edf8ff',
                      opacity: authSubmitting ? 0.62 : 1,
                    }}
                  >
                    ENTER DEVELOPER PROFILE
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 mb-5">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setAuthErrorMessage('');
                    setAuthInfoMessage('');
                  }}
                  className="rounded-2xl px-4 py-3 font-display text-sm font-bold tracking-wider transition-all"
                  style={{
                    background: authMode === 'login' ? 'rgba(157,220,255,0.14)' : 'rgba(255,255,255,0.03)',
                    border:
                      authMode === 'login'
                        ? '1px solid rgba(157,220,255,0.38)'
                        : '1px solid rgba(255,255,255,0.08)',
                    color: authMode === 'login' ? '#9ddcff' : 'rgba(225,235,242,0.7)',
                  }}
                >
                  <span className="inline-flex items-center gap-2">
                    <LogIn className="w-4 h-4" />
                    SIGN IN
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('register');
                    setAuthErrorMessage('');
                    setAuthInfoMessage('');
                  }}
                  className="rounded-2xl px-4 py-3 font-display text-sm font-bold tracking-wider transition-all"
                  style={{
                    background: authMode === 'register' ? 'rgba(255,199,133,0.12)' : 'rgba(255,255,255,0.03)',
                    border:
                      authMode === 'register'
                        ? '1px solid rgba(255,199,133,0.34)'
                        : '1px solid rgba(255,255,255,0.08)',
                    color: authMode === 'register' ? '#ffc785' : 'rgba(225,235,242,0.7)',
                  }}
                >
                  <span className="inline-flex items-center gap-2">
                    <UserPlus className="w-4 h-4" />
                    REGISTER
                  </span>
                </button>
              </div>

              {!hasSupabaseConfig && (
                <div
                  className="rounded-2xl px-4 py-3 mb-4"
                  style={{
                    background: 'rgba(255,171,122,0.08)',
                    border: '1px solid rgba(255,171,122,0.22)',
                  }}
                >
                  <div
                    className="font-mono text-[11px] tracking-wider mb-1"
                    style={{ color: '#ffbb92' }}
                  >
                    AUTH NOT CONFIGURED
                  </div>
                  <div
                    className="font-mono text-xs leading-5"
                    style={{ color: 'rgba(255,255,255,0.72)' }}
                  >
                    Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to enable real account auth.
                  </div>
                </div>
              )}

              {(authErrorMessage || authInfoMessage) && (
                <div
                  className="rounded-2xl px-4 py-3 mb-4"
                  style={{
                    background: authErrorMessage ? 'rgba(255,120,120,0.08)' : 'rgba(157,220,255,0.08)',
                    border: authErrorMessage
                      ? '1px solid rgba(255,120,120,0.22)'
                      : '1px solid rgba(157,220,255,0.22)',
                  }}
                >
                  <div
                    className="font-mono text-xs leading-5"
                    style={{ color: authErrorMessage ? '#ffb0b0' : 'rgba(225,235,242,0.82)' }}
                  >
                    {authErrorMessage || authInfoMessage}
                  </div>
                </div>
              )}

              <form onSubmit={handleAuthSubmit} onKeyDown={stopAuthKeyPropagation} onKeyUp={stopAuthKeyPropagation} className="space-y-4">
                <div>
                  <label
                    htmlFor="auth-email"
                    className="block font-mono text-[11px] tracking-wider mb-2"
                    style={{ color: 'rgba(225,235,242,0.66)' }}
                  >
                    EMAIL
                  </label>
                  <input
                    id="auth-email"
                    type="email"
                    value={authEmail}
                    onChange={(event) => setAuthEmail(event.target.value)}
                    onKeyDown={stopAuthKeyPropagation}
                    onKeyUp={stopAuthKeyPropagation}
                    autoComplete="email"
                    className="w-full rounded-2xl px-4 py-3 font-mono text-sm"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#edf8ff',
                    }}
                  />
                </div>

                <div>
                  <label
                    htmlFor="auth-password"
                    className="block font-mono text-[11px] tracking-wider mb-2"
                    style={{ color: 'rgba(225,235,242,0.66)' }}
                  >
                    PASSWORD
                  </label>
                  <input
                    id="auth-password"
                    type="password"
                    value={authPassword}
                    onChange={(event) => setAuthPassword(event.target.value)}
                    onKeyDown={stopAuthKeyPropagation}
                    onKeyUp={stopAuthKeyPropagation}
                    autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                    className="w-full rounded-2xl px-4 py-3 font-mono text-sm"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#edf8ff',
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={authSubmitting || !hasSupabaseConfig}
                  className="w-full rounded-2xl px-4 py-3 font-display text-sm font-bold tracking-[0.18em] transition-all disabled:cursor-not-allowed"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(157,220,255,0.18), rgba(255,199,133,0.12))',
                    border: '1px solid rgba(157,220,255,0.38)',
                    color: '#edf8ff',
                    opacity: authSubmitting || !hasSupabaseConfig ? 0.62 : 1,
                  }}
                >
                  {authSubmitting
                    ? authMode === 'login'
                      ? 'SIGNING IN...'
                      : 'CREATING ACCOUNT...'
                    : authMode === 'login'
                      ? 'SIGN IN'
                      : 'CREATE ACCOUNT'}
                </button>
              </form>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );

  const renderComboShopModal = () => (
    visibleComboPacks.length === 0 ? null :
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
                <div
                  className="rounded-xl px-4 py-2 font-mono text-xs"
                  style={{
                    background: 'rgba(125,227,255,0.1)',
                    border: '1px solid rgba(125,227,255,0.24)',
                    color: '#bceeff',
                  }}
                >
                  MORE LOADOUTS COMING IN A NEW RELEASE.
                </div>
                {visibleComboPacks.map((combo) => {
                  const active = isComboActive(combo.id);
                  const equipped = selectedComboId === combo.id;
                  const comboLive = combo.live !== false;
                  const getComboPrice = (mode) => {
                    const pricing = combo.pricing?.[mode] || null;
                    const diamondCost = Number(pricing?.diamonds ?? 0);
                    const coinCost = Number(
                      pricing?.coins ??
                        (mode === 'permanent'
                          ? combo.cost
                          : Math.floor(combo.cost * (mode === 'monthly' ? 0.7 : 0.4)))
                    );

                    if (diamondCost > 0) {
                      return { amount: diamondCost, currencyType: 'diamonds', days: Number(pricing?.days || 0) };
                    }

                    return { amount: Math.max(0, coinCost), currencyType: 'coins', days: Number(pricing?.days || 0) };
                  };

                  const formatPriceLabel = (mode) => {
                    const price = getComboPrice(mode);
                    return `${price.amount} ${price.currencyType}`;
                  };

                  const attemptComboPurchase = (mode) => {
                    if (!comboLive) return;

                    const price = getComboPrice(mode);
                    const hasFunds =
                      price.currencyType === 'diamonds'
                        ? spendDiamonds(price.amount)
                        : spendCoins(price.amount);

                    if (!hasFunds) {
                      alert(
                        `Not enough ${price.currencyType === 'diamonds' ? 'diamonds' : 'coins'}`
                      );
                      return;
                    }

                    if (mode === 'permanent') {
                      ownCombo(combo.id);
                    } else {
                      const defaultDays = mode === 'monthly' ? 30 : 7;
                      const rentalDays = price.days > 0 ? price.days : defaultDays;
                      rentCombo(combo.id, rentalDays * 24 * 60 * 60 * 1000);
                    }

                    addPurchaseRecord({
                      kind: 'combo',
                      itemId: combo.id,
                      mode,
                      cost: price.amount,
                      currencyType: price.currencyType,
                      days: mode === 'permanent' ? undefined : price.days || (mode === 'monthly' ? 30 : 7),
                    });

                    setCoins(getCoins());
                    setDiamonds(getDiamonds());
                    setSelectedCombo(combo.id);
                    refreshSelectedCombo();
                  };

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
                          {formatPriceLabel('permanent')}
                        </div>
                      </div>

                      <div className="text-xs text-white/60 mb-3">
                        {combo.desc}
                      </div>

                      {!comboLive && (
                        <div className="text-amber-300 text-xs mb-2">
                          V2 ARMORY PACK COMING SOON
                        </div>
                      )}

                      {active && (
                        <div className="text-green-400 text-xs mb-2">
                          {equipped ? 'EQUIPPED FOR NEXT RUN' : 'ACTIVE (NOT EQUIPPED)'}
                        </div>
                      )}

                      <div className="flex gap-2 flex-wrap">
                        {active && (
                          <button
                            onClick={() => {
                              setSelectedCombo(combo.id);
                              refreshSelectedCombo();
                            }}
                            className="px-3 py-2 rounded bg-green-500/20 border border-green-400 text-green-300"
                          >
                            {equipped ? 'EQUIPPED' : 'EQUIP'}
                          </button>
                        )}
                        <button
                          onClick={() => attemptComboPurchase('permanent')}
                          disabled={!comboLive}
                          className="px-3 py-2 rounded bg-cyan-500/20 border border-cyan-400 text-cyan-300"
                          style={{ opacity: comboLive ? 1 : 0.45, cursor: comboLive ? 'pointer' : 'not-allowed' }}
                        >
                          {comboLive ? `BUY (${formatPriceLabel('permanent')})` : 'V2 ARMORY PACK COMING SOON'}
                        </button>

                        <button
                          onClick={() => attemptComboPurchase('weekly')}
                          disabled={!comboLive}
                          className="px-3 py-2 rounded bg-purple-500/20 border border-purple-400 text-purple-300"
                          style={{ opacity: comboLive ? 1 : 0.45, cursor: comboLive ? 'pointer' : 'not-allowed' }}
                        >
                          {comboLive ? `RENT WEEK (${formatPriceLabel('weekly')})` : 'V2 ARMORY PACK COMING SOON'}
                        </button>

                        <button
                          onClick={() => attemptComboPurchase('monthly')}
                          disabled={!comboLive}
                          className="px-3 py-2 rounded bg-pink-500/20 border border-pink-400 text-pink-300"
                          style={{ opacity: comboLive ? 1 : 0.45, cursor: comboLive ? 'pointer' : 'not-allowed' }}
                        >
                          {comboLive ? `RENT MONTH (${formatPriceLabel('monthly')})` : 'V2 ARMORY PACK COMING SOON'}
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
                    {isMobileDevice ? (
                      <p
                        className="font-mono text-[11px] leading-5"
                        style={{ color: 'rgba(255,255,255,0.58)' }}
                      >
                        Keyboard key rebinding is available on web only. Mobile control layout can
                        be changed in the Mobile Controls section below.
                      </p>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <KeyBindButton
                            label="FLY"
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
                      </>
                    )}
                  </div>

                  {isMobileDevice && (
                    <div
                      className="rounded-2xl p-4"
                      style={{
                        background: 'rgba(125,227,255,0.04)',
                        border: '1px solid rgba(125,227,255,0.14)',
                      }}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <Smartphone className="w-4 h-4" style={{ color: '#7de3ff' }} />
                        <div
                          className="font-display text-lg font-black tracking-wider"
                          style={{ color: '#7de3ff' }}
                        >
                          MOBILE CONTROLS
                        </div>
                      </div>

                      <p
                        className="font-mono text-[11px] leading-5 mb-3"
                        style={{ color: 'rgba(255,255,255,0.58)' }}
                      >
                        Mobile uses external touch controls outside the playfield. Pick which side
                        the fly and fire buttons should use.
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <ChoiceButton
                          label="Fly Left / Fire Right"
                          description="Classic layout with fly button on the left side."
                          active={settingsDraft.mobileButtonLayout !== 'fly-right'}
                          accent="#7de3ff"
                          onClick={() => updateSetting('mobileButtonLayout', 'fly-left')}
                        />
                        <ChoiceButton
                          label="Fire Left / Fly Right"
                          description="Swap sides so fire is on the left and fly is on the right."
                          active={settingsDraft.mobileButtonLayout === 'fly-right'}
                          accent="#ffe66d"
                          onClick={() => updateSetting('mobileButtonLayout', 'fly-right')}
                        />
                        <ChoiceButton
                          label="Screen Special"
                          description="Use on-screen blast and special buttons only."
                          active={settingsDraft.mobileSpecialControl !== 'blow'}
                          accent="#ff66ff"
                          onClick={() =>
                            updateSettings({
                              mobileSpecialControl: 'screen',
                              mobileMicEnabled: false,
                            })
                          }
                        />
                        <ChoiceButton
                          label="Mic Assist"
                          description="Keep special buttons and allow a short blow to trigger the available special."
                          active={settingsDraft.mobileSpecialControl === 'blow'}
                          accent="#ffc785"
                          onClick={() => updateSetting('mobileSpecialControl', 'blow')}
                        />
                      </div>

                      {settingsDraft.mobileSpecialControl === 'blow' && (
                        <div className="mt-3">
                          <ToggleRow
                            label="Enable Microphone"
                            description="During runs, a short blow triggers the currently available special action."
                            value={Boolean(settingsDraft.mobileMicEnabled)}
                            onChange={(value) => updateSetting('mobileMicEnabled', value)}
                            accent="#ffc785"
                          />
                          <div
                            className="flex items-start gap-2 mt-3 font-mono text-[11px] leading-5"
                            style={{ color: 'rgba(255,255,255,0.56)' }}
                          >
                            <Mic className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                            <span>
                              If mic access is denied, the on-screen special button still works.
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

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
                      {isMobileDevice ? 'TOUCH LAYOUT' : 'CURRENT BINDINGS'}
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {(isMobileDevice
                        ? [
                            ['Fly Side', settingsDraft.mobileButtonLayout === 'fly-right' ? 'RIGHT' : 'LEFT'],
                            ['Fire Side', settingsDraft.mobileButtonLayout === 'fly-right' ? 'LEFT' : 'RIGHT'],
                            ['Mic Assist', settingsDraft.mobileMicEnabled ? 'ON' : 'OFF'],
                            ['Mic Mode', settingsDraft.mobileSpecialControl === 'blow' ? 'BLOW' : 'SCREEN'],
                          ]
                        : [
                            ['Fly', prettyKeyName(settingsDraft.flapKey)],
                            ['Shoot', prettyKeyName(settingsDraft.shootKey)],
                            ['Blast', prettyKeyName(settingsDraft.blastKey)],
                            ['Bomb', prettyKeyName(settingsDraft.bombKey)],
                          ]
                      ).map(([label, value]) => (
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
                      <li>
                        {purchasesEnabledForPlatform
                          ? '- Coin prices are shown before checkout.'
                          : '- Coins and diamonds are earned during runs.'}
                      </li>
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

                    {isOwnerAccount && (
                      <button
                        onClick={handleGrantOwnerAccess}
                        disabled={isGrantingOwnerAccess}
                        className="mt-3 px-4 py-2 rounded-xl font-display text-sm font-bold tracking-wider transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed"
                        style={{
                          background: 'rgba(125,227,255,0.10)',
                          border: '1px solid rgba(125,227,255,0.28)',
                          color: '#7de3ff',
                          opacity: isGrantingOwnerAccess ? 0.62 : 1,
                        }}
                      >
                        {isGrantingOwnerAccess ? 'SYNCING OWNER ACCESS...' : 'GRANT OWNER ACCESS'}
                      </button>
                    )}

                    {isDeveloperLoginEnabled && (
                      <button
                        onClick={handleClearDeveloperState}
                        className="mt-3 px-4 py-2 rounded-xl font-display text-sm font-bold tracking-wider transition-all hover:scale-105 active:scale-95"
                        style={{
                          background: 'rgba(255,120,120,0.08)',
                          border: '1px solid rgba(255,120,120,0.22)',
                          color: '#ffb0b0',
                        }}
                      >
                        CLEAR LOCAL DEV STATE
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );

  return (
    <>
      {renderAuthModal()}
      {renderComboShopModal()}
      {renderSettingsModal()}
    </>
  );
}
