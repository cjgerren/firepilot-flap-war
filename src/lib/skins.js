// Skin definitions and draw functions
// Each skin has: id, name, desc, emoji, cost (coins, 0=free), unlockScore (milestone, 0=shop only)
// "owned by default" skins have cost:0 and unlockScore:0

export const SKINS = [
  {
    id: 'default',
    name: 'CYAN DART',
    desc: 'The classic. Sleek. Dependable. You.',
    emoji: '🔷',
    cost: 0,
    unlockScore: 0,
    colors: { body: '#00ffff', inner: '#001a1a', eye: '#ff00ff', trail: '#ff00ff' },
  },
  {
    id: 'ghost',
    name: 'GHOST PROTOCOL',
    desc: 'Barely there. Semi-transparent. Very cool.',
    emoji: '👻',
    cost: 0,
    unlockScore: 5,
    colors: { body: '#ffffff', inner: '#111133', eye: '#aaaaff', trail: '#8888ff' },
  },
  {
    id: 'inferno',
    name: 'INFERNO',
    desc: 'Hot. Too hot. Don\'t touch.',
    emoji: '🔥',
    cost: 80,
    unlockScore: 0,
    colors: { body: '#ff4400', inner: '#1a0800', eye: '#ffff00', trail: '#ff8800' },
  },
  {
    id: 'matrix',
    name: 'THE MATRIX',
    desc: 'There is no wall.',
    emoji: '💊',
    cost: 120,
    unlockScore: 0,
    colors: { body: '#00ff44', inner: '#001100', eye: '#00ff44', trail: '#00aa22' },
  },
  {
    id: 'vaporwave',
    name: 'VAPORWAVE',
    desc: 'A E S T H E T I C. It\'s 1984 forever.',
    emoji: '🌴',
    cost: 150,
    unlockScore: 0,
    colors: { body: '#ff77cc', inner: '#1a0011', eye: '#ffee00', trail: '#aa44ff' },
  },
  {
    id: 'void',
    name: 'THE VOID',
    desc: 'Dark. Empty. Unavoidable. Like my DMs.',
    emoji: '🕳️',
    cost: 0,
    unlockScore: 15,
    colors: { body: '#440055', inner: '#000000', eye: '#ff00ff', trail: '#220033' },
  },
  {
    id: 'solar',
    name: 'SOLAR FLARE',
    desc: 'Straight out of the sun. SPF 9000.',
    emoji: '☀️',
    cost: 200,
    unlockScore: 0,
    colors: { body: '#ffdd00', inner: '#1a1000', eye: '#ff8800', trail: '#ffaa00' },
  },
  {
    id: 'glitch',
    name: 'GLITCH',
    desc: 'ERROR: SKIN NOT FOUND. Wait, there it is.',
    emoji: '⚡',
    cost: 0,
    unlockScore: 25,
    colors: { body: '#ff00ff', inner: '#0a000a', eye: '#00ffff', trail: '#ff00aa' },
    glitch: true,
  },
  {
    id: 'toaster',
    name: 'THE TOASTER',
    desc: 'Certified household appliance. Feared by bread.',
    emoji: '🍞',
    cost: 300,
    unlockScore: 0,
    colors: { body: '#c8a060', inner: '#2a1800', eye: '#ff4400', trail: '#ffaa44' },
    funny: true,
  },
  {
    id: 'night_runner',
    name: 'NIGHT RUNNER',
    desc: 'Street-racer vibes with electric cyan trim.',
    emoji: '🏁',
    cost: 260,
    unlockScore: 0,
    colors: { body: '#1e2b44', inner: '#070b14', eye: '#00e5ff', trail: '#00b8ff' },
  },
  {
    id: 'desert_hunter',
    name: 'DESERT HUNTER',
    desc: 'Rugged bounty-wing silhouette with amber highlights.',
    emoji: '🦂',
    cost: 320,
    unlockScore: 0,
    colors: { body: '#a86b3a', inner: '#26160c', eye: '#ffcf7d', trail: '#ff9d43' },
  },
  {
    id: 'moon_warden',
    name: 'MOON WARDEN',
    desc: 'Lunar guard frame tuned for calm precision.',
    emoji: '🌙',
    cost: 0,
    unlockScore: 35,
    colors: { body: '#dde6ff', inner: '#1a2338', eye: '#8ea8ff', trail: '#8bb5ff' },
  },
  {
    id: 'rose_phantom',
    name: 'ROSE PHANTOM',
    desc: 'Stealth silhouette with magenta pulse trails.',
    emoji: '🌹',
    cost: 340,
    unlockScore: 0,
    colors: { body: '#b63b7a', inner: '#220916', eye: '#ffd1ec', trail: '#ff5db9' },
  },
  {
    id: 'arc_sentinel',
    name: 'ARC SENTINEL',
    desc: 'A heroic guardian look with polished chrome arcs.',
    emoji: '🛡️',
    cost: 0,
    unlockScore: 60,
    colors: { body: '#c8f0ff', inner: '#132434', eye: '#ffe082', trail: '#62d8ff' },
  },
  {
    id: 'neon_shogun',
    name: 'NEON SHOGUN',
    desc: 'Blade-inspired hull lines with glowing crimson accents.',
    emoji: '🗡️',
    cost: 420,
    unlockScore: 0,
    colors: { body: '#d3474f', inner: '#1f0a0d', eye: '#ffd4d8', trail: '#ff7a86' },
  },
  {
    id: 'legendary',
    name: 'LEGENDARY',
    desc: 'Rainbow. Animated. You earned this.',
    emoji: '🌈',
    cost: 0,
    unlockScore: 50,
    colors: { body: '#rainbow', inner: '#000011', eye: '#ffffff', trail: '#rainbow' },
    rainbow: true,
  },
];

export function getSkin(id) {
  return SKINS.find(s => s.id === id) || SKINS[0];
}

// Draw the player using a given skin
export function drawPlayerSkin(ctx, x, y, velocity, shields, skin, frame = 0) {
  const S = typeof skin === 'string' ? getSkin(skin) : skin;
  const PLAYER_SIZE = 24;
  const rotation = Math.min(Math.max(velocity * 3, -30), 45) * Math.PI / 180;

  // Rainbow color helper
  const rainbow = (offset = 0) => `hsl(${(frame * 3 + offset) % 360}, 100%, 60%)`;
  const withAlpha = (color, alpha) => {
    if (color.startsWith('#')) {
      const hex = color.length >= 7 ? color.slice(0, 7) : color;
      const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
      return `${hex}${a}`;
    }

    if (color.startsWith('hsl(')) {
      return color.replace('hsl(', 'hsla(').replace(')', `, ${alpha})`);
    }

    return color;
  };

  const bodyColor = S.rainbow ? rainbow(0) : S.colors.body;
  const eyeColor = S.colors.eye;
  const trailBase = S.rainbow ? rainbow(120) : S.colors.trail;
  const trailColor = velocity < 0 ? trailBase : withAlpha(trailBase, 0.53);

  ctx.save();
  ctx.translate(x, y);

  // Glitch offset
  if (S.glitch && Math.random() > 0.85) {
    ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 3);
  }

  ctx.save();
  ctx.globalAlpha = 0.26;
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.beginPath();
  ctx.ellipse(-2, 10, 23, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.rotate(rotation);

  // Shield ring
  if (shields > 0) {
    ctx.shadowColor = shields >= 2 ? bodyColor : '#ff6600';
    ctx.shadowBlur = 18;
    ctx.strokeStyle = shields >= 2 ? bodyColor : '#ff6600';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.28;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, PLAYER_SIZE + 5 + i * 2, -0.65, 0.65);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  const fuselage = ctx.createLinearGradient(-19, -11, 18, 12);
  fuselage.addColorStop(0, '#070b10');
  fuselage.addColorStop(0.18, S.colors.inner);
  fuselage.addColorStop(0.42, bodyColor);
  fuselage.addColorStop(0.63, '#f7fbff');
  fuselage.addColorStop(0.8, bodyColor);
  fuselage.addColorStop(1, '#111921');

  const underside = ctx.createLinearGradient(-18, 0, 16, 10);
  underside.addColorStop(0, 'rgba(0,0,0,0.7)');
  underside.addColorStop(0.58, 'rgba(0,0,0,0.32)');
  underside.addColorStop(1, 'rgba(255,255,255,0.1)');

  const canopy = ctx.createLinearGradient(2, -8, 10, 6);
  canopy.addColorStop(0, '#ffffff');
  canopy.addColorStop(0.35, eyeColor);
  canopy.addColorStop(1, S.colors.inner);

  // Contrail bloom
  const tc = S.rainbow ? rainbow(240) : trailColor;
  ctx.shadowColor = tc;
  ctx.shadowBlur = 22;
  const exhaustBloom = ctx.createLinearGradient(-42, 0, -12, 0);
  exhaustBloom.addColorStop(0, 'rgba(255,255,255,0)');
  exhaustBloom.addColorStop(0.42, withAlpha(tc, 0.34));
  exhaustBloom.addColorStop(1, withAlpha(tc, 0.86));
  ctx.fillStyle = exhaustBloom;
  ctx.globalAlpha = 0.34;
  ctx.beginPath();
  ctx.moveTo(-12, -4);
  ctx.lineTo(-28 - Math.random() * 9, -11);
  ctx.lineTo(-42 - Math.random() * 10, 0);
  ctx.lineTo(-28 - Math.random() * 9, 11);
  ctx.lineTo(-12, 4);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  // Fuselage
  ctx.shadowColor = bodyColor;
  ctx.shadowBlur = S.glitch ? 24 : 16;
  ctx.fillStyle = fuselage;
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.quadraticCurveTo(7, -10, -7, -8.5);
  ctx.lineTo(-16, -4.5);
  ctx.quadraticCurveTo(-19, -1.5, -19, 0);
  ctx.quadraticCurveTo(-19, 1.5, -16, 4.5);
  ctx.lineTo(-7, 8.5);
  ctx.quadraticCurveTo(7, 10, 16, 0);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(235,248,255,0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.fillStyle = underside;
  ctx.beginPath();
  ctx.moveTo(12, 1);
  ctx.quadraticCurveTo(1, 8, -11, 5);
  ctx.lineTo(-4, 1);
  ctx.lineTo(8, 1);
  ctx.closePath();
  ctx.fill();

  // Wings
  const wingPaint = ctx.createLinearGradient(-12, -12, 5, 9);
  wingPaint.addColorStop(0, '#0a1016');
  wingPaint.addColorStop(0.48, bodyColor);
  wingPaint.addColorStop(1, '#d8eef4');
  ctx.fillStyle = wingPaint;
  ctx.beginPath();
  ctx.moveTo(2, -2);
  ctx.lineTo(-13, -14);
  ctx.lineTo(-3, -4);
  ctx.lineTo(6, -1);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(235,248,255,0.4)';
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(2, 2);
  ctx.lineTo(-13, 14);
  ctx.lineTo(-3, 4);
  ctx.lineTo(6, 1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Tail stabilizers
  ctx.fillStyle = '#101820';
  ctx.beginPath();
  ctx.moveTo(-11, -3);
  ctx.lineTo(-18, -11);
  ctx.lineTo(-10, -6);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-11, 3);
  ctx.lineTo(-18, 11);
  ctx.lineTo(-10, 6);
  ctx.closePath();
  ctx.fill();

  // Canopy / cockpit
  ctx.shadowColor = eyeColor;
  ctx.shadowBlur = 8;
  ctx.fillStyle = canopy;
  ctx.beginPath();
  ctx.moveTo(8, -4);
  ctx.quadraticCurveTo(12, -1, 8, 4);
  ctx.lineTo(1, 3);
  ctx.quadraticCurveTo(0, 0, 1, -3);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = 0.72;
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(4, -3);
  ctx.quadraticCurveTo(8, -4, 10, -1);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Accent lines
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-12, 0);
  ctx.lineTo(13, 0);
  ctx.stroke();

  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = bodyColor;
  ctx.beginPath();
  ctx.moveTo(-8, -5.5);
  ctx.lineTo(7, -2.5);
  ctx.moveTo(-8, 5.5);
  ctx.lineTo(7, 2.5);
  ctx.stroke();

  ctx.globalAlpha = 0.5;
  ctx.fillStyle = 'rgba(235,248,255,0.75)';
  for (const px of [-10, -4, 3]) {
    ctx.beginPath();
    ctx.arc(px, -1.8, 0.75, 0, Math.PI * 2);
    ctx.arc(px, 1.8, 0.75, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Engine cores
  ctx.shadowColor = tc;
  ctx.shadowBlur = 14;
  ctx.fillStyle = tc;
  ctx.beginPath();
  ctx.arc(-14, -3.4, 2.5, 0, Math.PI * 2);
  ctx.arc(-14, 3.4, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Hot exhaust
  ctx.globalAlpha = 0.92;
  const hotCore = ctx.createLinearGradient(-30, 0, -13, 0);
  hotCore.addColorStop(0, 'rgba(255,255,255,0)');
  hotCore.addColorStop(0.48, tc);
  hotCore.addColorStop(1, '#ffffff');
  ctx.fillStyle = hotCore;
  ctx.beginPath();
  ctx.moveTo(-14, -4);
  ctx.lineTo(-28 - Math.random() * 5, -2);
  ctx.lineTo(-31 - Math.random() * 6, 0);
  ctx.lineTo(-28 - Math.random() * 5, 2);
  ctx.lineTo(-14, 4);
  ctx.lineTo(-18, 0);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  // Nose light
  ctx.shadowColor = '#ffffff';
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(14, 0, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.restore();
}
