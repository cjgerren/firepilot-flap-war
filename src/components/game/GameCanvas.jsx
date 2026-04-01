import React, { useRef, useEffect, useCallback } from 'react';
import { drawPlayerSkin } from '../../lib/skins.js';
import { getWeapon, COMBO_PACKS } from '../../lib/gameItems.js';
import {
  getSelectedWeapon,
  getEquippedUpgrades,
  consumeEquippedUpgrade,
  getOwnedCombos,
  isComboActive,
  addDiamonds,
} from '../../lib/gameStore.js';


const GAME_WIDTH = 800;
const GAME_HEIGHT = 500;
const GRAVITY = 0.18;
const JUMP_FORCE = -5.5;
const PIPE_WIDTH = 50;
const PIPE_GAP = 150;
const PIPE_GAP_BOMB = 240;
const PIPE_SPEED_BASE = 3;
const PLAYER_SIZE = 24;
const GROUND_HEIGHT = 40;
const MAX_SHIELDS = 3;
const BLAST_STREAK = 3;

const DEFAULT_SETTINGS = {
  flapKey: 'Space',
  shootKey: 'KeyF',
  blastKey: 'KeyB',
  bombKey: 'KeyT',
  musicEnabled: true,
  sfxEnabled: true,
  musicVolume: 0.6,
  sfxVolume: 0.8,
  onlineMode: true,
};

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
  const settings = loadSettings();
  if (!settings.sfxEnabled) return;

  try {
    const audio = new Audio(`/audio/sfx/${name}.wav`);
    audio.volume = 0.5;
    audio.play().catch(() => { });
  } catch (err) {
    console.warn('SFX error:', err);
  }
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

function drawBullet(ctx, b) {
  ctx.save();

  if (b.weaponType === 'lightning_zap') {
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 20;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const cx = b.x + i * 20 + (Math.random() - 0.5) * 8;
      const cy = b.y + (Math.random() - 0.5) * 16;
      if (i === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    }
    ctx.stroke();
    ctx.shadowColor = '#aaaaff';
    ctx.shadowBlur = 8;
    ctx.strokeStyle = '#aaaaff';
    ctx.stroke();
  } else if (b.weaponType === 'rocket') {
    ctx.shadowColor = '#ff4400';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ff4400';
    ctx.beginPath();
    ctx.moveTo(b.x + 14, b.y);
    ctx.lineTo(b.x, b.y - 4);
    ctx.lineTo(b.x + 4, b.y);
    ctx.lineTo(b.x, b.y + 4);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ff8800';
    ctx.beginPath();
    ctx.arc(b.x + 2, b.y, 3, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const color = b.color || '#ffff00';
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = color;
    ctx.fillRect(b.x, b.y - 2, b.isAuto ? 14 : 18, b.isAuto ? 2 : 3);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(b.x + 14, b.y - 1, 5, 1);
  }

  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawRocketPods(ctx, px, py, frame) {
  const offsets = [8, -8];

  offsets.forEach((dy) => {
    ctx.save();
    ctx.shadowColor = '#000dff';
    ctx.shadowBlur = 6;
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(px - 8, py + dy - 2, 12, 4);

    ctx.fillStyle = '#ff0000';
    ctx.fillRect(px + 4, py + dy - 1, 3, 2);

    ctx.shadowColor = '#001eff';
    ctx.shadowBlur = 8;
    ctx.fillStyle = `rgba(255,100,0,${0.4 + Math.sin(frame * 0.3 + dy) * 0.2})`;
    ctx.beginPath();
    ctx.arc(px - 8, py + dy, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
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

function drawTunnelBomb(ctx, b) {
  ctx.save();
  const pulse = 0.7 + Math.sin(b.age * 0.3) * 0.3;

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
  ctx.beginPath();
  ctx.moveTo(b.x - 8, b.y);
  ctx.lineTo(b.x - 18 - Math.random() * 8, b.y - 5);
  ctx.lineTo(b.x - 22 - Math.random() * 6, b.y);
  ctx.lineTo(b.x - 18 - Math.random() * 8, b.y + 5);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawBlast(ctx, blast, width, height) {
  const groundY = height - GROUND_HEIGHT;
  const progress = 1 - blast.life / blast.maxLife;
  const alpha = blast.life / blast.maxLife;

  ctx.save();

  const waveX = blast.originX;
  const waveW = (width - waveX + 60) * progress + 30;
  const waveH = 60 + progress * 80;
  const wy = blast.originY - waveH / 2;

  ctx.globalAlpha = alpha * 0.55;
  const grad = ctx.createLinearGradient(waveX, 0, waveX + waveW, 0);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.2, '#ff00ff');
  grad.addColorStop(0.6, '#00ffff');
  grad.addColorStop(1, 'transparent');

  ctx.shadowColor = '#ff00ff';
  ctx.shadowBlur = 30;
  ctx.fillStyle = grad;
  ctx.fillRect(waveX, wy, waveW, waveH);

  ctx.globalAlpha = alpha;
  ctx.shadowColor = '#ffffff';
  ctx.shadowBlur = 20;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(waveX + waveW, Math.max(5, wy));
  ctx.lineTo(waveX + waveW, Math.min(groundY, wy + waveH));
  ctx.stroke();

  ctx.restore();
}

function drawPortal(ctx, portal) {
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

function drawZapArc(ctx, x1, y1, x2, y2) {
  ctx.save();
  ctx.shadowColor = '#ffffff';
  ctx.shadowBlur = 20;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x1, y1);

  const segs = 6;
  for (let i = 1; i <= segs; i++) {
    const t = i / segs;
    const mx = x1 + (x2 - x1) * t + (Math.random() - 0.5) * 30;
    const my = y1 + (y2 - y1) * t + (Math.random() - 0.5) * 30;
    ctx.lineTo(mx, my);
  }

  ctx.lineTo(x2, y2);
  ctx.stroke();

  ctx.shadowColor = '#aaaaff';
  ctx.shadowBlur = 6;
  ctx.strokeStyle = '#aaaaff';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function drawEnemy(ctx, e, frame) {
  ctx.save();
  ctx.translate(e.x, e.y);
  const pulse = Math.sin(frame * 0.1 + e.seed) * 0.3 + 0.7;

  if (e.type === 'drone') {
    ctx.shadowColor = '#ff4400';
    ctx.shadowBlur = 10 * pulse;
    ctx.strokeStyle = '#ff4400';
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
      const r = 14;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }

    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = '#330d00';
    ctx.fill();

    ctx.shadowColor = '#ff2200';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#ff4400';
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < 4; i++) {
      const ra = (i / 4) * Math.PI * 2 + frame * 0.3;
      ctx.fillStyle = `rgba(255,68,0,${0.4 * pulse})`;
      ctx.fillRect(Math.cos(ra) * 18 - 4, Math.sin(ra) * 5 - 1, 8, 2);
    }
  } else if (e.type === 'seeker') {
    ctx.shadowColor = '#ff0066';
    ctx.shadowBlur = 12 * pulse;
    ctx.fillStyle = '#ff0066';
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-10, -10);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-10, 10);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#330011';
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(-6, -6);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-6, 6);
    ctx.closePath();
    ctx.fill();

    ctx.shadowColor = '#ae5f04';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#af5d11';
    ctx.beginPath();
    ctx.arc(6, 0, 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.type === 'bomber') {
    ctx.shadowColor = '#ff8800';
    ctx.shadowBlur = 14 * pulse;
    ctx.fillStyle = '#ff8800';
    ctx.fillRect(-18, -10, 36, 20);

    ctx.fillStyle = '#3d1a00';
    ctx.fillRect(-14, -6, 28, 12);

    ctx.fillStyle = '#ffff00';
    for (let i = -14; i < 14; i += 8) {
      ctx.fillRect(i, -10, 4, 3);
      ctx.fillRect(i + 4, 7, 4, 3);
    }
  } else if (e.type === 'ground_turret') {
    ctx.shadowColor = '#1e5322';
    ctx.shadowBlur = 12 * pulse;

    // Base
    ctx.fillStyle = '#17404d';
    ctx.fillRect(-16, -8, 32, 16);

    ctx.strokeStyle = '#2a4b2f';
    ctx.lineWidth = 2;
    ctx.strokeRect(-16, -8, 32, 16);

    // Treads / ground base
    ctx.fillStyle = '#0f1a22';
    ctx.fillRect(-18, 8, 36, 6);

    // Turret head
    ctx.fillStyle = '#245d70';
    ctx.fillRect(-10, -18, 20, 12);

    ctx.strokeStyle = '#453d28';
    ctx.lineWidth = 2;
    ctx.strokeRect(-10, -18, 20, 12);

    // Cannon aimed forward/up slightly
    ctx.fillStyle = '#322a1a';
    ctx.fillRect(4, -15, 16, 4);

    // Core light
    ctx.shadowColor = '#4a4228';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#413312';
    ctx.beginPath();
    ctx.arc(0, -12, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Small glow accents
    ctx.shadowBlur = 0;
    ctx.fillStyle = `rgba(125,227,255,${0.35 + pulse * 0.25})`;
    ctx.fillRect(-12, -4, 4, 4);
    ctx.fillRect(8, -4, 4, 4);
  }

  if (e.hp < e.maxHp) {
    const bw = 30;
    const bh = 4;
    ctx.fillStyle = '#330000';
    ctx.fillRect(-bw / 2, -24, bw, bh);
    ctx.fillStyle = e.type === 'ground_turret' ? '#090909' : '#080808';
    ctx.fillRect(-bw / 2, -24, bw * (e.hp / e.maxHp), bh);
  }

  ctx.restore();
}

function drawPipe(ctx, x, topHeight, gap, gameHeight, frame) {
  const bottomY = topHeight + gap;
  const groundY = gameHeight - GROUND_HEIGHT;

  const topGrad = ctx.createLinearGradient(x, 0, x + PIPE_WIDTH, 0);
  topGrad.addColorStop(0, '#060707');
  topGrad.addColorStop(0.5, '#404040');
  topGrad.addColorStop(1, '#080909');
  neonRect(ctx, x, 0, PIPE_WIDTH, topHeight, topGrad, '#ff0000', 6);
  neonRect(ctx, x - 4, topHeight - 16, PIPE_WIDTH + 8, 16, '#2f1717', '#ffffff', 10);

  ctx.globalAlpha = 0.12;
  for (let sy = 0; sy < topHeight; sy += 6) {
    ctx.fillStyle = '#fb0202';
    ctx.fillRect(x, sy, PIPE_WIDTH, 1);
  }
  ctx.globalAlpha = 1;

  const botGrad = ctx.createLinearGradient(x, bottomY, x + PIPE_WIDTH, bottomY);
  botGrad.addColorStop(0, '#030303');
  botGrad.addColorStop(0.5, '#050438');
  botGrad.addColorStop(1, '#040404');
  neonRect(ctx, x, bottomY, PIPE_WIDTH, groundY - bottomY, botGrad, '#090949', 6);
  neonRect(ctx, x - 4, bottomY, PIPE_WIDTH + 8, 16, '#0f102d', '#f9f9f9', 10);

  ctx.globalAlpha = 0.12;
  for (let sy = bottomY; sy < groundY; sy += 6) {
    ctx.fillStyle = '#ff00ff';
    ctx.fillRect(x, sy, PIPE_WIDTH, 1);
  }
  ctx.globalAlpha = 1;
}

function drawBackground(ctx, width, height, frame, scrollX) {
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, '#07071a');
  bg.addColorStop(1, '#0a0a1a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const groundY = height - GROUND_HEIGHT;
  ctx.globalAlpha = 0.12;
  const gs = 40;
  const off = scrollX % gs;

  for (let x = -off; x < width + gs; x += gs) neonLine(ctx, x, groundY, x, height, '#00ffff', 0.5, 2);
  for (let y = groundY; y < height; y += 10) neonLine(ctx, 0, y, width, y, '#00ffff', 0.5, 1);

  ctx.globalAlpha = 1;
  neonLine(ctx, 0, groundY, width, groundY, '#00ffff', 2, 14);

  ctx.globalAlpha = 0.07;
  const co = (scrollX * 0.2) % 200;
  const blds = [60, 90, 45, 110, 70, 85, 55, 100, 65, 80, 95, 50, 75, 105, 60, 90];
  blds.forEach((bh, i) => {
    ctx.fillStyle = '#00ffff';
    ctx.fillRect(i * 60 - co, groundY - bh, 40, bh);
  });

  ctx.globalAlpha = 0.35;
  for (let i = 0; i < 25; i++) {
    const px = ((i * 137 + frame * 0.25 + scrollX * 0.08) % (width + 80)) - 40;
    const py = ((i * 97 + Math.sin(frame * 0.02 + i) * 20) % (groundY - 30)) + 15;
    ctx.fillStyle = i % 3 === 0 ? '#ff00ff' : '#00ffff';
    ctx.fillRect(px, py, 1 + (i % 2), 1 + (i % 2));
  }

  ctx.globalAlpha = 1;
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
  comboSpecialUses
) {
  ctx.save();

  ctx.font = '700 28px Orbitron, monospace';
  ctx.textAlign = 'center';
  ctx.shadowColor = '#00ffff';
  ctx.shadowBlur = 20;
  ctx.fillStyle = '#00ffff';
  ctx.fillText(score, width / 2, 44);
  ctx.shadowBlur = 0;

  ctx.font = '600 12px JetBrains Mono, monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(0,255,255,0.5)';
  ctx.fillText('SHD', 16, 22);

  for (let i = 0; i < MAX_SHIELDS; i++) {
    const sx = 52 + i * 18;
    ctx.shadowColor = i < shields ? '#00ffff' : 'transparent';
    ctx.shadowBlur = i < shields ? 8 : 0;
    ctx.fillStyle = i < shields ? '#00ffff' : '#002222';
    ctx.fillRect(sx, 10, 12, 12);
    ctx.shadowBlur = 0;
  }

  ctx.textAlign = 'right';
  ctx.shadowColor = '#ff4400';
  ctx.shadowBlur = 8;
  ctx.fillStyle = '#ff4400';
  ctx.fillText(`KILLS: ${kills}`, width - 14, 22);
  ctx.shadowBlur = 0;

  const dotColors = ['#ff4400', '#ff8800', '#ffff00'];
  for (let i = 0; i < BLAST_STREAK; i++) {
    const filled = i < streakCount;
    ctx.shadowColor = filled ? dotColors[i] : 'transparent';
    ctx.shadowBlur = filled ? 8 : 0;
    ctx.fillStyle = filled ? dotColors[i] : '#221100';
    ctx.beginPath();
    ctx.arc(width - 14 - i * 16, 35, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  if (blastReady) {
    ctx.textAlign = 'right';
    ctx.shadowColor = '#ff00ff';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#ff00ff';
    ctx.font = '700 11px Orbitron, monospace';
    ctx.fillText('BLAST READY [B]', width - 14, 52);
    ctx.shadowBlur = 0;
  }

  if (tunnelBombActive) {
    ctx.textAlign = 'left';
    ctx.shadowColor = '#ff6600';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#ff6600';
    ctx.font = '700 10px Orbitron, monospace';
    const secs = Math.ceil(tunnelBombTimer / 60);
    ctx.fillText(`💣 WIDE TUNNEL ${secs}s`, 14, 48);
    ctx.shadowBlur = 0;
  }

  if (weaponId === 'lightning') {
    drawChargeBar(ctx, 0, 58, zapCharge, zapMax, width);
  }

  if (comboSpecialId === 'teleport_blink' && comboSpecialUses > 0) {
    ctx.textAlign = 'left';
    ctx.shadowColor = '#99ddff';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#99ddff';
    ctx.font = '700 10px Orbitron, monospace';
    ctx.fillText(`BLINK [Q] ${comboSpecialUses}`, 14, 64);
    ctx.shadowBlur = 0;
  }

  ctx.restore();
}
function getDifficultyTier(score) {
  if (score < 8) {
    return {
      speed: PIPE_SPEED_BASE,
      pipeSpawnMin: 105,
      pipeSpawnDecay: 1.5,
      enemySpawnMin: 125,
      enemySpawnDecay: 4,
      seekerBias: 0.2,
      bomberBias: 0.05,
    };
  }

  if (score < 20) {
    return {
      speed: PIPE_SPEED_BASE + 0.8,
      pipeSpawnMin: 95,
      pipeSpawnDecay: 1.8,
      enemySpawnMin: 110,
      enemySpawnDecay: 5,
      seekerBias: 0.28,
      bomberBias: 0.1,
    };
  }

  if (score < 35) {
    return {
      speed: PIPE_SPEED_BASE + 1.5,
      pipeSpawnMin: 88,
      pipeSpawnDecay: 2,
      enemySpawnMin: 98,
      enemySpawnDecay: 5.5,
      seekerBias: 0.35,
      bomberBias: 0.14,
    };
  }

  return {
    speed: PIPE_SPEED_BASE + 2.0,
    pipeSpawnMin: 82,
    pipeSpawnDecay: 2.1,
    enemySpawnMin: 92,
    enemySpawnDecay: 6,
    seekerBias: 0.4,
    bomberBias: 0.18,
  };
}
export default function GameCanvas({
  onGameOver,
  onScore,
  gameState,
  skinId,
  onBlastReadyChange,
  jumpRef,
  shootRef,
  shootStartRef,
  shootStopRef,
  blastRef,
  onTunnelBombReadyChange,
  tunnelBombRef,
}) {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const settingsRef = useRef(loadSettings());

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

    let comboWeaponId = null;
    let comboUpgradeIds = [];
    let comboSpecialId = null;

    const ownedCombos = getOwnedCombos();

    for (const comboId of ownedCombos) {
      if (!isComboActive(comboId)) continue;

      const combo = COMBO_PACKS.find((c) => c.id === comboId);
      if (!combo || !Array.isArray(combo.contents)) continue;

      for (const item of combo.contents) {
        if (!item || !item.category || !item.id) continue;

        if (item.category === 'weapon' && !comboWeaponId) {
          comboWeaponId = item.id;
        } else if (item.category === 'upgrade') {
          comboUpgradeIds.push(item.id);
        } else if (item.category === 'special' && !comboSpecialId) {
          comboSpecialId = item.id;
        }
      }

      break;
    }

    const comboUpgradeCounts = {};

    for (const id of comboUpgradeIds) {
      if (id === 'shield1' || id === 'shield2' || id === 'tunnelbomb') {
        comboUpgradeCounts[id] = (comboUpgradeCounts[id] || 0) + 1;
      }
    }

    const equipped = {
      ...baseEquipped,
      ...comboUpgradeCounts,
    };

    let weaponId = selectedWeaponId;

    if (comboWeaponId) {
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
      pipeTimer: 0,
      enemyTimer: 0,
      speed: PIPE_SPEED_BASE,
      invincible: 0,
      postTeleportFreeze: 0,
      killStreak: 0,
      blastReady: false,
      ended: false,
      weaponId,
      weaponDef,
      comboSpecialId,
      comboSpecialUses: comboSpecialId === 'teleport_blink' ? 3 : 0,
      burstPending: [],
      burstTimer: 0,
      autoHeld: false,
      zapCharge: weaponDef.maxCharge || 0,
      zapCooldown: 0,
      tunnelBombReady: hasTunnelBomb,
      tunnelBombActive: false,
      tunnelBombTimer: 0,
      pipeGap: PIPE_GAP,
    };
  }

  if (!gameRef.current) gameRef.current = makeInitialState();

  function explode(game, x, y, color1, color2, count = 12) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const speed = 1.5 + Math.random() * 3;
      game.particles.push({
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
    explode(game, e.x, e.y, '#ff4400', '#ffff00', 16);
    e.dead = true;
    game.kills++;

    const baseScore =
      e.type === 'ground_turret'
        ? 4
        : e.type === 'bomber'
          ? 3
          : e.type === 'seeker'
            ? 2
            : 1;

    game.score += baseScore + scoreBonus;
    game.killStreak++;

    if (e.type === 'ground_turret') {
      const diamondReward = e.diamondReward ?? 1;
      addDiamonds(diamondReward);
      game.diamondsEarned = (game.diamondsEarned || 0) + diamondReward;
    }

    playSfx('explosion');

    if (game.killStreak >= BLAST_STREAK && !game.blastReady) {
      game.blastReady = true;
      game.killStreak = 0;
      onBlastReadyChange && onBlastReadyChange(true);
      playSfx('powerup');
    }

    onScore(game.score, game.kills);
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

    const nextPipe = game.pipes
      .filter((p) => p.x + PIPE_WIDTH > game.player.x + 10)
      .sort((a, b) => a.x - b.x)[0];

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

    game.portalEffects.push({
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

    playSfx('hit');
    onGameOver(game.score, game.kills, game.diamondsEarned || 0);

    return true;
  }

  const tunnelBomb = useCallback(() => {
    if (gameState !== 'playing') return;
    const game = gameRef.current;
    if (!game || game.ended) return;
    if (!game.tunnelBombReady) return;

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
  }, [gameState, onTunnelBombReadyChange]);

  const useComboSpecial = useCallback(() => {
    if (gameState !== 'playing') return;

    const game = gameRef.current;
    if (!game || game.ended) return;

    if (game.comboSpecialId !== 'teleport_blink') return;
    if ((game.comboSpecialUses || 0) <= 0) return;
    if (game.teleportWindup) return;

    const nextPipe = game.pipes
      .filter((p) => p.x + PIPE_WIDTH > game.player.x + 10)
      .sort((a, b) => a.x - b.x)[0];

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

    game.portalEffects.push({
      x: game.player.x,
      y: game.player.y,
      life: 16,
      maxLife: 16,
      type: 'entry',
    });

    playSfx('powerup');
  }, [gameState]);

  const blast = useCallback(() => {
    if (gameState !== 'playing') return;
    const game = gameRef.current;
    if (!game || game.ended) return;
    if (!game.blastReady) return;

    game.blastReady = false;
    game.killStreak = 0;
    onBlastReadyChange && onBlastReadyChange(false);

    playSfx('blast');

    game.blasts.push({
      originX: game.player.x + PLAYER_SIZE,
      originY: game.player.y,
      life: 35,
      maxLife: 35,
    });

    game.enemies.forEach((e) => {
      explode(game, e.x, e.y, '#ff00ff', '#ffffff', 18);
      game.kills++;
      game.score += e.type === 'bomber' ? 3 : e.type === 'seeker' ? 2 : 1;
    });

    if (game.enemies.length > 0) {
      playSfx('explosion');
    }

    game.enemies = [];
    game.enemyBullets = [];
    onScore(game.score, game.kills);
  }, [gameState, onBlastReadyChange, onScore]);

  const shoot = useCallback(() => {
    if (gameState !== 'playing') return;
    const game = gameRef.current;
    if (!game || game.ended) return;

    const { weaponDef, weaponId } = game;

    if (weaponId === 'lightning') {
      if (game.zapCooldown > 0) return;

      const def = weaponDef;
      const livingEnemies = game.enemies.filter((e) => !e.dead);
      const sortedEnemies = [...livingEnemies].sort((a, b) => {
        const da = Math.hypot(a.x - game.player.x, a.y - game.player.y);
        const db = Math.hypot(b.x - game.player.x, b.y - game.player.y);
        return da - db;
      });

      const primaryTarget = sortedEnemies[0] || null;
      const maxChains = def.chainCount || 1;

      if (game.zapCharge > 0 && primaryTarget) {
        playSfx('shoot');

        for (const enemy of sortedEnemies.slice(0, maxChains)) {
          game.zapArcs.push({
            x1: game.player.x,
            y1: game.player.y,
            x2: enemy.x,
            y2: enemy.y,
            life: 8,
          });
          enemy.hp -= def.damage || 2;
          if (enemy.hp <= 0) killEnemy(game, enemy);
        }

        game.zapCharge = Math.max(0, game.zapCharge - def.drainRate);
        game.zapCooldown = weaponDef.fireRate;
        return;
      }

      playSfx('shoot');
      game.bullets.push({
        x: game.player.x + PLAYER_SIZE / 2 + 4,
        y: game.player.y,
        spawnFrame: game.frame,
        weaponType: 'auto',
        color: '#00ffff',
        isAuto: true,
      });
      game.zapCooldown = Math.max(4, Math.floor((weaponDef.fireRate || 6) * 0.75));
      return;
    }

    const lastBullet = game.bullets[game.bullets.length - 1];
    if (lastBullet && game.frame - lastBullet.spawnFrame < weaponDef.fireRate) return;

    const bx = game.player.x + PLAYER_SIZE / 2 + 4;
    const by = game.player.y;

    playSfx('shoot');

    if (weaponId === 'blaster') {
      game.bullets.push({
        x: bx,
        y: by,
        spawnFrame: game.frame,
        weaponType: 'single',
        color: '#ffff00',
      });
    } else if (weaponId === 'blaster2') {
      game.bullets.push({
        x: bx,
        y: by,
        spawnFrame: game.frame,
        weaponType: 'burst',
        color: '#0008ff',
      });

      game.burstPending.push({
        fireAtFrame: game.frame + 5,
        bullet: {
          x: bx + 20,
          y: by,
          weaponType: 'burst',
          color: '#3104fb',
        },
      });
    } else if (weaponId === 'rocket') {
      game.bullets.push({
        x: bx,
        y: by,
        spawnFrame: game.frame,
        weaponType: 'burst',
        color: '#ff0000',
      });

      game.burstPending.push({
        fireAtFrame: game.frame + 5,
        bullet: {
          x: bx + 20,
          y: by,
          weaponType: 'burst',
          color: '#1900ff',
        },
      });

      [-8, 8].forEach((dy) => {
        game.rockets.push({
          x: game.player.x - 8,
          y: game.player.y + dy,
          vx: 8,
          vy: 0,
          targetId: null,
          age: 0,
        });
      });

    } else if (weaponId === 'auto') {
      game.bullets.push({
        x: bx,
        y: by,
        spawnFrame: game.frame,
        weaponType: 'auto',
        color: '#00ffff',
        isAuto: true,
      });
    }
  }, [gameState]);

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
    if (gameState !== 'playing') return;
    const game = gameRef.current;
    if (!game || game.ended) return;

    if (!game.started) {
      game.started = true;
    }

    game.player.velocity = JUMP_FORCE;

    for (let i = 0; i < 5; i++) {
      game.particles.push({
        x: game.player.x - 10,
        y: game.player.y,
        vx: -2 - Math.random() * 3,
        vy: (Math.random() - 0.5) * 4,
        life: 20,
        color: Math.random() > 0.5 ? '#00ffff' : '#ff00ff',
        type: 'trail',
      });
    }
  }, [gameState]);

  useEffect(() => {
    if (gameState === 'ready') {
      const newState = makeInitialState();
      gameRef.current = newState;

      onBlastReadyChange && onBlastReadyChange(false);
      onTunnelBombReadyChange && onTunnelBombReadyChange(newState.tunnelBombReady);
    }

    if (gameState === 'playing') {
      const eq = getEquippedUpgrades();
      if (eq.shield2 > 0) consumeEquippedUpgrade('shield2');
      else if (eq.shield1 > 0) consumeEquippedUpgrade('shield1');
    }
  }, [gameState, onBlastReadyChange, onTunnelBombReadyChange]);

  useEffect(() => {
    const matches = (code, primary, fallbacks = []) => code === primary || fallbacks.includes(code);

    const handleKeyDown = (e) => {
      const settings = settingsRef.current;

      if (matches(e.code, settings.flapKey, ['ArrowUp'])) {
        e.preventDefault();
        jump();
        return;
      }

      // ✅ ADD THIS BLOCK RIGHT HERE
      if (e.code === 'KeyQ') {
        e.preventDefault();
        if (!e.repeat) useComboSpecial();
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
  }, [jump, blast, tunnelBomb, startShootHold, stopShootHold, useComboSpecial]);

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

  const handleTouchStart = useCallback(
    (e) => {
      e.preventDefault();
      const touch = e.touches?.[0];
      if (!touch) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      if (x < rect.width / 2) {
        jump();
      } else {
        startShootHold();
      }
    },
    [jump, startShootHold]
  );

  const handleTouchEnd = useCallback((e) => {
    e.preventDefault();
    stopShootHold();
  }, [stopShootHold]);


  useEffect(() => {
    if (jumpRef) jumpRef.current = jump;
    if (shootRef) shootRef.current = shoot;
    if (blastRef) blastRef.current = blast;
    if (tunnelBombRef) tunnelBombRef.current = tunnelBomb;
  }, [jump, shoot, blast, tunnelBomb, jumpRef, shootRef, blastRef, tunnelBombRef]);

  useEffect(() => {
    if (shootStartRef) shootStartRef.current = startShootHold;
    if (shootStopRef) shootStopRef.current = stopShootHold;
  }, [startShootHold, stopShootHold, shootStartRef, shootStopRef]);

  function spawnEnemy(game) {
    const groundY = GAME_HEIGHT - GROUND_HEIGHT;
    const tier = getDifficultyTier(game.score);

    const roll = Math.random();
    let type = 'drone';

    if (game.score >= 12 && roll < 0.18) {
      type = 'ground_turret';
    } else if (game.score < 5) {
      type = roll < 0.8 ? 'drone' : 'seeker';
    } else if (roll < tier.bomberBias) {
      type = 'bomber';
    } else if (roll < tier.bomberBias + tier.seekerBias) {
      type = 'seeker';
    } else {
      type = 'drone';
    }

    const configs = {
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

    const cfg = configs[type];

    let spawnY;

    if (type === 'ground_turret') {
      spawnY = groundY - cfg.size - 8;
    } else {
      const nextPipe = game.pipes
        .filter((p) => p.x + PIPE_WIDTH > game.player.x)
        .sort((a, b) => a.x - b.x)[0];

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
      vy: type === 'ground_turret' ? 0 : (Math.random() - 0.5) * 1.2,
      type,
      hp: cfg.hp,
      maxHp: type === 'ground_turret' ? cfg.hp : cfg.maxHp,
      speed: cfg.speed,
      size: cfg.size,
      seed: Math.random() * 100,
      seekTimer: 0,
      shootCooldown:
        type === 'ground_turret'
          ? 70 + Math.floor(Math.random() * 45)
          : 0,
      diamondReward: type === 'ground_turret' ? 1 : 0,
      id: Math.random(),
    });
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animId;

    const loop = () => {
      const game = gameRef.current;
      if (!game) return;

      const groundY = GAME_HEIGHT - GROUND_HEIGHT;
      const playerHalf = PLAYER_SIZE / 2;
      const tier = getDifficultyTier(game.score);

      if (gameState === 'playing') {
        game.frame++;
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

        if (game.teleportWindup) {
          game.teleportWindup.framesLeft--;

          if (game.teleportWindup.framesLeft <= 0) {
            const { exitY, worldShift, desiredPlayerX } = game.teleportWindup;

            game.portalEffects.push({
              x: desiredPlayerX,
              y: exitY,
              life: 24,
              maxLife: 24,
              type: 'exit',
            });

            game.pipes.forEach((p) => {
              p.x -= worldShift;
            });
            game.enemies.forEach((e) => {
              e.x -= worldShift;
            });
            game.bullets.forEach((b) => {
              b.x -= worldShift;
            });
            game.rockets.forEach((r) => {
              r.x -= worldShift;
            });
            game.tunnelBombs.forEach((b) => {
              b.x -= worldShift;
            });
            game.blasts.forEach((b) => {
              b.originX -= worldShift;
            });
            game.zapArcs.forEach((z) => {
              z.x1 -= worldShift;
              z.x2 -= worldShift;
            });
            game.particles.forEach((p) => {
              p.x -= worldShift;
            });

            game.player.x = desiredPlayerX;
            game.player.y = exitY;
            game.player.velocity = 0;
            game.invincible = Math.max(game.invincible, 35);
            game.postTeleportFreeze = 28;
            game.comboSpecialUses -= 1;
            game.teleportWindup = null;

            for (let i = 0; i < 18; i++) {
              game.particles.push({
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

      if (game.weaponId === 'lightning' && game.zapCharge < game.weaponDef.maxCharge) {
        game.zapCharge = Math.min(
          game.weaponDef.maxCharge,
          game.zapCharge + game.weaponDef.rechargeRate
        );
      }

      if (game.burstPending.length > 0) {
        const ready = [];
        const waiting = [];

        for (const item of game.burstPending) {
          if (game.frame >= item.fireAtFrame) {
            ready.push(item);
          } else {
            waiting.push(item);
          }
        }

        game.burstPending = waiting;

        for (const item of ready) {
          game.bullets.push({
            ...item.bullet,
            spawnFrame: game.frame,
          });
        }
      }

      if (game.autoHeld) {
        shoot();
      }

      if (game.started) {
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

      game.portalEffects = game.portalEffects
        .map((p) => ({
          ...p,
          life: p.life - 1,
        }))
        .filter((p) => p.life > 0);

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
          if (game.score >= 20 && game.score < 40) {
            dynamicChance = 0.3;
          } else if (game.score >= 40) {
            dynamicChance = 0.5;
          }

          const isDynamic = Math.random() < dynamicChance;

          game.pipes.push({
            x: GAME_WIDTH + 10,
            topHeight,
            baseTopHeight: topHeight,
            gap,
            scored: false,
            dynamic: isDynamic,
            waveAmp: isDynamic ? (game.score >= 40 ? 22 : 18) : 0,
            waveSpeed: isDynamic ? (game.score >= 40 ? 0.05 : 0.04) : 0,
            waveOffset: Math.random() * Math.PI * 2,
          });

          game.enemyTimer = Math.min(game.enemyTimer, 35);
        }
      }

      game.pipes.forEach((p) => {
        if (game.postTeleportFreeze <= 0) {
          p.x -= game.speed;
        }

        if (p.dynamic) {
          p.topHeight =
            p.baseTopHeight +
            Math.sin(game.frame * p.waveSpeed + p.waveOffset) * p.waveAmp;

          p.topHeight = Math.max(
            60,
            Math.min(GAME_HEIGHT - GROUND_HEIGHT - p.gap - 60, p.topHeight)
          );
        }
      });

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
              if (tryPortalRescue(game)) {
                break;
              }
              endRun(game);
              break;
            }
          }
        }
      }

      game.pipes.forEach((p) => {
        if (!p.scored && p.x + PIPE_WIDTH < game.player.x) {
          p.scored = true;
          game.score++;
          playSfx('coin');
          onScore(game.score, game.kills);
        }
      });

      game.pipes = game.pipes.filter((p) => p.x > -PIPE_WIDTH - 20);

      if (game.started) {
        game.enemyTimer++;

        const enemyInterval = Math.max(
          tier.enemySpawnMin,
          180 - game.score * tier.enemySpawnDecay
        );

        if (game.enemyTimer >= enemyInterval) {
          game.enemyTimer = 0;
          spawnEnemy(game);
        }
      }

      game.enemies.forEach((e) => {
        if (game.postTeleportFreeze <= 0) {
          e.x -= e.speed;
        }

        if (e.type === 'ground_turret') {
          e.y = groundY - e.size - 8;

          if (e.shootCooldown > 0) {
            e.shootCooldown--;
          } else {
            const dx = game.player.x - e.x;
            const dy = game.player.y - e.y;
            const dist = Math.max(1, Math.hypot(dx, dy));

            game.enemyBullets.push({
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
      });

      game.bullets.forEach((b) => {
        b.x += b.vx ?? (b.weaponType === 'lightning_zap' ? 20 : 14);
        b.y += b.vy ?? 0;
      });

      game.enemyBullets.forEach((b) => {
        b.x += b.vx;
        b.y += b.vy;
        b.life--;
      });

      game.enemyBullets = game.enemyBullets.filter(
        (b) =>
          b.life > 0 &&
          b.x > -40 &&
          b.x < GAME_WIDTH + 40 &&
          b.y > -40 &&
          b.y < GAME_HEIGHT + 40
      );

      game.bullets = game.bullets.filter((b) => {
        if (b.x > GAME_WIDTH) return false;

        for (const e of game.enemies) {
          const dx = b.x - e.x;
          const dy = b.y - e.y;
          if (Math.abs(dx) < e.size + 10 && Math.abs(dy) < e.size) {
            e.hp--;
            explode(game, b.x, b.y, b.color || '#ffff00', '#ff0000', 6);
            if (e.hp <= 0) killEnemy(game, e);
            return false;
          }
        }

        return true;
      });

      game.rockets.forEach((r) => {
        r.age++;

        let nearest = null;
        let nearDist = Infinity;

        game.enemies.forEach((e) => {
          if (e.dead) return;
          const d = Math.hypot(e.x - r.x, e.y - r.y);
          if (d < nearDist) {
            nearDist = d;
            nearest = e;
          }
        });

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

        for (const e of game.enemies) {
          if (e.dead) continue;
          if (Math.hypot(e.x - r.x, e.y - r.y) < e.size + 8) {
            explode(game, r.x, r.y, '#ff4400', '#ffff00', 10);
            e.hp -= 3;
            if (e.hp <= 0) killEnemy(game, e);
            r.dead = true;
            break;
          }
        }

        game.particles.push({
          x: r.x,
          y: r.y,
          vx: -r.vx * 0.3,
          vy: (Math.random() - 0.5) * 2,
          life: 12,
          color: '#ff6600',
          type: 'trail',
          size: 3,
        });
      });

      game.rockets = game.rockets.filter(
        (r) => !r.dead && r.x < GAME_WIDTH + 50 && r.x > -50 && r.age < 180
      );

      game.zapArcs = game.zapArcs.filter((z) => {
        z.life--;
        return z.life > 0;
      });

      game.tunnelBombs.forEach((b) => {
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
      });

      game.tunnelBombs = game.tunnelBombs.filter((b) => !b.dead);

      game.blasts.forEach((bl) => {
        bl.life--;
      });
      game.blasts = game.blasts.filter((bl) => bl.life > 0);

      if (game.invincible === 0) {
        for (let i = game.enemies.length - 1; i >= 0; i--) {
          const e = game.enemies[i];
          if (e.dead) continue;

          const dx = e.x - game.player.x;
          const dy = e.y - game.player.y;
          const dist = Math.hypot(dx, dy);

          if (dist < e.size + 12) {
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
          const dist = Math.hypot(dx, dy);

          if (dist < (b.size || 4) + 12) {
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
            if (!tryPortalRescue(game)) {
              endRun(game);
            }
          }
        } else {
          game.player.y = Math.max(
            playerHalf + 2,
            Math.min(groundY - playerHalf - 2, game.player.y)
          );
        }
      }

      game.enemies = game.enemies.filter((e) => !e.dead && e.x > -80);
      game.enemyBullets = game.enemyBullets.filter((b) => !b.dead);

      game.particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05;
        p.life--;
      });
      game.particles = game.particles.filter((p) => p.life > 0);

      drawBackground(ctx, GAME_WIDTH, GAME_HEIGHT, game.frame, game.scrollX);
      game.pipes.forEach((p) =>
        drawPipe(ctx, p.x, p.topHeight, p.gap || PIPE_GAP, GAME_HEIGHT, game.frame)
      );
      game.enemies.forEach((e) => drawEnemy(ctx, e, game.frame));
      game.bullets.forEach((b) => drawBullet(ctx, b));

      game.enemyBullets.forEach((b) => {
        ctx.save();
        ctx.fillStyle = '#ff5577';
        ctx.shadowColor = '#ff5577';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.size || 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      game.rockets.forEach((r) => drawBullet(ctx, { ...r, weaponType: 'rocket' }));
      game.blasts.forEach((bl) => drawBlast(ctx, bl, GAME_WIDTH, GAME_HEIGHT));
      game.tunnelBombs.forEach((b) => drawTunnelBomb(ctx, b));
      game.zapArcs.forEach((z) => drawZapArc(ctx, z.x1, z.y1, z.x2, z.y2));

      game.particles.forEach((p) => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life / (p.type === 'explosion' ? 40 : 20));
        ctx.shadowColor = p.color;
        ctx.shadowBlur = p.type === 'explosion' ? 10 : 4;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size || 3, p.size || 3);
        ctx.restore();
      });

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

          game.portalEffects.forEach((portal) => {
            drawPortal(ctx, portal);
          });

          if (game.weaponId === 'rocket' && gameState === 'playing') {
            drawRocketPods(ctx, game.player.x, game.player.y, game.frame);
          }

          if (game.shieldKillsEnemies && game.shieldDurationLeft > 0) {
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
          game.comboSpecialUses
        );
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [gameState, onGameOver, onScore, skinId, onBlastReadyChange, onTunnelBombReadyChange]);

  return (
    <canvas
      ref={canvasRef}
      width={GAME_WIDTH}
      height={GAME_HEIGHT}
      onMouseDown={handleCanvasPointerDown}
      onMouseUp={handleCanvasPointerUp}
      onMouseLeave={handleCanvasPointerUp}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      className="block max-w-full h-auto rounded-lg"
      style={{
        cursor: 'crosshair',
        border: '1px solid hsla(180, 100%, 50%, 0.3)',
        boxShadow:
          '0 0 30px hsla(180, 100%, 50%, 0.15), 0 0 60px hsla(300, 100%, 50%, 0.08)',
      }}
    />
  );
}