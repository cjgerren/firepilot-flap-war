export const releasePlatform = import.meta.env.VITE_RELEASE_PLATFORM || 'web';

export const isIosAppStoreBuild =
  releasePlatform === 'ios-appstore' ||
  import.meta.env.VITE_IOS_APP_STORE_BUILD === 'true';

export const areExternalPurchasesEnabled =
  import.meta.env.VITE_DISABLE_EXTERNAL_PURCHASES === 'true'
    ? false
    : !isIosAppStoreBuild;

export const appStorePurchaseMessage =
  'Coin and diamond purchases are disabled in this iOS build. Earn currency by playing.';

export const isMultiplayerEnabled =
  import.meta.env.VITE_MULTIPLAYER_ENABLED === 'true';

export const isMultiplayerDarkModeEnabled =
  import.meta.env.VITE_MULTIPLAYER_DARK_MODE === 'true';

export const multiplayerTransport =
  import.meta.env.VITE_MULTIPLAYER_TRANSPORT || 'ws';

export const multiplayerRegion =
  import.meta.env.VITE_MULTIPLAYER_REGION || 'us-east';
