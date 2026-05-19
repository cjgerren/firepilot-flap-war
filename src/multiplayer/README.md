# Multiplayer Client Skeleton

This folder is isolated from the active gameplay path.

## Purpose
- Hold multiplayer contracts, client adapter, and telemetry plumbing.
- Stay unreferenced by current single-player gameplay until integration gate approval.

## Subfolders
- `contracts/`: client-side protocol constants and schema version.
- `client/`: connection lifecycle and transport adapter.
- `matchmaking/`: room create/join/leave requests.
- `sim/`: client prediction data types only.
- `telemetry/`: dark mode telemetry forwarding.
