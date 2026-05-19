import express from 'express';

export function createMultiplayerRouter({ config }) {
  const router = express.Router();

  router.get('/health', (_req, res) => {
    res.json({
      ok: true,
      multiplayerEnabled: config.enabled,
      tickRate: config.tickRate,
      maxRoomSize: config.maxRoomSize,
    });
  });

  return router;
}

