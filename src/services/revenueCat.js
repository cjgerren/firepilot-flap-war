import { Capacitor } from '@capacitor/core';
import { Purchases, LOG_LEVEL } from '@revenuecat/purchases-capacitor';

const REVENUECAT_IOS_API_KEY = (import.meta.env.VITE_REVENUECAT_IOS_API_KEY || '').trim();

let initialized = false;
let initializedUserId = null;

function isIosNative() {
  if (typeof window === 'undefined') return false;
  if (typeof Capacitor?.isNativePlatform !== 'function') return false;
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
}

function normalizeUserId(userId) {
  if (typeof userId !== 'string') return null;
  const trimmed = userId.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function configureRevenueCat(userId = null) {
  if (!isIosNative()) return false;
  if (!REVENUECAT_IOS_API_KEY) {
    throw new Error('Missing VITE_REVENUECAT_IOS_API_KEY for iOS RevenueCat purchases.');
  }

  const appUserID = normalizeUserId(userId);

  if (!initialized) {
    await Purchases.setLogLevel({ level: LOG_LEVEL.INFO });
    await Purchases.configure({
      apiKey: REVENUECAT_IOS_API_KEY,
      appUserID,
    });
    initialized = true;
    initializedUserId = appUserID;
    return true;
  }

  if (appUserID && appUserID !== initializedUserId) {
    await Purchases.logIn({ appUserID });
    initializedUserId = appUserID;
  }

  return true;
}

export async function initRevenueCat(userId) {
  return configureRevenueCat(userId);
}

export async function getRevenueCatOfferings() {
  await configureRevenueCat(null);
  const offerings = await Purchases.getOfferings();
  const packageCount = offerings?.current?.availablePackages?.length || 0;
  console.info('[RevenueCat] offerings loaded', {
    currentOffering: offerings?.current?.identifier || null,
    packageCount,
  });
  return offerings;
}

export async function buyRevenueCatPackage(rcPackage) {
  if (!rcPackage) {
    throw new Error('RevenueCat package is required for purchase.');
  }

  await configureRevenueCat(null);

  console.info('[RevenueCat] purchase started', {
    packageIdentifier: rcPackage.identifier || null,
    productIdentifier: rcPackage?.product?.identifier || null,
  });

  try {
    const result = await Purchases.purchasePackage({ aPackage: rcPackage });
    console.info('[RevenueCat] purchase success', {
      productIdentifier: result?.productIdentifier || null,
      transactionIdentifier: result?.transaction?.transactionIdentifier || null,
    });
    return result;
  } catch (error) {
    console.error('[RevenueCat] purchase failure', {
      message: error?.message || 'unknown-error',
      code: error?.code || null,
      userCancelled: error?.userCancelled ?? null,
      readableErrorCode: error?.userInfo?.readableErrorCode || null,
    });
    throw error;
  }
}
