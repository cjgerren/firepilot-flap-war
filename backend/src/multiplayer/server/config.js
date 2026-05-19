function parseIntEnv(value, fallback) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getMultiplayerConfig() {
  return {
    enabled: process.env.MULTIPLAYER_ENABLED === 'true',
    port: parseIntEnv(process.env.MULTIPLAYER_PORT, 3001),
    tickRate: parseIntEnv(process.env.MULTIPLAYER_TICK_RATE, 30),
    maxRoomSize: parseIntEnv(process.env.MULTIPLAYER_MAX_ROOM_SIZE, 8),
    requireServerAuth: process.env.MULTIPLAYER_REQUIRE_SERVER_AUTH !== 'false',
  };
}

