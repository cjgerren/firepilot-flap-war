# FirePilot Multiplayer Blueprint (Non-Invasive Track)

## Goal
Ship real-time multiplayer without touching existing single-player gameplay until integration gates pass.

## Safety Rules
- Keep `main` focused on release stability.
- Build all multiplayer work in side paths only.
- Keep multiplayer feature flags off by default.
- Do not import multiplayer modules into current gameplay loop until Gate 5.

## Branch Model
- `main`: single-player release track.
- `feature/mp-foundation`: protocol, server sim, tooling.
- `feature/mp-client-adapter`: client adapter and dark-mode telemetry.
- `feature/mp-integration`: gated UI entry and full closed test rollout.

## File Ownership Boundaries
- Do not edit gameplay-critical paths during Gates 0-4:
- `src/components/game/GameCanvas.jsx`
- `src/pages/Game.jsx` gameplay flow
- `src/lib/gameStore.js` live economy logic

## Multiplayer Scope (Phase 1)
- 1 mode: room-based PvP search-and-destroy.
- 1 map archetype: maze flight lane set.
- Authoritative server simulation.
- Reconnect support.
- Session replay logs for debugging.

## Gates
1. Gate 0: Freeze and tag stable single-player release.
2. Gate 1: Finalize protocol contracts and schema versioning.
3. Gate 2: Implement server-authoritative sim + replay harness.
4. Gate 3: Add client adapter in dark mode (telemetry-only, no gameplay effect).
5. Gate 4: Internal private-room multiplayer with bots and reconnect tests.
6. Gate 5: Limited closed test rollout behind kill switch.
7. Gate 6: Production-ready integration with monitored ramp.

## Exit Criteria Before Integration
- Match completion rate >= 95%.
- Server/client desync rate <= 1%.
- Reconnect success within 10 seconds.
- Single-player crash/regression checks pass.
- Kill switch verified for instant multiplayer disable.

## Feature Flags
- Frontend:
- `VITE_MULTIPLAYER_ENABLED=false`
- `VITE_MULTIPLAYER_DARK_MODE=false`
- `VITE_MULTIPLAYER_TRANSPORT=ws`
- `VITE_MULTIPLAYER_REGION=us-east`
- Backend:
- `MULTIPLAYER_ENABLED=false`
- `MULTIPLAYER_PORT=3001`
- `MULTIPLAYER_TICK_RATE=30`
- `MULTIPLAYER_MAX_ROOM_SIZE=8`
- `MULTIPLAYER_REQUIRE_SERVER_AUTH=true`

## Rollback Plan
- Disable multiplayer by setting `VITE_MULTIPLAYER_ENABLED=false` and `MULTIPLAYER_ENABLED=false`.
- Keep single-player release path unchanged and always available.
