import configuredGameConfig from './game-config.json';

const FALLBACK_GAME_CONFIG = {
  configVersion: 1,
  metadata: {
    title: 'FirePilot Mainline',
    notes: 'Default baseline profile.',
    updatedAt: null,
  },
  gameplay: {
    scoreRampMultiplier: 1,
    playerHp: 3,
    enemySpawnBaseInterval: 170,
  },
  enemies: {
    enabledTypes: ['drone', 'enemy_ship', 'ground_turret'],
    weights: {
      drone: 0.58,
      enemy_ship: 0.28,
      ground_turret: 0.14,
    },
    healthMultiplier: 1,
    speedMultiplier: 1,
    customEnemies: [],
  },
  armory: {
    allowNewWeapons: true,
    starterWeapons: ['blaster'],
    featuredWeapons: ['blaster2', 'rocket', 'auto', 'lightning'],
    featuredSkins: ['default'],
    featuredUpgrades: ['damage_boost', 'rapid_fire'],
    featuredSpecials: ['teleport_blink', 'sonic_boom'],
    featuredCombos: ['shock-and-awe', 'bombardier'],
  },
  audio: {
    musicEnabledByDefault: true,
    musicVolume: 0.6,
    sfxEnabledByDefault: true,
    sfxVolume: 0.8,
  },
  visuals: {
    theme: 'classic',
    hudStyle: 'retro-neon',
    particlesMultiplier: 1,
  },
  platforms: {
    web: {
      enabled: true,
      multiplayerEnabled: true,
    },
    android: {
      enabled: true,
      multiplayerEnabled: true,
    },
    ios: {
      enabled: true,
      multiplayerEnabled: false,
    },
  },
};

const ENEMY_WEIGHT_KEYS = ['drone', 'enemy_ship', 'ground_turret'];
const CUSTOM_ENEMY_ARCHETYPES = ['drone', 'enemy_ship', 'ground_turret', 'seeker', 'bomber'];

function clamp(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function normalizeWeightMap(candidate) {
  const weights = {};
  let total = 0;

  ENEMY_WEIGHT_KEYS.forEach((key) => {
    const safe = clamp(candidate?.[key], 0, 1, FALLBACK_GAME_CONFIG.enemies.weights[key]);
    weights[key] = safe;
    total += safe;
  });

  if (total <= 0) {
    return { ...FALLBACK_GAME_CONFIG.enemies.weights };
  }

  ENEMY_WEIGHT_KEYS.forEach((key) => {
    weights[key] = weights[key] / total;
  });
  return weights;
}

function normalizeCustomEnemies(candidate) {
  if (!Array.isArray(candidate)) return [];

  return candidate
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry, index) => ({
      id: String(entry.id || `custom_enemy_${index + 1}`)
        .trim()
        .slice(0, 40),
      name: String(entry.name || `Custom Enemy ${index + 1}`)
        .trim()
        .slice(0, 60),
      archetype: CUSTOM_ENEMY_ARCHETYPES.includes(entry.archetype)
        ? entry.archetype
        : 'drone',
      movement: String(entry.movement || 'straight')
        .trim()
        .slice(0, 30),
      weapon: String(entry.weapon || 'pulse')
        .trim()
        .slice(0, 30),
      emoji: String(entry.emoji || '🤖')
        .trim()
        .slice(0, 6),
      color: String(entry.color || '#6af0ff')
        .trim()
        .slice(0, 24),
      hp: clamp(entry.hp, 1, 99, 2),
      speed: clamp(entry.speed, 0.2, 12, 2.5),
      live: entry.live !== false,
    }));
}

function normalizeConfig(raw) {
  const base = FALLBACK_GAME_CONFIG;
  const candidate = raw && typeof raw === 'object' ? raw : {};

  return {
    configVersion: clamp(candidate.configVersion, 1, Number.MAX_SAFE_INTEGER, 1),
    metadata: {
      title: String(candidate.metadata?.title || base.metadata.title),
      notes: String(candidate.metadata?.notes || base.metadata.notes),
      updatedAt: candidate.metadata?.updatedAt || null,
    },
    gameplay: {
      scoreRampMultiplier: clamp(
        candidate.gameplay?.scoreRampMultiplier,
        0.25,
        3,
        base.gameplay.scoreRampMultiplier
      ),
      playerHp: clamp(candidate.gameplay?.playerHp, 1, 20, base.gameplay.playerHp),
      enemySpawnBaseInterval: clamp(
        candidate.gameplay?.enemySpawnBaseInterval,
        60,
        300,
        base.gameplay.enemySpawnBaseInterval
      ),
    },
    enemies: {
      enabledTypes: Array.isArray(candidate.enemies?.enabledTypes)
        ? candidate.enemies.enabledTypes.filter((id) => ENEMY_WEIGHT_KEYS.includes(id))
        : base.enemies.enabledTypes,
      weights: normalizeWeightMap(candidate.enemies?.weights),
      healthMultiplier: clamp(
        candidate.enemies?.healthMultiplier,
        0.3,
        5,
        base.enemies.healthMultiplier
      ),
      speedMultiplier: clamp(
        candidate.enemies?.speedMultiplier,
        0.3,
        5,
        base.enemies.speedMultiplier
      ),
      customEnemies: normalizeCustomEnemies(candidate.enemies?.customEnemies),
    },
    armory: {
      allowNewWeapons:
        typeof candidate.armory?.allowNewWeapons === 'boolean'
          ? candidate.armory.allowNewWeapons
          : base.armory.allowNewWeapons,
      starterWeapons: Array.isArray(candidate.armory?.starterWeapons)
        ? candidate.armory.starterWeapons.filter(Boolean)
        : base.armory.starterWeapons,
      featuredWeapons: Array.isArray(candidate.armory?.featuredWeapons)
        ? candidate.armory.featuredWeapons.filter(Boolean)
        : base.armory.featuredWeapons,
      featuredSkins: Array.isArray(candidate.armory?.featuredSkins)
        ? candidate.armory.featuredSkins.filter(Boolean)
        : base.armory.featuredSkins,
      featuredUpgrades: Array.isArray(candidate.armory?.featuredUpgrades)
        ? candidate.armory.featuredUpgrades.filter(Boolean)
        : base.armory.featuredUpgrades,
      featuredSpecials: Array.isArray(candidate.armory?.featuredSpecials)
        ? candidate.armory.featuredSpecials.filter(Boolean)
        : base.armory.featuredSpecials,
      featuredCombos: Array.isArray(candidate.armory?.featuredCombos)
        ? candidate.armory.featuredCombos.filter(Boolean)
        : base.armory.featuredCombos,
    },
    audio: {
      musicEnabledByDefault:
        typeof candidate.audio?.musicEnabledByDefault === 'boolean'
          ? candidate.audio.musicEnabledByDefault
          : base.audio.musicEnabledByDefault,
      musicVolume: clamp(candidate.audio?.musicVolume, 0, 1, base.audio.musicVolume),
      sfxEnabledByDefault:
        typeof candidate.audio?.sfxEnabledByDefault === 'boolean'
          ? candidate.audio.sfxEnabledByDefault
          : base.audio.sfxEnabledByDefault,
      sfxVolume: clamp(candidate.audio?.sfxVolume, 0, 1, base.audio.sfxVolume),
    },
    visuals: {
      theme: String(candidate.visuals?.theme || base.visuals.theme),
      hudStyle: String(candidate.visuals?.hudStyle || base.visuals.hudStyle),
      particlesMultiplier: clamp(
        candidate.visuals?.particlesMultiplier,
        0,
        3,
        base.visuals.particlesMultiplier
      ),
    },
    platforms: {
      web: {
        enabled:
          typeof candidate.platforms?.web?.enabled === 'boolean'
            ? candidate.platforms.web.enabled
            : base.platforms.web.enabled,
        multiplayerEnabled:
          typeof candidate.platforms?.web?.multiplayerEnabled === 'boolean'
            ? candidate.platforms.web.multiplayerEnabled
            : base.platforms.web.multiplayerEnabled,
      },
      android: {
        enabled:
          typeof candidate.platforms?.android?.enabled === 'boolean'
            ? candidate.platforms.android.enabled
            : base.platforms.android.enabled,
        multiplayerEnabled:
          typeof candidate.platforms?.android?.multiplayerEnabled === 'boolean'
            ? candidate.platforms.android.multiplayerEnabled
            : base.platforms.android.multiplayerEnabled,
      },
      ios: {
        enabled:
          typeof candidate.platforms?.ios?.enabled === 'boolean'
            ? candidate.platforms.ios.enabled
            : base.platforms.ios.enabled,
        multiplayerEnabled:
          typeof candidate.platforms?.ios?.multiplayerEnabled === 'boolean'
            ? candidate.platforms.ios.multiplayerEnabled
            : base.platforms.ios.multiplayerEnabled,
      },
    },
  };
}

export const gameConfig = normalizeConfig(configuredGameConfig);

export function getRuntimeDefaultSettings() {
  return {
    flapKey: 'Space',
    shootKey: 'KeyF',
    blastKey: 'KeyB',
    bombKey: 'KeyT',
    mobileSpecialControl: 'screen',
    mobileMicEnabled: false,
    mobileButtonLayout: 'fly-left',
    musicEnabled: gameConfig.audio.musicEnabledByDefault,
    sfxEnabled: gameConfig.audio.sfxEnabledByDefault,
    musicVolume: gameConfig.audio.musicVolume,
    sfxVolume: gameConfig.audio.sfxVolume,
    onlineMode: gameConfig.platforms.web.multiplayerEnabled,
  };
}

export function getGameplayConfig() {
  return {
    scoreRampMultiplier: gameConfig.gameplay.scoreRampMultiplier,
    playerHp: gameConfig.gameplay.playerHp,
    enemySpawnBaseInterval: gameConfig.gameplay.enemySpawnBaseInterval,
  };
}

export function getEnemyConfig() {
  return {
    enabledTypes: [...gameConfig.enemies.enabledTypes],
    weights: { ...gameConfig.enemies.weights },
    healthMultiplier: gameConfig.enemies.healthMultiplier,
    speedMultiplier: gameConfig.enemies.speedMultiplier,
    customEnemies: [...gameConfig.enemies.customEnemies],
  };
}

export function getStarterWeaponIds() {
  const starters = gameConfig.armory.starterWeapons.filter(Boolean);
  return starters.length > 0 ? starters : [...FALLBACK_GAME_CONFIG.armory.starterWeapons];
}

export function getDefaultSelectedWeapon() {
  return getStarterWeaponIds()[0] || 'blaster';
}

export function getFeaturedWeaponIds() {
  return [...gameConfig.armory.featuredWeapons];
}

export function getFeaturedSkinIds() {
  return [...gameConfig.armory.featuredSkins];
}

export function getFeaturedUpgradeIds() {
  return [...gameConfig.armory.featuredUpgrades];
}

export function getFeaturedSpecialIds() {
  return [...gameConfig.armory.featuredSpecials];
}

export function getFeaturedComboIds() {
  return [...gameConfig.armory.featuredCombos];
}
