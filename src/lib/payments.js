import { Capacitor, registerPlugin } from '@capacitor/core';
import { hasSupabaseConfig, supabase } from '../api/supabaseClient';

import {
  appStorePurchaseMessage,
  areExternalPurchasesEnabled,
} from './releaseConfig';
import { getApiBaseUrl, hasApiBaseUrl } from './apiBaseUrl';
import { addCoins, addDiamonds, addPurchaseRecord } from './gameStore';
import {
  buyRevenueCatPackage,
  getRevenueCatOfferings,
  initRevenueCat,
} from '../services/revenueCat';

const PlayBilling = registerPlugin('PlayBilling');

export const COIN_PACKS = [
  {
    id: 'coins_100',
    label: '100 Coins',
    coins: 100,
    amount: 199,
  },
  {
    id: 'coins_200',
    label: '200 Coins',
    coins: 200,
    amount: 399,
  },
  {
    id: 'coins_500',
    label: '500 Coins',
    coins: 500,
    amount: 999,
  },
  {
    id: 'coins_1200',
    label: '1200 Coins',
    coins: 1200,
    amount: 1999,
    tag: 'Starter Pack',
  },
  {
    id: 'coins_2500',
    label: '2500 Coins',
    coins: 2500,
    amount: 3999,
    tag: 'Popular',
  },
  {
    id: 'coins_3000',
    label: '3000 Coins',
    coins: 3000,
    amount: 5499,
  },
  {
    id: 'coins_4000',
    label: '4000 Coins',
    coins: 4000,
    amount: 7500,
  },
  {
    id: 'coins_5000',
    label: '5000 Coins',
    coins: 5000,
    amount: 8999,
    tag: 'Best Value',
  },
  {
    id: 'coins_10000',
    label: '10000 Coins',
    coins: 10000,
    amount: 12000,
    tag: 'Whale Pack',
  },
];

export const DIAMOND_PACKS = [
  {
    id: 'diamonds_10',
    label: '10 Diamonds',
    diamonds: 10,
    amount: 199,
  },
  {
    id: 'diamonds_25',
    label: '25 Diamonds',
    diamonds: 25,
    amount: 399,
    tag: 'Starter',
  },
  {
    id: 'diamonds_75',
    label: '75 Diamonds',
    diamonds: 75,
    amount: 999,
    tag: 'Popular',
  },
  {
    id: 'diamonds_150',
    label: '150 Diamonds',
    diamonds: 150,
    amount: 1799,
  },
  {
    id: 'diamonds_300',
    label: '300 Diamonds',
    diamonds: 300,
    amount: 2999,
    tag: 'Best Value',
  },
];

function isNativePlatform() {
  return typeof Capacitor?.isNativePlatform === 'function'
    ? Capacitor.isNativePlatform()
    : false;
}

export function isGooglePlayBillingAvailable() {
  if (typeof window === 'undefined') return false;
  return isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export function isIosRevenueCatAvailable() {
  if (typeof window === 'undefined') return false;
  const apiKey = String(import.meta.env.VITE_REVENUECAT_IOS_API_KEY || '').trim();
  return isNativePlatform() && Capacitor.getPlatform() === 'ios' && apiKey.length > 0;
}

export function usesStripeCheckout() {
  return !isGooglePlayBillingAvailable() && !isIosRevenueCatAvailable();
}

export function formatUsdFromCents(amount) {
  return `$${(amount / 100).toFixed(2)}`;
}

export function hasPaymentsApiBaseUrl() {
  if (isGooglePlayBillingAvailable()) {
    return Boolean(import.meta.env.VITE_API_BASE_URL?.trim());
  }

  if (isIosRevenueCatAvailable()) {
    return true;
  }

  return hasSupabaseConfig || hasApiBaseUrl();
}

function buildCatalog(currencyType) {
  return currencyType === 'diamonds' ? DIAMOND_PACKS : COIN_PACKS;
}

function getPackProductId(pack) {
  return pack?.productId || pack?.id;
}

function overlayDisplayPrice(pack, storeProduct) {
  if (!storeProduct) {
    return {
      ...pack,
      displayPrice: isGooglePlayBillingAvailable() ? null : formatUsdFromCents(pack.amount),
    };
  }

  return {
    ...pack,
    displayPrice: storeProduct.displayPrice || storeProduct.priceString || null,
    priceCurrencyCode: storeProduct.priceCurrencyCode || null,
    priceAmountMicros: storeProduct.priceAmountMicros ?? null,
    playTitle: storeProduct.title || null,
    playDescription: storeProduct.description || null,
    revenueCatPackage: storeProduct.revenueCatPackage || null,
  };
}

function collectRevenueCatPackages(offerings) {
  const packages = [];
  const seenProductIds = new Set();

  const currentPackages = offerings?.current?.availablePackages || [];
  for (let i = 0; i < currentPackages.length; i++) {
    const rcPackage = currentPackages[i];
    const productId = rcPackage?.product?.identifier;
    if (!productId || seenProductIds.has(productId)) continue;
    seenProductIds.add(productId);
    packages.push(rcPackage);
  }

  if (packages.length > 0) {
    return packages;
  }

  const allOfferings = offerings?.all || {};
  for (const offeringId of Object.keys(allOfferings)) {
    const offering = allOfferings[offeringId];
    const availablePackages = offering?.availablePackages || [];
    for (let i = 0; i < availablePackages.length; i++) {
      const rcPackage = availablePackages[i];
      const productId = rcPackage?.product?.identifier;
      if (!productId || seenProductIds.has(productId)) continue;
      seenProductIds.add(productId);
      packages.push(rcPackage);
    }
  }

  return packages;
}

function overlayRevenueCatCatalog(packs, revenueCatPackagesByProductId) {
  return packs.map((pack) => {
    const productId = getPackProductId(pack);
    const rcPackage = revenueCatPackagesByProductId.get(productId);
    if (!rcPackage) {
      return overlayDisplayPrice(pack, null);
    }

    return overlayDisplayPrice(pack, {
      displayPrice: rcPackage?.product?.priceString || null,
      priceCurrencyCode: rcPackage?.product?.currencyCode || null,
      title: rcPackage?.product?.title || null,
      description: rcPackage?.product?.description || null,
      revenueCatPackage: rcPackage,
    });
  });
}

async function findRevenueCatPackageForPack(pack) {
  if (pack?.revenueCatPackage) {
    return pack.revenueCatPackage;
  }

  const offerings = await getRevenueCatOfferings();
  const packages = collectRevenueCatPackages(offerings);
  const productId = getPackProductId(pack);

  for (let i = 0; i < packages.length; i++) {
    const rcPackage = packages[i];
    if (rcPackage?.product?.identifier === productId) {
      return rcPackage;
    }
  }

  return null;
}

async function hashUserId(userId) {
  if (!userId || typeof window === 'undefined' || !window.crypto?.subtle) {
    return null;
  }

  const encoded = new TextEncoder().encode(userId);
  const digest = await window.crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

async function queryGooglePlayProducts(productIds) {
  if (!isGooglePlayBillingAvailable()) {
    return [];
  }

  const { products = [] } = await PlayBilling.queryProducts({ productIds });
  return Array.isArray(products) ? products : [];
}

export async function loadStoreCatalog() {
  const fallback = {
    coins: COIN_PACKS.map((pack) => overlayDisplayPrice(pack, null)),
    diamonds: DIAMOND_PACKS.map((pack) => overlayDisplayPrice(pack, null)),
    error: '',
  };

  if (isIosRevenueCatAvailable()) {
    try {
      await initRevenueCat(null);
      const offerings = await getRevenueCatOfferings();
      const packages = collectRevenueCatPackages(offerings);
      const byProductId = new Map();
      for (let i = 0; i < packages.length; i++) {
        const rcPackage = packages[i];
        const productId = rcPackage?.product?.identifier;
        if (!productId) continue;
        byProductId.set(productId, rcPackage);
      }

      return {
        coins: overlayRevenueCatCatalog(COIN_PACKS, byProductId),
        diamonds: overlayRevenueCatCatalog(DIAMOND_PACKS, byProductId),
        error: '',
      };
    } catch (error) {
      console.error('RevenueCat catalog load failed:', error);
      return {
        ...fallback,
        error: error?.message || 'Unable to load RevenueCat product pricing.',
      };
    }
  }

  if (!isGooglePlayBillingAvailable()) {
    return fallback;
  }

  try {
    const productIds = [...COIN_PACKS, ...DIAMOND_PACKS].map((pack) => getPackProductId(pack));
    const products = await queryGooglePlayProducts(productIds);
    const productsById = new Map(products.map((product) => [product.productId, product]));

    return {
      coins: COIN_PACKS.map((pack) => overlayDisplayPrice(pack, productsById.get(getPackProductId(pack)))),
      diamonds: DIAMOND_PACKS.map((pack) =>
        overlayDisplayPrice(pack, productsById.get(getPackProductId(pack)))
      ),
      error: '',
    };
  } catch (error) {
    console.error('Google Play catalog load failed:', error);
    return {
      ...fallback,
      error: error?.message || 'Unable to load Google Play product pricing.',
    };
  }
}

async function verifyGooglePlayPurchase({ pack, userId, currencyType, purchase, obfuscatedAccountId }) {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) {
    throw new Error(
      'Google Play purchases require VITE_API_BASE_URL to point at your live backend API.'
    );
  }

  const purchaseToken = purchase?.purchaseToken;
  const productIds = Array.isArray(purchase?.productIds) ? purchase.productIds : [];
  const productId = productIds.find((value) => value === getPackProductId(pack)) || getPackProductId(pack);

  if (!purchaseToken || !productId) {
    throw new Error('Google Play did not return a valid purchase token.');
  }

  const res = await fetch(`${apiBaseUrl}/play/verify-product-purchase`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId,
      currencyType,
      packId: pack.id,
      productId,
      purchaseToken,
      obfuscatedAccountId,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || data.error || 'Failed to verify Google Play purchase.');
  }

  return data;
}

async function createStripeCheckout(pack, userId, currencyType) {
  if (!pack || typeof pack !== 'object') {
    throw new Error(`Invalid ${currencyType} pack`);
  }

  if (!userId) {
    throw new Error('Missing user id');
  }

  const quantity = currencyType === 'diamonds' ? pack.diamonds : pack.coins;
  if (!quantity || !Number.isInteger(quantity) || quantity <= 0) {
    throw new Error(`Invalid ${currencyType} quantity`);
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  const supabaseFunctionUrl =
    hasSupabaseConfig && supabaseUrl ? `${supabaseUrl}/functions/v1/stripe-create-checkout-session` : '';

  const apiBaseUrl = getApiBaseUrl();
  const fallbackApiUrl = apiBaseUrl ? `${apiBaseUrl}/stripe/create-checkout-session` : '';
  const endpoint = supabaseFunctionUrl || fallbackApiUrl;

  if (!endpoint) {
    throw new Error('Missing checkout endpoint configuration.');
  }

  let authToken = '';
  if (supabaseFunctionUrl) {
    const sessionResult = await supabase?.auth?.getSession?.();
    authToken = sessionResult?.data?.session?.access_token || '';
    if (!authToken) {
      throw new Error('You must be signed in before checkout.');
    }
  }

  const headers = {
    'Content-Type': 'application/json',
  };

  if (supabaseFunctionUrl) {
    headers.apikey = supabaseAnonKey || '';
    headers.Authorization = `Bearer ${authToken}`;
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      packId: pack.id,
      currencyType,
      userId,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to create checkout session');
  }

  if (!data.url) {
    throw new Error('No checkout URL returned');
  }

  window.location.href = data.url;
  return {
    ok: true,
    status: 'redirected',
    url: data.url,
  };
}

async function createGooglePlayPurchase(pack, userId, currencyType) {
  const obfuscatedAccountId = await hashUserId(userId);
  const purchaseResult = await PlayBilling.purchaseProduct({
    productId: getPackProductId(pack),
    obfuscatedAccountId,
  });

  if (purchaseResult?.status === 'cancelled') {
    return { ok: false, cancelled: true, status: 'cancelled' };
  }

  if (purchaseResult?.status === 'pending') {
    return { ok: false, pending: true, status: 'pending' };
  }

  if (purchaseResult?.status !== 'purchased' || !purchaseResult?.purchase) {
    throw new Error('Google Play did not complete the purchase.');
  }

  const verification = await verifyGooglePlayPurchase({
    pack,
    userId,
    currencyType,
    purchase: purchaseResult.purchase,
    obfuscatedAccountId,
  });

  return {
    ok: true,
    status: 'purchased',
    purchase: purchaseResult.purchase,
    verification,
  };
}

async function createRevenueCatPurchase(pack, userId, currencyType) {
  await initRevenueCat(userId || null);
  const rcPackage = await findRevenueCatPackageForPack(pack);
  if (!rcPackage) {
    throw new Error(
      `RevenueCat product not found for ${getPackProductId(pack)}. Check RevenueCat offering product mappings.`
    );
  }

  const purchaseResult = await buyRevenueCatPackage(rcPackage);
  const quantity = currencyType === 'diamonds' ? Number(pack?.diamonds || 0) : Number(pack?.coins || 0);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error(`Invalid ${currencyType} quantity`);
  }

  if (currencyType === 'diamonds') {
    addDiamonds(quantity);
  } else {
    addCoins(quantity);
  }

  addPurchaseRecord({
    kind: currencyType,
    source: 'revenuecat-ios',
    packId: pack?.id || null,
    productId: purchaseResult?.productIdentifier || rcPackage?.product?.identifier || null,
    quantity,
    transactionId: purchaseResult?.transaction?.transactionIdentifier || null,
  });

  return {
    ok: true,
    status: 'purchased',
    purchase: purchaseResult,
    creditedLocally: true,
  };
}

async function startPurchase(pack, userId, currencyType) {
  if (isGooglePlayBillingAvailable()) {
    return createGooglePlayPurchase(pack, userId, currencyType);
  }

  if (isIosRevenueCatAvailable()) {
    return createRevenueCatPurchase(pack, userId, currencyType);
  }

  if (!areExternalPurchasesEnabled) {
    throw new Error(appStorePurchaseMessage);
  }

  return createStripeCheckout(pack, userId, currencyType);
}

export async function buyCoins(pack, userId) {
  try {
    return await startPurchase(pack, userId, 'coins');
  } catch (err) {
    console.error('Coin purchase error:', err);
    alert(err.message || 'Unable to start coin purchase right now.');
    return { ok: false, error: err?.message || 'purchase-failed' };
  }
}

export async function buyDiamonds(pack, userId) {
  try {
    return await startPurchase(pack, userId, 'diamonds');
  } catch (err) {
    console.error('Diamond purchase error:', err);
    alert(err.message || 'Unable to start diamond purchase right now.');
    return { ok: false, error: err?.message || 'purchase-failed' };
  }
}

export async function syncGooglePlayPurchases(userId) {
  if (!isGooglePlayBillingAvailable() || !userId) {
    return { ok: false, reason: 'not-android-play' };
  }

  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) {
    return { ok: false, reason: 'missing-api-base-url' };
  }

  const obfuscatedAccountId = await hashUserId(userId);
  const knownPacks = [...buildCatalog('coins'), ...buildCatalog('diamonds')];
  const packByProductId = new Map(knownPacks.map((pack) => [getPackProductId(pack), pack]));
  const seenTokens = new Set();
  let processed = 0;

  try {
    const { purchases = [] } = await PlayBilling.getUnconsumedPurchases();
    for (const purchase of purchases) {
      if (!purchase || purchase.purchaseStateName !== 'purchased') {
        continue;
      }

      if (!purchase.purchaseToken || seenTokens.has(purchase.purchaseToken)) {
        continue;
      }

      seenTokens.add(purchase.purchaseToken);

      const productId = Array.isArray(purchase.productIds)
        ? purchase.productIds.find((value) => packByProductId.has(value))
        : null;
      const pack = productId ? packByProductId.get(productId) : null;
      if (!pack) {
        continue;
      }

      const currencyType = typeof pack.diamonds === 'number' ? 'diamonds' : 'coins';
      await verifyGooglePlayPurchase({
        pack,
        userId,
        currencyType,
        purchase,
        obfuscatedAccountId,
      });
      processed += 1;
    }

    return { ok: true, processed };
  } catch (error) {
    console.error('Google Play purchase sync failed:', error);
    return {
      ok: false,
      processed,
      reason: error?.message || 'google-play-sync-failed',
    };
  }
}

export async function syncCheckoutSession(sessionId) {
  if (!areExternalPurchasesEnabled) {
    return { ok: false, reason: 'external-purchases-disabled' };
  }

  if (!sessionId) {
    return { ok: false, reason: 'missing-session-id' };
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  const supabaseFunctionUrl =
    hasSupabaseConfig && supabaseUrl ? `${supabaseUrl}/functions/v1/stripe-sync-checkout-session` : '';

  const apiBaseUrl = getApiBaseUrl();
  const fallbackApiUrl = apiBaseUrl ? `${apiBaseUrl}/stripe/sync-checkout-session` : '';
  const endpoint = supabaseFunctionUrl || fallbackApiUrl;

  if (!endpoint) {
    return { ok: false, reason: 'missing-api-base-url' };
  }

  let authToken = '';
  if (supabaseFunctionUrl) {
    const sessionResult = await supabase?.auth?.getSession?.();
    authToken = sessionResult?.data?.session?.access_token || '';
    if (!authToken) {
      throw new Error('You must be signed in before purchase sync.');
    }
  }

  const headers = {
    'Content-Type': 'application/json',
  };

  if (supabaseFunctionUrl) {
    headers.apikey = supabaseAnonKey || '';
    headers.Authorization = `Bearer ${authToken}`;
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ sessionId }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || data.error || 'Failed to sync checkout session');
  }

  return data;
}
