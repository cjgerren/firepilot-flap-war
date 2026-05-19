export class AuthoritativeSim {
  constructor({ tickRate = 30 } = {}) {
    this.tickRate = tickRate;
    this.frame = 0;
    this.players = new Map();
  }

  upsertPlayer(playerId, state = {}) {
    this.players.set(playerId, {
      x: Number(state.x || 0),
      y: Number(state.y || 0),
      hp: Number(state.hp || 100),
      alive: state.alive !== false,
    });
  }

  applyInput(playerId, input = {}) {
    const player = this.players.get(playerId);
    if (!player || !player.alive) return;
    if (input.flap) player.y -= 1;
    if (input.fire) player.x += 0.2;
  }

  tick() {
    this.frame += 1;
    return this.snapshot();
  }

  snapshot() {
    return {
      frame: this.frame,
      players: Array.from(this.players.entries()).map(([playerId, state]) => ({
        playerId,
        ...state,
      })),
    };
  }
}

