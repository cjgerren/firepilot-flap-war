import React, { useRef, useEffect, useCallback } from 'react';
import { drawPlayerSkin } from '../../lib/skins.js';
import { getWeapon, getSpecial, COMBO_PACKS } from '../../lib/gameItems.js';
import audioManager from '../../lib/audioManager.js';
import {
  getEnemyConfig,
  getGameplayConfig,
  getRuntimeDefaultSettings,
} from '../../config/gameConfig.js';
import {
  getSelectedWeapon,
  getEquippedUpgrades,
  consumeEquippedUpgrade,
  getActiveComboIds,
  getSelectedCombo,
  addDiamonds,
  getSelectedSpecial,
  getSpecialQty,
  consumeSpecial,
} from '../../lib/gameStore.js';


const GAME_WIDTH = 800;
const GAME_HEIGHT = 500;
const GRAVITY = 0.18;
const JUMP_FORCE = -5.5;
const PIPE_WIDTH = 50;
const PIPE_GAP = 150;
const PIPE_GAP_BOMB = 240;
const PIPE_SPEED_BASE = 2.74;
const PLAYER_SIZE = 24;
const GROUND_HEIGHT = 40;
const MAX_SHIELDS = 3;
const BLAST_STREAK = 3;
const TURRET_SCORE_START = 42;
const SWARM_SCORE_START = 220;
const SWARM_ENEMY_CAP = 5;
const SWARM_DELAY_MIN = 18;
const SWARM_DELAY_MAX = 30;
const SWARM_DYNAMIC_START_SCORE = 300;
const SWARM_DYNAMIC_STEP_BASE = 54;
const MAX_PARTICLES = 260;
const MAX_PARTICLES_MOBILE = 130;
const MAX_ENEMY_BULLETS_MOBILE = 64;
const MAX_ZAP_ARCS_MOBILE = 14;
const MAX_PLAYER_BULLETS_MOBILE = 60;
const MAX_BURST_PENDING_MOBILE = 20;
const MAX_ROCKETS_MOBILE = 16;
const MAX_PARTICLES_IOS = 56;
const MAX_ENEMY_BULLETS_IOS = 32;
const MAX_ZAP_ARCS_IOS = 6;
const MAX_PLAYER_BULLETS_IOS = 24;
const MAX_BURST_PENDING_IOS = 6;
const MAX_ROCKETS_IOS = 7;
const IOS_RENDER_SCALE = 0.66;
const MAX_ENEMIES_IOS = 4;
const IOS_ULTRA_MAX_PARTICLES = 34;
const IOS_ULTRA_MAX_ENEMY_BULLETS = 22;
const IOS_ULTRA_MAX_ZAP_ARCS = 4;
const IOS_ULTRA_MAX_PLAYER_BULLETS = 16;
const IOS_ULTRA_MAX_BURST_PENDING = 4;
const IOS_ULTRA_MAX_ROCKETS = 4;
const IOS_ULTRA_MAX_ENEMIES = 4;
const IOS_SLOW_FRAME_MS = 22;
const IOS_RECOVER_FRAME_MS = 18;
const IOS_SLOW_FRAMES_TO_DEGRADE = 10;
const IOS_GOOD_FRAMES_TO_RECOVER = 120;
const IOS_FRAME_AVG_WINDOW = 45;
const IOS_DEGRADE_AVG_MS = 20;
const IOS_RECOVER_AVG_MS = 17;
const IOS_DEGRADE_FRAMES_REQUIRED = 24;
const IOS_RECOVER_FRAMES_REQUIRED = 160;
const IOS_MAX_DPR = 1.25;
const DEFAULT_MAX_DPR = 2;
const SHOW_PERF_OVERLAY = false;
const MAX_BLASTS_DEFAULT = 10;
const MAX_PORTAL_EFFECTS_DEFAULT = 14;
const MAX_BLASTS_IOS = 5;
const MAX_PORTAL_EFFECTS_IOS = 8;
const MAX_BLASTS_IOS_ULTRA = 3;
const MAX_PORTAL_EFFECTS_IOS_ULTRA = 5;
const TELEPORT_MIN_SCORE = 28;
const ENEMY_SPATIAL_CELL = 96;
const SCRIPTED_SWARM_MILESTONES = [
  { score: 140, size: 'small' },
  { score: 180, size: 'small', rearLargeDrone: true },
  { score: 220, size: 'medium' },
  { score: 280, size: 'medium', rearLargeDrone: true },
  { score: 340, size: 'single', forceNapalmBomber: true },
  { score: 380, size: 'large' },
];

const DEFAULT_SETTINGS = getRuntimeDefaultSettings();
const GAMEPLAY_CONFIG = getGameplayConfig();
const ENEMY_CONFIG = getEnemyConfig();
const LIVE_CUSTOM_ENEMIES = (ENEMY_CONFIG.customEnemies || []).filter(
  (entry) => entry && entry.live !== false
);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function readLowPerformanceOverride() {
  if (typeof window === 'undefined') return false;
  try {
    // Opt-in only: default iOS rendering should match Android/web visuals.
    return window.localStorage.getItem('firepilot_force_ios_performance_mode') === '1';
  } catch {
    return false;
  }
}

function getClampedDevicePixelRatio(isIOSPerformanceMode) {
  if (typeof window === 'undefined') return 1;
  const dpr = Number(window.devicePixelRatio || 1);
  const maxDpr = isIOSPerformanceMode ? IOS_MAX_DPR : DEFAULT_MAX_DPR;
  return clamp(dpr, 1, maxDpr);
}

function getRenderFxProfile(game) {
  const lowFx = Boolean(game?.lowFx);
  const perfLevel = Number(game?.renderPerfLevel || 0);
  const ultra = Boolean(game?.ultraLowFx || perfLevel >= 2);
  return {
    lowFx,
    minimal: lowFx && perfLevel >= 1,
    ultra,
    perfLevel,
  };
}

function getRenderCache(game, width, height) {
  if (!game.renderCache || game.renderCache.width !== width || game.renderCache.height !== height) {
    game.renderCache = {
      width,
      height,
      bgMain: null,
      bgDepthGlow: null,
      bgHaze: null,
      bgFloor: null,
      bgTunnelWash: null,
      bgVignette: null,
    };
  }
  return game.renderCache;
}

function getNativePlatform() {
  if (typeof window === 'undefined') return 'web';
  const platform = window.Capacitor?.getPlatform?.();
  if (platform) return platform;

  const ua = window.navigator?.userAgent || '';
  const touchPoints = Number(window.navigator?.maxTouchPoints || 0);
  const isIosUa = /iPad|iPhone|iPod/i.test(ua);
  const isIpadDesktopUa = /Macintosh/i.test(ua) && touchPoints > 1;
  if (isIosUa || isIpadDesktopUa) return 'ios';

  return 'web';
}

function loadSettings() {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem('firepilot_settings');
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function playSfx(name) {
  audioManager.playSfx(name);
}

function isEditableEventTarget(target) {
  if (!target || !(target instanceof HTMLElement)) return false;

  const tagName = target.tagName;
  return (
    target.isContentEditable ||
    tagName === 'INPUT' ||
    tagName === 'TEXTAREA' ||
    tagName === 'SELECT'
  );
}

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pickConfiguredBaseEnemyType(roll, { includeTurret = true } = {}) {
  const enabled = new Set(ENEMY_CONFIG.enabledTypes);
  const weighted = [
    { id: 'drone', weight: ENEMY_CONFIG.weights.drone },
    { id: 'enemy_ship', weight: ENEMY_CONFIG.weights.enemy_ship },
    { id: 'ground_turret', weight: ENEMY_CONFIG.weights.ground_turret },
  ].filter((entry) => enabled.has(entry.id) && (includeTurret || entry.id !== 'ground_turret'));

  if (weighted.length <= 0) return 'drone';

  const total = weighted.reduce((sum, entry) => sum + Math.max(0, Number(entry.weight || 0)), 0);
  if (total <= 0) return weighted[0].id;

  let cursor = Math.max(0, Math.min(0.999999, roll)) * total;
  for (const entry of weighted) {
    cursor -= entry.weight;
    if (cursor <= 0) return entry.id;
  }
  return weighted[weighted.length - 1].id;
}

function distSq(x1, y1, x2, y2) {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return dx * dx + dy * dy;
}

function getClosestForwardPipe(pipes, minRightEdgeX) {
  let best = null;
  let bestX = Number.POSITIVE_INFINITY;
  for (let i = 0; i < pipes.length; i++) {
    const pipe = pipes[i];
    if (pipe.x + PIPE_WIDTH <= minRightEdgeX) continue;
    if (pipe.x >= bestX) continue;
    bestX = pipe.x;
    best = pipe;
  }
  return best;
}

function getBurstCountBySize(size, score) {
  if (size === 'small') return randomInt(1, 2);
  if (size === 'medium') return randomInt(2, 3);
  if (size === 'large') {
    const bonus = score >= 800 ? 1 : 0;
    return randomInt(3 + bonus, 4 + bonus);
  }
  return 1;
}

function buildSwarmPlan(score, definition) {
  const forceNapalmBomber = Boolean(definition.forceNapalmBomber);
  const total = forceNapalmBomber ? 1 : getBurstCountBySize(definition.size, score);

  return {
    size: definition.size,
    total,
    remaining: total,
    rearLargeDrone: Boolean(definition.rearLargeDrone),
    forceNapalmBomber,
  };
}

function buildDynamicSwarmPlan(score) {
  if (score < 320) return buildSwarmPlan(score, { size: 'small' });
  if (score < 650) return buildSwarmPlan(score, { size: 'medium' });
  return buildSwarmPlan(score, { size: 'large', rearLargeDrone: score >= 900 });
}

function getNearestEnemies(enemies, originX, originY, limit = 1) {
  const nearest = [];
  const nearestDistances = [];
  for (const enemy of enemies) {
    if (enemy.dead) continue;
    const distance = distSq(enemy.x, enemy.y, originX, originY);
    if (nearest.length < limit) {
      nearest.push(enemy);
      nearestDistances.push(distance);
      continue;
    }
    let farthestIndex = 0;
    for (let i = 1; i < nearestDistances.length; i++) {
      if (nearestDistances[i] > nearestDistances[farthestIndex]) {
        farthestIndex = i;
      }
    }
    if (distance < nearestDistances[farthestIndex]) {
      nearest[farthestIndex] = enemy;
      nearestDistances[farthestIndex] = distance;
    }
  }
  return nearest;
}

function compactArrayInPlace(arr, shouldKeep) {
  let writeIndex = 0;
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    if (!shouldKeep(item, i)) continue;
    arr[writeIndex++] = item;
  }
  arr.length = writeIndex;
  return arr;
}

function hasHitId(ids, id) {
  if (!Array.isArray(ids) || ids.length <= 0) return false;
  for (let i = 0; i < ids.length; i++) {
    if (ids[i] === id) return true;
  }
  return false;
}

function buildEnemySpatialIndex(enemies, cellSize = ENEMY_SPATIAL_CELL) {
  const buckets = new Map();

  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i];
    if (!enemy || enemy.dead) continue;
    const cx = Math.floor(enemy.x / cellSize);
    const cy = Math.floor(enemy.y / cellSize);
    const key = `${cx}|${cy}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(enemy);
      continue;
    }
    buckets.set(key, [enemy]);
  }

  return { buckets, cellSize };
}

function collectNearbyEnemies(index, x, y, radiusX, radiusY, out) {
  out.length = 0;
  if (!index || !index.buckets || index.buckets.size <= 0) return out;

  const cellSize = index.cellSize;
  const minCx = Math.floor((x - radiusX) / cellSize);
  const maxCx = Math.floor((x + radiusX) / cellSize);
  const minCy = Math.floor((y - radiusY) / cellSize);
  const maxCy = Math.floor((y + radiusY) / cellSize);

  for (let cy = minCy; cy <= maxCy; cy++) {
    for (let cx = minCx; cx <= maxCx; cx++) {
      const bucket = index.buckets.get(`${cx}|${cy}`);
      if (!bucket) continue;
      for (let i = 0; i < bucket.length; i++) {
        out.push(bucket[i]);
      }
    }
  }

  return out;
}

function applyIosPerformanceBudget(game, ultraLowFx = false) {
  if (!game) return;
  if (!ultraLowFx) {
    game.maxParticles = MAX_PARTICLES_IOS;
    game.maxEnemyBullets = MAX_ENEMY_BULLETS_IOS;
    game.maxZapArcs = MAX_ZAP_ARCS_IOS;
    game.maxPlayerBullets = MAX_PLAYER_BULLETS_IOS;
    game.maxBurstPending = MAX_BURST_PENDING_IOS;
    game.maxRockets = MAX_ROCKETS_IOS;
    game.maxEnemies = MAX_ENEMIES_IOS;
    game.maxBlasts = MAX_BLASTS_IOS;
    game.maxPortalEffects = MAX_PORTAL_EFFECTS_IOS;
    game.blastResolvePerFrame = 2;
    return;
  }

  game.maxParticles = IOS_ULTRA_MAX_PARTICLES;
  game.maxEnemyBullets = IOS_ULTRA_MAX_ENEMY_BULLETS;
  game.maxZapArcs = IOS_ULTRA_MAX_ZAP_ARCS;
  game.maxPlayerBullets = IOS_ULTRA_MAX_PLAYER_BULLETS;
  game.maxBurstPending = IOS_ULTRA_MAX_BURST_PENDING;
  game.maxRockets = IOS_ULTRA_MAX_ROCKETS;
  game.maxEnemies = IOS_ULTRA_MAX_ENEMIES;
  game.maxBlasts = MAX_BLASTS_IOS_ULTRA;
  game.maxPortalEffects = MAX_PORTAL_EFFECTS_IOS_ULTRA;
  game.blastResolvePerFrame = 1;
}

function applyIosVisualLevel(game, level = 0) {
  if (!game || !game.lowFx) return;
  const nextLevel = clamp(Math.round(Number(level || 0)), 0, 2);
  game.renderPerfLevel = nextLevel;
  game.ultraLowFx = nextLevel >= 2;
  applyIosPerformanceBudget(game, nextLevel >= 2);
}

function pushWithCap(list, value, maxItems) {
  if (!Array.isArray(list)) return;
  if (list.length >= maxItems) {
    list.shift();
  }
  list.push(value);
}

function getEnemyBaseScore(type) {
  if (type === 'ground_turret') return 4;
  if (type === 'bomber') return 3;
  if (type === 'seeker') return 2;
  return 1;
}

function createZapArc(x1, y1, x2, y2, life = 8) {
  const points = [];
  const segments = 4;
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    points.push({
      x: x1 + (x2 - x1) * t + (Math.random() - 0.5) * 30,
      y: y1 + (y2 - y1) * t + (Math.random() - 0.5) * 30,
    });
  }
  return { x1, y1, x2, y2, life, points };
}

function neonRect(ctx, x, y, w, h, fill, glow, glowSize = 8) {
  ctx.shadowColor = glow;
  ctx.shadowBlur = glowSize;
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.shadowBlur = 0;
}

function neonLine(ctx, x1, y1, x2, y2, color, lw = 1, glow = 6) {
  ctx.shadowColor = color;
  ctx.shadowBlur = glow;
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawBullet(ctx, b, lowFx = false) {
  ctx.save();
  if (lowFx) {
    if (b.weaponType === 'plasma_lance') {
      ctx.fillStyle = b.color || '#66ffff';
      ctx.fillRect(b.x - 28, b.y - 2, 40, 4);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(b.x + 10, b.y - 1, 5, 2);
    } else if (b.weaponType === 'ricochet') {
      ctx.strokeStyle = b.color || '#66ccff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
      ctx.stroke();
    } else if (b.weaponType === 'seismic') {
      ctx.strokeStyle = b.color || '#ffaa44';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 5.5, 0, Math.PI * 2);
      ctx.stroke();
    } else if (b.weaponType === 'rocket') {
      ctx.fillStyle = '#ffb066';
      ctx.beginPath();
      ctx.moveTo(b.x + 8, b.y);
      ctx.lineTo(b.x - 5, b.y - 3);
      ctx.lineTo(b.x - 5, b.y + 3);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = b.color || '#ffff00';
      ctx.fillRect(b.x - 5, b.y - 1.25, 10, 2.5);
    }
    ctx.restore();
    return;
  }

  if (b.weaponType === 'seismic') {
    const pulse = 0.75 + Math.sin((b.age || 0) * 0.35) * 0.18;
    ctx.shadowColor = b.color || '#ffaa44';
    ctx.shadowBlur = 22;
    ctx.strokeStyle = b.color || '#ffaa44';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 8 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,196,110,0.28)';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (b.weaponType === 'flak') {
    const color = b.color || '#ffcc66';
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (b.weaponType === 'plasma_lance') {
    const color = b.color || '#66ffff';
    ctx.shadowColor = color;
    ctx.shadowBlur = 24;
    const lance = ctx.createLinearGradient(b.x - 54, b.y, b.x + 18, b.y);
    lance.addColorStop(0, 'rgba(102,255,255,0)');
    lance.addColorStop(0.28, `${color}55`);
    lance.addColorStop(0.8, color);
    lance.addColorStop(1, '#ffffff');
    ctx.fillStyle = lance;
    ctx.fillRect(b.x - 54, b.y - 3, 76, 6);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(b.x + 12, b.y - 1.5, 10, 3);
  } else if (b.weaponType === 'ricochet') {
    const color = b.color || '#66ccff';
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(b.x - 8, b.y);
    ctx.lineTo(b.x + 8, b.y);
    ctx.moveTo(b.x, b.y - 8);
    ctx.lineTo(b.x, b.y + 8);
    ctx.stroke();
  } else if (b.weaponType === 'lightning_zap') {
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 20;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const seed = Number(b.seed || ((b.spawnFrame || 0) * 0.17 + b.y * 0.03));
    for (let i = 0; i < 5; i++) {
      const phase = seed + (b.age || 0) * 0.22 + i * 1.35;
      const cx = b.x + i * 20 + Math.sin(phase) * 4;
      const cy = b.y + Math.cos(phase * 1.4) * 8;
      if (i === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    }
    ctx.stroke();
    ctx.shadowColor = '#aaaaff';
    ctx.shadowBlur = 8;
    ctx.strokeStyle = '#aaaaff';
    ctx.stroke();
  } else if (b.weaponType === 'rocket') {
    const flame = 0.82 + Math.sin((b.x + b.y) * 0.08) * 0.12;
    ctx.shadowColor = '#ff7a1a';
    ctx.shadowBlur = 16;
    const rocketBody = ctx.createLinearGradient(b.x, b.y - 5, b.x + 18, b.y + 5);
    rocketBody.addColorStop(0, '#151b21');
    rocketBody.addColorStop(0.45, '#a8b4ba');
    rocketBody.addColorStop(1, '#323c44');
    ctx.fillStyle = rocketBody;
    ctx.beginPath();
    ctx.moveTo(b.x + 18, b.y);
    ctx.lineTo(b.x + 4, b.y - 5);
    ctx.lineTo(b.x - 2, b.y);
    ctx.lineTo(b.x + 4, b.y + 5);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.shadowColor = '#ff4200';
    ctx.shadowBlur = 14;
    const exhaust = ctx.createLinearGradient(b.x - 20, b.y, b.x + 4, b.y);
    exhaust.addColorStop(0, 'rgba(255,80,0,0)');
    exhaust.addColorStop(0.32, `rgba(255,92,0,${0.4 * flame})`);
    exhaust.addColorStop(1, `rgba(255,220,110,${0.88 * flame})`);
    ctx.fillStyle = exhaust;
    ctx.beginPath();
    ctx.moveTo(b.x + 3, b.y - 3);
    ctx.lineTo(b.x - 18, b.y - 8);
    ctx.lineTo(b.x - 24, b.y);
    ctx.lineTo(b.x - 18, b.y + 8);
    ctx.lineTo(b.x + 3, b.y + 3);
    ctx.closePath();
    ctx.fill();
  } else {
    const color = b.color || '#ffff00';
    ctx.shadowColor = color;
    ctx.shadowBlur = b.isAuto ? 10 : 16;
    const tracerLength = b.isAuto ? 28 : 40;
    const tracer = ctx.createLinearGradient(b.x - tracerLength, b.y, b.x + 12, b.y);
    tracer.addColorStop(0, 'rgba(255,255,255,0)');
    tracer.addColorStop(0.42, `${color}44`);
    tracer.addColorStop(0.86, color);
    tracer.addColorStop(1, '#ffffff');
    ctx.fillStyle = tracer;
    ctx.fillRect(b.x - tracerLength, b.y - 1.5, tracerLength + 18, b.isAuto ? 2.2 : 3.2);
    ctx.fillStyle = '#fff8da';
    ctx.fillRect(b.x + 10, b.y - 1, 7, 2);
  }

  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawRocketPods(ctx, px, py, frame, lowFx = false) {
  if (lowFx) {
    const offsets = [8, -8];
    for (let i = 0; i < offsets.length; i++) {
      const dy = offsets[i];
      ctx.fillStyle = '#8ab3c8';
      ctx.fillRect(px - 9, py + dy - 2, 12, 4);
      ctx.fillStyle = '#ff9648';
      ctx.fillRect(px - 12, py + dy - 1, 3, 2);
    }
    return;
  }

  const offsets = [8, -8];

  for (let i = 0; i < offsets.length; i++) {
    const dy = offsets[i];
    ctx.save();
    ctx.shadowColor = '#7de3ff';
    ctx.shadowBlur = 8;
    const pod = ctx.createLinearGradient(px - 10, py + dy - 4, px + 8, py + dy + 4);
    pod.addColorStop(0, '#101820');
    pod.addColorStop(0.48, '#d4e2e8');
    pod.addColorStop(1, '#344551');
    ctx.fillStyle = pod;
    ctx.fillRect(px - 10, py + dy - 3, 14, 6);

    ctx.strokeStyle = 'rgba(230,248,255,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(px - 10, py + dy - 3, 14, 6);

    ctx.shadowColor = '#ff7a1a';
    ctx.shadowBlur = 10;
    ctx.fillStyle = `rgba(255,120,20,${0.38 + Math.sin(frame * 0.3 + dy) * 0.16})`;
    ctx.beginPath();
    ctx.ellipse(px - 11, py + dy, 5, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawChargeBar(ctx, x, y, charge, maxCharge, width) {
  const bw = 100;
  const bh = 6;
  const bx = width / 2 - bw / 2;
  const ratio = charge / maxCharge;

  ctx.fillStyle = '#111';
  ctx.fillRect(bx, y, bw, bh);

  const color = ratio > 0.5 ? '#00ffff' : ratio > 0.2 ? '#ffff00' : '#ff4400';
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.fillStyle = color;
  ctx.fillRect(bx, y, bw * ratio, bh);
  ctx.shadowBlur = 0;

  ctx.fillStyle = color;
  ctx.font = '600 9px JetBrains Mono';
  ctx.textAlign = 'center';
  ctx.fillText('ZAP CHARGE', width / 2, y - 2);
}

function drawTunnelBomb(ctx, b, lowFx = false) {
  ctx.save();
  const pulse = 0.7 + Math.sin(b.age * 0.3) * 0.3;

  if (lowFx) {
    ctx.fillStyle = '#ff6600';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffaa00';
    ctx.fillRect(b.x - 12, b.y - 2, 10, 4);
    ctx.restore();
    return;
  }

  ctx.shadowColor = '#ff6600';
  ctx.shadowBlur = 15 * pulse;
  ctx.fillStyle = '#ff6600';
  ctx.beginPath();
  ctx.arc(b.x, b.y, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowColor = '#ffaa00';
  ctx.shadowBlur = 8;
  ctx.fillStyle = '#ffaa00';
  ctx.beginPath();
  ctx.arc(b.x + 2, b.y - 2, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowColor = '#ff4400';
  ctx.shadowBlur = 6;
  ctx.fillStyle = `rgba(255,100,0,${0.6 * pulse})`;
  const wobble = Math.sin((b.age || 0) * 0.32) * 2.2;
  ctx.beginPath();
  ctx.moveTo(b.x - 8, b.y);
  ctx.lineTo(b.x - 24 + wobble, b.y - 5);
  ctx.lineTo(b.x - 28 + wobble * 0.7, b.y);
  ctx.lineTo(b.x - 24 + wobble, b.y + 5);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawBlast(ctx, blast, width, height, lowFx = false) {
  const groundY = height - GROUND_HEIGHT;
  const progress = 1 - blast.life / blast.maxLife;
  const alpha = blast.life / blast.maxLife;
  const pulse = 0.82 + Math.sin(progress * 24) * 0.18;

  ctx.save();

  const waveX = blast.originX;
  const waveW = (width - waveX + 120) * progress + 46;
  const waveH = 76 + progress * 140;
  const wy = blast.originY - waveH / 2;
  const clampedTop = Math.max(10, wy);
  const clampedBottom = Math.min(groundY, wy + waveH);
  const edgeX = waveX + waveW;

  if (lowFx) {
    ctx.globalAlpha = alpha * 0.5;
    ctx.fillStyle = '#7de3ff';
    ctx.fillRect(waveX, clampedTop, waveW, clampedBottom - clampedTop);
    ctx.globalAlpha = alpha * 0.8;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(edgeX - 2, clampedTop, 2, clampedBottom - clampedTop);
    ctx.strokeStyle = '#dff8ff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(edgeX, clampedTop);
    ctx.lineTo(edgeX, clampedBottom);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Outer plasma wake.
  ctx.globalAlpha = alpha * 0.44;
  const wake = ctx.createLinearGradient(waveX, 0, edgeX, 0);
  wake.addColorStop(0, 'rgba(255,255,255,0.8)');
  wake.addColorStop(0.12, 'rgba(255,120,230,0.95)');
  wake.addColorStop(0.5, 'rgba(80,250,255,0.95)');
  wake.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.shadowColor = '#ff44dd';
  ctx.shadowBlur = lowFx ? 20 : 44;
  ctx.fillStyle = wake;
  ctx.fillRect(waveX, clampedTop, waveW, clampedBottom - clampedTop);

  // High-energy core band.
  const coreH = Math.max(24, waveH * 0.42 * pulse);
  ctx.globalAlpha = alpha * 0.92;
  const core = ctx.createLinearGradient(waveX + 6, 0, edgeX, 0);
  core.addColorStop(0, 'rgba(255,255,255,1)');
  core.addColorStop(0.25, 'rgba(255,180,245,0.98)');
  core.addColorStop(0.7, 'rgba(126,235,255,0.98)');
  core.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.shadowColor = '#8bffff';
  ctx.shadowBlur = lowFx ? 16 : 30;
  ctx.fillStyle = core;
  ctx.fillRect(waveX + 4, blast.originY - coreH / 2, waveW, coreH);

  // Serrated leading edge to look more violent.
  ctx.globalAlpha = alpha * 0.9;
  ctx.shadowColor = '#ffffff';
  ctx.shadowBlur = lowFx ? 12 : 24;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  let y = clampedTop;
  let toggle = 1;
  while (y < clampedBottom) {
    const bite = 3 + Math.sin(progress * 42 + y * 0.05) * 2;
    const x = edgeX + bite * toggle;
    if (y === clampedTop) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
    toggle *= -1;
    y += 9;
  }
  ctx.stroke();

  // Shock rings punching outward from the edge.
  for (let i = 0; i < (lowFx ? 1 : 3); i++) {
    const ringProgress = Math.max(0, progress - i * 0.08);
    const ringRadius = 28 + ringProgress * (60 + i * 32);
    ctx.globalAlpha = alpha * (0.34 - i * 0.08);
    ctx.strokeStyle = i === 0 ? '#ffffff' : i === 1 ? '#7de3ff' : '#ff8ce8';
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = lowFx ? 8 : 16 - i * 3;
    ctx.lineWidth = 2.6 - i * 0.55;
    ctx.beginPath();
    ctx.arc(edgeX + i * 8, blast.originY, ringRadius, -0.9, 0.9);
    ctx.stroke();
  }

  // Hot debris sparks.
  ctx.globalAlpha = alpha * 0.9;
  for (let i = 0; i < (lowFx ? 8 : 18); i++) {
    const t = progress * 35 + i * 0.7;
    const sparkY = blast.originY + Math.sin(t) * (10 + i * 2.1);
    const sparkX = edgeX + 10 + i * 2.6;
    const size = 1.8 + (i % 3);
    ctx.fillStyle = i % 2 === 0 ? '#ffccff' : '#8af8ff';
    ctx.shadowColor = i % 2 === 0 ? '#ff66dd' : '#66eaff';
    ctx.shadowBlur = lowFx ? 6 : 10;
    ctx.fillRect(sparkX, sparkY, size, size);
  }

  ctx.restore();
}

function drawPortal(ctx, portal, lowFx = false) {
  const alpha = portal.life / portal.maxLife;
  const pulse = 1 + Math.sin((1 - alpha) * Math.PI * 4) * 0.12;

  let radius = 18 * pulse;
  let innerRadius = radius - 6;
  let blur = 20;

  if (portal.type === 'entry') {
    radius = 28 * pulse;
    innerRadius = radius - 8;
    blur = 30;
  }

  if (lowFx) {
    ctx.save();
    ctx.globalAlpha = alpha * 0.9;
    ctx.strokeStyle = portal.type === 'entry' ? '#66ffff' : '#cc99ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(portal.x, portal.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.globalAlpha = alpha;

  ctx.shadowColor = portal.type === 'entry' ? '#66ffff' : '#cc99ff';
  ctx.shadowBlur = blur;

  ctx.strokeStyle = portal.type === 'entry' ? '#66ffff' : '#cc99ff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(portal.x, portal.y, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(portal.x, portal.y, innerRadius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

function drawZapArc(ctx, x1, y1, x2, y2, points = null, lowFx = false) {
  ctx.save();
  if (!lowFx) {
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 20;
  }
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = lowFx ? 1.4 : 2;
  ctx.beginPath();
  ctx.moveTo(x1, y1);

  if (Array.isArray(points) && points.length > 0) {
    for (const point of points) {
      ctx.lineTo(point.x, point.y);
    }
  } else {
    const segs = 4;
    const base = (x1 + y1 + x2 + y2) * 0.01;
    for (let i = 1; i <= segs; i++) {
      const t = i / segs;
      const phase = base + i * 1.4;
      const mx = x1 + (x2 - x1) * t + Math.sin(phase) * 12;
      const my = y1 + (y2 - y1) * t + Math.cos(phase * 1.33) * 12;
      ctx.lineTo(mx, my);
    }
  }

  ctx.lineTo(x2, y2);
  ctx.stroke();

  if (!lowFx) {
    ctx.shadowColor = '#aaaaff';
    ctx.shadowBlur = 6;
    ctx.strokeStyle = '#aaaaff';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
}

function drawEnemy(ctx, e, frame, lowFx = false) {
  ctx.save();
  ctx.translate(e.x, e.y);
  const pulse = Math.sin(frame * 0.1 + e.seed) * 0.3 + 0.7;
  const customColor = typeof e.customEnemyColor === 'string' ? e.customEnemyColor : null;
  const customEmoji = typeof e.customEnemyEmoji === 'string' ? e.customEnemyEmoji : null;

  if (lowFx) {
    const baseColor = customColor || (
      e.type === 'ground_turret'
        ? '#6ea2bd'
        : e.type === 'bomber'
          ? (e.isNapalmBomber ? '#ff7f52' : '#ffb066')
          : e.type === 'seeker'
            ? '#8fc8e0'
            : e.type === 'drone'
              ? '#9adfff'
              : '#7db9d5'
    );

    if (e.type === 'ground_turret') {
      ctx.fillStyle = baseColor;
      ctx.fillRect(-12, -8, 24, 16);
      ctx.fillStyle = '#1a2630';
      ctx.fillRect(-5, -14, 10, 8);
    } else {
      ctx.fillStyle = baseColor;
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(6, e.size * 0.62), 0, Math.PI * 2);
      ctx.fill();
    }

    if (e.hp < e.maxHp) {
      const bw = 26;
      const bh = 3;
      ctx.fillStyle = 'rgba(6,12,18,0.82)';
      ctx.fillRect(-bw / 2, -20, bw, bh);
      ctx.fillStyle = '#ffaf85';
      ctx.fillRect(-bw / 2, -20, bw * (e.hp / e.maxHp), bh);
    }

    if (customEmoji) {
      ctx.textAlign = 'center';
      ctx.font = '700 11px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(customEmoji, 0, -Math.max(16, e.size + 6));
    }

    ctx.restore();
    return;
  }

  ctx.save();
  ctx.globalAlpha = 0.24;
  ctx.fillStyle = 'rgba(0,0,0,0.9)';
  ctx.beginPath();
  ctx.ellipse(-4, e.size * 0.7, e.size * 1.35, e.size * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (e.type === 'enemy_ship') {
    ctx.shadowColor = 'rgba(255,160,120,0.5)';
    ctx.shadowBlur = 14 * pulse;
    const body = ctx.createLinearGradient(-22, -11, 20, 11);
    body.addColorStop(0, '#121a22');
    body.addColorStop(0.5, '#4b5964');
    body.addColorStop(1, '#151f28');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-24, 0);
    ctx.lineTo(4, -13);
    ctx.lineTo(22, -5);
    ctx.lineTo(18, 0);
    ctx.lineTo(22, 5);
    ctx.lineTo(4, 13);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#081018';
    ctx.fillRect(-8, -5, 18, 10);
    ctx.strokeStyle = 'rgba(220,245,255,0.45)';
    ctx.strokeRect(-8, -5, 18, 10);

    ctx.fillStyle = '#7de3ff';
    ctx.beginPath();
    ctx.arc(-13, 0, 2.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(255,120,80,${0.45 + pulse * 0.2})`;
    ctx.fillRect(19, -5, 7, 3);
    ctx.fillRect(19, 2, 7, 3);

    ctx.globalAlpha = 0.46;
    ctx.strokeStyle = 'rgba(255,255,255,0.58)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-13, -4);
    ctx.lineTo(10, -6);
    ctx.stroke();
    ctx.globalAlpha = 1;
  } else if (e.type === 'drone') {
    ctx.shadowColor = 'rgba(120,225,255,0.55)';
    ctx.shadowBlur = 12 * pulse;
    ctx.fillStyle = '#293744';
    ctx.beginPath();
    ctx.ellipse(0, 0, 17, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(220,245,255,0.7)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.fillStyle = '#111923';
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(150,230,255,0.18)';
    ctx.fillRect(-15, -2, 30, 4);

    ctx.strokeStyle = 'rgba(120,220,255,0.55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-18, 0);
    ctx.lineTo(-26, -7);
    ctx.moveTo(-18, 0);
    ctx.lineTo(-26, 7);
    ctx.moveTo(18, 0);
    ctx.lineTo(26, -7);
    ctx.moveTo(18, 0);
    ctx.lineTo(26, 7);
    ctx.stroke();

    ctx.fillStyle = '#ff8c66';
    for (const ox of [-18, 18]) {
      ctx.beginPath();
      ctx.arc(ox, 0, 3.3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = `rgba(255,150,120,${0.45 + pulse * 0.25})`;
    for (const ox of [-23, 23]) {
      ctx.fillRect(ox, -1, 7, 2);
    }

    ctx.globalAlpha = 0.38;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(0, 0, 13, -0.85, 0.85);
    ctx.stroke();
    ctx.globalAlpha = 1;
  } else if (e.type === 'seeker') {
    ctx.shadowColor = 'rgba(255,160,120,0.5)';
    ctx.shadowBlur = 12 * pulse;
    ctx.fillStyle = '#394553';
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(0, -11);
    ctx.lineTo(-16, -7);
    ctx.lineTo(-10, 0);
    ctx.lineTo(-16, 7);
    ctx.lineTo(0, 11);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#171f28';
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(-2, -5);
    ctx.lineTo(-8, 0);
    ctx.lineTo(-2, 5);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(220,240,255,0.6)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-3, -3);
    ctx.lineTo(12, 0);
    ctx.lineTo(-3, 3);
    ctx.stroke();

    ctx.fillStyle = '#7de3ff';
    ctx.beginPath();
    ctx.arc(7, 0, 2.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(255,110,74,${0.28 + pulse * 0.2})`;
    ctx.beginPath();
    ctx.moveTo(-15, -4);
    ctx.lineTo(-28, 0);
    ctx.lineTo(-15, 4);
    ctx.closePath();
    ctx.fill();
  } else if (e.type === 'bomber') {
    ctx.shadowColor = e.isNapalmBomber ? 'rgba(255,120,90,0.55)' : 'rgba(255,175,120,0.42)';
    ctx.shadowBlur = 14 * pulse;
    const bomberBody = ctx.createLinearGradient(-18, -12, 18, 12);
    bomberBody.addColorStop(0, e.isNapalmBomber ? '#2a1f1a' : '#1e2732');
    bomberBody.addColorStop(0.5, e.isNapalmBomber ? '#78503a' : '#52616d');
    bomberBody.addColorStop(1, e.isNapalmBomber ? '#261f1b' : '#1c2631');
    ctx.fillStyle = bomberBody;
    ctx.beginPath();
    ctx.moveTo(-18, -8);
    ctx.lineTo(12, -11);
    ctx.lineTo(18, 0);
    ctx.lineTo(12, 11);
    ctx.lineTo(-18, 8);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#131b23';
    ctx.fillRect(-14, -5, 20, 10);
    ctx.fillRect(-4, -11, 8, 22);

    ctx.strokeStyle = 'rgba(220,245,255,0.45)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-14, -5, 20, 10);

    ctx.fillStyle = e.isNapalmBomber ? '#ff7f52' : '#ffb066';
    for (const ox of [-10, -2, 6]) {
      ctx.beginPath();
      ctx.arc(ox, -8, 1.7, 0, Math.PI * 2);
      ctx.arc(ox + 4, 8, 1.7, 0, Math.PI * 2);
      ctx.fill();
    }

    if (e.isNapalmBomber) {
      ctx.fillStyle = 'rgba(255,90,45,0.85)';
      ctx.fillRect(-4, -14, 10, 3);
      ctx.fillRect(-4, 11, 10, 3);
    }

    ctx.globalAlpha = 0.44;
    ctx.strokeStyle = 'rgba(255,255,255,0.48)';
    ctx.beginPath();
    ctx.moveTo(-14, -6);
    ctx.lineTo(8, -8);
    ctx.stroke();
    ctx.globalAlpha = 1;
  } else if (e.type === 'ground_turret') {
    ctx.shadowColor = 'rgba(100,215,255,0.35)';
    ctx.shadowBlur = 12 * pulse;

    const base = ctx.createLinearGradient(-18, -8, 18, 8);
    base.addColorStop(0, '#26313b');
    base.addColorStop(0.5, '#5d6d7a');
    base.addColorStop(1, '#1a222a');
    ctx.fillStyle = base;
    ctx.fillRect(-16, -8, 32, 16);

    ctx.strokeStyle = 'rgba(230,245,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-16, -8, 32, 16);

    ctx.fillStyle = '#111820';
    ctx.fillRect(-18, 8, 36, 6);

    ctx.fillStyle = '#394754';
    ctx.fillRect(-10, -18, 20, 12);
    ctx.strokeStyle = 'rgba(220,240,255,0.3)';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(-10, -18, 20, 12);

    ctx.fillStyle = '#1e262e';
    ctx.fillRect(4, -15, 16, 4);

    ctx.shadowColor = '#7de3ff';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#7de3ff';
    ctx.beginPath();
    ctx.arc(0, -12, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = `rgba(255,146,102,${0.35 + pulse * 0.25})`;
    ctx.fillRect(-12, -4, 4, 4);
    ctx.fillRect(8, -4, 4, 4);
  }

  if (customColor) {
    // Strong tint pass so custom color is clearly visible on top of archetype art.
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = 0.34;
    ctx.fillStyle = customColor;
    ctx.fillRect(-36, -30, 72, 60);
    ctx.restore();

    ctx.globalAlpha = 0.58;
    ctx.strokeStyle = customColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(11, e.size * 0.95), 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  if (customEmoji) {
    ctx.textAlign = 'center';
    ctx.font = '700 12px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 4;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(customEmoji, 0, -Math.max(16, e.size + 6));
    ctx.shadowBlur = 0;
  }

  if (e.hp < e.maxHp) {
    const bw = 30;
    const bh = 4;
    ctx.fillStyle = 'rgba(6,12,18,0.92)';
    ctx.fillRect(-bw / 2, -24, bw, bh);
    const hpFill = ctx.createLinearGradient(-bw / 2, 0, bw / 2, 0);
    hpFill.addColorStop(0, '#ff8c66');
    hpFill.addColorStop(1, '#7de3ff');
    ctx.fillStyle = hpFill;
    ctx.fillRect(-bw / 2, -24, bw * (e.hp / e.maxHp), bh);
  }

  ctx.restore();
}

function rockNoise(x, index, salt = 0) {
  return Math.sin(x * 0.037 + index * 2.17 + salt) * 0.5 + 0.5;
}

function drawCinematicGrade(ctx, width, height, frame, speed, lowFx = false) {
  ctx.save();

  const dustSpeed = Math.max(1, speed || PIPE_SPEED_BASE);
  ctx.globalAlpha = lowFx ? 0.12 : 0.18;
  ctx.strokeStyle = 'rgba(190,235,255,0.18)';
  ctx.lineWidth = 1;
  for (let i = 0; i < (lowFx ? 12 : 26); i++) {
    const y = 30 + ((i * 37 + frame * 0.42) % (height - 92));
    const x = ((i * 173 - frame * dustSpeed * 1.35) % (width + 180)) - 90;
    const len = 18 + rockNoise(i, frame * 0.02, 19) * 42;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y - 1.5);
    ctx.stroke();
  }

  ctx.globalAlpha = lowFx ? 0.05 : 0.08;
  ctx.fillStyle = '#d9f8ff';
  for (let y = 1; y < height; y += (lowFx ? 8 : 4)) {
    ctx.fillRect(0, y, width, 1);
  }

  ctx.globalAlpha = 1;
  const tunnelWash = ctx.createLinearGradient(0, 0, width, height);
  tunnelWash.addColorStop(0, 'rgba(125,227,255,0.08)');
  tunnelWash.addColorStop(0.42, 'rgba(0,0,0,0)');
  tunnelWash.addColorStop(1, 'rgba(255,126,74,0.07)');
  ctx.fillStyle = tunnelWash;
  ctx.fillRect(0, 0, width, height);

  const vignette = ctx.createRadialGradient(
    width * 0.48,
    height * 0.46,
    width * 0.22,
    width * 0.5,
    height * 0.5,
    width * 0.74
  );
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(0.62, 'rgba(0,0,0,0.12)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.58)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  ctx.restore();
}

function drawTunnelRim(ctx, x, y, width, side) {
  ctx.save();
  ctx.globalAlpha = 0.92;
  ctx.strokeStyle = side === 'top' ? 'rgba(187,242,255,0.66)' : 'rgba(255,202,144,0.54)';
  ctx.lineWidth = 5;
  ctx.shadowColor = side === 'top' ? '#7de3ff' : '#ffc785';
  ctx.shadowBlur = 14;

  ctx.beginPath();
  ctx.moveTo(x - 16, y);
  ctx.lineTo(x + width + 16, y);
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 16, y + (side === 'top' ? 4 : -4));
  ctx.lineTo(x + width + 16, y + (side === 'top' ? 4 : -4));
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.62;
  ctx.fillStyle = side === 'top' ? 'rgba(192,246,255,0.78)' : 'rgba(255,212,160,0.68)';
  for (let i = 0; i < 4; i++) {
    const px = x + 6 + i * (width / 3);
    ctx.fillRect(px - 4, y - 2, 8, 4);
  }
  ctx.restore();
}

function drawTunnelWall(ctx, x, startY, width, height, side, frame, lowFx = false) {
  if (height <= 0) return;

  const endY = startY + height;
  const edgeY = side === 'top' ? endY : startY;

  if (lowFx) {
    ctx.save();
    ctx.fillStyle = side === 'top' ? '#1b2d3a' : '#2b2a24';
    ctx.fillRect(x - 2, startY, width + 4, height);
    ctx.fillStyle = side === 'top' ? '#7de3ff' : '#ffc785';
    if (side === 'top') {
      ctx.fillRect(x - 2, Math.max(startY + 2, edgeY - 4), width + 4, 2);
    } else {
      ctx.fillRect(x - 2, Math.min(endY - 2, edgeY + 2), width + 4, 2);
    }
    ctx.restore();
    return;
  }

  ctx.save();
  const wallGradient = ctx.createLinearGradient(x, startY, x + width, endY);
  wallGradient.addColorStop(0, '#050a10');
  wallGradient.addColorStop(0.18, '#182838');
  wallGradient.addColorStop(0.48, '#61717d');
  wallGradient.addColorStop(0.72, '#1b2e3e');
  wallGradient.addColorStop(1, '#050a0f');
  ctx.fillStyle = wallGradient;
  ctx.shadowColor = 'rgba(0,10,16,0.88)';
  ctx.shadowBlur = 18;
  ctx.fillRect(x - 18, startY, width + 36, height);

  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(235,248,255,0.2)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x - 18, startY, width + 36, height);

  const bevel = ctx.createLinearGradient(x - 18, startY, x + width + 18, startY);
  bevel.addColorStop(0, 'rgba(255,255,255,0.08)');
  bevel.addColorStop(0.18, 'rgba(0,0,0,0.24)');
  bevel.addColorStop(0.5, 'rgba(255,255,255,0.12)');
  bevel.addColorStop(0.82, 'rgba(0,0,0,0.28)');
  bevel.addColorStop(1, 'rgba(255,255,255,0.06)');
  ctx.fillStyle = bevel;
  ctx.globalAlpha = 0.74;
  ctx.fillRect(x - 18, startY, width + 36, height);

  ctx.globalAlpha = 0.62;
  ctx.strokeStyle = 'rgba(174,230,248,0.16)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const panelY = startY + 12 + i * Math.max(18, height / 4);
    if (panelY > endY - 8) continue;
    ctx.beginPath();
    ctx.moveTo(x - 12, panelY);
    ctx.lineTo(x + width + 12, panelY + Math.sin(frame * 0.03 + i) * 2);
    ctx.stroke();
  }

  ctx.globalAlpha = 0.38;
  ctx.fillStyle = 'rgba(3,8,12,0.68)';
  const edgeShadowY = side === 'top' ? edgeY - 18 : edgeY;
  ctx.fillRect(x - 22, edgeShadowY, width + 44, 18);

  ctx.globalAlpha = 0.72;
  ctx.fillStyle = 'rgba(220,240,245,0.38)';
  for (let i = 0; i < 6; i++) {
    const rivetX = x - 8 + i * ((width + 16) / 5);
    const rivetY = side === 'top'
      ? Math.max(startY + 12, edgeY - 44)
      : Math.min(endY - 12, edgeY + 42);
    ctx.beginPath();
    ctx.arc(rivetX, rivetY, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  const glow = 0.22 + Math.sin(frame * 0.04 + x * 0.03) * 0.08;
  ctx.globalAlpha = 0.82;
  ctx.shadowColor = side === 'top' ? '#7de3ff' : '#ffc785';
  ctx.shadowBlur = 12;
  ctx.fillStyle = side === 'top'
    ? `rgba(125,227,255,${glow})`
    : `rgba(255,199,133,${glow})`;
  if (side === 'top') {
    ctx.fillRect(x - 8, Math.max(startY + 8, edgeY - 28), width + 16, 5);
  } else {
    ctx.fillRect(x - 8, Math.min(endY - 14, edgeY + 22), width + 16, 5);
  }

  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.34;
  ctx.fillStyle = 'rgba(230,245,255,0.45)';
  for (let i = 0; i < 3; i++) {
    const px = x + 6 + i * (width / 2);
    ctx.fillRect(px, startY + 10, 3, Math.max(8, height - 20));
  }

  ctx.restore();

  drawTunnelRim(ctx, x, edgeY, width, side);
}

function drawTunnelPassage(ctx, passage, gameHeight, frame, lowFx = false, fxProfile = null) {
  const { x, topHeight, gap } = passage;
  const bottomY = topHeight + gap;
  const groundY = gameHeight - GROUND_HEIGHT;
  const isMoving = Boolean(passage.dynamic);
  const minimal = Boolean(fxProfile?.minimal);
  const pulse = 0.6 + Math.sin(frame * 0.055 + x * 0.02) * 0.12;

  drawTunnelWall(ctx, x, 0, PIPE_WIDTH, topHeight, 'top', frame, lowFx);
  drawTunnelWall(ctx, x, bottomY, PIPE_WIDTH, groundY - bottomY, 'bottom', frame, lowFx);

  if (isMoving) {
    ctx.save();
    if (minimal) {
      ctx.globalAlpha = 0.38;
      ctx.fillStyle = '#ff8452';
      ctx.fillRect(x - 6, topHeight + gap / 2 - 1, PIPE_WIDTH + 12, 2);
    } else {
      ctx.globalAlpha = lowFx ? 0.42 : 0.36 + pulse * 0.16;
      ctx.strokeStyle = 'rgba(255,132,82,0.62)';
      ctx.lineWidth = lowFx ? 2 : 3;
      ctx.setLineDash(lowFx ? [] : [10, 8]);
      ctx.beginPath();
      ctx.moveTo(x - 22, topHeight + gap / 2);
      ctx.lineTo(x + PIPE_WIDTH + 22, topHeight + gap / 2);
      ctx.stroke();
    }

    if (!lowFx) {
      ctx.shadowColor = '#ff8452';
      ctx.shadowBlur = 14;
      ctx.fillStyle = 'rgba(255,132,82,0.72)';
      ctx.fillRect(x - 18, topHeight + gap / 2 - 2, 8, 4);
      ctx.fillRect(x + PIPE_WIDTH + 10, topHeight + gap / 2 - 2, 8, 4);
    }
    ctx.restore();
  }

  if (lowFx) {
    return;
  }

  const mist = ctx.createLinearGradient(x - 24, topHeight, x + PIPE_WIDTH + 24, bottomY);
  mist.addColorStop(0, 'rgba(125,227,255,0)');
  mist.addColorStop(0.5, `rgba(177,232,245,${0.08 + pulse * 0.08})`);
  mist.addColorStop(1, 'rgba(255,199,133,0)');
  ctx.save();
  ctx.fillStyle = mist;
  ctx.fillRect(x - 24, topHeight, PIPE_WIDTH + 48, gap);
  ctx.restore();
}

function drawSignalMarker(ctx, x, y, size, color, frame) {
  const pulse = 0.65 + Math.sin(frame * 0.04 + x * 0.02) * 0.18;

  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 14 * pulse;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.34;

  ctx.lineWidth = 1.5;
  ctx.strokeRect(x - size * 0.6, y - size * 0.26, size * 1.2, size * 0.52);
  ctx.globalAlpha = 0.72;
  ctx.fillRect(x - size * 0.36, y - 1.5, size * 0.72, 3);
  ctx.beginPath();
  ctx.arc(x, y, size * 0.2 + pulse * 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawBackground(
  ctx,
  width,
  height,
  frame,
  scrollX,
  lowFx = false,
  fxProfile = null,
  renderCache = null
) {
  const minimal = Boolean(fxProfile?.minimal);
  if (lowFx) {
    const groundY = height - GROUND_HEIGHT;
    ctx.fillStyle = '#03080f';
    ctx.fillRect(0, 0, width, height);

    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = '#2d4e61';
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const y = 34 + i * 52;
      const drift = ((i * 68 - scrollX * 0.24) % (width + 120)) - 60;
      ctx.beginPath();
      ctx.moveTo(drift, y);
      ctx.lineTo(drift + 90, y + 8);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    ctx.fillStyle = '#0b1c2a';
    ctx.fillRect(0, groundY - 8, width, height - groundY + 8);
    ctx.fillStyle = '#7de3ff';
    for (let i = 0; i < 5; i++) {
      const x = ((i * 150 - scrollX * 0.55) % (width + 170)) - 80;
      ctx.fillRect(x, groundY - 2, 44, 2);
    }
    return;
  }

  const cache = renderCache || {};
  if (!cache.bgMain) {
    const bgMain = ctx.createLinearGradient(0, 0, 0, height);
    bgMain.addColorStop(0, '#01040a');
    bgMain.addColorStop(0.3, '#071525');
    bgMain.addColorStop(0.62, '#0b1520');
    bgMain.addColorStop(1, '#020407');
    cache.bgMain = bgMain;
  }
  const bg = cache.bgMain;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const groundY = height - GROUND_HEIGHT;

  if (!minimal) {
    ctx.save();
    if (!cache.bgDepthGlow) {
      const depthGlow = ctx.createRadialGradient(
        width * 0.58,
        height * 0.47,
        18,
        width * 0.52,
        height * 0.5,
        width * 0.75
      );
      depthGlow.addColorStop(0, 'rgba(190,242,255,0.28)');
      depthGlow.addColorStop(0.28, 'rgba(50,118,156,0.17)');
      depthGlow.addColorStop(0.66, 'rgba(6,18,28,0.22)');
      depthGlow.addColorStop(1, 'rgba(0,0,0,0)');
      cache.bgDepthGlow = depthGlow;
    }
    ctx.fillStyle = cache.bgDepthGlow;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  ctx.save();
  const horizonY = groundY * 0.53;
  ctx.strokeStyle = 'rgba(146,220,246,0.12)';
  ctx.lineWidth = 1;
  for (let i = -2; i < 12; i++) {
    const x = ((i * 96 - scrollX * 0.36) % (width + 180)) - 90;
    const ribAlpha = 0.2 + (i % 3) * 0.06;
    ctx.globalAlpha = ribAlpha;
    ctx.fillStyle = 'rgba(16,35,52,0.9)';
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 42, 0);
    ctx.lineTo(x + 86, horizonY);
    ctx.lineTo(x + 44, groundY);
    ctx.lineTo(x, groundY);
    ctx.lineTo(x + 40, horizonY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.globalAlpha = 0.66;
    ctx.strokeStyle = i % 2 === 0 ? 'rgba(125,227,255,0.34)' : 'rgba(255,176,102,0.22)';
    ctx.lineWidth = i % 2 === 0 ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x + 43, 0);
    ctx.lineTo(x + 70, horizonY);
    ctx.lineTo(x + 43, groundY);
    ctx.stroke();

    ctx.globalAlpha = 0.26;
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(x + 50, 0, 8, groundY);
  }
  ctx.restore();

  if (!minimal) {
    ctx.save();
    ctx.globalAlpha = 0.34;
    ctx.strokeStyle = 'rgba(210,238,248,0.16)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 9; i++) {
      const yTop = 22 + i * 18;
      const yBottom = groundY - 22 - i * 15;
      ctx.beginPath();
      ctx.moveTo(0, yTop);
      ctx.lineTo(width * 0.57, horizonY - i * 2);
      ctx.lineTo(width, yTop + 14);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, yBottom);
      ctx.lineTo(width * 0.57, horizonY + i * 2);
      ctx.lineTo(width, yBottom - 12);
      ctx.stroke();
    }
    ctx.restore();

    if (!cache.bgHaze) {
      const haze = ctx.createLinearGradient(0, 70, 0, groundY);
      haze.addColorStop(0, 'rgba(190,232,245,0.06)');
      haze.addColorStop(0.45, 'rgba(135,194,212,0.13)');
      haze.addColorStop(1, 'rgba(255,176,102,0.08)');
      cache.bgHaze = haze;
    }
    ctx.fillStyle = cache.bgHaze;
    ctx.fillRect(0, 0, width, groundY);
  }

  ctx.save();
  for (let i = 0; i < (minimal ? 4 : 12); i++) {
    const markerX = ((i * 132 - scrollX * 0.26) % (width + 180)) - 80;
    const markerY = i % 2 === 0 ? groundY - 56 : 42;
    const color = i % 3 === 0 ? '#7de3ff' : i % 3 === 1 ? '#ffc785' : '#b4f2ff';
    drawSignalMarker(ctx, markerX, markerY, 12 + rockNoise(i, 7, 31) * 8, color, frame);
  }
  ctx.restore();

  ctx.save();
  if (!cache.bgFloor) {
    const floor = ctx.createLinearGradient(0, groundY - 28, 0, height);
    floor.addColorStop(0, 'rgba(85,105,120,0.76)');
    floor.addColorStop(0.3, '#132434');
    floor.addColorStop(0.68, '#071018');
    floor.addColorStop(1, '#05070a');
    cache.bgFloor = floor;
  }
  const floor = cache.bgFloor;
  ctx.fillStyle = floor;
  ctx.fillRect(0, groundY - 24, width, height - groundY + 24);

  ctx.strokeStyle = 'rgba(194,235,248,0.22)';
  ctx.lineWidth = 1;
  for (let i = -1; i < 14; i++) {
    const x = ((i * 82 - scrollX * 0.58) % (width + 130)) - 70;
    const y = groundY - 18 + (i % 3) * 9;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 62, y + 8);
    ctx.stroke();
  }
  ctx.shadowColor = '#7de3ff';
  ctx.shadowBlur = 14;
  ctx.fillStyle = 'rgba(125,227,255,0.34)';
  for (let i = -1; i < 9; i++) {
    const x = ((i * 120 - scrollX * 0.8) % (width + 150)) - 75;
    ctx.fillRect(x, groundY - 4, 54, 3);
  }

  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.32;
  ctx.fillStyle = 'rgba(0,0,0,0.86)';
  ctx.fillRect(0, groundY + 24, width, height - groundY);
  ctx.restore();
}

function drawHUD(
  ctx,
  score,
  shields,
  kills,
  width,
  streakCount,
  blastReady,
  tunnelBombActive,
  tunnelBombTimer,
  weaponId,
  zapCharge,
  zapMax,
  comboSpecialId,
  comboSpecialUses,
  engineBurstCharges,
  lowFx = false
) {
  ctx.save();
  if (lowFx) {
    ctx.fillStyle = 'rgba(5,12,18,0.72)';
    ctx.fillRect(8, 8, 110, 24);
    ctx.fillRect(width - 118, 8, 110, 24);
    ctx.fillRect(width / 2 - 64, 8, 128, 26);

    ctx.font = '600 11px JetBrains Mono, monospace';
    ctx.fillStyle = '#eaf6ff';
    ctx.textAlign = 'left';
    ctx.fillText(`HP ${Math.max(0, shields)}`, 14, 24);
    ctx.textAlign = 'center';
    ctx.fillText(`SCORE ${score}`, width / 2, 25);
    ctx.textAlign = 'right';
    ctx.fillText(`KILLS ${kills}`, width - 14, 24);

    ctx.fillStyle = blastReady ? '#ff88ff' : 'rgba(255,255,255,0.24)';
    ctx.fillRect(width / 2 - 58, 36, 36, 3);
    ctx.fillStyle = comboSpecialUses > 0 ? '#ffb27f' : 'rgba(255,255,255,0.24)';
    ctx.fillRect(width / 2 - 18, 36, 36, 3);
    ctx.fillStyle = engineBurstCharges > 0 ? '#7de3ff' : 'rgba(255,255,255,0.24)';
    ctx.fillRect(width / 2 + 22, 36, 36, 3);

    ctx.restore();
    return;
  }

  const framePanel = (x, y, w, h, accent) => {
    ctx.save();
    ctx.fillStyle = 'rgba(7,14,20,0.62)';
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 12, y);
    ctx.lineTo(x + w - 12, y);
    ctx.lineTo(x + w, y + 12);
    ctx.lineTo(x + w, y + h - 12);
    ctx.lineTo(x + w - 12, y + h);
    ctx.lineTo(x + 12, y + h);
    ctx.lineTo(x, y + h - 12);
    ctx.lineTo(x, y + 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  };

  framePanel(12, 10, 112, 40, 'rgba(125,227,255,0.32)');
  framePanel(width - 132, 10, 120, 46, 'rgba(255,148,108,0.3)');
  framePanel(width / 2 - 78, 10, 156, 44, 'rgba(220,240,255,0.28)');

  ctx.font = '700 10px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(190,220,235,0.72)';
  ctx.fillText('MISSION SCORE', width / 2, 24);

  ctx.font = '700 26px Orbitron, monospace';
  ctx.shadowColor = 'rgba(180,235,255,0.65)';
  ctx.shadowBlur = 14;
  ctx.fillStyle = '#f3fbff';
  ctx.fillText(score, width / 2, 46);
  ctx.shadowBlur = 0;

  ctx.font = '600 10px JetBrains Mono, monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(180,230,245,0.7)';
  ctx.fillText('SHIELDS', 22, 24);

  for (let i = 0; i < MAX_SHIELDS; i++) {
    const sx = 24 + i * 26;
    ctx.shadowColor = i < shields ? '#7de3ff' : 'transparent';
    ctx.shadowBlur = i < shields ? 10 : 0;
    ctx.fillStyle = i < shields ? 'rgba(125,227,255,0.95)' : 'rgba(40,58,68,0.6)';
    ctx.beginPath();
    ctx.moveTo(sx, 18);
    ctx.lineTo(sx + 8, 14);
    ctx.lineTo(sx + 16, 18);
    ctx.lineTo(sx + 13, 30);
    ctx.lineTo(sx + 3, 30);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  ctx.fillStyle = 'rgba(190,220,235,0.72)';
  ctx.fillText(`ARMOR ${shields}/${MAX_SHIELDS}`, 22, 42);

  ctx.textAlign = 'right';
  ctx.font = '600 10px JetBrains Mono, monospace';
  ctx.fillStyle = 'rgba(255,196,170,0.72)';
  ctx.fillText('HOSTILES NEUTRALIZED', width - 22, 22);
  ctx.font = '700 18px Orbitron, monospace';
  ctx.shadowColor = 'rgba(255,160,120,0.55)';
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#ffb066';
  ctx.fillText(String(kills), width - 22, 44);
  ctx.shadowBlur = 0;

  const dotColors = ['#7de3ff', '#ffb066', '#f5ec8e'];
  for (let i = 0; i < BLAST_STREAK; i++) {
    const filled = i < streakCount;
    ctx.shadowColor = filled ? dotColors[i] : 'transparent';
    ctx.shadowBlur = filled ? 8 : 0;
    ctx.fillStyle = filled ? dotColors[i] : 'rgba(36,45,52,0.8)';
    ctx.beginPath();
    ctx.arc(width - 24 - i * 18, 58, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  if (blastReady) {
    ctx.textAlign = 'right';
    framePanel(width - 170, 66, 158, 24, 'rgba(255,178,120,0.28)');
    ctx.shadowColor = 'rgba(255,176,120,0.55)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffb066';
    ctx.font = '700 10px Orbitron, monospace';
    ctx.fillText('SHOCKWAVE READY [B]', width - 22, 82);
    ctx.shadowBlur = 0;
  }

  if (tunnelBombActive) {
    ctx.textAlign = 'left';
    framePanel(12, 66, 148, 24, 'rgba(255,178,120,0.28)');
    ctx.shadowColor = 'rgba(255,176,120,0.55)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#ffb066';
    ctx.font = '700 10px Orbitron, monospace';
    const secs = Math.ceil(tunnelBombTimer / 60);
    ctx.fillText(`WIDE CORRIDOR ${secs}s`, 22, 82);
    ctx.shadowBlur = 0;
  }

  if (weaponId === 'lightning') {
    drawChargeBar(ctx, 0, 58, zapCharge, zapMax, width);
  }

  if (comboSpecialId && comboSpecialUses > 0) {
    const specialLabelMap = {
      teleport_blink: 'BLINK',
      sonic_boom: 'SONIC',
      missile_barrage: 'MISSILE',
      screen_nuke: 'NUKE',
      chain_lightning_storm: 'STORM',
    };
    const specialLabel = specialLabelMap[comboSpecialId] || 'SPECIAL';
    ctx.textAlign = 'left';
    framePanel(12, 94, 120, 24, 'rgba(125,227,255,0.28)');
    ctx.shadowColor = '#99ddff';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#99ddff';
    ctx.font = '700 10px Orbitron, monospace';
    ctx.fillText(`${specialLabel} [Q] ${comboSpecialUses}`, 22, 110);
    ctx.shadowBlur = 0;
  }

  if ((engineBurstCharges || 0) > 0) {
    ctx.textAlign = 'right';
    framePanel(width - 174, 94, 162, 24, 'rgba(255,205,130,0.3)');
    ctx.shadowColor = '#ffd791';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#ffd791';
    ctx.font = '700 10px Orbitron, monospace';
    ctx.fillText(`EVADE BURST x${engineBurstCharges}`, width - 22, 110);
    ctx.shadowBlur = 0;
  }

  ctx.restore();
}

function drawPerfOverlay(ctx, game, width) {
  if (!SHOW_PERF_OVERLAY || !game) return;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.66)';
  ctx.fillRect(10, 132, 208, 86);
  ctx.strokeStyle = 'rgba(120,220,255,0.45)';
  ctx.strokeRect(10, 132, 208, 86);
  ctx.fillStyle = '#aff6ff';
  ctx.font = '600 10px JetBrains Mono, monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`FPS ${game.perfOverlayFps || 0}`, 18, 148);
  ctx.fillText(`SKIP ${game.perfFrameSkipActive ? 'true' : 'false'}`, 18, 162);
  ctx.fillText(`PART ${game.particles?.length || 0}`, 18, 176);
  ctx.fillText(
    `PROJ ${(game.bullets?.length || 0) + (game.enemyBullets?.length || 0) + (game.rockets?.length || 0)}`,
    18,
    190
  );
  ctx.fillText(`ENEMIES ${game.enemies?.length || 0}`, 18, 204);
  ctx.fillText(`DPR ${(Number(game.renderDpr || 1)).toFixed(2)}`, width - 90, 148);
  ctx.restore();
}

function getDifficultyTier(score) {
  if (score < 8) {
    return {
      speed: PIPE_SPEED_BASE,
      pipeSpawnMin: 112,
      pipeSpawnDecay: 1.1,
      enemySpawnMin: 120,
      enemySpawnDecay: 2.1,
      seekerBias: 0.16,
      bomberBias: 0.03,
    };
  }

  if (score < 20) {
    return {
      speed: PIPE_SPEED_BASE + 0.45,
      pipeSpawnMin: 106,
      pipeSpawnDecay: 1.25,
      enemySpawnMin: 110,
      enemySpawnDecay: 2.3,
      seekerBias: 0.22,
      bomberBias: 0.06,
    };
  }

  if (score < 35) {
    return {
      speed: PIPE_SPEED_BASE + 0.85,
      pipeSpawnMin: 100,
      pipeSpawnDecay: 1.35,
      enemySpawnMin: 102,
      enemySpawnDecay: 2.45,
      seekerBias: 0.28,
      bomberBias: 0.1,
    };
  }

  if (score < 80) {
    return {
      speed: PIPE_SPEED_BASE + 1.25,
      pipeSpawnMin: 92,
      pipeSpawnDecay: 1.55,
      enemySpawnMin: 96,
      enemySpawnDecay: 2.6,
      seekerBias: 0.35,
      bomberBias: 0.14,
    };
  }

  if (score < 120) {
    return {
      speed: PIPE_SPEED_BASE + 1.55,
      pipeSpawnMin: 86,
      pipeSpawnDecay: 1.7,
      enemySpawnMin: 90,
      enemySpawnDecay: 2.8,
      seekerBias: 0.4,
      bomberBias: 0.18,
    };
  }

  const speedTierStep = Math.floor((score - 120) / 25) + 1;

  return {
    speed: PIPE_SPEED_BASE + 1.55 + Math.min(speedTierStep * 0.16, 1.44),
    pipeSpawnMin: Math.max(66, 84 - speedTierStep * 2),
    pipeSpawnDecay: 1.78 + Math.min(speedTierStep * 0.04, 0.72),
    enemySpawnMin: Math.max(78, 88 - speedTierStep * 1.5),
    enemySpawnDecay: 2.9 + Math.min(speedTierStep * 0.07, 1.4),
    seekerBias: Math.min(0.62, 0.42 + speedTierStep * 0.02),
    bomberBias: Math.min(0.32, 0.2 + speedTierStep * 0.01),
  };
}

export default function GameCanvas({
  onGameOver,
  onScore,
  gameState,
  skinId,
  isMobileDevice = false,
  onBlastReadyChange,
  onComboSpecialReadyChange,
  jumpRef,
  shootRef,
  shootStartRef,
  shootStopRef,
  blastRef,
  onTunnelBombReadyChange,
  tunnelBombRef,
  comboSpecialRef,
  reviveRef,
}) {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const nativePlatform = getNativePlatform();
  const isIOSPerformanceMode = nativePlatform === 'ios' && readLowPerformanceOverride();
  const renderScale = isIOSPerformanceMode ? IOS_RENDER_SCALE : 1;
  const renderDpr = getClampedDevicePixelRatio(isIOSPerformanceMode);
  const renderWidth = Math.round(GAME_WIDTH * renderScale * renderDpr);
  const renderHeight = Math.round(GAME_HEIGHT * renderScale * renderDpr);
  const settingsRef = useRef(loadSettings());
  const previousGameStateRef = useRef(gameState);
  const canAcceptRunInput = gameState === 'ready' || gameState === 'playing';

  useEffect(() => {
    const syncSettings = () => {
      settingsRef.current = loadSettings();
    };

    syncSettings();
    window.addEventListener('firepilot-settings-changed', syncSettings);
    window.addEventListener('storage', syncSettings);

    return () => {
      window.removeEventListener('firepilot-settings-changed', syncSettings);
      window.removeEventListener('storage', syncSettings);
    };
  }, []);

  function makeInitialState() {
    const selectedWeaponId = getSelectedWeapon();
    const baseEquipped = getEquippedUpgrades();
    const selectedSpecialId = getSelectedSpecial();
    const selectedSpecialQty = selectedSpecialId ? getSpecialQty(selectedSpecialId) : 0;

    let comboWeaponId = null;
    const comboUpgradeCounts = {};
    let comboSpecialId = null;

    const activeComboIds = getActiveComboIds();
    const selectedComboId = getSelectedCombo();
    const comboIdToApply =
      selectedComboId && activeComboIds.includes(selectedComboId)
        ? selectedComboId
        : (activeComboIds[0] || '');
    const combo = COMBO_PACKS.find((c) => c.id === comboIdToApply);

    if (combo && Array.isArray(combo.contents)) {
      for (const item of combo.contents) {
        if (!item || !item.category || !item.id) continue;

        if (item.category === 'weapon' && !comboWeaponId) {
          comboWeaponId = item.id;
        } else if (item.category === 'upgrade') {
          const qty = Math.max(1, Number(item.qty || 1));
          comboUpgradeCounts[item.id] = (comboUpgradeCounts[item.id] || 0) + qty;
        } else if (item.category === 'special' && !comboSpecialId) {
          comboSpecialId = item.id;
        }
      }
    }

    const equipped = {
      ...baseEquipped,
      ...comboUpgradeCounts,
    };

    const damageBonus =
      (equipped.damage_boost_mk2 || 0) * 0.45 +
      (equipped.damage_boost_mk3 || 0) * 0.75;
    const fireRateReduction = Math.min(0.35, (equipped.fire_rate_enhancer || 0) * 0.08);
    const fireRateMultiplier = Math.max(0.65, 1 - fireRateReduction);
    const jumpBoost =
      (equipped.engine_boost_mk1 || 0) * 0.35 +
      (equipped.engine_boost_mk2 || 0) * 0.55 +
      (equipped.engine_boost_mk3 || 0) * 0.75 +
      (equipped.maneuver_thrusters || 0) * 0.2;
    const engineBurstCharges =
      (equipped.engine_boost_mk3 || 0) > 0
        ? 4
        : (equipped.engine_boost_mk2 || 0) > 0
          ? 3
          : (equipped.engine_boost_mk1 || 0) > 0
            ? 2
            : 0;
    const armorBonusHits =
      (equipped.armor_mk1 || 0) +
      (equipped.armor_mk2 || 0) * 2 +
      (equipped.armor_mk3 || 0) * 3 +
      (equipped.shield_generator || 0) +
      (equipped.advanced_shield_core || 0) * 2;
    const shieldPulseLevel =
      (equipped.shield_generator || 0) +
      (equipped.advanced_shield_core || 0) * 2;
    const baseOrbitalDroneTier =
      (equipped.orbital_drone_mk3 || 0) > 0 ? 3 :
      (equipped.orbital_drone_mk2 || 0) > 0 ? 2 :
      (equipped.orbital_drone_mk1 || 0) > 0 ? 1 :
      0;
    const orbitalDroneTier = isIOSPerformanceMode ? 0 : baseOrbitalDroneTier;
    const orbitalDroneCount =
      orbitalDroneTier <= 0
        ? 0
        : orbitalDroneTier === 1
          ? 1
          : orbitalDroneTier === 2
            ? 3
            : 4;
    const orbitalDroneRespawns = orbitalDroneTier > 0 ? 3 : 0;
    const orbitalDroneTriggerRange =
      orbitalDroneTier >= 3 ? 132 : orbitalDroneTier === 2 ? 118 : 102;
    const energyOrbTier =
      (equipped.energy_orbs_mk3 || 0) > 0 ? 3 :
      (equipped.energy_orbs_mk2 || 0) > 0 ? 2 :
      (equipped.energy_orbs_mk1 || 0) > 0 ? 1 :
      0;
    const energyOrbCount =
      energyOrbTier <= 0
        ? 0
        : energyOrbTier === 1
          ? 2
          : energyOrbTier === 2
            ? 3
            : 4;
    const energyOrbDamage =
      energyOrbTier === 1
        ? 0.65
        : energyOrbTier === 2
          ? 0.9
          : energyOrbTier >= 3
            ? 1.2
            : 0;

    let weaponId = selectedWeaponId;
    const selectedWeaponDef = getWeapon(selectedWeaponId);

    if ((!selectedWeaponDef || selectedWeaponDef.live === false) && comboWeaponId) {
      const testWeapon = getWeapon(comboWeaponId);
      if (testWeapon && testWeapon.live !== false) {
        weaponId = comboWeaponId;
      }
    }

    const weaponDef = getWeapon(weaponId);

    let shieldLevel = 0;
    let shieldHitsLeft = 0;
    let shieldKillsEnemies = false;
    let shieldDurationLeft = 0;

    if (equipped.shield2 > 0) {
      shieldLevel = 2;
      shieldHitsLeft = 3;
      shieldKillsEnemies = true;
      shieldDurationLeft = 7200;
    } else if (equipped.shield1 > 0) {
      shieldLevel = 1;
      shieldHitsLeft = 1;
    }

    shieldHitsLeft += Math.max(0, armorBonusHits);

    if (!comboSpecialId && selectedSpecialId && selectedSpecialQty > 0) {
      comboSpecialId = selectedSpecialId;
    }

    const comboSpecialDef = comboSpecialId ? getSpecial(comboSpecialId) : null;
    let comboSpecialUses =
      Math.max(1, Number(comboSpecialDef?.uses || 1));
    let comboSpecialSource =
      !comboSpecialDef
        ? null
        : selectedSpecialId && selectedSpecialId === comboSpecialId && selectedSpecialQty > 0
        ? 'inventory'
        : 'combo';

    // Overcompensated iOS stability guard: never auto-enable blink special.
    if (isIOSPerformanceMode && comboSpecialId === 'teleport_blink') {
      comboSpecialId = null;
      comboSpecialUses = 0;
      comboSpecialSource = null;
    }

    const hasTunnelBomb = (equipped.tunnelbomb || 0) > 0;

    return {
      player: { x: 120, y: GAME_HEIGHT / 2, velocity: 0 },
      pipes: [],
      bullets: [],
      rockets: [],
      zapArcs: [],
      enemies: [],
      enemyBullets: [],
      particles: [],
      blasts: [],
      tunnelBombs: [],
      portalEffects: [],
      teleportWindup: null,
      started: false,
      frame: 0,
      scrollX: 0,
      score: 0,
      kills: 0,
      shields: shieldHitsLeft > 0 ? shieldHitsLeft : 0,
      shieldLevel,
      shieldHitsLeft,
      shieldKillsEnemies,
      shieldDurationLeft,
      armorBonusHits,
      shieldPulseLevel,
      shieldPulseCooldown: shieldPulseLevel > 0 ? 70 : 0,
      pipeTimer: 0,
      enemyTimer: 0,
      firstEnemySpawned: false,
      speed: PIPE_SPEED_BASE,
      invincible: 0,
      postTeleportFreeze: 0,
      killStreak: 0,
      blastReady: false,
      ended: false,
      reviveUsed: false,
      weaponId,
      weaponDef,
      comboSpecialId,
      comboSpecialUses,
      comboSpecialSource,
      pulseShotCycle: 0,
      burstPending: [],
      burstTimer: 0,
      autoHeld: false,
      mobileSteerTargetY: null,
      zapCharge: weaponDef.maxCharge || 0,
      zapCooldown: 0,
      lowFx: isIOSPerformanceMode,
      isIOSPerformanceMode,
      maxParticles: isIOSPerformanceMode ? MAX_PARTICLES_IOS : (isMobileDevice ? MAX_PARTICLES_MOBILE : MAX_PARTICLES),
      maxEnemyBullets: isIOSPerformanceMode ? MAX_ENEMY_BULLETS_IOS : (isMobileDevice ? MAX_ENEMY_BULLETS_MOBILE : Number.POSITIVE_INFINITY),
      maxZapArcs: isIOSPerformanceMode ? MAX_ZAP_ARCS_IOS : (isMobileDevice ? MAX_ZAP_ARCS_MOBILE : Number.POSITIVE_INFINITY),
      maxPlayerBullets: isIOSPerformanceMode ? MAX_PLAYER_BULLETS_IOS : (isMobileDevice ? MAX_PLAYER_BULLETS_MOBILE : Number.POSITIVE_INFINITY),
      maxBurstPending: isIOSPerformanceMode ? MAX_BURST_PENDING_IOS : (isMobileDevice ? MAX_BURST_PENDING_MOBILE : Number.POSITIVE_INFINITY),
      maxRockets: isIOSPerformanceMode ? MAX_ROCKETS_IOS : (isMobileDevice ? MAX_ROCKETS_MOBILE : Number.POSITIVE_INFINITY),
      maxEnemies: isIOSPerformanceMode ? MAX_ENEMIES_IOS : 12,
      maxBlasts: isIOSPerformanceMode ? MAX_BLASTS_IOS : MAX_BLASTS_DEFAULT,
      maxPortalEffects: isIOSPerformanceMode ? MAX_PORTAL_EFFECTS_IOS : MAX_PORTAL_EFFECTS_DEFAULT,
      blastResolveQueue: [],
      blastResolvePerFrame: isIOSPerformanceMode ? 2 : 4,
      damageBonus,
      mk1DamageKillsRemaining: (equipped.damage_boost_mk1 || 0) > 0 ? 10 : 0,
      fireRateMultiplier,
      jumpForce: JUMP_FORCE - jumpBoost,
      engineBurstCharges,
      engineBurstCooldown: 0,
      lastJumpFrame: -999,
      tunnelBombReady: hasTunnelBomb,
      tunnelBombActive: false,
      tunnelBombTimer: 0,
      pipeGap: PIPE_GAP,
      orbitalDroneTier,
      orbitalDroneTriggerRange,
      orbitalDrones: Array.from({ length: orbitalDroneCount }, (_, index) => ({
        slot: index,
        x: 120,
        y: GAME_HEIGHT / 2,
        vx: 0,
        vy: 0,
        speed: 7 + orbitalDroneTier * 0.7,
        state: 'orbit',
        targetId: null,
        respawnsLeft: orbitalDroneRespawns,
        respawnCooldown: 0,
      })),
      energyOrbTier,
      energyOrbCount,
      energyOrbDamage,
      swarmQueue: [],
      activeSwarm: null,
      swarmDelay: 0,
      swarmScriptIndex: 0,
      swarmDynamicNextScore: SWARM_DYNAMIC_START_SCORE,
      swarmEnabled: !isIOSPerformanceMode,
      scoreDirty: false,
      explosionSfxCooldown: 0,
      ultraLowFx: false,
      renderPerfLevel: 0,
      slowFrameStreak: 0,
      goodFrameStreak: 0,
      frameAvgMs: 16.67,
      frameAvgBuffer: new Float32Array(IOS_FRAME_AVG_WINDOW),
      frameAvgBufferIndex: 0,
      frameAvgBufferCount: 0,
      frameAvgBufferSum: 0,
      perfDegradeFrames: 0,
      perfRecoverFrames: 0,
      perfFrameSkipActive: false,
      perfOverlayFps: 0,
      perfOverlayFrameCounter: 0,
      perfOverlayElapsedMs: 0,
      renderDpr,
      perfLogFrameCounter: 0,
      perfLogFrameSumMs: 0,
      perfLogWorstMs: 0,
      tempPools: {
        enemyCandidates: [],
        splashCandidates: [],
        rocketCandidates: [],
        droneCandidates: [],
        orbCandidates: [],
      },
      renderCache: null,
    };
  }

  if (!gameRef.current) gameRef.current = makeInitialState();

  function pushParticle(game, particle) {
    if (game.particles.length >= game.maxParticles) {
      return;
    }
    game.particles.push(particle);
  }

  function pushEnemyBullet(game, bullet) {
    if (game.enemyBullets.length >= game.maxEnemyBullets) return;
    game.enemyBullets.push(bullet);
  }

  function pushZapArc(game, arc) {
    if (game.zapArcs.length >= game.maxZapArcs) {
      game.zapArcs.shift();
    }
    game.zapArcs.push(arc);
  }

  function pushBlastEffect(game, blast) {
    pushWithCap(game.blasts, blast, game.maxBlasts || MAX_BLASTS_DEFAULT);
  }

  function pushPortalEffect(game, portal) {
    pushWithCap(
      game.portalEffects,
      portal,
      game.maxPortalEffects || MAX_PORTAL_EFFECTS_DEFAULT
    );
  }

  function enqueueSwarm(game, plan) {
    game.swarmQueue.push(plan);
  }

  function isComboSpecialReady(game) {
    return Boolean(
      game &&
      !game.ended &&
      game.comboSpecialId &&
      (game.comboSpecialUses || 0) > 0 &&
      !game.teleportWindup
    );
  }

  function notifyComboSpecialReady(game) {
    onComboSpecialReadyChange && onComboSpecialReadyChange(isComboSpecialReady(game));
  }

  function markScoreDirty(game) {
    game.scoreDirty = true;
  }

  function explode(game, x, y, color1, color2, count = 12) {
    const burstCount = game.lowFx ? Math.max(3, Math.ceil(count * 0.4)) : count;
    const remainingCapacity = Math.max(0, game.maxParticles - game.particles.length);
    const spawnCount = Math.min(burstCount, remainingCapacity);
    if (spawnCount <= 0) return;

    for (let i = 0; i < spawnCount; i++) {
      const angle = (i / spawnCount) * Math.PI * 2;
      const speed = 1.5 + Math.random() * 3;
      pushParticle(game, {
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 25 + Math.floor(Math.random() * 15),
        color: i % 2 === 0 ? color1 : color2,
        type: 'explosion',
        size: 2 + Math.random() * 3,
      });
    }
  }

  function killEnemy(game, e, scoreBonus = 0) {
    explode(game, e.x, e.y, '#ff4400', '#ffff00', game.lowFx ? 10 : 16);
    e.dead = true;
    game.kills++;

    const baseScore = getEnemyBaseScore(e.type);

    game.score += baseScore + scoreBonus;
    markScoreDirty(game);
    game.killStreak++;
    if ((game.mk1DamageKillsRemaining || 0) > 0) {
      game.mk1DamageKillsRemaining--;
    }

    if (e.type === 'ground_turret') {
      const diamondReward = e.diamondReward ?? 1;
      addDiamonds(diamondReward);
      game.diamondsEarned = (game.diamondsEarned || 0) + diamondReward;
    }

    if ((game.explosionSfxCooldown || 0) <= 0) {
      playSfx('explosion');
      game.explosionSfxCooldown = game.lowFx ? 3 : 1;
    }

    const blastThreshold = game.ultraLowFx ? 8 : game.lowFx ? 6 : BLAST_STREAK;
    if (game.killStreak >= blastThreshold && !game.blastReady) {
      game.blastReady = true;
      game.killStreak = 0;
      onBlastReadyChange && onBlastReadyChange(true);
      playSfx('powerup');
    }

  }

  function pushPlayerBullet(game, overrides = {}) {
    if (game.bullets.length >= game.maxPlayerBullets) return;
    const def = game.weaponDef || {};
    const mk1Bonus =
      (game.mk1DamageKillsRemaining || 0) > 0
        ? Math.max(1, Math.ceil(Number(def.damage || 1) * 0.35))
        : 0;
    const adjustedDamage = Math.max(
      1,
      Number(def.damage || 1) + Number(game.damageBonus || 0) + mk1Bonus
    );

    const bullet = {
      x: game.player.x + PLAYER_SIZE / 2 + 4,
      y: game.player.y,
      spawnFrame: game.frame,
      weaponType: def.type || 'single',
      color: def.color || '#ffff00',
      vx: def.bulletSpeed || 14,
      vy: 0,
      damage: adjustedDamage,
      pierce: def.pierce || 0,
      splashRadius: def.splashRadius || 0,
      bounces: def.bounces || 0,
      hitIds: [],
      age: 0,
    };

    if (overrides && typeof overrides === 'object') {
      const keys = Object.keys(overrides);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        bullet[key] = overrides[key];
      }
    }

    game.bullets.push(bullet);
  }

  function getAdjustedFireRate(game, fallback = 8) {
    const base = Math.max(1, Number(fallback || 8));
    const multiplier = Math.max(0.65, Number(game.fireRateMultiplier || 1));
    return Math.max(2, Math.floor(base * multiplier));
  }

  function consumeActiveSpecialCharge(game, count = 1) {
    if (!game.comboSpecialId) return;

    game.comboSpecialUses = Math.max(0, (game.comboSpecialUses || 0) - Math.max(1, count));
    if (game.comboSpecialUses > 0) return;

    if (game.comboSpecialSource === 'inventory') {
      consumeSpecial(game.comboSpecialId, 1);
      const remainingQty = getSpecialQty(game.comboSpecialId);
      if (remainingQty > 0) {
        const specialDef = getSpecial(game.comboSpecialId);
        game.comboSpecialUses = Math.max(1, Number(specialDef?.uses || 1));
        notifyComboSpecialReady(game);
        return;
      }
    }

    game.comboSpecialId = null;
    game.comboSpecialUses = 0;
    game.comboSpecialSource = null;
    notifyComboSpecialReady(game);
  }

  function handleShieldHit(game) {
    if (game.shieldHitsLeft > 0) {
      game.shieldHitsLeft--;
      game.shields = game.shieldHitsLeft; // 🔥 sync UI

      game.invincible = 60;
      game.player.velocity = -3;

      playSfx('shield');

      if (game.shieldHitsLeft <= 0) {
        game.shieldLevel = 0;
        game.shieldKillsEnemies = false;
        game.shieldDurationLeft = 0;
      }

      return true;
    }

    return false;
  }

  function tryPortalRescue(game) {
    if (game.comboSpecialId !== 'teleport_blink') return false;
    if ((game.comboSpecialUses || 0) <= 0) return false;
    if (game.teleportWindup) return false;

    const nextPipe = getClosestForwardPipe(game.pipes, game.player.x + 10);

    if (!nextPipe) return false;

    const gapTop = nextPipe.topHeight;
    const gapBottom = nextPipe.topHeight + nextPipe.gap;
    const gapCenterY = (gapTop + gapBottom) / 2;

    const groundY = GAME_HEIGHT - GROUND_HEIGHT;
    const playerHalf = PLAYER_SIZE / 2;
    const minY = playerHalf + 8;
    const maxY = groundY - playerHalf - 8;

    const exitY = Math.max(minY, Math.min(maxY, gapCenterY));

    const desiredPlayerX = 120;
    const pipeClearance = 26;
    const worldShift =
      (nextPipe.x + PIPE_WIDTH + pipeClearance) - desiredPlayerX;

    game.teleportWindup = {
      framesLeft: 12,
      entryX: game.player.x,
      entryY: game.player.y,
      exitY,
      worldShift,
      desiredPlayerX,
    };

    pushPortalEffect(game, {
      x: game.player.x,
      y: game.player.y,
      life: 16,
      maxLife: 16,
      type: 'entry',
    });

    playSfx('powerup');

    // immediate safety so collisions this frame do not kill the player
    game.player.velocity = 0;
    game.invincible = Math.max(game.invincible, 20);

    return true;
  }

  function endRun(game) {
    if (game.ended) return true;

    game.ended = true;
    game.started = false;
    game.autoHeld = false;
    game.mobileSteerTargetY = null;

    playSfx('hit');
    notifyComboSpecialReady(game);
    onGameOver(game.score, game.kills, game.diamondsEarned || 0);

    return true;
  }

  const reviveRun = useCallback(() => {
    const game = gameRef.current;
    if (!game || !game.ended) return false;
    if (game.reviveUsed) return false;

    const groundY = GAME_HEIGHT - GROUND_HEIGHT;
    const playerHalf = PLAYER_SIZE / 2;
    const minY = playerHalf + 16;
    const maxY = groundY - playerHalf - 16;

    const nextPipe = getClosestForwardPipe(game.pipes, 150);

    let reviveY = GAME_HEIGHT / 2;

    if (nextPipe) {
      const gapTop = nextPipe.topHeight;
      const gapBottom = nextPipe.topHeight + nextPipe.gap;
      reviveY = Math.max(minY, Math.min(maxY, (gapTop + gapBottom) / 2));
    }

    game.player.x = 120;
    game.player.y = reviveY;
    game.player.velocity = 0;
    game.invincible = Math.max(game.invincible, 170);
    game.ended = false;
    game.started = true;
    game.reviveUsed = true;
    game.autoHeld = false;
    game.mobileSteerTargetY = null;
    game.postTeleportFreeze = 0;
    game.teleportWindup = null;
    game.enemyBullets = [];
    pushPortalEffect(game, {
      x: game.player.x,
      y: game.player.y,
      life: 28,
      maxLife: 28,
      type: 'exit',
    });

    if (game.tunnelBombActive) {
      game.tunnelBombActive = false;
      game.pipeGap = PIPE_GAP;
    }

    playSfx('powerup');
    onBlastReadyChange && onBlastReadyChange(game.blastReady);
    onTunnelBombReadyChange && onTunnelBombReadyChange(game.tunnelBombReady);
    notifyComboSpecialReady(game);

    return true;
  }, [onBlastReadyChange, onTunnelBombReadyChange]);

  const tunnelBomb = useCallback(() => {
    if (!canAcceptRunInput) return false;
    const game = gameRef.current;
    if (!game || game.ended) return false;
    if (!game.tunnelBombReady) return false;

    game.tunnelBombReady = false;
    onTunnelBombReadyChange && onTunnelBombReadyChange(false);
    consumeEquippedUpgrade('tunnelbomb');

    playSfx('powerup');

    game.tunnelBombs.push({
      x: game.player.x + PLAYER_SIZE,
      y: game.player.y,
      vx: 12,
      vy: -1,
      age: 0,
    });
    return true;
  }, [canAcceptRunInput, onTunnelBombReadyChange]);

  const activateComboSpecial = useCallback(() => {
    if (!canAcceptRunInput) return;

    const game = gameRef.current;
    if (!game || game.ended) return;

    if (!game.comboSpecialId) return;
    if ((game.comboSpecialUses || 0) <= 0) return;
    if (game.comboSpecialId === 'teleport_blink' && game.teleportWindup) return;

    const specialId = game.comboSpecialId;
    if (isIOSPerformanceMode && specialId === 'teleport_blink') return;

    if (specialId === 'sonic_boom') {
      let killsFromWave = 0;
      for (let i = 0; i < game.enemies.length; i++) {
        const enemy = game.enemies[i];
        if (enemy.dead) continue;
        const distance = Math.hypot(enemy.x - game.player.x, enemy.y - game.player.y);
        if (distance > 220) continue;
        killEnemy(game, enemy, 1);
        killsFromWave++;
      }
      compactArrayInPlace(game.enemies, (enemy) => !enemy.dead);
      if (killsFromWave > 0) {
        playSfx('blast');
      }
      consumeActiveSpecialCharge(game, 1);
      return;
    }

    if (specialId === 'missile_barrage') {
      for (let i = 0; i < 6; i++) {
        game.rockets.push({
          x: game.player.x - 6 - i * 4,
          y: game.player.y + (i % 2 === 0 ? -8 : 8),
          vx: 7.6 + i * 0.25,
          vy: (i % 2 === 0 ? -0.45 : 0.45),
          targetId: null,
          age: 0,
        });
      }
      playSfx('shoot');
      consumeActiveSpecialCharge(game, 1);
      return;
    }

    if (specialId === 'screen_nuke') {
      if (game.enemies.length > 0) {
        for (let i = 0; i < game.enemies.length; i++) {
          const enemy = game.enemies[i];
          if (!enemy.dead) {
            killEnemy(game, enemy, 2);
          }
        }
        game.enemies.length = 0;
        game.enemyBullets.length = 0;
        playSfx('explosion');
      }
      consumeActiveSpecialCharge(game, 1);
      return;
    }

    if (specialId === 'chain_lightning_storm') {
      const targets = getNearestEnemies(game.enemies, game.player.x, game.player.y, 4);
      for (let i = 0; i < targets.length; i++) {
        const enemy = targets[i];
        pushZapArc(game, createZapArc(game.player.x, game.player.y, enemy.x, enemy.y, 10));
        enemy.hp -= 3;
        if (enemy.hp <= 0) killEnemy(game, enemy, 1);
      }
      compactArrayInPlace(game.enemies, (enemy) => !enemy.dead);
      if (targets.length > 0) {
        playSfx('powerup');
      }
      consumeActiveSpecialCharge(game, 1);
      return;
    }

    if (specialId !== 'teleport_blink') return;
    if (isIOSPerformanceMode) return;
    if (!game.started || game.score < TELEPORT_MIN_SCORE) return;
    if (game.pipes.length < 2) return;

    const nextPipe = getClosestForwardPipe(game.pipes, game.player.x + 10);

    if (!nextPipe) return;

    const gapTop = nextPipe.topHeight;
    const gapBottom = nextPipe.topHeight + nextPipe.gap;
    const gapCenterY = (gapTop + gapBottom) / 2;

    const groundY = GAME_HEIGHT - GROUND_HEIGHT;
    const playerHalf = PLAYER_SIZE / 2;
    const minY = playerHalf + 8;
    const maxY = groundY - playerHalf - 8;

    const exitY = Math.max(minY, Math.min(maxY, gapCenterY));

    const desiredPlayerX = 120;
    const pipeClearance = 26;
    const worldShift =
      (nextPipe.x + PIPE_WIDTH + pipeClearance) - desiredPlayerX;

    game.teleportWindup = {
      framesLeft: 12,
      entryX: game.player.x,
      entryY: game.player.y,
      exitY,
      worldShift,
      desiredPlayerX,
    };

    pushPortalEffect(game, {
      x: game.player.x,
      y: game.player.y,
      life: 16,
      maxLife: 16,
      type: 'entry',
    });

    playSfx('powerup');
    notifyComboSpecialReady(game);
  }, [canAcceptRunInput]);

  const blast = useCallback(() => {
    if (!canAcceptRunInput) return;
    const game = gameRef.current;
    if (!game || game.ended) return;
    if (!game.blastReady) return;

    game.blastReady = false;
    game.killStreak = 0;
    onBlastReadyChange && onBlastReadyChange(false);

    playSfx('blast');

    if (!game.lowFx) {
      pushBlastEffect(game, {
        originX: game.player.x + PLAYER_SIZE,
        originY: game.player.y,
        life: 35,
        maxLife: 35,
      });
    }

    const enemyCount = game.enemies.length;
    if (enemyCount <= 0) {
      return;
    }

    const blastFxBudget = game.lowFx ? (game.ultraLowFx ? 0 : 2) : 10;
    const blastFxStep =
      blastFxBudget > 0 && enemyCount > blastFxBudget
        ? Math.ceil(enemyCount / blastFxBudget)
        : 1;
    const queuedKills = [];
    for (let index = 0; index < game.enemies.length; index++) {
      const e = game.enemies[index];
      queuedKills.push({
        x: e.x,
        y: e.y,
        score: getEnemyBaseScore(e.type),
        showFx: blastFxBudget > 0 && index % blastFxStep === 0,
      });
    }

    if (queuedKills.length > 0) {
      playSfx('explosion');
    }

    game.blastResolveQueue = queuedKills;
    if (game.lowFx) {
      game.blastResolvePerFrame = game.ultraLowFx ? 1 : 2;
    }
    game.enemies = [];
    game.enemyBullets = [];
    markScoreDirty(game);
  }, [canAcceptRunInput, onBlastReadyChange, onScore]);

  const shoot = useCallback(() => {
    if (!canAcceptRunInput) return;
    const game = gameRef.current;
    if (!game || game.ended) return;

    if (!game.started) {
      game.started = true;
    }

    const { weaponDef, weaponId } = game;

    if (weaponDef.type === 'lightning') {
      if (game.zapCooldown > 0) return;

      const def = weaponDef;
      const nearestTargets = getNearestEnemies(
        game.enemies,
        game.player.x,
        game.player.y,
        Math.max(1, def.chainCount || 1)
      );
      const primaryTarget = nearestTargets[0] || null;
      const maxChains = def.chainCount || 1;

      if (game.zapCharge > 0 && primaryTarget) {
        playSfx('shoot');

        for (const enemy of nearestTargets.slice(0, maxChains)) {
          pushZapArc(game, createZapArc(game.player.x, game.player.y, enemy.x, enemy.y, 8));
          enemy.hp -= def.damage || 2;
          if (enemy.hp <= 0) killEnemy(game, enemy);
        }

        game.zapCharge = Math.max(0, game.zapCharge - def.drainRate);
        game.zapCooldown = getAdjustedFireRate(game, weaponDef.fireRate);
        return;
      }

      playSfx('shoot');
      if (game.bullets.length >= game.maxPlayerBullets) {
        game.zapCooldown = Math.max(
          2,
          Math.floor(getAdjustedFireRate(game, weaponDef.fireRate || 6) * 0.75)
        );
        return;
      }
      game.bullets.push({
        x: game.player.x + PLAYER_SIZE / 2 + 4,
        y: game.player.y,
        spawnFrame: game.frame,
        weaponType: 'auto',
        color: '#00ffff',
        isAuto: true,
      });
      game.zapCooldown = Math.max(
        2,
        Math.floor(getAdjustedFireRate(game, weaponDef.fireRate || 6) * 0.75)
      );
      return;
    }

    const lastBullet = game.bullets[game.bullets.length - 1];
    if (lastBullet && game.frame - lastBullet.spawnFrame < getAdjustedFireRate(game, weaponDef.fireRate))
      return;

    const bx = game.player.x + PLAYER_SIZE / 2 + 4;
    const by = game.player.y;

    playSfx('shoot');

    if (weaponId === 'blaster') {
      pushPlayerBullet(game, {
        x: bx,
        y: by,
        weaponType: 'single',
        color: '#ffff00',
      });
    } else if (weaponId === 'blaster2') {
      pushPlayerBullet(game, {
        x: bx,
        y: by,
        weaponType: 'burst',
        color: '#0008ff',
      });

      if (game.burstPending.length < game.maxBurstPending) {
        game.burstPending.push({
          fireAtFrame: game.frame + 5,
          bullet: {
            x: bx + 20,
            y: by,
            weaponType: 'burst',
            color: '#3104fb',
          },
        });
      }
    } else if (weaponId === 'rocket') {
      pushPlayerBullet(game, {
        x: bx,
        y: by,
        weaponType: 'burst',
        color: '#ff0000',
      });

      if (game.burstPending.length < game.maxBurstPending) {
        game.burstPending.push({
          fireAtFrame: game.frame + 5,
          bullet: {
            x: bx + 20,
            y: by,
            weaponType: 'burst',
            color: '#1900ff',
          },
        });
      }

      const rocketOffsets = [-8, 8];
      for (let i = 0; i < rocketOffsets.length; i++) {
        const dy = rocketOffsets[i];
        if (game.rockets.length >= game.maxRockets) break;
        game.rockets.push({
          x: game.player.x - 8,
          y: game.player.y + dy,
          vx: 8,
          vy: 0,
          targetId: null,
          age: 0,
        });
      }

    } else if (weaponDef.type === 'auto') {
      pushPlayerBullet(game, {
        x: bx,
        y: by,
        weaponType: 'auto',
        color: '#00ffff',
        isAuto: true,
      });
    } else if (weaponDef.type === 'pulse') {
      game.pulseShotCycle = ((game.pulseShotCycle || 0) + 1) % 3;
      const chargedPulse = game.pulseShotCycle === 0;

      pushPlayerBullet(game, {
        x: bx,
        y: by,
        weaponType: 'pulse',
        color: chargedPulse ? '#a8ffff' : '#7df9ff',
        vx: chargedPulse ? 20 : 18,
        damage: chargedPulse
          ? Math.max(2, Number(weaponDef.damage || 1) + 1 + Number(game.damageBonus || 0))
          : Math.max(1, Number(weaponDef.damage || 1) + Number(game.damageBonus || 0)),
        splashRadius: chargedPulse ? 62 : 38,
        pierce: chargedPulse ? 1 : 0,
      });
    } else if (weaponDef.type === 'flak') {
      const pellets = weaponDef.pelletCount || 5;
      const center = (pellets - 1) / 2;

      for (let i = 0; i < pellets; i++) {
        pushPlayerBullet(game, {
          x: bx,
          y: by,
          weaponType: 'flak',
          vx: weaponDef.bulletSpeed || 13,
          vy: (i - center) * (weaponDef.spread || 3),
        });
      }
    } else if (weaponDef.type === 'ricochet') {
      pushPlayerBullet(game, {
        x: bx,
        y: by,
        weaponType: 'ricochet',
        vy: game.player.velocity * 0.18,
      });
    } else if (weaponDef.type === 'plasma_lance') {
      pushPlayerBullet(game, {
        x: bx,
        y: by,
        weaponType: 'plasma_lance',
      });
    } else if (weaponDef.type === 'seismic') {
      pushPlayerBullet(game, {
        x: bx,
        y: by,
        weaponType: 'seismic',
      });
    } else {
      pushPlayerBullet(game, {
        x: bx,
        y: by,
        weaponType: 'single',
      });
    }
  }, [canAcceptRunInput]);

  const startShootHold = useCallback(() => {
    const game = gameRef.current;
    if (!game || game.ended) return;
    game.autoHeld = true;
    shoot();
  }, [shoot]);

  const stopShootHold = useCallback(() => {
    const game = gameRef.current;
    if (!game) return;
    game.autoHeld = false;
  }, []);

  const jump = useCallback(() => {
    if (!canAcceptRunInput) return;
    const game = gameRef.current;
    if (!game || game.ended) return;

    if (!game.started) {
      game.started = true;
    }

    const quickTap = game.frame - (game.lastJumpFrame || -999) <= 11;
    const canBurst = (game.engineBurstCharges || 0) > 0 && (game.engineBurstCooldown || 0) <= 0;
    game.lastJumpFrame = game.frame;

    if (quickTap && canBurst) {
      game.engineBurstCharges--;
      game.engineBurstCooldown = 34;
      game.player.x = Math.min(GAME_WIDTH - 140, game.player.x + 62);
      game.player.velocity = Math.min(game.player.velocity, -2.6);
      game.invincible = Math.max(game.invincible, 15);
      for (let i = 0; i < 10; i++) {
        pushParticle(game, {
          x: game.player.x - 18,
          y: game.player.y + (Math.random() - 0.5) * 12,
          vx: -3 - Math.random() * 3.2,
          vy: (Math.random() - 0.5) * 2.5,
          life: 18 + Math.floor(Math.random() * 8),
          color: i % 2 === 0 ? '#7de3ff' : '#ffd791',
          type: 'trail',
          size: 2.5,
        });
      }
      playSfx('powerup');
    }

    game.player.velocity = Number(game.jumpForce || JUMP_FORCE);

    for (let i = 0; i < 5; i++) {
      pushParticle(game, {
        x: game.player.x - 10,
        y: game.player.y,
        vx: -2 - Math.random() * 3,
        vy: (Math.random() - 0.5) * 4,
        life: 20,
        color: Math.random() > 0.5 ? '#00ffff' : '#ff00ff',
        type: 'trail',
      });
    }
  }, [canAcceptRunInput]);

  useEffect(() => {
    const previousGameState = previousGameStateRef.current;

    if (gameState === 'ready') {
      const newState = makeInitialState();
      gameRef.current = newState;

      onBlastReadyChange && onBlastReadyChange(false);
      onTunnelBombReadyChange && onTunnelBombReadyChange(newState.tunnelBombReady);
      notifyComboSpecialReady(newState);
    }

    if (gameState === 'playing' && previousGameState === 'ready') {
      const eq = getEquippedUpgrades();
      if (eq.shield2 > 0) consumeEquippedUpgrade('shield2');
      else if (eq.shield1 > 0) consumeEquippedUpgrade('shield1');
    }

    previousGameStateRef.current = gameState;
  }, [gameState, onBlastReadyChange, onTunnelBombReadyChange, onComboSpecialReadyChange]);

  useEffect(() => {
    const matches = (code, primary, fallbacks = []) => code === primary || fallbacks.includes(code);

    const handleKeyDown = (e) => {
      if (isEditableEventTarget(e.target)) return;

      const settings = settingsRef.current;

      if (matches(e.code, settings.flapKey, ['ArrowUp'])) {
        e.preventDefault();
        jump();
        return;
      }

      // ✅ ADD THIS BLOCK RIGHT HERE
      if (e.code === 'KeyQ') {
        e.preventDefault();
        if (!e.repeat) activateComboSpecial();
        return;
      }

      if (matches(e.code, settings.shootKey, ['ArrowRight'])) {
        e.preventDefault();
        if (!e.repeat) {
          startShootHold();
        }
        return;
      }

      if (matches(e.code, settings.blastKey)) {
        e.preventDefault();
        if (!e.repeat) blast();
        return;
      }

      if (matches(e.code, settings.bombKey)) {
        e.preventDefault();
        if (!e.repeat) tunnelBomb();
      }
    };

    const handleKeyUp = (e) => {
      if (isEditableEventTarget(e.target)) return;

      const settings = settingsRef.current;
      if (matches(e.code, settings.shootKey, ['ArrowRight'])) {
        e.preventDefault();
        stopShootHold();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [jump, blast, tunnelBomb, startShootHold, stopShootHold, activateComboSpecial]);

  const handleCanvasPointerDown = useCallback(
    (e) => {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      if (x < rect.width / 2) {
        jump();
      } else {
        startShootHold();
      }
    },
    [jump, startShootHold]
  );

  const handleCanvasPointerUp = useCallback(() => {
    stopShootHold();
  }, [stopShootHold]);

  useEffect(() => {
    if (jumpRef) jumpRef.current = jump;
    if (shootRef) shootRef.current = shoot;
    if (blastRef) blastRef.current = blast;
    if (tunnelBombRef) tunnelBombRef.current = tunnelBomb;
    if (comboSpecialRef) comboSpecialRef.current = activateComboSpecial;
    if (reviveRef) reviveRef.current = reviveRun;
  }, [jump, shoot, blast, tunnelBomb, activateComboSpecial, reviveRun, jumpRef, shootRef, blastRef, tunnelBombRef, comboSpecialRef, reviveRef]);

  useEffect(() => {
    if (shootStartRef) shootStartRef.current = startShootHold;
    if (shootStopRef) shootStopRef.current = stopShootHold;
  }, [startShootHold, stopShootHold, shootStartRef, shootStopRef]);

  function spawnEnemy(game, options = {}) {
    if (game.enemies.length >= game.maxEnemies) return;
    const groundY = GAME_HEIGHT - GROUND_HEIGHT;
    const tier = getDifficultyTier(game.score);
    const isSwarm = Boolean(options.swarm);
    const forcedType = options.forcedType || null;
    const isNapalmBomber = forcedType === 'napalm_bomber';
    const sizeScale = Math.max(0.7, Number(options.sizeScale || 1));
    const speedScale = Math.max(0.55, Number(options.speedScale || 1));
    const hpScale = Math.max(0.8, Number(options.hpScale || 1));
    const customSpawnEligible =
      !forcedType &&
      !isSwarm &&
      !game.lowFx &&
      LIVE_CUSTOM_ENEMIES.length > 0 &&
      game.score >= 20;
    let customProfile = null;

    if (customSpawnEligible) {
      const customChance = Math.min(
        0.38,
        0.1 + game.score * 0.00045 + LIVE_CUSTOM_ENEMIES.length * 0.03
      );
      if (Math.random() < customChance) {
        customProfile = LIVE_CUSTOM_ENEMIES[Math.floor(Math.random() * LIVE_CUSTOM_ENEMIES.length)];
      }
    }

    const roll = Math.random();
    let type = 'drone';

    if (forcedType === 'napalm_bomber') {
      type = 'bomber';
    } else if (forcedType) {
      type = forcedType;
    } else if (customProfile) {
      type = customProfile.archetype || 'drone';
    } else if (game.lowFx) {
      // Low-FX profile keeps a simple mix while honoring configured enemy weights.
      type = pickConfiguredBaseEnemyType(roll, { includeTurret: false });
      if (type === 'enemy_ship' && game.score < 120) {
        type = 'drone';
      }
    } else if (isSwarm) {
      if (game.score >= 360 && roll < 0.07) {
        type = 'bomber';
      } else if (game.score >= 240 && roll < 0.24 + tier.seekerBias * 0.25) {
        type = 'seeker';
      } else if (game.score >= 180 && roll < 0.36) {
        type = 'enemy_ship';
      } else {
        type = 'drone';
      }
    } else {
      if (game.score >= 80 && roll < 0.12 + tier.bomberBias * 0.35) {
        type = 'bomber';
      } else if (game.score >= 40 && roll < 0.24 + tier.seekerBias * 0.4) {
        type = 'seeker';
      } else {
        type = pickConfiguredBaseEnemyType(roll);
        if (type === 'ground_turret' && game.score < TURRET_SCORE_START) {
          type = 'drone';
        } else if (type === 'enemy_ship' && game.score < 26) {
          type = 'drone';
        }
      }
    }

    if (type === 'ground_turret' && game.score < TURRET_SCORE_START) {
      type = 'drone';
      customProfile = null;
    } else if (type === 'enemy_ship' && game.score < 26) {
      type = 'drone';
      customProfile = null;
    } else if (type === 'seeker' && game.score < 40) {
      type = 'drone';
      customProfile = null;
    } else if (type === 'bomber' && game.score < 80) {
      type = 'drone';
      customProfile = null;
    }

    const configs = {
      enemy_ship: { hp: 2, maxHp: 2, speed: 3.3 + Math.random() * 1.4, size: 17 },
      drone: { hp: 1, maxHp: 1, speed: 2.5 + Math.random() * 1.5, size: 14 },
      seeker: { hp: 2, maxHp: 2, speed: 2 + Math.random() * 2, size: 16 },
      bomber: { hp: 4, maxHp: 4, speed: 1.2 + Math.random() * 0.8, size: 18 },
      ground_turret: {
        hp: 5 + Math.floor(Math.random() * 4),
        maxHp: 8,
        speed: 1.25 + Math.random() * 0.45,
        size: 18,
      },
    };

    if (!configs[type]) {
      type = 'drone';
      customProfile = null;
    }

    const cfg = configs[type];
    const customHp = Number(customProfile?.hp);
    const customSpeed = Number(customProfile?.speed);
    const baseHp = Number.isFinite(customHp) ? customHp : cfg.hp;
    const baseMaxHp = Number.isFinite(customHp)
      ? customHp
      : type === 'ground_turret'
      ? cfg.hp
      : cfg.maxHp;
    const baseSpeed = Number.isFinite(customSpeed) ? customSpeed : cfg.speed;

    let spawnY;
    const anchor = 'floor';

    if (isNapalmBomber) {
      spawnY = 44 + Math.random() * 18;
    } else if (type === 'ground_turret') {
      spawnY = groundY - cfg.size - 8;
    } else {
      const nextPipe = getClosestForwardPipe(game.pipes, game.player.x);

      if (nextPipe) {
        const gapTop = nextPipe.topHeight;
        const gapBottom = nextPipe.topHeight + nextPipe.gap;
        const padding = 22;

        const safeMin = gapTop + padding;
        const safeMax = gapBottom - padding;

        if (safeMax > safeMin) {
          spawnY = safeMin + Math.random() * (safeMax - safeMin);
        } else {
          spawnY = GAME_HEIGHT / 2;
        }
      } else {
        spawnY = 80 + Math.random() * (groundY - 160);
      }

      if (Math.abs(spawnY - game.player.y) < 36) {
        spawnY += spawnY < game.player.y ? -48 : 48;
      }

      spawnY = Math.max(40, Math.min(groundY - 20, spawnY));
    }

    game.enemies.push({
      x: GAME_WIDTH + 40,
      y: spawnY,
      vy: type === 'ground_turret' || isNapalmBomber
        ? 0
        : (Math.random() - 0.5) * 1.2,
      type,
      hp: Math.max(1, Math.round(baseHp * hpScale * ENEMY_CONFIG.healthMultiplier)),
      maxHp: Math.max(
        1,
        Math.round(baseMaxHp * hpScale * ENEMY_CONFIG.healthMultiplier)
      ),
      speed: baseSpeed * speedScale * ENEMY_CONFIG.speedMultiplier,
      size: Math.round(cfg.size * sizeScale),
      customEnemyId: customProfile?.id || null,
      customEnemyName: customProfile?.name || null,
      customEnemyEmoji: customProfile?.emoji || null,
      customEnemyColor: customProfile?.color || null,
      seed: Math.random() * 100,
      anchor: isNapalmBomber ? 'ceiling' : anchor,
      seekTimer: 0,
      shootCooldown:
        isNapalmBomber
          ? 22 + Math.floor(Math.random() * 12)
          : type === 'ground_turret' || type === 'enemy_ship'
          ? 70 + Math.floor(Math.random() * 45)
          : 0,
      diamondReward: type === 'ground_turret' ? 1 : 0,
      isNapalmBomber,
      id: Math.random(),
    });

    game.firstEnemySpawned = true;
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx =
      canvas.getContext('2d', { alpha: false, desynchronized: true }) ||
      canvas.getContext('2d');
    if (!ctx) return undefined;
    let animId;
    let lastStepTimestamp = 0;
    const STEP_MS = 1000 / 60;

    const loop = (timestamp) => {
      if (!lastStepTimestamp) {
        lastStepTimestamp = timestamp;
      }

      const frameDeltaMs = timestamp - lastStepTimestamp;
      if (frameDeltaMs < STEP_MS) {
        animId = requestAnimationFrame(loop);
        return;
      }
      lastStepTimestamp = timestamp;

      const game = gameRef.current;
      if (!game) return;
      game.renderDpr = renderDpr;
      const groundY = GAME_HEIGHT - GROUND_HEIGHT;
      const playerHalf = PLAYER_SIZE / 2;
      const tier = getDifficultyTier(game.score);
      const simulationActive = gameState === 'playing' && !game.ended;

      if (game.lowFx && simulationActive) {
        const frameBuffer = game.frameAvgBuffer;
        const frameBufferIndex = game.frameAvgBufferIndex || 0;
        const frameBufferCount = Math.min(IOS_FRAME_AVG_WINDOW, game.frameAvgBufferCount || 0);
        const previousSample = frameBufferCount >= IOS_FRAME_AVG_WINDOW ? frameBuffer[frameBufferIndex] : 0;
        const nextCount = frameBufferCount >= IOS_FRAME_AVG_WINDOW ? frameBufferCount : frameBufferCount + 1;

        frameBuffer[frameBufferIndex] = frameDeltaMs;
        game.frameAvgBufferIndex = (frameBufferIndex + 1) % IOS_FRAME_AVG_WINDOW;
        game.frameAvgBufferCount = nextCount;
        game.frameAvgBufferSum = (game.frameAvgBufferSum || 0) + frameDeltaMs - previousSample;
        game.frameAvgMs = game.frameAvgBufferSum / Math.max(1, nextCount);

        if (frameDeltaMs > IOS_SLOW_FRAME_MS) {
          game.slowFrameStreak = (game.slowFrameStreak || 0) + 1;
          game.goodFrameStreak = 0;
        } else if (frameDeltaMs < IOS_RECOVER_FRAME_MS) {
          game.goodFrameStreak = (game.goodFrameStreak || 0) + 1;
          game.slowFrameStreak = Math.max(0, (game.slowFrameStreak || 0) - 1);
        } else {
          game.slowFrameStreak = Math.max(0, (game.slowFrameStreak || 0) - 1);
          game.goodFrameStreak = Math.max(0, (game.goodFrameStreak || 0) - 1);
        }

        if (game.frameAvgMs > IOS_DEGRADE_AVG_MS) {
          game.perfDegradeFrames = (game.perfDegradeFrames || 0) + 1;
          game.perfRecoverFrames = 0;
          if (game.perfDegradeFrames >= IOS_DEGRADE_FRAMES_REQUIRED && (game.renderPerfLevel || 0) < 2) {
            applyIosVisualLevel(game, (game.renderPerfLevel || 0) + 1);
            game.perfDegradeFrames = 0;
            game.perfRecoverFrames = 0;
          }
        } else if (game.frameAvgMs < IOS_RECOVER_AVG_MS) {
          game.perfRecoverFrames = (game.perfRecoverFrames || 0) + 1;
          game.perfDegradeFrames = Math.max(0, (game.perfDegradeFrames || 0) - 1);
          if (game.perfRecoverFrames >= IOS_RECOVER_FRAMES_REQUIRED && (game.renderPerfLevel || 0) > 0) {
            applyIosVisualLevel(game, (game.renderPerfLevel || 0) - 1);
            game.perfDegradeFrames = 0;
            game.perfRecoverFrames = 0;
          }
        } else {
          game.perfDegradeFrames = Math.max(0, (game.perfDegradeFrames || 0) - 1);
          game.perfRecoverFrames = Math.max(0, (game.perfRecoverFrames || 0) - 1);
        }

        game.perfLogFrameCounter = (game.perfLogFrameCounter || 0) + 1;
        game.perfLogFrameSumMs = (game.perfLogFrameSumMs || 0) + frameDeltaMs;
        game.perfLogWorstMs = Math.max(game.perfLogWorstMs || 0, frameDeltaMs);
        if (game.perfLogFrameCounter >= 300) {
          const avgMs = game.perfLogFrameSumMs / game.perfLogFrameCounter;
          const mode = game.ultraLowFx ? 'ios-ultra-low' : (game.renderPerfLevel || 0) > 0 ? 'ios-low+' : 'ios-low';
          console.info(
            `[perf] mode=${mode} avg=${avgMs.toFixed(1)}ms frameAvg=${(game.frameAvgMs || 0).toFixed(1)}ms worst=${(game.perfLogWorstMs || 0).toFixed(1)}ms`
          );
          game.perfLogFrameCounter = 0;
          game.perfLogFrameSumMs = 0;
          game.perfLogWorstMs = 0;
        }
      }

        if (simulationActive) {
          game.frame++;
          if ((game.engineBurstCooldown || 0) > 0) {
            game.engineBurstCooldown--;
          }
          game.speed = tier.speed;

        if (game.started) {
          if (game.postTeleportFreeze > 0) {
            game.postTeleportFreeze--;
          } else {
            game.scrollX += game.speed;
          }
        }

        if (game.invincible > 0) game.invincible--;
        if (game.zapCooldown > 0) game.zapCooldown--;
        if ((game.explosionSfxCooldown || 0) > 0) game.explosionSfxCooldown--;

        if (game.blastResolveQueue.length > 0) {
          const resolveCount = Math.min(game.blastResolvePerFrame, game.blastResolveQueue.length);
          for (let i = 0; i < resolveCount; i++) {
            const resolved = game.blastResolveQueue.pop();
            if (!resolved) break;
            game.kills++;
            game.score += resolved.score;
            if (resolved.showFx) {
              explode(game, resolved.x, resolved.y, '#ff00ff', '#ffffff', game.lowFx ? 8 : 18);
            }
          }
          markScoreDirty(game);
        }

        if (game.teleportWindup) {
          game.teleportWindup.framesLeft--;

          if (game.teleportWindup.framesLeft <= 0) {
            const { exitY, worldShift, desiredPlayerX } = game.teleportWindup;

            pushPortalEffect(game, {
              x: desiredPlayerX,
              y: exitY,
              life: 24,
              maxLife: 24,
              type: 'exit',
            });

            for (let i = 0; i < game.pipes.length; i++) game.pipes[i].x -= worldShift;
            for (let i = 0; i < game.enemies.length; i++) game.enemies[i].x -= worldShift;
            for (let i = 0; i < game.bullets.length; i++) game.bullets[i].x -= worldShift;
            for (let i = 0; i < game.rockets.length; i++) game.rockets[i].x -= worldShift;
            for (let i = 0; i < game.tunnelBombs.length; i++) game.tunnelBombs[i].x -= worldShift;
            for (let i = 0; i < game.blasts.length; i++) game.blasts[i].originX -= worldShift;
            for (let i = 0; i < game.zapArcs.length; i++) {
              game.zapArcs[i].x1 -= worldShift;
              game.zapArcs[i].x2 -= worldShift;
            }
            for (let i = 0; i < game.particles.length; i++) game.particles[i].x -= worldShift;

            game.player.x = desiredPlayerX;
            game.player.y = exitY;
            game.player.velocity = 0;
            game.invincible = Math.max(game.invincible, 35);
            game.postTeleportFreeze = 28;
            consumeActiveSpecialCharge(game, 1);
            game.teleportWindup = null;

            for (let i = 0; i < 18; i++) {
              pushParticle(game, {
                x: desiredPlayerX + (Math.random() - 0.5) * 18,
                y: exitY + (Math.random() - 0.5) * 18,
                vx: (Math.random() - 0.5) * 7,
                vy: (Math.random() - 0.5) * 7,
                life: 18 + Math.floor(Math.random() * 12),
                color: Math.random() > 0.5 ? '#66ffff' : '#cc99ff',
                type: 'trail',
                size: 2 + Math.random() * 2,
              });
            }
          }
        }
      }

      if (simulationActive) {
        const throttleHeavyWork = game.ultraLowFx && game.frame % 2 === 1;

        if (game.weaponDef?.type === 'lightning' && game.zapCharge < game.weaponDef.maxCharge) {
          game.zapCharge = Math.min(
            game.weaponDef.maxCharge,
            game.zapCharge + game.weaponDef.rechargeRate
          );
        }

        if (game.burstPending.length > 0) {
          let pendingWriteIndex = 0;
          for (let i = 0; i < game.burstPending.length; i++) {
            const item = game.burstPending[i];
            if (game.frame >= item.fireAtFrame) {
              if (game.bullets.length < game.maxPlayerBullets) {
                const bullet = item.bullet || {};
                game.bullets.push({
                  x: Number(bullet.x || 0),
                  y: Number(bullet.y || 0),
                  weaponType: bullet.weaponType || 'single',
                  color: bullet.color || '#ffff00',
                  vx: Number.isFinite(bullet.vx) ? bullet.vx : undefined,
                  vy: Number.isFinite(bullet.vy) ? bullet.vy : undefined,
                  damage: Number.isFinite(bullet.damage) ? bullet.damage : undefined,
                  pierce: Number.isFinite(bullet.pierce) ? bullet.pierce : undefined,
                  splashRadius: Number.isFinite(bullet.splashRadius) ? bullet.splashRadius : undefined,
                  bounces: Number.isFinite(bullet.bounces) ? bullet.bounces : undefined,
                  hitIds: [],
                  age: 0,
                  spawnFrame: game.frame,
                });
              }
              continue;
            }
            game.burstPending[pendingWriteIndex++] = item;
          }
          game.burstPending.length = pendingWriteIndex;
        }

        if (game.autoHeld) {
          shoot();
        }

        if (game.started) {
          if (game.mobileSteerTargetY !== null) {
            const distanceToTarget = game.mobileSteerTargetY - game.player.y;
            const desiredVelocity = Math.max(-4.6, Math.min(4.6, distanceToTarget * 0.075));
            game.player.velocity += (desiredVelocity - game.player.velocity) * 0.24;
          }

          game.player.velocity += GRAVITY;
          game.player.y += game.player.velocity;
        }

        if (game.shieldLevel === 2 && game.shieldDurationLeft > 0) {
          game.shieldDurationLeft--;
          if (game.shieldDurationLeft === 0) {
            game.shieldKillsEnemies = false;
            game.shieldLevel = 0;
            game.shieldHitsLeft = 0;
            game.shields = 0;
          }
        }

        if (game.tunnelBombActive) {
          game.tunnelBombTimer--;
          if (game.tunnelBombTimer <= 0) {
            game.tunnelBombActive = false;
            game.pipeGap = PIPE_GAP;
          }
        }

        for (let i = game.portalEffects.length - 1; i >= 0; i--) {
          const portal = game.portalEffects[i];
          portal.life -= 1;
          if (portal.life <= 0) {
            game.portalEffects.splice(i, 1);
          }
        }

        if (game.started) {
          game.pipeTimer++;

          const spawnInterval = Math.max(
            tier.pipeSpawnMin,
            140 - game.score * tier.pipeSpawnDecay
          );

          if (game.pipeTimer >= spawnInterval) {
            game.pipeTimer = 0;

            const gap = game.pipeGap;
            const minTop = 60;
            const maxTop = groundY - gap - 60;
            const topHeight = minTop + Math.random() * Math.max(10, maxTop - minTop);

            let dynamicChance = 0;
            if (game.score >= 12 && game.score < 28) {
              dynamicChance = 0.35;
            } else if (game.score >= 28 && game.score < 120) {
              dynamicChance = 0.58;
            } else if (game.score >= 120 && game.score < 220) {
              dynamicChance = 0.7;
            } else if (game.score >= 220) {
              dynamicChance = 0.82;
            }
            if (game.lowFx) {
              dynamicChance = 0.08;
            }

            const isDynamic = Math.random() < dynamicChance;
            const closeAmp = isDynamic ? Math.min(52, 14 + game.score * 0.6) : 0;
            const baseCenter = topHeight + gap / 2;

            game.pipes.push({
              x: GAME_WIDTH + 10,
              topHeight,
              baseTopHeight: topHeight,
              baseCenter,
              baseGap: gap,
              gap,
              scored: false,
              dynamic: isDynamic,
              closeAmp,
              waveAmp: isDynamic ? (game.score >= 160 ? 28 : game.score >= 28 ? 22 : 16) : 0,
              waveSpeed: isDynamic ? (game.score >= 160 ? 0.07 : game.score >= 28 ? 0.055 : 0.04) : 0,
              waveOffset: Math.random() * Math.PI * 2,
            });

            game.enemyTimer = Math.min(game.enemyTimer, 80);
          }
        }

        for (let i = 0; i < game.pipes.length; i++) {
          const p = game.pipes[i];
          if (game.postTeleportFreeze <= 0) {
            p.x -= game.speed;
          }

          if (p.dynamic && !throttleHeavyWork) {
            const motion = Math.sin(game.frame * p.waveSpeed + p.waveOffset);
            const closeMotion =
              (Math.sin(game.frame * p.waveSpeed * 1.28 + p.waveOffset + Math.PI / 2) + 1) / 2;
            const floorGap = game.score >= 240 ? 88 : game.score >= 180 ? 92 : game.score >= 120 ? 98 : 104;
            const nextGap = Math.max(floorGap, p.baseGap - closeMotion * p.closeAmp);
            const centerY = p.baseCenter + motion * p.waveAmp;

            p.gap = nextGap;
            p.topHeight = Math.max(60, Math.min(groundY - p.gap - 60, centerY - p.gap / 2));
          }
        }

        for (const p of game.pipes) {
          const gapBottom = p.topHeight + p.gap;

          const playerLeft = game.player.x - playerHalf;
          const playerRight = game.player.x + playerHalf;
          const pipeLeft = p.x;
          const pipeRight = p.x + PIPE_WIDTH;

          const overlapsPipeX = playerRight > pipeLeft && playerLeft < pipeRight;

          if (game.invincible === 0 && overlapsPipeX) {
            const hitTopPipe = game.player.y - playerHalf < p.topHeight;
            const hitBottomPipe = game.player.y + playerHalf > gapBottom;

            if (hitTopPipe || hitBottomPipe) {
              if (handleShieldHit(game)) {
                if (hitTopPipe) {
                  game.player.y = p.topHeight + playerHalf + 4;
                } else {
                  game.player.y = gapBottom - playerHalf - 4;
                }
              } else {
                endRun(game);
                break;
              }
            }
          }
        }

        for (let i = 0; i < game.pipes.length; i++) {
          const p = game.pipes[i];
          if (!p.scored && p.x + PIPE_WIDTH < game.player.x) {
            p.scored = true;
            game.score++;
            markScoreDirty(game);
            playSfx('coin');
          }
        }

        compactArrayInPlace(game.pipes, (p) => p.x > -PIPE_WIDTH - 20);

        if (game.started) {
          game.enemyTimer++;

          if (!game.firstEnemySpawned) {
            if (game.enemyTimer >= 72 || game.score >= 6) {
              game.enemyTimer = 0;
              spawnEnemy(game, { forcedType: 'drone', speedScale: 0.92 });
            }
          } else {
            const enemyInterval = Math.max(
              tier.enemySpawnMin,
              GAMEPLAY_CONFIG.enemySpawnBaseInterval - game.score * tier.enemySpawnDecay
            );

            if (game.enemyTimer >= enemyInterval) {
              game.enemyTimer = 0;
              spawnEnemy(game);
            }
          }

          if (game.swarmEnabled && game.score >= SWARM_SCORE_START) {
            while (
              game.swarmScriptIndex < SCRIPTED_SWARM_MILESTONES.length &&
              game.score >= SCRIPTED_SWARM_MILESTONES[game.swarmScriptIndex].score
            ) {
              const definition = SCRIPTED_SWARM_MILESTONES[game.swarmScriptIndex];
              enqueueSwarm(game, buildSwarmPlan(game.score, definition));
              game.swarmScriptIndex++;
            }

            while (game.score >= game.swarmDynamicNextScore) {
              enqueueSwarm(game, buildDynamicSwarmPlan(game.score));
              const step = Math.max(
                22,
                SWARM_DYNAMIC_STEP_BASE - Math.floor((game.score - SWARM_DYNAMIC_START_SCORE) / 180) * 4
              );
              game.swarmDynamicNextScore += step;
            }

            if (!game.activeSwarm && game.swarmQueue.length > 0) {
              game.activeSwarm = game.swarmQueue.shift();
              game.swarmDelay = 0;
            }

            if (game.activeSwarm) {
              if (game.swarmDelay > 0) {
                game.swarmDelay--;
              } else if (game.enemies.length < SWARM_ENEMY_CAP) {
                if (game.activeSwarm.forceNapalmBomber) {
                  spawnEnemy(game, { swarm: true, forcedType: 'napalm_bomber' });
                  game.activeSwarm.remaining = 0;
                } else {
                  const isRearLarge =
                    game.activeSwarm.rearLargeDrone && game.activeSwarm.remaining === 1;

                  spawnEnemy(
                    game,
                    isRearLarge
                      ? {
                          swarm: true,
                          forcedType: 'drone',
                          sizeScale: 1.45,
                          hpScale: 1.9,
                          speedScale: 0.82,
                        }
                      : { swarm: true }
                  );
                  game.activeSwarm.remaining--;
                }

                game.swarmDelay = randomInt(SWARM_DELAY_MIN, SWARM_DELAY_MAX);
              }

              if (game.activeSwarm.remaining <= 0) {
                game.activeSwarm = null;
                game.swarmDelay = 0;
              }
            }
          }
        }

        for (let i = 0; i < game.enemies.length; i++) {
          const e = game.enemies[i];
          if (game.postTeleportFreeze <= 0) {
            e.x -= e.speed;
          }
          if (e.orbHitCooldown > 0) {
            e.orbHitCooldown--;
          }

          if (e.isNapalmBomber) {
            const targetY = 52 + Math.sin((game.frame + e.seed) * 0.05) * 10;
            e.y += (targetY - e.y) * 0.2;
            e.y = Math.max(34, Math.min(98, e.y));

            if (e.shootCooldown > 0) {
              e.shootCooldown--;
            } else if (e.x > game.player.x - 30) {
              pushEnemyBullet(game, {
                x: e.x - e.size * 0.22,
                y: e.y + e.size * 0.42,
                vx: -1.7 + Math.random() * 0.5,
                vy: 3.4 + Math.random() * 0.9,
                size: 5,
                life: 140,
                napalm: true,
                gravity: 0.045,
              });
              e.shootCooldown = 26 + Math.floor(Math.random() * 18);
              playSfx('shoot');
            }
          } else if (e.type === 'ground_turret') {
            e.y = groundY - e.size - 8;

            if (e.shootCooldown > 0) {
              e.shootCooldown--;
            } else {
              const dx = game.player.x - e.x;
              const dy = game.player.y - e.y;
              const dist = Math.max(1, Math.hypot(dx, dy));

              pushEnemyBullet(game, {
                x: e.x - e.size * 0.2,
                y: e.y - e.size * 0.5,
                vx: (dx / dist) * 4.5,
                vy: (dy / dist) * 4.5,
                size: 4,
                life: 160,
              });

              e.shootCooldown = 85 + Math.floor(Math.random() * 45);
              playSfx('shoot');
            }
          } else if (e.type === 'enemy_ship') {
            const dy = game.player.y - e.y;
            e.vy += dy * 0.004;
            e.vy = Math.max(-1.8, Math.min(1.8, e.vy));
            e.y += e.vy;
            e.y = Math.max(32, Math.min(groundY - 32, e.y));

            if (e.shootCooldown > 0) {
              e.shootCooldown--;
            } else if (e.x > game.player.x + 80) {
              const dx = game.player.x - e.x;
              const shotDy = game.player.y - e.y;
              const dist = Math.max(1, Math.hypot(dx, shotDy));
              pushEnemyBullet(game, {
                x: e.x - e.size,
                y: e.y,
                vx: (dx / dist) * 5.2,
                vy: (shotDy / dist) * 5.2,
                size: 3.5,
                life: 120,
              });
              e.shootCooldown = 95 + Math.floor(Math.random() * 40);
              playSfx('shoot');
            }
          } else if (e.type === 'seeker') {
            const dy = game.player.y - e.y;
            e.vy += dy * 0.008;
            e.vy = Math.max(-3, Math.min(3, e.vy));
            e.y += e.vy;
            e.y = Math.max(30, Math.min(groundY - 20, e.y));
          } else {
            e.vy = Math.sin(game.frame * 0.04 + e.seed) * 1.5;
            e.y += e.vy;
            e.y = Math.max(30, Math.min(groundY - 20, e.y));
          }
        }

        const enemySpatialIndex = buildEnemySpatialIndex(game.enemies);
        const pools = game.tempPools || (game.tempPools = {
          enemyCandidates: [],
          splashCandidates: [],
          rocketCandidates: [],
          droneCandidates: [],
          orbCandidates: [],
        });
        const enemyCandidates = pools.enemyCandidates;
        const splashCandidates = pools.splashCandidates;
        const rocketCandidates = pools.rocketCandidates;
        const droneCandidates = pools.droneCandidates;
        const orbCandidates = pools.orbCandidates;

        for (let i = 0; i < game.bullets.length; i++) {
          const b = game.bullets[i];
          b.age = (b.age || 0) + 1;
          b.x += b.vx ?? (b.weaponType === 'lightning_zap' ? 20 : 14);
          b.y += b.vy ?? 0;

          if (b.weaponType === 'ricochet') {
            const hitCeiling = b.y < 18;
            const hitFloor = b.y > groundY - 18;

            if ((hitCeiling || hitFloor) && b.bounces > 0) {
              b.y = hitCeiling ? 18 : groundY - 18;
              b.vy = -(b.vy || 2.6) || (hitCeiling ? 2.6 : -2.6);
              b.bounces--;
              explode(game, b.x, b.y, b.color || '#66ccff', '#ffffff', 4);
            }
          }
        }

        if (game.energyOrbCount > 0 && !throttleHeavyWork) {
          const orbRadius = 34 + game.energyOrbTier * 3;
          const orbCount = game.energyOrbCount;
          const orbDamage = Math.max(0.25, Number(game.energyOrbDamage || 0.65));

          for (let i = 0; i < orbCount; i++) {
            const angle = game.frame * 0.08 + (i * Math.PI * 2) / orbCount;
            const orbX = game.player.x + Math.cos(angle) * orbRadius;
            const orbY = game.player.y + Math.sin(angle) * orbRadius;

            collectNearbyEnemies(enemySpatialIndex, orbX, orbY, 72, 72, orbCandidates);
            for (const enemy of orbCandidates) {
              if (enemy.dead) continue;
              if ((enemy.orbHitCooldown || 0) > 0) continue;

              const hitRadius = enemy.size + 9;
              if (distSq(enemy.x, enemy.y, orbX, orbY) > hitRadius * hitRadius) continue;

              enemy.hp -= orbDamage;
              enemy.orbHitCooldown = 14;
              explode(game, orbX, orbY, '#7de3ff', '#ffffff', 5);
              if (enemy.hp <= 0) {
                killEnemy(game, enemy, 0);
              }
            }
          }
        }

        if (game.orbitalDroneTier > 0) {
          for (let i = 0; i < game.orbitalDrones.length; i++) {
            const drone = game.orbitalDrones[i];
            if (drone.dead) continue;

            drone.respawnCooldown = Math.max(0, Number(drone.respawnCooldown || 0) - 1);
            drone.speed = 7 + game.orbitalDroneTier * 0.7;

            if (drone.state === 'spent') {
              if ((drone.respawnsLeft || 0) <= 0) {
                drone.dead = true;
                continue;
              }
              if ((drone.respawnsLeft || 0) > 0 && drone.respawnCooldown <= 0) {
                drone.state = 'orbit';
                drone.targetId = null;
                drone.respawnsLeft = Math.max(0, (drone.respawnsLeft || 0) - 1);
                drone.x = game.player.x;
                drone.y = game.player.y;
                drone.vx = 0;
                drone.vy = 0;
                playSfx('powerup');
              }
              continue;
            }

            if (drone.state !== 'attack') {
              const orbitAngle = game.frame * 0.11 + drone.slot * ((Math.PI * 2) / Math.max(1, game.orbitalDrones.length));
              const orbitRadius = 25 + game.orbitalDroneTier * 4;
              const orbitTargetX = game.player.x + Math.cos(orbitAngle) * orbitRadius;
              const orbitTargetY = game.player.y + Math.sin(orbitAngle) * orbitRadius;
              drone.x += (orbitTargetX - drone.x) * 0.24;
              drone.y += (orbitTargetY - drone.y) * 0.24;
              drone.vx = orbitTargetX - drone.x;
              drone.vy = orbitTargetY - drone.y;

              let nearest = null;
              let nearestDist = Infinity;
              const triggerRange = Number(game.orbitalDroneTriggerRange || 108);
              collectNearbyEnemies(
                enemySpatialIndex,
                game.player.x,
                game.player.y,
                triggerRange + 64,
                triggerRange + 64,
                droneCandidates
              );
              for (const enemy of droneCandidates) {
                if (enemy.dead) continue;
                const allowed = triggerRange + enemy.size;
                const distToPlayerSq = distSq(enemy.x, enemy.y, game.player.x, game.player.y);
                if (distToPlayerSq > allowed * allowed) continue;
                if (distToPlayerSq < nearestDist) {
                  nearestDist = distToPlayerSq;
                  nearest = enemy;
                }
              }

              if (nearest) {
                drone.state = 'attack';
                drone.targetId = nearest.id;
              }
              continue;
            }

            let target = null;
            for (let j = 0; j < game.enemies.length; j++) {
              const enemy = game.enemies[j];
              if (enemy.dead || enemy.id !== drone.targetId) continue;
              target = enemy;
              break;
            }
            if (!target) {
              for (let j = 0; j < game.enemies.length; j++) {
                const enemy = game.enemies[j];
                if (enemy.dead || enemy.x <= game.player.x - 20) continue;
                target = enemy;
                break;
              }
              drone.targetId = target ? target.id : null;
              if (!target) {
                drone.state = 'orbit';
                drone.targetId = null;
                continue;
              }
            }

            const dx = target.x - drone.x;
            const dy = target.y - drone.y;
            const dist = Math.max(1, Math.hypot(dx, dy));
            drone.vx = (dx / dist) * drone.speed;
            drone.vy = (dy / dist) * drone.speed;
            drone.x += drone.vx;
            drone.y += drone.vy;

            if (dist < target.size + 8) {
              explode(game, drone.x, drone.y, '#ff9f55', '#fff19c', 14);
              target.hp -= game.orbitalDroneTier >= 2 ? 7 : 6;
              if (target.hp <= 0) {
                killEnemy(game, target, 1);
              }
              drone.state = 'spent';
              drone.targetId = null;
              drone.respawnCooldown = game.orbitalDroneTier >= 2 ? 36 : 44;
            }
          }
        }

        for (let i = 0; i < game.enemyBullets.length; i++) {
          const b = game.enemyBullets[i];
          b.x += b.vx;
          b.y += b.vy;
          if (b.gravity) b.vy += b.gravity;
          b.life--;
        }

        compactArrayInPlace(
          game.enemyBullets,
          (b) =>
            b.life > 0 &&
            b.x > -40 &&
            b.x < GAME_WIDTH + 40 &&
            b.y > -40 &&
            b.y < GAME_HEIGHT + 40
        );

        if (game.shieldPulseLevel > 0) {
          game.shieldPulseCooldown = Math.max(0, (game.shieldPulseCooldown || 0) - 1);
          if (game.shieldPulseCooldown <= 0 && game.enemyBullets.length > 0 && !throttleHeavyWork) {
            let nearestBullet = null;
            let nearestDistance = Infinity;
            const pulseRange = 72 + game.shieldPulseLevel * 10;
            const pulseRangeSq = pulseRange * pulseRange;
            for (let i = 0; i < game.enemyBullets.length; i++) {
              const b = game.enemyBullets[i];
              const distToPlayerSq = distSq(b.x, b.y, game.player.x, game.player.y);
              if (distToPlayerSq <= pulseRangeSq && distToPlayerSq < nearestDistance) {
                nearestDistance = distToPlayerSq;
                nearestBullet = b;
              }
            }

            if (nearestBullet) {
              nearestBullet.dead = true;
              explode(game, nearestBullet.x, nearestBullet.y, '#88ddff', '#ffffff', 7);
              game.shieldPulseCooldown = Math.max(48, 112 - game.shieldPulseLevel * 14);
              playSfx('shield');
            } else {
              game.shieldPulseCooldown = 16;
            }
          }
        }

        compactArrayInPlace(game.bullets, (b) => {
          if (b.x > GAME_WIDTH + 80) return false;
          if (b.x < -120) return false;
          if (b.y < -40 || b.y > groundY + 40) return false;

          collectNearbyEnemies(enemySpatialIndex, b.x, b.y, 88, 88, enemyCandidates);
          for (const e of enemyCandidates) {
            const hitIds = b.hitIds;
            if (e.dead || hasHitId(hitIds, e.id)) continue;

            const dx = b.x - e.x;
            const dy = b.y - e.y;
            const hitWidth = b.weaponType === 'plasma_lance' ? e.size + 26 : e.size + 10;
            const hitHeight = b.weaponType === 'flak' ? e.size + 4 : e.size;

            if (Math.abs(dx) < hitWidth && Math.abs(dy) < hitHeight) {
              const damage = Math.max(1, Number(b.damage || 1));
              e.hp -= damage;
              if (!b.hitIds) b.hitIds = [];
              b.hitIds.push(e.id);

              const pulseSplashRadius =
                b.weaponType === 'pulse'
                  ? Math.max(32, Number(b.splashRadius || 38))
                  : 0;
              const explosionRadius = Math.max(Number(b.splashRadius || 0), pulseSplashRadius);

              if (explosionRadius > 0) {
                const explosionCount = b.weaponType === 'pulse' ? 18 : 14;
                const explosionPrimary = b.weaponType === 'pulse' ? '#7df9ff' : (b.color || '#ffaa44');
                const explosionSecondary = b.weaponType === 'pulse' ? '#ffffff' : '#ffffff';
                explode(game, b.x, b.y, explosionPrimary, explosionSecondary, explosionCount);

                const splashRadiusSq = explosionRadius * explosionRadius;
                collectNearbyEnemies(
                  enemySpatialIndex,
                  b.x,
                  b.y,
                  explosionRadius + 64,
                  explosionRadius + 64,
                  splashCandidates
                );
                for (const nearby of splashCandidates) {
                  if (nearby === e || nearby.dead) continue;
                  const distanceSq = distSq(nearby.x, nearby.y, b.x, b.y);
                  if (distanceSq > splashRadiusSq) continue;
                  const distance = Math.sqrt(distanceSq);

                  const splashDamageScale = b.weaponType === 'pulse' ? 0.72 : 0.65;
                  nearby.hp -= Math.max(1, Math.ceil(damage * splashDamageScale));
                  if (b.weaponType === 'pulse') {
                    // Pulse shockwave pushes nearby enemies outward slightly.
                    const push = Math.max(0.2, (explosionRadius - distance) / explosionRadius) * 2.4;
                    nearby.x += (nearby.x >= b.x ? 1 : -1) * push;
                    nearby.y += (nearby.y >= b.y ? 1 : -1) * push * 0.55;
                  }
                  if (nearby.hp <= 0) killEnemy(game, nearby);
                }
              } else {
                explode(game, b.x, b.y, b.color || '#ffff00', '#ff0000', 6);
              }

              if (e.hp <= 0) killEnemy(game, e);

              if (b.weaponType === 'ricochet' && b.bounces > 0) {
                let ricochetTarget = null;
                let ricochetTargetDistance = Infinity;
                for (const target of game.enemies) {
                  if (target.dead || hasHitId(b.hitIds, target.id)) continue;
                  const distanceSq = distSq(target.x, target.y, b.x, b.y);
                  if (distanceSq < ricochetTargetDistance) {
                    ricochetTargetDistance = distanceSq;
                    ricochetTarget = target;
                  }
                }

                if (ricochetTarget) {
                  const angle = Math.atan2(ricochetTarget.y - b.y, ricochetTarget.x - b.x);
                  const vx = b.vx || 0;
                  const vy = b.vy || 0;
                  const speed = Math.max(10, Math.sqrt(vx * vx + vy * vy));
                  b.vx = Math.cos(angle) * speed;
                  b.vy = Math.sin(angle) * speed;
                  b.bounces--;
                  b.x += b.vx * 0.12;
                  b.y += b.vy * 0.12;
                  explode(game, b.x, b.y, b.color || '#66ccff', '#ffffff', 8);
                  return true;
                }
              }

              if (b.pierce > 0) {
                b.pierce--;
                return true;
              }

              return false;
            }
          }

          return true;
        });

        for (let i = 0; i < game.rockets.length; i++) {
          const r = game.rockets[i];
          r.age++;

          let nearest = null;
          let nearDist = Infinity;

          collectNearbyEnemies(enemySpatialIndex, r.x, r.y, 220, 220, rocketCandidates);
          const homingPool = rocketCandidates.length > 0 ? rocketCandidates : game.enemies;
          for (let j = 0; j < homingPool.length; j++) {
            const e = homingPool[j];
            if (e.dead) continue;
            const dSq = distSq(e.x, e.y, r.x, r.y);
            if (dSq < nearDist) {
              nearDist = dSq;
              nearest = e;
            }
          }

          if (nearest) {
            const angle = Math.atan2(nearest.y - r.y, nearest.x - r.x);
            r.vx += Math.cos(angle) * 0.8;
            r.vy += Math.sin(angle) * 0.8;
            const spd = Math.hypot(r.vx, r.vy);
            if (spd > 10) {
              r.vx = (r.vx / spd) * 10;
              r.vy = (r.vy / spd) * 10;
            }
          }

          r.x += r.vx;
          r.y += r.vy;

          collectNearbyEnemies(enemySpatialIndex, r.x, r.y, 84, 84, rocketCandidates);
          const collisionPool = rocketCandidates.length > 0 ? rocketCandidates : game.enemies;
          for (const e of collisionPool) {
            if (e.dead) continue;
            const rocketHitRadius = e.size + 8;
            if (distSq(e.x, e.y, r.x, r.y) < rocketHitRadius * rocketHitRadius) {
              explode(game, r.x, r.y, '#ff4400', '#ffff00', 10);
              e.hp -= 3;
              if (e.hp <= 0) killEnemy(game, e);
              r.dead = true;
              break;
            }
          }

          pushParticle(game, {
            x: r.x,
            y: r.y,
            vx: -r.vx * 0.3,
            vy: (Math.random() - 0.5) * 2,
            life: 12,
            color: '#ff6600',
            type: 'trail',
            size: 3,
          });
        }

        compactArrayInPlace(
          game.rockets,
          (r) => !r.dead && r.x < GAME_WIDTH + 50 && r.x > -50 && r.age < 180
        );

        compactArrayInPlace(game.zapArcs, (z) => {
          z.life--;
          return z.life > 0;
        });

        for (let i = 0; i < game.tunnelBombs.length; i++) {
          const b = game.tunnelBombs[i];
          b.x += b.vx;
          b.y += b.vy;
          b.age++;
          b.vy += 0.05;

          if (b.x > GAME_WIDTH + 40 || b.y > GAME_HEIGHT) {
            explode(game, Math.min(b.x, GAME_WIDTH - 10), b.y, '#ff6600', '#ffaa00', 20);
            b.dead = true;
            game.tunnelBombActive = true;
            game.tunnelBombTimer = 3600;
            game.pipeGap = PIPE_GAP_BOMB;
            playSfx('explosion');
          }
        }

        compactArrayInPlace(game.tunnelBombs, (b) => !b.dead);

        for (let i = 0; i < game.blasts.length; i++) {
          game.blasts[i].life--;
        }
        compactArrayInPlace(game.blasts, (bl) => bl.life > 0);

        if (game.invincible === 0) {
          for (let i = game.enemies.length - 1; i >= 0; i--) {
            const e = game.enemies[i];
            if (e.dead) continue;

            const dx = e.x - game.player.x;
            const dy = e.y - game.player.y;
            const hitRadius = e.size + 12;
            if (dx * dx + dy * dy < hitRadius * hitRadius) {
              if (game.shieldKillsEnemies) {
                killEnemy(game, e);
                continue;
              }

              if (handleShieldHit(game)) {
                continue;
              }

              if (endRun(game)) break;
            }
          }

          for (let i = game.enemyBullets.length - 1; i >= 0; i--) {
            const b = game.enemyBullets[i];
            const dx = b.x - game.player.x;
            const dy = b.y - game.player.y;
            const hitRadius = (b.size || 4) + 12;
            if (dx * dx + dy * dy < hitRadius * hitRadius) {
              game.enemyBullets.splice(i, 1);
              explode(game, b.x, b.y, '#ff3355', '#ffaa33', 8);

              if (handleShieldHit(game)) {
                continue;
              }

              if (endRun(game)) break;
            }
          }
        }

        if (game.invincible === 0) {
          const hitTopBoundary = game.player.y - playerHalf <= 0;
          const hitBottomBoundary = game.player.y + playerHalf >= groundY;

          if (hitTopBoundary || hitBottomBoundary) {
            if (handleShieldHit(game)) {
              if (hitTopBoundary) {
                game.player.y = playerHalf + 2;
              } else {
                game.player.y = groundY - playerHalf - 2;
              }
            } else {
              endRun(game);
            }
          } else {
            game.player.y = Math.max(
              playerHalf + 2,
              Math.min(groundY - playerHalf - 2, game.player.y)
            );
          }
        }

        compactArrayInPlace(game.enemies, (e) => !e.dead && e.x > -80);
        compactArrayInPlace(game.enemyBullets, (b) => !b.dead);

        for (let i = 0; i < game.particles.length; i++) {
          const p = game.particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.05;
          p.life--;
        }
        compactArrayInPlace(
          game.particles,
          (p) =>
            p.life > 0 &&
            p.x > -90 &&
            p.x < GAME_WIDTH + 90 &&
            p.y > -90 &&
            p.y < GAME_HEIGHT + 90
        );

        if (game.scoreDirty) {
          onScore(game.score, game.kills);
          game.scoreDirty = false;
        }
      }

      game.perfOverlayFrameCounter = (game.perfOverlayFrameCounter || 0) + 1;
      game.perfOverlayElapsedMs = (game.perfOverlayElapsedMs || 0) + frameDeltaMs;
      if (game.perfOverlayElapsedMs >= 500) {
        game.perfOverlayFps = Math.round(
          (game.perfOverlayFrameCounter * 1000) / game.perfOverlayElapsedMs
        );
        game.perfOverlayFrameCounter = 0;
        game.perfOverlayElapsedMs = 0;
      }

      const skipRenderFrame =
        simulationActive &&
        game.lowFx &&
        game.frame % 2 === 1 &&
        (game.ultraLowFx || game.renderPerfLevel >= 1 || game.slowFrameStreak >= Math.max(4, Math.floor(IOS_SLOW_FRAMES_TO_DEGRADE / 2)));
      game.perfFrameSkipActive = skipRenderFrame;

      if (skipRenderFrame) {
        animId = requestAnimationFrame(loop);
        return;
      }

      const drawScaleX = canvas.width / GAME_WIDTH;
      const drawScaleY = canvas.height / GAME_HEIGHT;
      ctx.setTransform(drawScaleX, 0, 0, drawScaleY, 0, 0);
      ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      const fxProfile = getRenderFxProfile(game);
      const renderCache = getRenderCache(game, GAME_WIDTH, GAME_HEIGHT);
      const ultraVisualSkip = fxProfile.ultra && game.frame % 2 === 1;

      drawBackground(
        ctx,
        GAME_WIDTH,
        GAME_HEIGHT,
        game.frame,
        game.scrollX,
        fxProfile.lowFx,
        fxProfile,
        renderCache
      );
      for (let i = 0; i < game.pipes.length; i++) {
        drawTunnelPassage(ctx, game.pipes[i], GAME_HEIGHT, game.frame, fxProfile.lowFx, fxProfile);
      }
      for (let i = 0; i < game.enemies.length; i++) {
        drawEnemy(ctx, game.enemies[i], game.frame, fxProfile.lowFx);
      }
      for (let i = 0; i < game.bullets.length; i++) {
        drawBullet(ctx, game.bullets[i], fxProfile.lowFx);
      }

      for (let i = 0; i < game.enemyBullets.length; i++) {
        const b = game.enemyBullets[i];
        if (game.lowFx) {
          ctx.fillStyle = b.napalm ? '#ff8a45' : '#ff5577';
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.size || 4, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }
        ctx.save();
        if (b.napalm) {
          ctx.shadowColor = '#ff7a38';
          ctx.shadowBlur = 12;
          const ember = ctx.createLinearGradient(b.x - 2, b.y - 8, b.x + 2, b.y + 8);
          ember.addColorStop(0, '#ffd27a');
          ember.addColorStop(1, '#ff5a2e');
          ctx.fillStyle = ember;
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.size || 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 0.6;
          ctx.fillStyle = '#ff9a4c';
          ctx.fillRect(b.x - 1.5, b.y - (b.size || 5) - 6, 3, 7);
        } else {
          ctx.fillStyle = '#ff5577';
          ctx.shadowColor = '#ff5577';
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.size || 4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      for (let i = 0; i < game.rockets.length; i++) {
        const r = game.rockets[i];
        r.weaponType = 'rocket';
        drawBullet(ctx, r, fxProfile.lowFx);
      }
      for (let i = 0; i < game.blasts.length; i++) {
        drawBlast(ctx, game.blasts[i], GAME_WIDTH, GAME_HEIGHT, fxProfile.lowFx);
      }
      for (let i = 0; i < game.tunnelBombs.length; i++) {
        drawTunnelBomb(ctx, game.tunnelBombs[i], fxProfile.lowFx);
      }
      if (!ultraVisualSkip) {
        for (let i = 0; i < game.zapArcs.length; i++) {
          const z = game.zapArcs[i];
          drawZapArc(ctx, z.x1, z.y1, z.x2, z.y2, z.points, fxProfile.lowFx);
        }
      }

      if (game.lowFx && !ultraVisualSkip) {
        ctx.shadowBlur = 0;
        for (let i = 0; i < game.particles.length; i++) {
          const p = game.particles[i];
          ctx.globalAlpha = Math.max(0, p.life / (p.type === 'explosion' ? 40 : 20));
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x, p.y, p.size || 2, p.size || 2);
        }
        ctx.globalAlpha = 1;
      } else if (!game.lowFx) {
        for (let i = 0; i < game.particles.length; i++) {
          const p = game.particles[i];
          ctx.save();
          ctx.globalAlpha = Math.max(0, p.life / (p.type === 'explosion' ? 40 : 20));
          ctx.shadowColor = p.color;
          ctx.shadowBlur = p.type === 'explosion' ? 10 : 4;
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x, p.y, p.size || 3, p.size || 3);
          ctx.restore();
        }
      }

      if (game.energyOrbCount > 0 && !ultraVisualSkip) {
        const orbCount = game.energyOrbCount;
        const orbRadius = 34 + game.energyOrbTier * 3;
        for (let i = 0; i < orbCount; i++) {
          const angle = game.frame * 0.08 + (i * Math.PI * 2) / orbCount;
          const orbX = game.player.x + Math.cos(angle) * orbRadius;
          const orbY = game.player.y + Math.sin(angle) * orbRadius;
          if (game.lowFx) {
            ctx.fillStyle = i % 2 === 0 ? '#7de3ff' : '#b6f1ff';
            ctx.fillRect(orbX - 2, orbY - 2, 4, 4);
          } else {
            ctx.save();
            ctx.shadowColor = '#7de3ff';
            ctx.shadowBlur = 12;
            ctx.fillStyle = i % 2 === 0 ? '#7de3ff' : '#b6f1ff';
            ctx.beginPath();
            ctx.arc(orbX, orbY, 4.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }
      }

      if (game.orbitalDrones?.length && !ultraVisualSkip) {
        for (let i = 0; i < game.orbitalDrones.length; i++) {
          const drone = game.orbitalDrones[i];
          if (drone.dead || drone.state === 'spent') continue;
          ctx.save();
          ctx.translate(drone.x, drone.y);
          const heading = Math.atan2(drone.vy || 0, drone.vx || 1);
          ctx.rotate(heading);
          if (!game.lowFx) {
            ctx.shadowColor = '#ffb877';
            ctx.shadowBlur = 10;
          }
          ctx.fillStyle = '#ffb877';
          ctx.beginPath();
          ctx.moveTo(7, 0);
          ctx.lineTo(-5, -3.8);
          ctx.lineTo(-2.8, 0);
          ctx.lineTo(-5, 3.8);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }

      const showPlayer =
        gameState !== 'playing' || game.invincible === 0 || game.frame % 6 < 4;

      if (showPlayer) {
        if (gameState === 'playing' || gameState === 'gameover') {
          if (game.teleportWindup) {
            const t = 1 - game.teleportWindup.framesLeft / 12;
            const easeIn = t * t * (3 - 2 * t);

            const pullX = game.player.x - easeIn * 26;
            const pullY = game.player.y + Math.sin(easeIn * Math.PI) * 4;
            const fakeVelocity = game.player.velocity - easeIn * 3;

            const scale = Math.max(0.08, 1 - easeIn * 0.82);
            const alpha = Math.max(0.04, 1 - easeIn * 0.92);

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.translate(pullX, pullY);
            ctx.rotate(-easeIn * 0.2);
            ctx.scale(scale, scale);

            drawPlayerSkin(
              ctx,
              0,
              0,
              fakeVelocity,
              game.shields,
              skinId || 'default',
              game.frame
            );

            ctx.restore();

            ctx.save();
            ctx.globalAlpha = 0.22 * (1 - easeIn);
            ctx.translate(pullX + 10, pullY);
            ctx.scale(scale * 1.15, scale * 1.15);

            drawPlayerSkin(
              ctx,
              0,
              0,
              fakeVelocity,
              game.shields,
              skinId || 'default',
              game.frame
            );

            ctx.restore();
          } else {
            drawPlayerSkin(
              ctx,
              game.player.x,
              game.player.y,
              game.player.velocity,
              game.shields,
              skinId || 'default',
              game.frame
            );
          }

          if (!ultraVisualSkip) {
            for (let i = 0; i < game.portalEffects.length; i++) {
              drawPortal(ctx, game.portalEffects[i], game.lowFx);
            }
          }

          if (game.weaponId === 'rocket' && gameState === 'playing') {
            drawRocketPods(ctx, game.player.x, game.player.y, game.frame, game.lowFx);
          }

          if (
            game.shieldKillsEnemies &&
            game.shieldDurationLeft > 0 &&
            !game.ultraLowFx &&
            !game.lowFx
          ) {
            ctx.save();
            ctx.shadowColor = '#870101';
            ctx.shadowBlur = 20;
            ctx.strokeStyle = `rgba(170,68,255,${0.4 + Math.sin(game.frame * 0.1) * 0.2})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(game.player.x, game.player.y, PLAYER_SIZE + 10, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }
        } else {
          const iy = GAME_HEIGHT / 2 + Math.sin(Date.now() * 0.003) * 15;
          drawPlayerSkin(
            ctx,
            120,
            iy,
            Math.sin(Date.now() * 0.003) * 2,
            MAX_SHIELDS,
            skinId || 'default',
            game.frame
          );
        }
      }

      if (!game.lowFx) {
        drawCinematicGrade(ctx, GAME_WIDTH, GAME_HEIGHT, game.frame, game.speed, game.lowFx);
      }

      if (gameState === 'playing') {
        drawHUD(
          ctx,
          game.score,
          game.shields,
          game.kills,
          GAME_WIDTH,
          game.killStreak,
          game.blastReady,
          game.tunnelBombActive,
          game.tunnelBombTimer,
          game.weaponId,
          game.zapCharge,
          game.weaponDef?.maxCharge || 180,
          game.comboSpecialId,
          game.comboSpecialUses,
          game.engineBurstCharges,
          fxProfile.lowFx
        );
      }

      drawPerfOverlay(ctx, game, GAME_WIDTH);

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [
    gameState,
    onGameOver,
    onScore,
    skinId,
    onBlastReadyChange,
    onTunnelBombReadyChange,
    renderScale,
    renderDpr,
  ]);

  return (
    <canvas
      ref={canvasRef}
      width={renderWidth}
      height={renderHeight}
      onMouseDown={isMobileDevice ? undefined : handleCanvasPointerDown}
      onMouseUp={isMobileDevice ? undefined : handleCanvasPointerUp}
      onMouseLeave={isMobileDevice ? undefined : handleCanvasPointerUp}
      className={`block ${isMobileDevice ? 'w-full h-auto max-w-full max-h-full object-contain' : 'rounded-lg w-full h-auto'}`}
      style={{
        width: '100%',
        height: 'auto',
        maxWidth: '100%',
        maxHeight: '100%',
        aspectRatio: isMobileDevice ? `${GAME_WIDTH} / ${GAME_HEIGHT}` : undefined,
        objectFit: isMobileDevice ? 'contain' : undefined,
        cursor: isMobileDevice ? 'default' : 'crosshair',
        touchAction: 'none',
        border: isMobileDevice ? 'none' : '1px solid hsla(180, 100%, 50%, 0.3)',
        boxShadow: isMobileDevice
          ? 'none'
          : '0 0 30px hsla(180, 100%, 50%, 0.15), 0 0 60px hsla(300, 100%, 50%, 0.08)',
      }}
    />
  );
}
