import { Capacitor } from '@capacitor/core';

const GOOGLE_TEST_REWARDED_AD_UNIT_ID_ANDROID = 'ca-app-pub-3940256099942544/5224354917';
const GOOGLE_TEST_REWARDED_AD_UNIT_ID_IOS = 'ca-app-pub-3940256099942544/1712485313';

let admobModulePromise = null;
let initialized = false;
const EVENT_SETTLE_WAIT_MS = 260;
let preparedAdUnitId = '';
let prepareInFlight = null;

function isNativePlatform() {
  return typeof Capacitor?.isNativePlatform === 'function'
    ? Capacitor.isNativePlatform()
    : false;
}

function getPlatform() {
  return typeof Capacitor?.getPlatform === 'function' ? Capacitor.getPlatform() : 'web';
}

export function isReviveAdsEnabled() {
  if (typeof window === 'undefined') return false;
  if (!isNativePlatform()) return false;
  const platform = getPlatform();
  return platform === 'android' || platform === 'ios';
}

function isTestingMode() {
  return import.meta.env.VITE_ADMOB_TESTING !== 'false';
}

function getRewardedAdUnitIdForPlatform() {
  const platform = getPlatform();
  if (platform === 'android') {
    return (
      import.meta.env.VITE_ADMOB_REWARDED_AD_UNIT_ID_ANDROID ||
      import.meta.env.VITE_ADMOB_REWARDED_AD_UNIT_ID ||
      ''
    ).trim();
  }

  if (platform === 'ios') {
    return (
      import.meta.env.VITE_ADMOB_REWARDED_AD_UNIT_ID_IOS ||
      import.meta.env.VITE_ADMOB_REWARDED_AD_UNIT_ID ||
      ''
    ).trim();
  }

  return '';
}

async function getAdMobModule() {
  if (!admobModulePromise) {
    admobModulePromise = import('@capacitor-community/admob');
  }
  return admobModulePromise;
}

async function ensureInitialized(AdMob) {
  if (initialized) return;
  await AdMob.initialize({
    initializeForTesting: isTestingMode(),
  });
  initialized = true;
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function errorMessageFromValue(value, fallback = 'ad_failed') {
  if (typeof value === 'string' && value.trim()) return value.trim();
  const nested = value?.message || value?.error || value?.localizedDescription;
  if (typeof nested === 'string' && nested.trim()) return nested.trim();
  return fallback;
}

function resolveAdUnitId() {
  const configuredAdUnitId = getRewardedAdUnitIdForPlatform();
  return isTestingMode()
    ? getPlatform() === 'ios'
      ? GOOGLE_TEST_REWARDED_AD_UNIT_ID_IOS
      : GOOGLE_TEST_REWARDED_AD_UNIT_ID_ANDROID
    : configuredAdUnitId;
}

async function prepareRewardedAd(AdMob, adId, userId = '') {
  if (preparedAdUnitId === adId) return { ok: true };
  if (prepareInFlight) return prepareInFlight;

  prepareInFlight = (async () => {
    await AdMob.prepareRewardVideoAd({
      adId,
      isTesting: isTestingMode(),
      npa: true,
      ...(userId ? { ssv: { customData: String(userId).slice(0, 120) } } : {}),
    });
    preparedAdUnitId = adId;
    return { ok: true };
  })();

  try {
    return await prepareInFlight;
  } finally {
    prepareInFlight = null;
  }
}

export async function primeReviveRewardedAd({ userId = '' } = {}) {
  if (!isReviveAdsEnabled()) return { ok: false, reason: 'unsupported_platform' };

  const adId = resolveAdUnitId().trim();
  if (!adId) return { ok: false, reason: 'missing_ad_unit_id' };

  const { AdMob } = await getAdMobModule();
  await ensureInitialized(AdMob);

  try {
    await prepareRewardedAd(AdMob, adId, userId);
    return { ok: true };
  } catch (error) {
    preparedAdUnitId = '';
    return {
      ok: false,
      reason: 'failed_to_load',
      message: errorMessageFromValue(error, 'loading failed'),
    };
  }
}

export async function showReviveRewardedAd({ userId = '' } = {}) {
  if (!isReviveAdsEnabled()) {
    return { ok: false, rewarded: false, adShown: false, reason: 'unsupported_platform' };
  }

  const adId = resolveAdUnitId().trim();

  if (!adId) {
    return { ok: false, rewarded: false, adShown: false, reason: 'missing_ad_unit_id' };
  }

  const { AdMob, RewardAdPluginEvents } = await getAdMobModule();
  await ensureInitialized(AdMob);

  let rewarded = false;
  let adShown = false;
  let adDismissed = false;
  let loadErrorMessage = '';
  let showErrorMessage = '';
  const listenerHandles = [];

  try {
    listenerHandles.push(
      await AdMob.addListener(RewardAdPluginEvents.Rewarded, (reward) => {
        const rewardAmount = Number(reward?.amount || 0);
        rewarded = Number.isFinite(rewardAmount) ? rewardAmount >= 1 : true;
      })
    );

    listenerHandles.push(
      await AdMob.addListener(RewardAdPluginEvents.Showed, () => {
        adShown = true;
      })
    );

    listenerHandles.push(
      await AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
        adDismissed = true;
      })
    );

    listenerHandles.push(
      await AdMob.addListener(RewardAdPluginEvents.FailedToLoad, (error) => {
        loadErrorMessage = errorMessageFromValue(error, 'loading failed');
      })
    );

    listenerHandles.push(
      await AdMob.addListener(RewardAdPluginEvents.FailedToShow, (error) => {
        showErrorMessage = errorMessageFromValue(error, 'failed to show');
      })
    );

    try {
      await prepareRewardedAd(AdMob, adId, userId);
    } catch (error) {
      preparedAdUnitId = '';
      return {
        ok: false,
        rewarded: false,
        adShown: false,
        reason: 'failed_to_load',
        message: loadErrorMessage || errorMessageFromValue(error, 'loading failed'),
      };
    }

    if (loadErrorMessage) {
      preparedAdUnitId = '';
      return {
        ok: false,
        rewarded: false,
        adShown: false,
        reason: 'failed_to_load',
        message: loadErrorMessage,
      };
    }

    let rewardResult = null;
    try {
      rewardResult = await AdMob.showRewardVideoAd();
    } catch (error) {
      preparedAdUnitId = '';
      return {
        ok: false,
        rewarded: false,
        adShown,
        reason: adShown ? 'no_reward' : 'failed_to_show',
        message: showErrorMessage || errorMessageFromValue(error, 'failed to show'),
      };
    }
    preparedAdUnitId = '';

    if (!rewarded) {
      const rewardAmount = Number(rewardResult?.amount);
      rewarded = Number.isFinite(rewardAmount) ? rewardAmount >= 1 : false;
    }

    if (!rewarded) {
      await wait(EVENT_SETTLE_WAIT_MS);
    }

    return rewarded
      ? { ok: true, rewarded: true, adShown: true }
      : {
          ok: false,
          rewarded: false,
          adShown: adShown || adDismissed,
          reason: adShown || adDismissed ? 'no_reward' : 'failed_to_show',
          message: showErrorMessage || 'reward not granted',
        };
  } catch (error) {
    console.error('Rewarded revive ad failed:', error);
    return {
      ok: false,
      rewarded: false,
      adShown,
      reason: 'ad_failed',
      message: errorMessageFromValue(error, 'ad_failed'),
    };
  } finally {
    for (const handle of listenerHandles) {
      try {
        await handle.remove();
      } catch {
        // ignore listener cleanup failures
      }
    }
  }
}
