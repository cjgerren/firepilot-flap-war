// ─── Weapons ──────────────────────────────────────────────────────────────────
export const WEAPONS = [
  {
    id: 'blaster',
    name: 'BLASTER',
    desc: 'Standard rapid-fire laser. Reliable. Classic.',
    emoji: '🔫',
    cost: 0,
    color: '#ffff00',
    fireRate: 12, // frames between shots
    type: 'single',
  },
  {
    id: 'blaster2',
    name: 'TWIN BURST',
    desc: '2-round burst. Twice the punch, twice the style.',
    emoji: '🔥',
    cost: 500,
    color: '#ff8800',
    fireRate: 14,
    type: 'burst',
    burstCount: 2,
  },
  {
    id: 'rocket',
    name: 'ROCKET MK-III',
    desc: 'Burst + 2 heat-seeking rockets under the belly. Very powerful.',
    emoji: '🚀',
    cost: 1000,
    color: '#ff4400',
    fireRate: 16,
    type: 'rocket',
    burstCount: 2,
  },
  {
    id: 'auto',
    name: 'FULL AUTO',
    desc: 'Fully automatic. Hold and destroy.',
    emoji: '⚡',
    cost: 1200,
    color: '#00ffff',
    fireRate: 5,
    type: 'auto',
  },
  {
    id: 'lightning',
    name: 'LIGHTNING ZAP',
    desc: 'Zaps all nearby enemies at once. Needs charge — depleted? Falls back to Full Auto.',
    emoji: '☇',
    cost: 1500,
    color: '#ffffff',
    fireRate: 8,
    type: 'lightning',
    maxCharge: 180,   // frames of charge (3 seconds at 60fps)
    rechargeRate: 1,  // charge recovered per frame when not firing
    drainRate: 20,    // charge drained per use
    zapRadius: 140,   // px
  },
];

// ─── Upgrades ─────────────────────────────────────────────────────────────────
export const UPGRADES = [
  {
    id: 'shield1',
    name: 'SHIELD MK-I',
    desc: 'Absorbs 1 hit from pipes or borders. Consumable — equip before each run.',
    emoji: '🛡️',
    cost: 250,
    type: 'shield',
    level: 1,
    hits: 1,
    killsEnemies: false,
    duration: null, // permanent until consumed
    stackable: true,
  },
  {
    id: 'shield2',
    name: 'SHIELD MK-II',
    desc: 'Absorbs 3 hits AND kills enemies on contact for 2 minutes. Premium protection.',
    emoji: '💎',
    cost: 1000,
    type: 'shield',
    level: 2,
    hits: 3,
    killsEnemies: true,
    duration: 7200, // frames ~2 min at 60fps
    stackable: true,
  },
  {
    id: 'tunnelbomb',
    name: 'TUNNEL BOMB',
    desc: 'Rockets off your ship — widens ALL tunnel gaps for ~1 minute.',
    emoji: '💣',
    cost: 1000,
    type: 'tunnelbomb',
    duration: 3600, // frames ~1 min at 60fps
    stackable: true,
  },
];

export function getWeapon(id) {
  return WEAPONS.find(w => w.id === id) || WEAPONS[0];
}
export function getUpgrade(id) {
  return UPGRADES.find(u => u.id === id);
}