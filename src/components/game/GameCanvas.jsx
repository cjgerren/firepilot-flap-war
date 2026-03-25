import React, { useRef, useEffect, useCallback } from 'react';
import { drawPlayerSkin } from '../../lib/skins.js';
import { getWeapon } from '../../lib/gameItems.js';
import {
  getSelectedWeapon,
  getEquippedUpgrades,
  consumeEquippedUpgrade,
} from '../../lib/gameStore.js';
import audioManager from '../../lib/audioManager';

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
    ctx.shadowColor = '#ff4400';
    ctx.shadowBlur = 6;
    ctx.fillStyle = '#ff4400';
    ctx.fillRect(px - 8, py + dy - 2, 12, 4);

    ctx.fillStyle = '#ff8800';
    ctx.fillRect(px + 4, py + dy - 1, 3, 2);

    ctx.shadowColor = '#ff6600';
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

    ctx.shadowColor = '#ff00ff';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#ff00ff';
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
  }

  if (e.hp < e.maxHp) {
    const bw = 30;
    const bh = 4;
    ctx.fillStyle = '#330000';
    ctx.fillRect(-bw / 2, -24, bw, bh);
    ctx.fillStyle = '#ff4400';
    ctx.fillRect(-bw / 2, -24, bw * (e.hp / e.maxHp), bh);
  }

  ctx.restore();
}

function drawPipe(ctx, x, topHeight, gap, gameHeight, frame) {
  const bottomY = topHeight + gap;
  const groundY = gameHeight - GROUND_HEIGHT;

  const topGrad = ctx.createLinearGradient(x, 0, x + PIPE_WIDTH, 0);
  topGrad.addColorStop(0, '#003333');
  topGrad.addColorStop(0.5, '#006666');
  topGrad.addColorStop(1, '#003333');
  neonRect(ctx, x, 0, PIPE_WIDTH, topHeight, topGrad, '#00ffff', 6);
  neonRect(ctx, x - 4, topHeight - 16, PIPE_WIDTH + 8, 16, '#005555', '#00ffff', 10);

  ctx.globalAlpha = 0.12;
  for (let sy = 0; sy < topHeight; sy += 6) {
    ctx.fillStyle = '#00ffff';
    ctx.fillRect(x, sy, PIPE_WIDTH, 1);
  }
  ctx.globalAlpha = 1;

  const botGrad = ctx.createLinearGradient(x, bottomY, x + PIPE_WIDTH, bottomY);
  botGrad.addColorStop(0, '#330033');
  botGrad.addColorStop(0.5, '#660066');
  botGrad.addColorStop(1, '#330033');
  neonRect(ctx, x, bottomY, PIPE_WIDTH, groundY - bottomY, botGrad, '#ff00ff', 6);
  neonRect(ctx, x - 4, bottomY, PIPE_WIDTH + 8, 16, '#550055', '#ff00ff', 10);

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
  zapMax
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

  ctx.restore();
}

export default function GameCanvas({
  onGameOver,
  onScore,
  gameState,
  skinId,
  onBlastReadyChange,
  jumpRef,
  shootRef,
  blastRef,
  onTunnelBombReadyChange,
  tunnelBombRef,
}) {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);

  function makeInitialState() {
    const weaponId = getSelectedWeapon();
    const weaponDef = getWeapon(weaponId);
    const equipped = getEquippedUpgrades();

    let startShields = MAX_SHIELDS;
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
      particles: [],
      blasts: [],
      tunnelBombs: [],
      frame: 0,
      scrollX: 0,
      score: 0,
      kills: 0,
      shields: startShields,
      shieldLevel,
      shieldHitsLeft,
      shieldKillsEnemies,
      shieldDurationLeft,
      pipeTimer: 0,
      enemyTimer: 0,
      speed: PIPE_SPEED_BASE,
      invincible: 0,
      killStreak: 0,
      blastReady: false,
      weaponId,
      weaponDef,
      burstPending: 0,
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
    game.score += (e.type === 'bomber' ? 3 : e.type === 'seeker' ? 2 : 1) + scoreBonus;
    game.killStreak++;

    audioManager.playSfx('explosion');

    if (game.killStreak >= BLAST_STREAK && !game.blastReady) {
      game.blastReady = true;
      game.killStreak = 0;
      onBlastReadyChange && onBlastReadyChange(true);
      audioManager.playSfx('powerup');
    }

    onScore(game.score, game.kills);
  }

  function handleShieldHit(game) {
    if (game.shieldHitsLeft > 0) {
      game.shieldHitsLeft--;
      game.invincible = 60;
      game.player.velocity = -3;

      audioManager.playSfx('shield');

      if (game.shieldHitsLeft === 0) {
        game.shieldLevel = 0;
        game.shieldKillsEnemies = false;
        game.shieldDurationLeft = 0;
      }

      return true;
    }

    return false;
  }

  const tunnelBomb = useCallback(() => {
    if (gameState !== 'playing') return;
    const game = gameRef.current;
    if (!game.tunnelBombReady) return;

    game.tunnelBombReady = false;
    onTunnelBombReadyChange && onTunnelBombReadyChange(false);
    consumeEquippedUpgrade('tunnelbomb');

    audioManager.playSfx('powerup');

    game.tunnelBombs.push({
      x: game.player.x + PLAYER_SIZE,
      y: game.player.y,
      vx: 12,
      vy: -1,
      age: 0,
    });
  }, [gameState, onTunnelBombReadyChange]);

  const blast = useCallback(() => {
    if (gameState !== 'playing') return;
    const game = gameRef.current;
    if (!game.blastReady) return;

    game.blastReady = false;
    game.killStreak = 0;
    onBlastReadyChange && onBlastReadyChange(false);

    audioManager.playSfx('blast');

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
      audioManager.playSfx('explosion');
    }

    game.enemies = [];
    onScore(game.score, game.kills);
  }, [gameState, onBlastReadyChange, onScore]);

  const shoot = useCallback(() => {
    if (gameState !== 'playing') return;
    const game = gameRef.current;
    const { weaponDef, weaponId } = game;

    if (weaponId === 'lightning') {
      const effectiveWeaponId = game.zapCharge > 0 ? 'lightning' : 'auto';

      if (effectiveWeaponId === 'lightning') {
        if (game.zapCooldown > 0) return;

        audioManager.playSfx('shoot');

        const def = weaponDef;
        game.enemies.forEach((e) => {
          const dx = e.x - game.player.x;
          const dy = e.y - game.player.y;
          if (Math.sqrt(dx * dx + dy * dy) < def.zapRadius) {
            game.zapArcs.push({
              x1: game.player.x,
              y1: game.player.y,
              x2: e.x,
              y2: e.y,
              life: 8,
            });
            e.hp -= 2;
            if (e.hp <= 0) killEnemy(game, e);
          }
        });

        game.zapCharge = Math.max(0, game.zapCharge - def.drainRate);
        game.zapCooldown = weaponDef.fireRate;
        return;
      }

      if (game.zapCooldown > 0) return;

      audioManager.playSfx('shoot');

      game.bullets.push({
        x: game.player.x + PLAYER_SIZE / 2 + 4,
        y: game.player.y,
        spawnFrame: game.frame,
        weaponType: 'auto',
        color: '#00ffff',
        isAuto: true,
      });
      game.zapCooldown = 5;
      return;
    }

    const lastBullet = game.bullets[game.bullets.length - 1];
    if (lastBullet && game.frame - lastBullet.spawnFrame < weaponDef.fireRate) return;

    const bx = game.player.x + PLAYER_SIZE / 2 + 4;
    const by = game.player.y;

    audioManager.playSfx('shoot');

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
        color: '#ff8800',
      });

      setTimeout(() => {
        if (gameRef.current) {
          gameRef.current.bullets.push({
            x: bx + 20,
            y: by,
            spawnFrame: game.frame,
            weaponType: 'burst',
            color: '#ff8800',
          });
        }
      }, 80);
    } else if (weaponId === 'rocket') {
      game.bullets.push({
        x: bx,
        y: by,
        spawnFrame: game.frame,
        weaponType: 'burst',
        color: '#ff8800',
      });

      setTimeout(() => {
        if (gameRef.current) {
          gameRef.current.bullets.push({
            x: bx + 20,
            y: by,
            spawnFrame: game.frame,
            weaponType: 'burst',
            color: '#ff8800',
          });
        }
      }, 80);

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

  const jump = useCallback(() => {
    if (gameState !== 'playing') return;
    const game = gameRef.current;
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
    if (gameState === 'playing') {
      const newState = makeInitialState();
      gameRef.current = newState;
      onBlastReadyChange && onBlastReadyChange(false);
      onTunnelBombReadyChange && onTunnelBombReadyChange(newState.tunnelBombReady);

      const eq = getEquippedUpgrades();
      if (eq.shield2 > 0) consumeEquippedUpgrade('shield2');
      else if (eq.shield1 > 0) consumeEquippedUpgrade('shield1');
    }
  }, [gameState, onBlastReadyChange, onTunnelBombReadyChange]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        jump();
      }
      if (e.code === 'KeyF' || e.code === 'ArrowRight') {
        e.preventDefault();
        shoot();
      }
      if (e.code === 'KeyB') {
        e.preventDefault();
        blast();
      }
      if (e.code === 'KeyT') {
        e.preventDefault();
        tunnelBomb();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [jump, shoot, blast, tunnelBomb]);

  const handleCanvasClick = useCallback(
    (e) => {
      const rect = canvasRef.current.getBoundingClientRect();
      if (e.clientX - rect.left < rect.width / 2) jump();
      else shoot();
    },
    [jump, shoot]
  );

  const handleTouchStart = useCallback((e) => {
    e.preventDefault();
  }, []);

  useEffect(() => {
    if (jumpRef) jumpRef.current = jump;
    if (shootRef) shootRef.current = shoot;
    if (blastRef) blastRef.current = blast;
    if (tunnelBombRef) tunnelBombRef.current = tunnelBomb;
  }, [jump, shoot, blast, tunnelBomb, jumpRef, shootRef, blastRef, tunnelBombRef]);

  function spawnEnemy(game) {
    const groundY = GAME_HEIGHT - GROUND_HEIGHT;
    const types = ['drone', 'drone', 'seeker', 'bomber'];
    const available = game.score < 5 ? ['drone', 'drone', 'seeker'] : types;
    const type = available[Math.floor(Math.random() * available.length)];

    const configs = {
      drone: { hp: 1, maxHp: 1, speed: 2.5 + Math.random() * 1.5, size: 14 },
      seeker: { hp: 2, maxHp: 2, speed: 2 + Math.random() * 2, size: 16 },
      bomber: { hp: 4, maxHp: 4, speed: 1.2 + Math.random() * 0.8, size: 18 },
    };

    const cfg = configs[type];

    game.enemies.push({
      x: GAME_WIDTH + 40,
      y: 40 + Math.random() * (groundY - 60),
      vy: (Math.random() - 0.5) * 1.2,
      type,
      hp: cfg.hp,
      maxHp: cfg.maxHp,
      speed: cfg.speed,
      size: cfg.size,
      seed: Math.random() * 100,
      seekTimer: 0,
      id: Math.random(),
    });
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animId;

    const loop = () => {
      const game = gameRef.current;
      const groundY = GAME_HEIGHT - GROUND_HEIGHT;
      const playerHalf = PLAYER_SIZE / 2;

      if (gameState === 'playing') {
        game.frame++;
        game.scrollX += game.speed;
        game.speed = PIPE_SPEED_BASE + game.score * 0.1;

        if (game.invincible > 0) game.invincible--;
        if (game.zapCooldown > 0) game.zapCooldown--;

        if (game.weaponId === 'lightning' && game.zapCharge < game.weaponDef.maxCharge) {
          game.zapCharge = Math.min(
            game.weaponDef.maxCharge,
            game.zapCharge + game.weaponDef.rechargeRate
          );
        }

        game.player.velocity += GRAVITY;
        game.player.y += game.player.velocity;

        if (game.shieldLevel === 2 && game.shieldDurationLeft > 0) {
          game.shieldDurationLeft--;
          if (game.shieldDurationLeft === 0) {
            game.shieldKillsEnemies = false;
            game.shieldLevel = 0;
            game.shieldHitsLeft = 0;
          }
        }

        if (game.tunnelBombActive) {
          game.tunnelBombTimer--;
          if (game.tunnelBombTimer <= 0) {
            game.tunnelBombActive = false;
            game.pipeGap = PIPE_GAP;
          }
        }

        game.pipeTimer++;
        const spawnInterval = Math.max(95, 140 - game.score * 2);
        if (game.pipeTimer >= spawnInterval) {
          game.pipeTimer = 0;
          const gap = game.pipeGap;
          const minTop = 60;
          const maxTop = groundY - gap - 60;
          game.pipes.push({
            x: GAME_WIDTH + 10,
            topHeight: minTop + Math.random() * Math.max(10, maxTop - minTop),
            gap,
            scored: false,
          });
        }

        game.pipes.forEach((p) => {
          p.x -= game.speed;
        });

        game.pipes.forEach((p) => {
          if (!p.scored && p.x + PIPE_WIDTH < game.player.x) {
            p.scored = true;
            game.score++;
            audioManager.playSfx('coin');
            onScore(game.score);
          }
        });

        game.pipes = game.pipes.filter((p) => p.x > -PIPE_WIDTH - 20);

        game.enemyTimer++;
        const enemyInterval = Math.max(80, 200 - game.score * 8);
        if (game.enemyTimer >= enemyInterval) {
          game.enemyTimer = 0;
          spawnEnemy(game);
        }

        game.enemies.forEach((e) => {
          e.x -= e.speed;
          if (e.type === 'seeker') {
            const dy = game.player.y - e.y;
            e.vy += dy * 0.008;
            e.vy = Math.max(-3, Math.min(3, e.vy));
          } else {
            e.vy = Math.sin(game.frame * 0.04 + e.seed) * 1.5;
          }
          e.y += e.vy;
          e.y = Math.max(30, Math.min(groundY - 20, e.y));
        });

        game.bullets.forEach((b) => {
          b.x += b.weaponType === 'lightning_zap' ? 20 : 14;
        });

        game.bullets = game.bullets.filter((b) => {
          if (b.x > GAME_WIDTH) return false;

          for (const e of game.enemies) {
            const dx = b.x - e.x;
            const dy = b.y - e.y;
            if (Math.abs(dx) < e.size + 10 && Math.abs(dy) < e.size) {
              e.hp--;
              explode(game, b.x, b.y, b.color || '#ffff00', '#ff8800', 6);
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
            audioManager.playSfx('explosion');
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

              audioManager.playSfx('hit');
              onGameOver(game.score, game.kills);
              break;
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
              } else if (hitBottomBoundary) {
                game.player.y = groundY - playerHalf - 2;
              }
            } else {
              audioManager.playSfx('hit');
              onGameOver(game.score, game.kills);
            }
          }
        } else {
          game.player.y = Math.max(playerHalf + 2, Math.min(groundY - playerHalf - 2, game.player.y));
        }

        if (game.invincible === 0) {
          const playerLeft = game.player.x - playerHalf;
          const playerRight = game.player.x + playerHalf;
          const playerTop = game.player.y - playerHalf;
          const playerBottom = game.player.y + playerHalf;

          for (const p of game.pipes) {
            const gap = p.gap || PIPE_GAP;
            const gapBottom = p.topHeight + gap;
            const overlapsX = playerRight > p.x && playerLeft < p.x + PIPE_WIDTH;

            if (!overlapsX) continue;

            const hitTopPipe = playerTop < p.topHeight;
            const hitBottomPipe = playerBottom > gapBottom;

            if (hitTopPipe || hitBottomPipe) {
              if (handleShieldHit(game)) {
                if (hitTopPipe) {
                  game.player.y = p.topHeight + playerHalf + 4;
                } else {
                  game.player.y = gapBottom - playerHalf - 4;
                }
              } else {
                audioManager.playSfx('hit');
                onGameOver(game.score, game.kills);
                break;
              }
            }
          }
        }

        game.enemies = game.enemies.filter((e) => !e.dead && e.x > -80);

        game.particles.forEach((p) => {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.05;
          p.life--;
        });
        game.particles = game.particles.filter((p) => p.life > 0);
      }

      drawBackground(ctx, GAME_WIDTH, GAME_HEIGHT, game.frame, game.scrollX);
      game.pipes.forEach((p) => drawPipe(ctx, p.x, p.topHeight, p.gap || PIPE_GAP, GAME_HEIGHT, game.frame));
      game.enemies.forEach((e) => drawEnemy(ctx, e, game.frame));
      game.bullets.forEach((b) => drawBullet(ctx, b));
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

      const showPlayer = gameState !== 'playing' || game.invincible === 0 || game.frame % 6 < 4;

      if (showPlayer) {
        if (gameState === 'playing' || gameState === 'gameover') {
          drawPlayerSkin(
            ctx,
            game.player.x,
            game.player.y,
            game.player.velocity,
            game.shields,
            skinId || 'default',
            game.frame
          );

          if (game.weaponId === 'rocket' && gameState === 'playing') {
            drawRocketPods(ctx, game.player.x, game.player.y, game.frame);
          }

          if (game.shieldKillsEnemies && game.shieldDurationLeft > 0) {
            ctx.save();
            ctx.shadowColor = '#aa44ff';
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
          game.weaponDef?.maxCharge || 180
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
      onClick={handleCanvasClick}
      onTouchStart={handleTouchStart}
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