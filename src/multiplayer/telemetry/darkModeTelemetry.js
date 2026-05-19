import { getMultiplayerFlags } from '../flags';

export function publishMultiplayerTelemetry(eventName, payload = {}) {
  const flags = getMultiplayerFlags();
  if (!flags.darkMode) return;

  window.dispatchEvent(
    new CustomEvent('firepilot-mp-telemetry', {
      detail: {
        ts: Date.now(),
        eventName,
        payload,
      },
    })
  );
}

