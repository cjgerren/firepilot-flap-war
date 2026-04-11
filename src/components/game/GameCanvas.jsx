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
const TURRET_SCORE_START = 42;

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

function drawRocketPods(ctx, px, py, frame) {
  const offsets = [8, -8];

  offsets.forEach((dy) => {
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
    ctx.shadowColor = 'rgba(255,175,120,0.42)';
    ctx.shadowBlur = 14 * pulse;
    const bomberBody = ctx.createLinearGradient(-18, -12, 18, 12);
    bomberBody.addColorStop(0, '#1e2732');
    bomberBody.addColorStop(0.5, '#52616d');
    bomberBody.addColorStop(1, '#1c2631');
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

    ctx.fillStyle = '#ffb066';
    for (const ox of [-10, -2, 6]) {
      ctx.beginPath();
      ctx.arc(ox, -8, 1.7, 0, Math.PI * 2);
      ctx.arc(ox + 4, 8, 1.7, 0, Math.PI * 2);
      ctx.fill();
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

function drawCinematicGrade(ctx, width, height, frame, speed) {
  ctx.save();

  const dustSpeed = Math.max(1, speed || PIPE_SPEED_BASE);
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = 'rgba(190,235,255,0.18)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 26; i++) {
    const y = 30 + ((i * 37 + frame * 0.42) % (height - 92));
    const x = ((i * 173 - frame * dustSpeed * 1.35) % (width + 180)) - 90;
    const len = 18 + rockNoise(i, frame * 0.02, 19) * 42;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y - 1.5);
    ctx.stroke();
  }

  ctx.globalAlpha = 0.08;
  ctx.fillStyle = '#d9f8ff';
  for (let y = 1; y < height; y += 4) {
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

function drawTunnelWall(ctx, x, startY, width, height, side, frame) {
  if (height <= 0) return;

  const endY = startY + height;
  const edgeY = side === 'top' ? endY : startY;

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

function drawTunnelPassage(ctx, passage, gameHeight, frame) {
  const { x, topHeight, gap } = passage;
  const bottomY = topHeight + gap;
  const groundY = gameHeight - GROUND_HEIGHT;
  const isMoving = Boolean(passage.dynamic);
  const pulse = 0.6 + Math.sin(frame * 0.055 + x * 0.02) * 0.12;

  drawTunnelWall(ctx, x, 0, PIPE_WIDTH, topHeight, 'top', frame);
  drawTunnelWall(ctx, x, bottomY, PIPE_WIDTH, groundY - bottomY, 'bottom', frame);

  if (isMoving) {
    ctx.save();
    ctx.globalAlpha = 0.36 + pulse * 0.16;
    ctx.strokeStyle = 'rgba(255,132,82,0.62)';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(x - 22, topHeight + gap / 2);
    ctx.lineTo(x + PIPE_WIDTH + 22, topHeight + gap / 2);
    ctx.stroke();

    ctx.shadowColor = '#ff8452';
    ctx.shadowBlur = 14;
    ctx.fillStyle = 'rgba(255,132,82,0.72)';
    ctx.fillRect(x - 18, topHeight + gap / 2 - 2, 8, 4);
    ctx.fillRect(x + PIPE_WIDTH + 10, topHeight + gap / 2 - 2, 8, 4);
    ctx.restore();
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

function drawBackground(ctx, width, height, frame, scrollX) {
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, '#01040a');
  bg.addColorStop(0.3, '#071525');
  bg.addColorStop(0.62, '#0b1520');
  bg.addColorStop(1, '#020407');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const groundY = height - GROUND_HEIGHT;

  ctx.save();
  const depthGlow = ctx.createRadialGradient(width * 0.58, height * 0.47, 18, width * 0.52, height * 0.5, width * 0.75);
  depthGlow.addColorStop(0, 'rgba(190,242,255,0.28)');
  depthGlow.addColorStop(0.28, 'rgba(50,118,156,0.17)');
  depthGlow.addColorStop(0.66, 'rgba(6,18,28,0.22)');
  depthGlow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = depthGlow;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

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

  const haze = ctx.createLinearGradient(0, 70, 0, groundY);
  haze.addColorStop(0, 'rgba(190,232,245,0.06)');
  haze.addColorStop(0.45, 'rgba(135,194,212,0.13)');
  haze.addColorStop(1, 'rgba(255,176,102,0.08)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, width, groundY);

  ctx.save();
  for (let i = 0; i < 12; i++) {
    const markerX = ((i * 132 - scrollX * 0.26) % (width + 180)) - 80;
    const markerY = i % 2 === 0 ? groundY - 56 : 42;
    const color = i % 3 === 0 ? '#7de3ff' : i % 3 === 1 ? '#ffc785' : '#b4f2ff';
    drawSignalMarker(ctx, markerX, markerY, 12 + rockNoise(i, 7, 31) * 8, color, frame);
  }
  ctx.restore();

  ctx.save();
  const floor = ctx.createLinearGradient(0, groundY - 28, 0, height);
  floor.addColorStop(0, 'rgba(85,105,120,0.76)');
  floor.addColorStop(0.3, '#132434');
  floor.addColorStop(0.68, '#071018');
  floor.addColorStop(1, '#05070a');
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
  comboSpecialUses
) {
  ctx.save();
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

  if (comboSpecialId === 'teleport_blink' && comboSpecialUses > 0) {
    ctx.textAlign = 'left';
    framePanel(12, 94, 120, 24, 'rgba(125,227,255,0.28)');
    ctx.shadowColor = '#99ddff';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#99ddff';
    ctx.font = '700 10px Orbitron, monospace';
    ctx.fillText(`BLINK [Q] ${comboSpecialUses}`, 22, 110);
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
    game.started = false;
    game.autoHeld = false;

    playSfx('hit');
    onGameOver(game.score, game.kills, game.diamondsEarned || 0);

    return true;
  }

  const tunnelBomb = useCallback(() => {
    if (!canAcceptRunInput) return;
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
  }, [canAcceptRunInput, onTunnelBombReadyChange]);

  const activateComboSpecial = useCallback(() => {
    if (!canAcceptRunInput) return;

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
  }, [canAcceptRunInput, onBlastReadyChange, onScore]);

  const shoot = useCallback(() => {
    if (!canAcceptRunInput) return;
    const game = gameRef.current;
    if (!game || game.ended) return;

    if (!game.started) {
      game.started = true;
    }

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
  }, [canAcceptRunInput]);

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

    const turretChance = game.score >= 60 ? 0.18 : 0.08;

    if (game.score >= TURRET_SCORE_START && roll < turretChance) {
      type = 'ground_turret';
    } else if (game.score >= 14 && roll < 0.44) {
      type = 'enemy_ship';
    } else if (game.score >= 8 && roll < 0.22 + tier.bomberBias) {
      type = 'bomber';
    } else if (game.score >= 6 && roll < 0.32 + tier.seekerBias) {
      type = 'seeker';
    } else {
      type = 'drone';
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

    const cfg = configs[type];

    let spawnY;
    const anchor = 'floor';

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
      vy: type === 'ground_turret'
        ? 0
        : (Math.random() - 0.5) * 1.2,
      type,
      hp: cfg.hp,
      maxHp: type === 'ground_turret' ? cfg.hp : cfg.maxHp,
      speed: cfg.speed,
      size: cfg.size,
      seed: Math.random() * 100,
      anchor,
      seekTimer: 0,
      shootCooldown:
        type === 'ground_turret' || type === 'enemy_ship'
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
      const simulationActive = gameState === 'playing' && !game.ended;

      if (simulationActive) {
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

      if (simulationActive) {
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
            if (game.score >= 12 && game.score < 28) {
              dynamicChance = 0.35;
            } else if (game.score >= 28) {
              dynamicChance = 0.58;
            }

            const isDynamic = Math.random() < dynamicChance;
            const closeAmp = isDynamic ? Math.min(34, 14 + game.score * 0.45) : 0;
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
              waveAmp: isDynamic ? (game.score >= 28 ? 22 : 16) : 0,
              waveSpeed: isDynamic ? (game.score >= 28 ? 0.055 : 0.04) : 0,
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
            const motion = Math.sin(game.frame * p.waveSpeed + p.waveOffset);
            const closeMotion =
              (Math.sin(game.frame * p.waveSpeed * 1.28 + p.waveOffset + Math.PI / 2) + 1) / 2;
            const nextGap = Math.max(104, p.baseGap - closeMotion * p.closeAmp);
            const centerY = p.baseCenter + motion * p.waveAmp;

            p.gap = nextGap;
            p.topHeight = Math.max(60, Math.min(groundY - p.gap - 60, centerY - p.gap / 2));
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
              game.enemyBullets.push({
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
      }

      drawBackground(ctx, GAME_WIDTH, GAME_HEIGHT, game.frame, game.scrollX);
      game.pipes.forEach((p) =>
        drawTunnelPassage(ctx, p, GAME_HEIGHT, game.frame)
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

      drawCinematicGrade(ctx, GAME_WIDTH, GAME_HEIGHT, game.frame, game.speed);

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
