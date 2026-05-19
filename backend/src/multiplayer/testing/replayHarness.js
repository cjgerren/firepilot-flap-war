import { AuthoritativeSim } from '../sim/AuthoritativeSim.js';

export function replayFrames({ frames = [], tickRate = 30 } = {}) {
  const sim = new AuthoritativeSim({ tickRate });
  sim.upsertPlayer('p1', { x: 0, y: 0, hp: 100, alive: true });

  for (const input of frames) {
    sim.applyInput('p1', input);
    sim.tick();
  }

  return sim.snapshot();
}

