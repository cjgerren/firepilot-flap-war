# Multiplayer Feature Flag Matrix

| Flag | Layer | Default | Purpose | Safe Rollback |
|---|---|---:|---|---|
| `VITE_MULTIPLAYER_ENABLED` | Frontend | `false` | Enables multiplayer UI and matchmaking flow. | Set `false`, redeploy client. |
| `VITE_MULTIPLAYER_DARK_MODE` | Frontend | `false` | Sends telemetry-only events without changing gameplay. | Set `false`, no user-facing impact. |
| `VITE_MULTIPLAYER_TRANSPORT` | Frontend | `ws` | Selects network transport. | Switch to known-good transport. |
| `VITE_MULTIPLAYER_REGION` | Frontend | `us-east` | Preferred region for matchmaking. | Change region routing. |
| `MULTIPLAYER_ENABLED` | Backend | `false` | Turns multiplayer server endpoints on/off. | Set `false`, restart service. |
| `MULTIPLAYER_PORT` | Backend | `3001` | Multiplayer service port. | Revert to prior port. |
| `MULTIPLAYER_TICK_RATE` | Backend | `30` | Authoritative sim tick rate. | Revert to baseline tick. |
| `MULTIPLAYER_MAX_ROOM_SIZE` | Backend | `8` | Hard cap for room members. | Lower cap to reduce load. |
| `MULTIPLAYER_REQUIRE_SERVER_AUTH` | Backend | `true` | Require server-side auth claims for sessions. | Keep `true` for safety. |

## Recommended Rollout Sequence
1. Enable `VITE_MULTIPLAYER_DARK_MODE=true` only.
2. Validate telemetry and error rates.
3. Enable backend `MULTIPLAYER_ENABLED=true` for internal users.
4. Enable `VITE_MULTIPLAYER_ENABLED=true` for closed test cohort.
5. Ramp cohorts gradually with monitoring.
