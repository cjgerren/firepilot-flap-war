# Multiplayer Server Skeleton

This subtree is an isolated authoritative multiplayer track.

## Boundaries
- No coupling to current single-player run loop.
- Can run as a separate process and separate port.
- Controlled by `MULTIPLAYER_ENABLED`.

## Modules
- `server/`: socket entry and room lifecycle.
- `protocol/`: server message contracts.
- `sim/`: authoritative simulation engine.
- `testing/`: replay and deterministic verification harness.
