# Multiplayer Integration Checklist

## Guardrails
- Multiplayer feature flags are default `false` in all release env files.
- No multiplayer imports in `GameCanvas` or active run loop until Gate 5.
- Kill switch tested on client and server.

## Gate 0
- Tag stable single-player build.
- Snapshot KPIs (crash-free rate, session length, ad flow).

## Gate 1
- Message contracts finalized.
- Contract schema version pinned.
- Serialization and validation tests pass.

## Gate 2
- Authoritative server sim runs at target tick rate.
- Replay log can reproduce a session deterministically.
- Server test harness covers movement/combat collisions.

## Gate 3
- Client adapter connects and exchanges heartbeat only.
- Dark mode telemetry captured with no gameplay mutations.
- Network failure handling does not crash UI.

## Gate 4
- Private room flow functional (create/join/leave).
- Bot fill logic available for internal load tests.
- Reconnect and late join policy validated.

## Gate 5
- Closed test cohort enabled.
- Observability dashboards available (match start, completion, disconnect).
- Rollback drill completed (disable multiplayer in under 5 minutes).

## Gate 6
- Gradual rollout plan set (1%, 10%, 25%, 100%).
- Incident response runbook reviewed.
- Post-launch regression checks pass.
