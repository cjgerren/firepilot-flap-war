import {
  isMultiplayerEnabled,
  isMultiplayerDarkModeEnabled,
  multiplayerTransport,
  multiplayerRegion,
} from '@/lib/releaseConfig';

export function getMultiplayerFlags() {
  return {
    enabled: isMultiplayerEnabled,
    darkMode: isMultiplayerDarkModeEnabled,
    transport: multiplayerTransport,
    region: multiplayerRegion,
  };
}

