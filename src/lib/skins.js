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
    desc: 'There is no pipe.',
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

  const bodyColor = S.rainbow ? rainbow(0) : S.colors.body;
  const eyeColor = S.colors.eye;
  const trailColor = S.rainbow ? rainbow(120) : (velocity < 0 ? S.colors.trail : S.colors.trail + '88');

  ctx.save();
  ctx.translate(x, y);

  // Glitch offset
  if (S.glitch && Math.random() > 0.85) {
    ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 3);
  }

  ctx.rotate(rotation);

  // Shield ring
  if (shields > 0) {
    ctx.shadowColor = shields >= 2 ? bodyColor : '#ff6600';
    ctx.shadowBlur = 18;
    ctx.strokeStyle = shields >= 2 ? bodyColor + '44' : '#ff660044';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, PLAYER_SIZE + 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // Body
  ctx.shadowColor = bodyColor;
  ctx.shadowBlur = S.glitch ? 20 : 15;
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.moveTo(PLAYER_SIZE / 2, 0);
  ctx.lineTo(-PLAYER_SIZE / 2, -PLAYER_SIZE / 3);
  ctx.lineTo(-PLAYER_SIZE / 3, 0);
  ctx.lineTo(-PLAYER_SIZE / 2, PLAYER_SIZE / 3);
  ctx.closePath();
  ctx.fill();

  // Inner
  ctx.shadowBlur = 0;
  ctx.fillStyle = S.colors.inner;
  ctx.beginPath();
  ctx.moveTo(PLAYER_SIZE / 3, 0);
  ctx.lineTo(-PLAYER_SIZE / 3, -PLAYER_SIZE / 5);
  ctx.lineTo(-PLAYER_SIZE / 5, 0);
  ctx.lineTo(-PLAYER_SIZE / 3, PLAYER_SIZE / 5);
  ctx.closePath();
  ctx.fill();

  // Eye
  ctx.shadowColor = eyeColor;
  ctx.shadowBlur = 5;
  ctx.fillStyle = eyeColor;
  ctx.beginPath();
  ctx.arc(PLAYER_SIZE / 6, -2, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Thruster trail
  const tc = S.rainbow ? rainbow(240) : trailColor;
  ctx.shadowColor = tc;
  ctx.shadowBlur = 10;
  ctx.fillStyle = tc;
  ctx.beginPath();
  ctx.moveTo(-PLAYER_SIZE / 3, 0);
  ctx.lineTo(-PLAYER_SIZE / 2 - 8 - Math.random() * 6, -4);
  ctx.lineTo(-PLAYER_SIZE / 2 - 12 - Math.random() * 8, 0);
  ctx.lineTo(-PLAYER_SIZE / 2 - 8 - Math.random() * 6, 4);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.restore();
}