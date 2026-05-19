import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
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
  LogIn,
  UserPlus,
  LogOut,
  Mic,
  Smartphone,
} from 'lucide-react';
import {
  getCoins,
  getDiamonds,
  getHighScore,
  getBadges,
  getDailyMissionState,
  claimDailyMission,
  getPurchaseHistory,
  grantFullAccessToLocalSave,
  resetEconomyProgress,
  spendCoins,
  spendDiamonds,
  ownCombo,
  rentCombo,
  isComboActive,
  getSelectedCombo,
  setSelectedCombo,
  addPurchaseRecord,
} from '../../lib/gameStore';

import { COMBO_PACKS, getCatalogAuditReport } from '../../lib/gameItems';
import {
  buyCoins,
  buyDiamonds,
  COIN_PACKS,
  DIAMOND_PACKS,
  hasPaymentsApiBaseUrl,
  isGooglePlayBillingAvailable,
  isIosRevenueCatAvailable,
  loadStoreCatalog,
} from '../../lib/payments';
import { pullCloudSaveToLocal, pushLocalSaveToCloud } from '../../lib/cloudSave';
import { useAuth } from '../../lib/AuthContext';
import {
  appStorePurchaseMessage,
  areExternalPurchasesEnabled,
} from '../../lib/releaseConfig';
import { getRuntimeDefaultSettings } from '../../config/gameConfig.js';

const DEFAULT_SETTINGS = getRuntimeDefaultSettings();
const GIFT_MESSAGE_DISMISSED_KEY = 'firepilot_dismissed_gift_messages';
const Armory = lazy(() => import('./Armory.jsx'));

function stopAuthKeyPropagation(event) {
  event.stopPropagation();
}

function getGiftMessageKey(entry, userId) {
  return `${userId || 'anon'}:${entry.creditId || entry.grantedAt || entry.ts || entry.message}`;
}

function getDismissedGiftMessages() {
  try {
    const raw = window.localStorage.getItem(GIFT_MESSAGE_DISMISSED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function dismissGiftMessage(messageKey) {
  const dismissed = new Set(getDismissedGiftMessages());
  dismissed.add(messageKey);
  window.localStorage.setItem(
    GIFT_MESSAGE_DISMISSED_KEY,
    JSON.stringify([...dismissed].slice(-100))
  );
}

function findActiveGiftMessage(userId) {
  if (typeof window === 'undefined' || !userId) return null;

  const dismissed = new Set(getDismissedGiftMessages());
  const now = Date.now();
  const messages = getPurchaseHistory()
    .filter((entry) => {
      if (entry?.source !== 'manual-credit' || !entry.message) return false;

      const expiresAt = entry.messageExpiresAt ? Date.parse(entry.messageExpiresAt) : 0;
      if (expiresAt && expiresAt <= now) return false;

      return !dismissed.has(getGiftMessageKey(entry, userId));
    })
    .sort((a, b) => Date.parse(b.grantedAt || b.ts || 0) - Date.parse(a.grantedAt || a.ts || 0));

  const message = messages[0];
  return message
    ? {
      key: getGiftMessageKey(message, userId),
      text: message.message,
      quantity: Number(message.quantity || 0),
      kind: message.kind || 'coins',
    }
    : null;
}

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
  diamondsEarned = 0,
  onStart,
  onReturnToMenu,
  onSkinChange,
  onReviveAttempt,
  canUseRevive = false,
  reviveBusy = false,
  reviveRetrySeconds = 0,
  reviveMessage = '',
  milestoneBonusCoins = 0,
  newBadgesUnlocked = [],
  dailyMissionCompletions = 0,
}) {
  const [showShop, setShowShop] = useState(false);
  const [showCoinShop, setShowCoinShop] = useState(false);
  const [showDiamondShop, setShowDiamondShop] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [coins, setCoins] = useState(getCoins());
  const [diamonds, setDiamonds] = useState(getDiamonds());
  const [buyingPackId, setBuyingPackId] = useState(null);
  const [isGrantingOwnerAccess, setIsGrantingOwnerAccess] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState(loadSettings());
  const [listeningFor, setListeningFor] = useState(null);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const {
    user,
    isLoadingAuth,
    hasSupabaseConfig,
    logout,
    login,
    register,
    loginAsDeveloper,
    clearLocalDeveloperState,
    isDeveloperLoginEnabled,
    isOwnerAccount,
  } = useAuth();
  const [showComboShop, setShowComboShop] = useState(false);
  const [selectedComboId, setSelectedComboId] = useState(getSelectedCombo());
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authErrorMessage, setAuthErrorMessage] = useState('');
  const [authInfoMessage, setAuthInfoMessage] = useState('');
  const [pendingCheckoutIntent, setPendingCheckoutIntent] = useState(null);
  const [giftMessage, setGiftMessage] = useState(null);
  const [storeCatalogError, setStoreCatalogError] = useState('');
  const [storeCatalogLoading, setStoreCatalogLoading] = useState(
    isGooglePlayBillingAvailable() || isIosRevenueCatAvailable()
  );
  const [playCatalogById, setPlayCatalogById] = useState({});
  const [badges, setBadges] = useState(getBadges());
  const [dailyMissionState, setDailyMissionState] = useState(getDailyMissionState());

  const highScore = getHighScore();
  const usesGooglePlay = isGooglePlayBillingAvailable();
  const usesIosRevenueCat = isIosRevenueCatAvailable();
  const usesNativeStorePurchase = usesGooglePlay || usesIosRevenueCat;
  const purchasesEnabledForPlatform = usesNativeStorePurchase || areExternalPurchasesEnabled;
  const hasPaymentBackend = hasPaymentsApiBaseUrl();
  const visibleComboPacks = useMemo(
    () => COMBO_PACKS.filter((combo) => combo.live !== false),
    []
  );

  useEffect(() => {
    const audit = getCatalogAuditReport();
    if (!audit.ok) {
      console.warn('[armory-catalog-audit]', audit.issues);
    }
  }, []);

  const dailyMissions = Array.isArray(dailyMissionState?.missions)
    ? dailyMissionState.missions
    : [];
  const recentBadges = badges.slice(0, 6);
  const paymentBlockReason = !purchasesEnabledForPlatform
    ? appStorePurchaseMessage
    : usesGooglePlay && !hasPaymentBackend
    ? 'Google Play purchases require VITE_API_BASE_URL to point at your live backend API.'
    : usesNativeStorePurchase && storeCatalogLoading
    ? usesIosRevenueCat
      ? 'Loading App Store products...'
      : 'Loading Google Play products...'
    : usesNativeStorePurchase && storeCatalogError
    ? storeCatalogError
    : isLoadingAuth
    ? 'Checking account session...'
    : !hasSupabaseConfig
      ? 'Checkout is disabled in this local build because Supabase auth is not configured.'
      : !user?.id
        ? 'Checkout requires a signed-in account. Selecting a pack will route you through login and return you here.'
        : null;

  const getCheckoutButtonLabel = (isBuying, currencyType) => {
    if (!purchasesEnabledForPlatform) return 'DISABLED';
    if (isBuying) {
      if (usesGooglePlay) return 'OPENING GOOGLE PLAY...';
      if (usesIosRevenueCat) return 'OPENING APP STORE...';
      return 'OPENING CHECKOUT...';
    }
    if (usesNativeStorePurchase && storeCatalogLoading) return 'LOADING STORE...';
    if (usesNativeStorePurchase && storeCatalogError) return 'STORE UNAVAILABLE';
    if (isLoadingAuth) return 'CHECKING SESSION...';
    if (usesGooglePlay && !hasPaymentBackend) return 'BACKEND REQUIRED';
    if (!hasSupabaseConfig) return 'AUTH NOT CONFIGURED';
    if (!user?.id) return currencyType === 'diamonds' ? 'SIGN IN FOR DIAMONDS' : 'SIGN IN FOR COINS';
    if (usesGooglePlay) return 'BUY WITH GOOGLE PLAY';
    if (usesIosRevenueCat) return 'BUY WITH APP STORE';
    return 'BUY NOW';
  };

  const refreshCurrencies = () => {
    setCoins(getCoins());
    setDiamonds(getDiamonds());
  };

  const refreshSelectedCombo = () => {
    setSelectedComboId(getSelectedCombo());
  };

  const refreshProgression = () => {
    setBadges(getBadges());
    setDailyMissionState(getDailyMissionState());
  };

  const refreshGiftMessage = () => {
    setGiftMessage(findActiveGiftMessage(user?.id));
  };

  const closeGiftMessage = () => {
    if (giftMessage?.key) {
      dismissGiftMessage(giftMessage.key);
    }

    setGiftMessage(null);
  };

  const resetAuthModalState = (mode = 'login') => {
    setAuthMode(mode);
    setAuthEmail('');
    setAuthPassword('');
    setAuthSubmitting(false);
    setAuthErrorMessage('');
    setAuthInfoMessage('');
  };

  const openAuthModal = (mode = 'login', checkoutIntent = null) => {
    resetAuthModalState(mode);
    setPendingCheckoutIntent(checkoutIntent);
    setShowAuthModal(true);
  };

  const closeAuthModal = () => {
    setShowAuthModal(false);
    setPendingCheckoutIntent(null);
    setAuthSubmitting(false);
    setAuthErrorMessage('');
    setAuthInfoMessage('');
  };

  const runCheckoutIntent = async (intent, authenticatedUser) => {
    if (!purchasesEnabledForPlatform) return;
    if (!intent?.pack || !intent?.currencyType || !authenticatedUser?.id) return;

    const packId = intent.pack.id || String(intent.pack.coins || intent.pack.diamonds || 'pack');
    setBuyingPackId(packId);

    try {
      let result = null;
      if (intent.currencyType === 'coins') {
        result = await buyCoins(intent.pack, authenticatedUser.id);
      } else {
        result = await buyDiamonds(intent.pack, authenticatedUser.id);
      }

      if (result?.ok && result.status === 'purchased') {
        if (result?.creditedLocally) {
          refreshCurrencies();
        } else {
          const syncResult = await pullCloudSaveToLocal();
          if (syncResult?.ok) {
            refreshCurrencies();
          }
        }
      }
    } finally {
      setBuyingPackId(null);
    }
  };

  const finalizeAuthSuccess = async (authenticatedUser) => {
    refreshCurrencies();
    setShowAuthModal(false);
    setAuthSubmitting(false);
    setAuthErrorMessage('');
    setAuthInfoMessage('');

    const intent = pendingCheckoutIntent;
    setPendingCheckoutIntent(null);

    if (!intent) return;

    if (intent.currencyType === 'coins') setShowCoinShop(true);
    if (intent.currencyType === 'diamonds') setShowDiamondShop(true);

    if (authenticatedUser?.isLocalDeveloper) {
      return;
    }

    await runCheckoutIntent(intent, authenticatedUser);
  };

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    setAuthErrorMessage('');
    setAuthInfoMessage('');

    if (!authEmail.trim() || !authPassword.trim()) {
      setAuthErrorMessage('Enter both email and password.');
      return;
    }

    setAuthSubmitting(true);

    try {
      if (authMode === 'login') {
        const result = await login(authEmail.trim(), authPassword);
        const authenticatedUser = result?.user ?? result?.session?.user ?? null;
        await finalizeAuthSuccess(authenticatedUser);
        return;
      }

      const result = await register(authEmail.trim(), authPassword);
      const authenticatedUser = result?.user ?? result?.session?.user ?? null;
      const hasSession = Boolean(result?.session);

      if (hasSession && authenticatedUser) {
        await finalizeAuthSuccess(authenticatedUser);
        return;
      }

      setAuthInfoMessage(
        'Account created. If your Supabase project requires email confirmation, verify your email and then sign in.'
      );
      setAuthMode('login');
      setAuthSubmitting(false);
    } catch (error) {
      setAuthErrorMessage(error?.message || 'Authentication failed.');
      setAuthSubmitting(false);
    }
  };

  const handleDeveloperAuth = async () => {
    setAuthErrorMessage('');
    setAuthInfoMessage('');
    setAuthSubmitting(true);

    try {
      const developerUser = await loginAsDeveloper();
      await finalizeAuthSuccess(developerUser);
    } catch (error) {
      setAuthErrorMessage(error?.message || 'Developer access failed.');
      setAuthSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      refreshCurrencies();
    } catch (error) {
      alert(error?.message || 'Logout failed.');
    }
  };

  const handleClearDeveloperState = async () => {
    const confirmed = window.confirm(
      'Clear local developer state and reset local coins, diamonds, unlocks, and inventory?'
    );

    if (!confirmed) return;

    try {
      await clearLocalDeveloperState();
      resetEconomyProgress();
      refreshCurrencies();
      refreshProgression();
      setShowShop(false);
      setShowCoinShop(false);
      setShowDiamondShop(false);
      setShowComboShop(false);
      alert('Local developer state was cleared.');
    } catch (error) {
      alert(error?.message || 'Failed to clear local developer state.');
    }
  };

  const openPrivacyPolicy = () => {
    window.location.href = '/privacy';
  };

  const openAccountDeletion = () => {
    window.location.href = '/account/delete';
  };

  const handleClaimMission = (missionId) => {
    const result = claimDailyMission(missionId);
    if (!result?.ok) {
      if (result?.reason === 'already_claimed') {
        alert('Mission reward already claimed.');
      } else if (result?.reason === 'mission_not_completed') {
        alert('Complete the mission first.');
      }
      return;
    }

    refreshCurrencies();
    refreshProgression();
  };

  const handleGrantOwnerAccess = async () => {
    if (!user?.id || !isOwnerAccount) {
      return;
    }

    const confirmed = window.confirm(
      'Grant full access to this signed-in owner account and sync it to cloud save?'
    );

    if (!confirmed) return;

    setIsGrantingOwnerAccess(true);

    try {
      await pullCloudSaveToLocal();
      grantFullAccessToLocalSave({
        note: 'Owner full access granted from authenticated account',
      });

      const pushResult = await pushLocalSaveToCloud();

      if (!pushResult?.ok) {
        throw new Error(pushResult?.reason || 'Cloud sync failed.');
      }

      refreshCurrencies();
      refreshProgression();
      alert('Owner full access synced to this account.');
    } catch (error) {
      alert(error?.message || 'Failed to grant owner access.');
    } finally {
      setIsGrantingOwnerAccess(false);
    }
  };

  useEffect(() => {
    let active = true;

    const loadCatalog = async () => {
      if (!usesNativeStorePurchase) {
        setStoreCatalogLoading(false);
        setStoreCatalogError('');
        setPlayCatalogById({});
        return;
      }

      setStoreCatalogLoading(true);
      const catalog = await loadStoreCatalog();
      if (!active) return;

      const byId = {};
      [...(catalog.coins || []), ...(catalog.diamonds || [])].forEach((pack) => {
        byId[pack.id] = pack;
      });

      setPlayCatalogById(byId);
      setStoreCatalogError(catalog.error || '');
      setStoreCatalogLoading(false);
    };

    loadCatalog();

    return () => {
      active = false;
    };
  }, [usesNativeStorePurchase]);

  useEffect(() => {
    const handleStorageChange = () => {
      refreshCurrencies();
      refreshGiftMessage();
      refreshSelectedCombo();
      refreshProgression();
      setSettingsDraft(loadSettings());
    };

    const handleFocus = () => {
      refreshCurrencies();
      refreshGiftMessage();
      refreshSelectedCombo();
      refreshProgression();
      setSettingsDraft(loadSettings());
    };

    const handleSettingsChanged = () => setSettingsDraft(loadSettings());

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('firepilot-local-save-updated', handleStorageChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('firepilot-settings-changed', handleSettingsChanged);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('firepilot-local-save-updated', handleStorageChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('firepilot-settings-changed', handleSettingsChanged);
    };
  }, [user?.id]);

  useEffect(() => {
    refreshGiftMessage();
    refreshProgression();
  }, [user?.id]);

  useEffect(() => {
    const updateMobileDevice = () => {
      const nativeCapacitor = Boolean(window.Capacitor?.isNativePlatform?.());
      const capacitorPlatform = window.Capacitor?.getPlatform?.();
      const isNativeMobileApp =
        nativeCapacitor &&
        (capacitorPlatform === 'android' || capacitorPlatform === 'ios');
      setIsMobileDevice(isNativeMobileApp);
    };

    updateMobileDevice();
    window.addEventListener('resize', updateMobileDevice);
    window.addEventListener('orientationchange', updateMobileDevice);
    return () => {
      window.removeEventListener('resize', updateMobileDevice);
      window.removeEventListener('orientationchange', updateMobileDevice);
    };
  }, []);

  useEffect(() => {
    if (!showSettings || !listeningFor) return undefined;
    if (isMobileDevice) return undefined;

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
  }, [showSettings, listeningFor, settingsDraft, isMobileDevice]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const shop = params.get('shop');
    if (!shop) return;

    if (shop === 'coins') setShowCoinShop(true);
    if (shop === 'diamonds') setShowDiamondShop(true);

    params.delete('shop');
    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`;
    window.history.replaceState({}, '', nextUrl);
  }, []);

  const coinPacks = useMemo(() => {
    const fallbackPacks = [
      { id: 'coins_100', coins: 100, amount: 199, tag: null },
      { id: 'coins_200', coins: 200, amount: 399, tag: null },
      { id: 'coins_500', coins: 500, amount: 999, tag: null },
      { id: 'coins_1200', coins: 1200, amount: 1999, tag: 'Starter Pack' },
      { id: 'coins_2500', coins: 2500, amount: 3999, tag: 'Popular' },
      { id: 'coins_3000', coins: 3000, amount: 5499, tag: null },
      { id: 'coins_4000', coins: 4000, amount: 7500, tag: null },
      { id: 'coins_5000', coins: 5000, amount: 8999, tag: 'Best Value' },
      { id: 'coins_10000', coins: 10000, amount: 12000, tag: 'Whale Pack' },
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
          1200: 'Starter Pack',
          2500: 'Popular',
          5000: 'Best Value',
          10000: 'Whale Pack',
        }[pack.coins] ??
        null,
    }));
  }, []);

  const displayedCoinPacks = useMemo(
    () =>
      coinPacks.map((pack) => ({
        ...pack,
        ...(playCatalogById[pack.id] || {}),
      })),
    [coinPacks, playCatalogById]
  );

  const diamondPacks = useMemo(() => {
    const fallbackPacks = [
      { id: 'diamonds_10', diamonds: 10, amount: 199, tag: null },
      { id: 'diamonds_25', diamonds: 25, amount: 399, tag: 'Starter' },
      { id: 'diamonds_75', diamonds: 75, amount: 999, tag: 'Popular' },
      { id: 'diamonds_150', diamonds: 150, amount: 1799, tag: null },
      { id: 'diamonds_300', diamonds: 300, amount: 2999, tag: 'Best Value' },
    ];

    const sourcePacks =
      Array.isArray(DIAMOND_PACKS) && DIAMOND_PACKS.length > 0
        ? DIAMOND_PACKS
        : fallbackPacks;

    return sourcePacks.map((pack) => ({
      ...pack,
      id: pack.id || `diamonds_${pack.diamonds}`,
      displayPrice:
        pack.priceLabel ||
        (typeof pack.amount === 'number' ? `$${(pack.amount / 100).toFixed(2)}` : ''),
      displayLabel: pack.label || `${pack.diamonds.toLocaleString()} Diamonds`,
      tag:
        pack.tag ??
        {
          25: 'Starter',
          75: 'Popular',
          300: 'Best Value',
        }[pack.diamonds] ??
        null,
    }));
  }, []);

  const displayedDiamondPacks = useMemo(
    () =>
      diamondPacks.map((pack) => ({
        ...pack,
        ...(playCatalogById[pack.id] || {}),
      })),
    [diamondPacks, playCatalogById]
  );

  const purchaseDisabled =
    isLoadingAuth ||
    !hasSupabaseConfig ||
    (usesGooglePlay && !hasPaymentBackend) ||
    (usesNativeStorePurchase && (storeCatalogLoading || Boolean(storeCatalogError)));

  const handleCoinPurchase = async (pack) => {
    if (!purchasesEnabledForPlatform) {
      alert(appStorePurchaseMessage);
      return;
    }

    if (isLoadingAuth) {
      alert(paymentBlockReason);
      return;
    }

    if (!user?.id) {
      openAuthModal('login', { currencyType: 'coins', pack });
      return;
    }

    if (usesGooglePlay && !hasPaymentBackend) {
      alert('Purchases are disabled because the app backend URL is not configured.');
      return;
    }

    if (!hasSupabaseConfig) {
      alert('Checkout is disabled because Supabase auth is not configured for this build.');
      return;
    }

    try {
      setBuyingPackId(pack.id || String(pack.coins));
      const result = await buyCoins(pack, user.id);
      if (result?.ok && result.status === 'purchased') {
        if (result?.creditedLocally) {
          refreshCurrencies();
        } else {
          const syncResult = await pullCloudSaveToLocal();
          if (syncResult?.ok) {
            refreshCurrencies();
          }
        }
      }
    } finally {
      setBuyingPackId(null);
    }
  };

  const handleDiamondPurchase = async (pack) => {
    if (!purchasesEnabledForPlatform) {
      alert(appStorePurchaseMessage);
      return;
    }

    if (isLoadingAuth) {
      alert(paymentBlockReason);
      return;
    }

    if (!user?.id) {
      openAuthModal('login', { currencyType: 'diamonds', pack });
      return;
    }

    if (usesGooglePlay && !hasPaymentBackend) {
      alert('Purchases are disabled because the app backend URL is not configured.');
      return;
    }

    if (!hasSupabaseConfig) {
      alert('Checkout is disabled because Supabase auth is not configured for this build.');
      return;
    }

    try {
      setBuyingPackId(pack.id || String(pack.diamonds));
      const result = await buyDiamonds(pack, user.id);
      if (result?.ok && result.status === 'purchased') {
        if (result?.creditedLocally) {
          refreshCurrencies();
        } else {
          const syncResult = await pullCloudSaveToLocal();
          if (syncResult?.ok) {
            refreshCurrencies();
          }
        }
      }
    } finally {
      setBuyingPackId(null);
    }
  };

  const updateSetting = (key, value) => {
    const next = { ...settingsDraft, [key]: value };
    setSettingsDraft(next);
    saveSettings(next);
  };

  const updateSettings = (patch) => {
    const next = { ...settingsDraft, ...patch };
    setSettingsDraft(next);
    saveSettings(next);
  };

  const resetSettings = () => {
    setSettingsDraft(DEFAULT_SETTINGS);
    saveSettings(DEFAULT_SETTINGS);
    setListeningFor(null);
  };

  const panelBaseStyle = {
    background:
      'radial-gradient(circle at top, rgba(58,92,118,0.2), rgba(8,12,18,0.96) 58%)',
    border: '1px solid rgba(150, 225, 255, 0.18)',
    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255,255,255,0.08)',
    backdropFilter: 'blur(14px)',
  };

  const menuShellStyle = {
    background:
      'linear-gradient(180deg, rgba(9,18,26,0.9), rgba(7,11,16,0.96)), radial-gradient(circle at top right, rgba(106,170,214,0.18), rgba(0,0,0,0) 35%)',
    border: '1px solid rgba(175, 225, 255, 0.16)',
    boxShadow: '0 30px 70px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)',
    backdropFilter: 'blur(12px)',
  };

  const renderGiftMessageModal = () => (
    <AnimatePresence>
      {giftMessage && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeGiftMessage}
            className="fixed inset-0"
            style={{
              zIndex: 1000002,
              background: 'rgba(0,0,0,0.68)',
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
              className="w-full max-w-md rounded-[28px] p-6 md:p-7 text-center"
              style={{
                ...panelBaseStyle,
                border: '1px solid rgba(255,221,0,0.34)',
                boxShadow:
                  '0 26px 70px rgba(0,0,0,0.52), 0 0 32px rgba(255,221,0,0.12)',
              }}
            >
              <div
                className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
                style={{
                  background: 'rgba(255,221,0,0.12)',
                  border: '1px solid rgba(255,221,0,0.32)',
                  color: '#ffdd00',
                }}
              >
                <Coins className="h-7 w-7" />
              </div>

              <h2
                className="font-display text-2xl font-black tracking-wide"
                style={{ color: '#fff4a8' }}
              >
                GIFT RECEIVED
              </h2>

              <p
                className="font-mono text-sm leading-6 mt-4"
                style={{ color: 'rgba(255,255,255,0.82)' }}
              >
                {giftMessage.text}
              </p>

              {giftMessage.quantity > 0 && (
                <div
                  className="mt-5 rounded-2xl px-4 py-3 font-display text-xl font-black"
                  style={{
                    color: '#ffdd00',
                    background: 'rgba(255,221,0,0.09)',
                    border: '1px solid rgba(255,221,0,0.24)',
                  }}
                >
                  +{giftMessage.quantity.toLocaleString()} {giftMessage.kind}
                </div>
              )}

              <button
                type="button"
                onClick={closeGiftMessage}
                className="mt-6 w-full rounded-xl px-4 py-3 font-display text-sm font-bold tracking-wider transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: 'rgba(255,221,0,0.14)',
                  border: '1px solid rgba(255,221,0,0.38)',
                  color: '#ffdd00',
                }}
              >
                CLAIM
              </button>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );

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

  const renderCoinShopModal = () => {
    return (
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
                {paymentBlockReason && (
                  <div
                    className="rounded-xl px-4 py-3 mb-5"
                    style={{
                      background: 'rgba(255, 171, 122, 0.08)',
                      border: '1px solid rgba(255, 171, 122, 0.22)',
                    }}
                  >
                    <div
                      className="font-mono text-[11px] mb-1 tracking-wider"
                      style={{ color: '#ffbb92' }}
                    >
                      CHECKOUT STATUS
                    </div>
                    <div
                      className="font-mono text-xs leading-5"
                      style={{ color: 'rgba(255,255,255,0.72)' }}
                    >
                      {paymentBlockReason}
                    </div>
                    {!isLoadingAuth && hasSupabaseConfig && !user?.id && (
                      <div className="flex flex-col md:flex-row gap-3 mt-4">
                        <button
                          onClick={() => openAuthModal('login')}
                          className="px-4 py-2 rounded-xl font-display text-sm font-bold tracking-wider"
                          style={{
                            background: 'rgba(157,220,255,0.14)',
                            border: '1px solid rgba(157,220,255,0.32)',
                            color: '#9ddcff',
                          }}
                        >
                          SIGN IN
                        </button>
                        <button
                          onClick={() => openAuthModal('register')}
                          className="px-4 py-2 rounded-xl font-display text-sm font-bold tracking-wider"
                          style={{
                            background: 'rgba(255,199,133,0.12)',
                            border: '1px solid rgba(255,199,133,0.28)',
                            color: '#ffc785',
                          }}
                        >
                          CREATE ACCOUNT
                        </button>
                      </div>
                    )}
                  </div>
                )}

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
                  {displayedCoinPacks.map((pack) => {
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
                          disabled={purchaseDisabled || isBuying || !pack.displayPrice}
                          className="w-full px-4 py-2.5 rounded-xl font-display text-sm font-bold tracking-wider transition-all hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed"
                          style={{
                            background:
                              'linear-gradient(135deg, rgba(0,255,255,0.18), rgba(255,0,255,0.12))',
                            border: '1px solid rgba(0,255,255,0.45)',
                            color: '#00ffff',
                            opacity: purchaseDisabled || isBuying || !pack.displayPrice ? 0.65 : 1,
                          }}
                        >
                          {getCheckoutButtonLabel(isBuying, 'coins')}
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
  };

  const renderDiamondShopModal = () => {
    return (
    <AnimatePresence>
      {showDiamondShop && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowDiamondShop(false)}
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
                    <span style={{ color: '#7de3ff', fontSize: 20 }}>💎</span>
                    <h2
                      className="font-display text-2xl font-black tracking-wider"
                      style={{
                        color: '#7de3ff',
                        textShadow: '0 0 18px rgba(125, 227, 255, 0.28)',
                      }}
                    >
                      BUY DIAMONDS
                    </h2>
                  </div>
                  <p
                    className="font-mono text-xs md:text-sm"
                    style={{ color: 'rgba(255,255,255,0.65)' }}
                  >
                    Diamonds are used for specials and premium combo access.
                  </p>
                </div>

                <button
                  onClick={() => setShowDiamondShop(false)}
                  className="flex items-center justify-center rounded-lg transition-all hover:scale-105 active:scale-95 shrink-0"
                  style={{
                    width: 40,
                    height: 40,
                    border: '1px solid rgba(255,255,255,0.14)',
                    background: 'rgba(255,255,255,0.05)',
                    color: '#ffffff',
                  }}
                  aria-label="Close diamond shop"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="overflow-y-auto p-5 md:p-6">
                {paymentBlockReason && (
                  <div
                    className="rounded-xl px-4 py-3 mb-5"
                    style={{
                      background: 'rgba(255, 171, 122, 0.08)',
                      border: '1px solid rgba(255, 171, 122, 0.22)',
                    }}
                  >
                    <div
                      className="font-mono text-[11px] mb-1 tracking-wider"
                      style={{ color: '#ffbb92' }}
                    >
                      CHECKOUT STATUS
                    </div>
                    <div
                      className="font-mono text-xs leading-5"
                      style={{ color: 'rgba(255,255,255,0.72)' }}
                    >
                      {paymentBlockReason}
                    </div>
                    {!isLoadingAuth && hasSupabaseConfig && !user?.id && (
                      <div className="flex flex-col md:flex-row gap-3 mt-4">
                        <button
                          onClick={() => openAuthModal('login')}
                          className="px-4 py-2 rounded-xl font-display text-sm font-bold tracking-wider"
                          style={{
                            background: 'rgba(157,220,255,0.14)',
                            border: '1px solid rgba(157,220,255,0.32)',
                            color: '#9ddcff',
                          }}
                        >
                          SIGN IN
                        </button>
                        <button
                          onClick={() => openAuthModal('register')}
                          className="px-4 py-2 rounded-xl font-display text-sm font-bold tracking-wider"
                          style={{
                            background: 'rgba(255,199,133,0.12)',
                            border: '1px solid rgba(255,199,133,0.28)',
                            color: '#ffc785',
                          }}
                        >
                          CREATE ACCOUNT
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div
                  className="flex items-center justify-between rounded-xl px-4 py-3 mb-5"
                  style={{
                    background: 'rgba(125, 227, 255, 0.08)',
                    border: '1px solid rgba(125, 227, 255, 0.22)',
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
                      color: '#7de3ff',
                      textShadow: '0 0 12px rgba(125, 227, 255, 0.24)',
                    }}
                  >
                    {diamonds} DIAMONDS
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {displayedDiamondPacks.map((pack) => {
                    const packId = pack.id || String(pack.diamonds);
                    const isBuying = buyingPackId === packId;

                    return (
                      <motion.div
                        key={packId}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="relative rounded-2xl p-4"
                        style={{
                          background:
                            'linear-gradient(135deg, rgba(125,227,255,0.10), rgba(0,255,255,0.05))',
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
                            <span style={{ color: '#7de3ff', fontSize: 18 }}>💎</span>
                            <h3
                              className="font-display text-2xl font-black"
                              style={{ color: '#ffffff' }}
                            >
                              {pack.diamonds.toLocaleString()}
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
                              color: '#7de3ff',
                              textShadow: '0 0 10px rgba(125,227,255,0.2)',
                            }}
                          >
                            {pack.displayPrice || 'Unavailable'}
                          </div>
                        </div>

                        <button
                          onClick={() => handleDiamondPurchase(pack)}
                          disabled={purchaseDisabled || isBuying || !pack.displayPrice}
                          className="w-full px-4 py-2.5 rounded-xl font-display text-sm font-bold tracking-wider transition-all hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed"
                          style={{
                            background:
                              'linear-gradient(135deg, rgba(125,227,255,0.18), rgba(0,255,255,0.12))',
                            border: '1px solid rgba(125,227,255,0.45)',
                            color: '#7de3ff',
                            opacity: purchaseDisabled || isBuying || !pack.displayPrice ? 0.65 : 1,
                          }}
                        >
                          {getCheckoutButtonLabel(isBuying, 'diamonds')}
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
  };

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

  const renderIdleMenu = () => (
    <div
      className={
        isMobileDevice
          ? 'w-full min-h-full h-full flex items-stretch justify-center px-0 py-0'
          : 'w-full min-h-full flex items-start md:items-center justify-center px-4 py-16 md:px-6 md:py-6'
      }
    >
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className={
          isMobileDevice
            ? 'w-full h-full max-w-none max-h-none rounded-none p-3 relative overflow-y-auto overflow-x-hidden'
            : 'w-full max-w-[860px] max-h-[calc(100vh-2rem)] rounded-[32px] p-4 md:p-6 relative overflow-y-auto overflow-x-hidden'
        }
        style={
          isMobileDevice
            ? {
                ...menuShellStyle,
                borderRadius: 0,
                minHeight: '100%',
                paddingBottom: 'max(env(safe-area-inset-bottom), 12px)',
              }
            : menuShellStyle
        }
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 18% 20%, rgba(135,210,255,0.16), rgba(0,0,0,0) 26%), radial-gradient(circle at 82% 12%, rgba(255,171,122,0.16), rgba(0,0,0,0) 24%), linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0))',
          }}
        />
        <div className="relative text-center mb-5 md:mb-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 mb-4">
            <div
              className="inline-flex items-center gap-2 rounded-full px-3 py-1"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(185,225,255,0.14)',
              }}
            >
              <Gamepad2 className="w-3.5 h-3.5" style={{ color: '#9ddcff' }} />
              <span
                className="font-mono text-[10px] tracking-[0.28em]"
                style={{ color: 'rgba(220,235,245,0.7)' }}
              >
                AERIAL COMBAT SIMULATION
              </span>
            </div>

            {user?.id ? (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <div
                  className="rounded-full px-3 py-1 font-mono text-[11px]"
                  style={{
                    background: 'rgba(157,220,255,0.08)',
                    border: '1px solid rgba(157,220,255,0.2)',
                    color: '#dff4ff',
                  }}
                >
                  {user.email || user.id}
                </div>
                {isDeveloperLoginEnabled && user.isLocalDeveloper && (
                  <button
                    onClick={handleClearDeveloperState}
                    className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-display text-xs font-bold tracking-wider"
                    style={{
                      background: 'rgba(255,120,120,0.08)',
                      border: '1px solid rgba(255,120,120,0.22)',
                      color: '#ffb0b0',
                    }}
                  >
                    CLEAR DEV
                  </button>
                )}
                {!user.isLocalDeveloper && (
                  <button
                    onClick={openAccountDeletion}
                    className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-display text-xs font-bold tracking-wider"
                    style={{
                      background: 'rgba(255,120,120,0.08)',
                      border: '1px solid rgba(255,120,120,0.22)',
                      color: '#ffb0b0',
                    }}
                  >
                    DELETE ACCOUNT
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  onClick={openPrivacyPolicy}
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-display text-xs font-bold tracking-wider"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: 'rgba(225,235,242,0.78)',
                  }}
                >
                  PRIVACY
                </button>
                <button
                  onClick={() => openAuthModal('login')}
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-display text-xs font-bold tracking-wider"
                  style={{
                    background: 'rgba(157,220,255,0.12)',
                    border: '1px solid rgba(157,220,255,0.28)',
                    color: '#9ddcff',
                  }}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  SIGN IN
                </button>
                <button
                  onClick={() => openAuthModal('register')}
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-display text-xs font-bold tracking-wider"
                  style={{
                    background: 'rgba(255,199,133,0.1)',
                    border: '1px solid rgba(255,199,133,0.24)',
                    color: '#ffc785',
                  }}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  CREATE ACCOUNT
                </button>
              </div>
            )}
          </div>

          <div
            className="inline-flex items-center gap-2 rounded-full px-3 py-1 mb-4"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(185,225,255,0.14)',
            }}
          >
            <Gamepad2 className="w-3.5 h-3.5" style={{ color: '#9ddcff' }} />
            <span
              className="font-mono text-[10px] tracking-[0.28em]"
              style={{ color: 'rgba(220,235,245,0.7)' }}
            >
              {user?.id ? 'PILOT AUTHENTICATED' : 'AUTH OPTIONAL FOR LOCAL PLAY'}
            </span>
          </div>
          <h1
            className="font-display text-[2.4rem] md:text-[4.35rem] leading-none font-black tracking-[0.16em]"
            style={{
              color: '#edf8ff',
              textShadow: '0 10px 30px rgba(0,0,0,0.35), 0 0 26px rgba(145,220,255,0.2)',
            }}
          >
            FIREPILOT
          </h1>
          <p
            className="font-display text-[1.05rem] md:text-[1.35rem] font-bold tracking-[0.55em] mt-3 pl-3"
            style={{ color: '#7de3ff' }}
          >
            FLAP WAR
          </p>
          <p
            className="font-mono text-[10px] md:text-xs tracking-[0.22em] mt-4"
            style={{ color: 'rgba(230,240,246,0.62)' }}
          >
            Low-altitude strike route through a fortified future tunnel.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={openPrivacyPolicy}
              className="font-mono text-[10px] tracking-[0.18em]"
              style={{ color: '#9ddcff' }}
            >
              PRIVACY
            </button>
            {!user?.isLocalDeveloper && (
              <button
                type="button"
                onClick={openAccountDeletion}
                className="font-mono text-[10px] tracking-[0.18em]"
                style={{ color: '#ffb0b0' }}
              >
                ACCOUNT DELETION
              </button>
            )}
          </div>
        </div>

        <div className="relative grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <StatChip
            icon={<Trophy className="w-4 h-4" />}
            label="BEST"
            value={highScore}
            color="#9ddcff"
            border="1px solid rgba(157,220,255,0.22)"
            bg="rgba(157,220,255,0.06)"
          />
          <StatChip
            icon={<Coins className="w-4 h-4" />}
            label="COINS"
            value={coins}
            color="#ffc785"
            border="1px solid rgba(255,199,133,0.22)"
            bg="rgba(255,199,133,0.06)"
          />
          <StatChip
            icon={<span className="text-sm">💎</span>}
            label="DIAMONDS"
            value={diamonds}
            color="#7de3ff"
            border="1px solid rgba(125,227,255,0.22)"
            bg="rgba(125,227,255,0.06)"
          />
          <StatChip
            icon={<Zap className="w-4 h-4" />}
            label="CONTROL"
            value={
              isMobileDevice
                ? settingsDraft.mobileButtonLayout === 'fly-right'
                  ? 'FIRE L / FLY R'
                  : 'FLY L / FIRE R'
                : prettyKeyName(settingsDraft.shootKey)
            }
            color="#d5e8ff"
            border="1px solid rgba(213,232,255,0.18)"
            bg="rgba(213,232,255,0.05)"
          />
        </div>

        <div className="relative grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <div
            className="rounded-2xl p-4 min-w-0"
            style={{
              background: 'rgba(125,227,255,0.05)',
              border: '1px solid rgba(125,227,255,0.2)',
            }}
          >
            <p
              className="font-mono text-xs font-bold mb-2"
              style={{ color: '#7de3ff' }}
            >
              DAILY MISSIONS
            </p>

            <div className="space-y-2">
              {dailyMissions.map((mission) => {
                const target = Math.max(1, Number(mission.target || 1));
                const progress = Math.max(0, Number(mission.progress || 0));
                const progressPct = Math.max(0, Math.min(100, Math.round((progress / target) * 100)));
                const canClaim = mission.completed && !mission.claimed;

                return (
                  <div
                    key={mission.id}
                    className="rounded-xl p-3"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-mono text-[11px]" style={{ color: '#dff4ff' }}>
                          {mission.title}
                        </p>
                        <p className="font-mono text-[10px]" style={{ color: 'rgba(220,235,245,0.62)' }}>
                          {mission.description}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-[10px]" style={{ color: '#ffc785' }}>
                          +{mission.reward} ⚡
                        </p>
                        {mission.claimed ? (
                          <span className="font-mono text-[10px]" style={{ color: '#7de3ff' }}>
                            CLAIMED
                          </span>
                        ) : mission.completed ? (
                          <button
                            onClick={() => handleClaimMission(mission.id)}
                            className="px-2 py-1 rounded-lg font-mono text-[10px]"
                            style={{
                              background: 'rgba(125,227,255,0.14)',
                              border: '1px solid rgba(125,227,255,0.34)',
                              color: '#7de3ff',
                            }}
                          >
                            CLAIM
                          </button>
                        ) : (
                          <span className="font-mono text-[10px]" style={{ color: 'rgba(220,235,245,0.5)' }}>
                            IN PROGRESS
                          </span>
                        )}
                      </div>
                    </div>

                    <div
                      className="mt-2 h-1.5 rounded-full overflow-hidden"
                      style={{ background: 'rgba(255,255,255,0.08)' }}
                    >
                      <div
                        style={{
                          width: `${progressPct}%`,
                          height: '100%',
                          background: mission.claimed ? '#7de3ff' : mission.completed ? '#00ffaa' : '#ffc785',
                        }}
                      />
                    </div>
                    <p className="mt-1 font-mono text-[10px]" style={{ color: 'rgba(220,235,245,0.62)' }}>
                      {Math.min(progress, target)} / {target}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div
            className="rounded-2xl p-4 min-w-0"
            style={{
              background: 'rgba(255,199,133,0.05)',
              border: '1px solid rgba(255,199,133,0.2)',
            }}
          >
            <p
              className="font-mono text-xs font-bold mb-2"
              style={{ color: '#ffc785' }}
            >
              MILESTONE BADGES
            </p>
            <p className="font-mono text-[10px] mb-3" style={{ color: 'rgba(220,235,245,0.62)' }}>
              Earn badges by hitting score milestones in a run.
            </p>

            {recentBadges.length === 0 ? (
              <p className="font-mono text-[11px]" style={{ color: 'rgba(220,235,245,0.6)' }}>
                No badges yet. Reach score 50 to unlock your first wings badge.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {recentBadges.map((badge) => (
                  <div
                    key={badge.id}
                    className="px-2.5 py-1.5 rounded-lg"
                    style={{
                      background: 'rgba(255,199,133,0.12)',
                      border: '1px solid rgba(255,199,133,0.26)',
                    }}
                  >
                    <p className="font-mono text-[10px]" style={{ color: '#ffd7ad' }}>
                      {badge.name}
                    </p>
                    <p className="font-mono text-[10px]" style={{ color: 'rgba(255,240,220,0.72)' }}>
                      Score {badge.score}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="relative grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
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
          <>
            <MenuActionButton
              onClick={() => setShowCoinShop(true)}
              icon={<Coins className="w-4 h-4" />}
              label="BUY COINS"
              accent="#ffdd00"
            />
            <MenuActionButton
              onClick={() => setShowDiamondShop(true)}
              icon={<span className="text-sm">💎</span>}
              label="BUY DIAMONDS"
              accent="#7de3ff"
            />
          </>
          {visibleComboPacks.length > 0 && (
            <MenuActionButton
              onClick={() => setShowComboShop(true)}
              icon={<Zap className="w-4 h-4" />}
              label="COMBO PACKS"
              accent="#00ffff"
            />
          )}
          <MenuActionButton
            onClick={() => setShowSettings(true)}
            icon={<Settings className="w-4 h-4" />}
            label="SETTINGS"
            accent="#ffffff"
          />
          {user?.id ? (
            <MenuActionButton
              onClick={handleLogout}
              icon={<LogOut className="w-4 h-4" />}
              label="SIGN OUT"
              accent="#d5e8ff"
            />
          ) : (
            <>
              <MenuActionButton
                onClick={() => openAuthModal('login')}
                icon={<LogIn className="w-4 h-4" />}
                label="SIGN IN"
                accent="#9ddcff"
              />
              <MenuActionButton
                onClick={() => openAuthModal('register')}
                icon={<UserPlus className="w-4 h-4" />}
                label="CREATE ACCOUNT"
                accent="#ffc785"
              />
            </>
          )}
        </div>

        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-3">
          <div
            className="rounded-2xl p-4 min-w-0"
            style={{
              background: 'rgba(157,220,255,0.05)',
              border: '1px solid rgba(157,220,255,0.12)',
            }}
          >
            <p
              className="font-mono text-xs font-bold mb-1"
              style={{ color: '#9ddcff' }}
            >
              FLIGHT WINDOW
            </p>
            <p
              className="font-mono text-[11px] leading-5"
              style={{ color: 'rgba(225,235,242,0.66)' }}
            >
              Launch arms the run. Tap, click, or press Fly to keep the aircraft inside the tunnel route.
            </p>
          </div>

          <div
            className="rounded-2xl p-4 min-w-0"
            style={{
              background: 'rgba(255,199,133,0.05)',
              border: '1px solid rgba(255,199,133,0.12)',
            }}
          >
            <p
              className="font-mono text-xs font-bold mb-1"
              style={{ color: '#ffc785' }}
            >
              FLIGHT CONTROL
            </p>
            <p
              className="font-mono text-[11px] leading-5"
              style={{ color: 'rgba(225,235,242,0.66)' }}
            >
              {isMobileDevice
                ? `Touch layout: ${
                    settingsDraft.mobileButtonLayout === 'fly-right'
                      ? 'Fire Left / Fly Right'
                      : 'Fly Left / Fire Right'
                  }. Change sides in Settings.`
                : `Fly: ${prettyKeyName(settingsDraft.flapKey)}. Shoot: ${prettyKeyName(settingsDraft.shootKey)}. Change everything in Settings.`}
            </p>
          </div>

          <div
            className="rounded-2xl p-4 min-w-0"
            style={{
              background: 'rgba(213,232,255,0.05)',
              border: '1px solid rgba(213,232,255,0.12)',
            }}
          >
            <p
              className="font-mono text-xs font-bold mb-1"
              style={{ color: '#d5e8ff' }}
            >
              HANGAR PREP
            </p>
            <p
              className="font-mono text-[11px] leading-5"
              style={{ color: 'rgba(225,235,242,0.66)' }}
            >
              Equip skins, weapons, and upgrades from the Armory before the run.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );

  const hasOpenModal =
    showShop ||
    showCoinShop ||
    showDiamondShop ||
    showSettings ||
    showComboShop ||
    giftMessage ||
    showAuthModal;

  const shouldRenderShell =
    gameState === 'idle' || gameState === 'gameover' || hasOpenModal;

  if (!shouldRenderShell) {
    return null;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={gameState}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 overflow-y-auto overflow-x-hidden"
        style={{
          zIndex: 999999,
          background:
            'radial-gradient(circle at top, rgba(120,190,235,0.1), rgba(0,0,0,0) 34%), linear-gradient(180deg, rgba(4,8,12,0.2), rgba(4,8,12,0.72))',
        }}
      >
        <AnimatePresence>
          {showShop && (
            <Suspense fallback={null}>
              <Armory
                onClose={() => {
                  setShowShop(false);
                  refreshCurrencies();
                }}
                onSkinChange={onSkinChange}
              />
            </Suspense>
          )}
        </AnimatePresence>

        {renderCoinShopModal()}
        {renderDiamondShopModal()}
        {renderAuthModal()}
        {renderGiftMessageModal()}
        {renderSettingsModal()}
        {renderComboShopModal()}

        {gameState === 'idle' && renderIdleMenu()}

        {gameState === 'gameover' && (
          <div
            className={
              isMobileDevice
                ? 'w-full min-h-full h-full flex flex-col items-stretch justify-start px-0 py-0 overflow-y-auto'
                : 'w-full h-full flex flex-col items-center justify-center px-3 md:px-6 py-4 overflow-y-auto'
            }
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 14 }}
              className={
                isMobileDevice
                  ? 'text-center mb-3 px-4 pt-6 pb-5 w-full max-w-none rounded-none'
                  : 'text-center mb-4 rounded-[28px] px-5 md:px-10 py-6 w-full max-w-3xl'
              }
              style={
                isMobileDevice
                  ? {
                      ...menuShellStyle,
                      borderRadius: 0,
                      paddingTop: 'max(env(safe-area-inset-top), 16px)',
                    }
                  : menuShellStyle
              }
            >
              <h2
                className="font-display text-[2.25rem] md:text-[3.4rem] leading-none font-black tracking-[0.14em]"
                style={{ color: '#edf8ff', textShadow: '0 10px 30px rgba(0,0,0,0.35)' }}
              >
                MISSION LOST
              </h2>
              <p
                className="font-mono text-xs tracking-widest mt-1"
                style={{ color: 'rgba(255,189,146,0.66)' }}
              >
                AIRFRAME FAILURE CONFIRMED
              </p>
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className={
                isMobileDevice
                  ? 'grid grid-cols-3 gap-2 mb-4 w-full px-4'
                  : 'grid grid-cols-3 gap-2 md:gap-4 mb-4 w-full max-w-3xl'
              }
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
                    className="font-display text-xl md:text-3xl font-black"
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

            {diamondsEarned > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.4, type: 'spring' }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg mb-4"
                style={{
                  background: 'rgba(125,227,255,0.10)',
                  border: '1px solid rgba(125,227,255,0.30)',
                }}
              >
                <span style={{ color: '#7de3ff' }}>💎</span>
                <span
                  className="font-mono text-sm font-bold"
                  style={{ color: '#7de3ff' }}
                >
                  +{diamondsEarned} diamonds earned!
                </span>
                <span
                  className="font-mono text-xs"
                  style={{ color: 'rgba(125,227,255,0.55)' }}
                >
                  ({diamonds} total)
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
              className={
                isMobileDevice
                  ? 'flex flex-col items-center gap-3 w-full px-4 pb-4'
                  : 'flex flex-col items-center gap-3 w-full max-w-[420px]'
              }
              style={
                isMobileDevice
                  ? { paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }
                  : undefined
              }
            >
              {canUseRevive && (
                <button
                  onClick={onReviveAttempt}
                  disabled={reviveBusy || reviveRetrySeconds > 0}
                  className="w-full flex items-center justify-center gap-3 px-8 py-4 rounded-xl font-display text-lg font-bold tracking-wider hover:scale-105 active:scale-95 transition-all disabled:cursor-not-allowed"
                  style={{
                    background:
                      'linear-gradient(135deg,rgba(255,125,186,0.2),rgba(125,227,255,0.13))',
                    border: '1px solid rgba(255,125,186,0.75)',
                    color: '#ffc8e4',
                    boxShadow: '0 0 20px rgba(255,125,186,0.22)',
                    opacity: reviveBusy ? 0.62 : 1,
                  }}
                >
                  {reviveBusy
                    ? 'LOADING AD...'
                    : reviveRetrySeconds > 0
                    ? `AD COOLING DOWN ${reviveRetrySeconds}s`
                    : 'WATCH AD TO REVIVE'}
                </button>
              )}

              {reviveMessage ? (
                <p
                  className="font-mono text-[11px] tracking-[0.14em] text-center max-w-[320px]"
                  style={{ color: 'rgba(255,212,226,0.86)' }}
                >
                  {reviveMessage}
                </p>
              ) : null}
              {!reviveMessage && reviveRetrySeconds > 0 ? (
                <p
                  className="font-mono text-[11px] tracking-[0.12em] text-center"
                  style={{ color: 'rgba(255,212,226,0.76)' }}
                >
                  Revive ad is throttled briefly. Countdown runs in real time.
                </p>
              ) : null}

              {milestoneBonusCoins > 0 && (
                <div
                  className="rounded-xl px-4 py-2 font-mono text-xs"
                  style={{
                    background: 'rgba(255,199,133,0.12)',
                    border: '1px solid rgba(255,199,133,0.28)',
                    color: '#ffd7ad',
                  }}
                >
                  MILESTONE BONUS +{milestoneBonusCoins} COINS
                </div>
              )}

              {dailyMissionCompletions > 0 && (
                <div
                  className="rounded-xl px-4 py-2 font-mono text-xs"
                  style={{
                    background: 'rgba(125,227,255,0.12)',
                    border: '1px solid rgba(125,227,255,0.28)',
                    color: '#c6f4ff',
                  }}
                >
                  {dailyMissionCompletions} DAILY MISSION
                  {dailyMissionCompletions > 1 ? 'S' : ''} COMPLETED
                </div>
              )}

              {newBadgesUnlocked.length > 0 && (
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {newBadgesUnlocked.map((badge) => (
                    <span
                      key={badge.id}
                      className="px-3 py-1 rounded-full font-mono text-[10px]"
                      style={{
                        background: 'rgba(255,199,133,0.16)',
                        border: '1px solid rgba(255,199,133,0.32)',
                        color: '#ffd7ad',
                      }}
                    >
                      BADGE UNLOCKED: {badge.name}
                    </span>
                  ))}
                </div>
              )}

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

              {user?.id ? (
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <div
                    className="rounded-full px-4 py-2 font-mono text-xs"
                    style={{
                      background: 'rgba(157,220,255,0.08)',
                      border: '1px solid rgba(157,220,255,0.22)',
                      color: '#dff4ff',
                    }}
                  >
                    {user.email || user.id}
                  </div>
                  {isOwnerAccount && (
                    <div
                      className="rounded-full px-4 py-2 font-mono text-xs"
                      style={{
                        background: 'rgba(125,227,255,0.10)',
                        border: '1px solid rgba(125,227,255,0.28)',
                        color: '#7de3ff',
                      }}
                    >
                      OWNER
                    </div>
                  )}
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-display text-sm font-bold tracking-wider hover:scale-105 active:scale-95 transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.18)',
                      color: '#d5e8ff',
                    }}
                  >
                    <LogOut className="w-4 h-4" /> SIGN OUT
                  </button>
                  {isOwnerAccount && (
                    <button
                      onClick={handleGrantOwnerAccess}
                      disabled={isGrantingOwnerAccess}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-display text-sm font-bold tracking-wider hover:scale-105 active:scale-95 transition-all disabled:cursor-not-allowed"
                      style={{
                        background: 'rgba(125,227,255,0.10)',
                        border: '1px solid rgba(125,227,255,0.28)',
                        color: '#7de3ff',
                        opacity: isGrantingOwnerAccess ? 0.62 : 1,
                      }}
                    >
                      {isGrantingOwnerAccess ? 'SYNCING OWNER...' : 'GRANT OWNER ACCESS'}
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={() => openAuthModal('login')}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-display text-sm font-bold tracking-wider hover:scale-105 active:scale-95 transition-all"
                    style={{
                      background: 'rgba(157,220,255,0.12)',
                      border: '1px solid rgba(157,220,255,0.3)',
                      color: '#9ddcff',
                    }}
                  >
                    <LogIn className="w-4 h-4" /> SIGN IN
                  </button>
                  <button
                    onClick={() => openAuthModal('register')}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-display text-sm font-bold tracking-wider hover:scale-105 active:scale-95 transition-all"
                    style={{
                      background: 'rgba(255,199,133,0.1)',
                      border: '1px solid rgba(255,199,133,0.26)',
                      color: '#ffc785',
                    }}
                  >
                    <UserPlus className="w-4 h-4" /> CREATE ACCOUNT
                  </button>
                </div>
              )}

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
