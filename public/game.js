const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const insertButton = document.getElementById('insert-button');
const overlay = document.getElementById('overlay');
const potValueEl = document.getElementById('pot-value');
const walletValueEl = document.getElementById('wallet-value');
const overlayList = overlay.querySelector('ul');
const overlayHint = overlay.querySelector('.hint');

const ENTRY_COST = 1;
const BOT_COUNT = 3;
const BOT_CONTRIBUTION = ENTRY_COST;
const BOT_SHOOT_INTERVAL = 5000;
const BOT_BULLET_DAMAGE = 20;
const CASH_OUT_HOLD_DURATION = 3000;
const CASH_OUT_COOLDOWN = 2000;
const INTRO_MESSAGE =
  "Drop $1 to spawn and battle rival mercenaries for the arena pot. Automated turrets keep the field busy for this prototype—land your neon shots, dodge return fire, and escape with the cash!";

const state = {
  wallet: 10,
  pot: 0,
  active: false,
  gameOver: false,
  lastShot: 0,
  shootInterval: 180,
  mouse: { x: canvas.width / 2, y: canvas.height / 2 },
  keys: new Set(),
};

const world = {
  width: 2400,
  height: 1600,
  barrierThickness: 120,
};

const CAMERA_SMOOTHING = 0.12;
const camera = {
  x: 0,
  y: 0,
};

const BARRIER_DAMAGE_PER_SECOND = 25;
let barrierDamageBuffer = 0;

let currentTimestamp = 0;

const player = {
  x: world.width / 2,
  y: world.height - world.barrierThickness - 200,
  radius: 18,
  maxSpeed: 5.1,
  acceleration: 0.36,
  damping: 0.86,
  vx: 0,
  vy: 0,
  thrusterWarmth: 0,
  health: 100,
  maxHealth: 100,
  color: '#3cfbff',
  sprite: null,
};

const bots = [];
const bullets = [];
const botBullets = [];
const particles = [];

const spriteSupportAvailable = typeof window !== 'undefined' && typeof Mask !== 'undefined' && typeof Sprite !== 'undefined';

const spriteAssets = spriteSupportAvailable ? buildSpriteAssets() : null;
const spaceBackdrop = spriteAssets ? spriteAssets.background : null;

if (spriteAssets?.player) {
  player.sprite = spriteAssets.player;
  player.radius = spriteAssets.player.hitRadius;
}

const cashOutState = {
  holding: false,
  holdStart: 0,
  cooldownUntil: 0,
};

function getMouseWorldPosition() {
  return {
    x: camera.x + state.mouse.x,
    y: camera.y + state.mouse.y,
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

class Bot {
  constructor(x, y, tint, spriteAsset) {
    this.x = x;
    this.y = y;
    this.sprite = spriteAsset || null;
    this.width = this.sprite?.width ?? 44;
    this.height = this.sprite?.height ?? 44;
    this.hitRadius = this.sprite?.hitRadius ?? Math.max(this.width, this.height) / 2;
    this.health = 60;
    this.maxHealth = 60;
    this.tint = tint;
    this.lastShot = performance.now();
  }

  draw() {
    const aimAngle = Math.atan2(player.y - this.y, player.x - this.x);
    if (this.sprite) {
      drawShipSprite(this.sprite, this.x, this.y, aimAngle, { glowColor: this.tint, thrusterIntensity: 0.35 });
    } else {
      drawFallbackBotSprite(this, aimAngle);
    }
    drawHealthBar(this.x, this.y - (this.hitRadius + 18), this.health, this.maxHealth);
  }
}

class Bullet {
  constructor(x, y, angle) {
    const speed = 7;
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = 70;
  }

  update(delta = 1) {
    this.x += this.vx * delta;
    this.y += this.vy * delta;
    this.life -= delta;
  }

  draw() {
    ctx.save();
    ctx.strokeStyle = '#ff3cac';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 2, this.y - this.vy * 2);
    ctx.stroke();
    ctx.restore();
  }
}

class BotBullet {
  constructor(x, y, angle) {
    const speed = 4.5;
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = 160;
  }

  update(delta = 1) {
    this.x += this.vx * delta;
    this.y += this.vy * delta;
    this.life -= delta;
  }

  draw() {
    ctx.save();
    ctx.strokeStyle = '#ffb347';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 3, this.y - this.vy * 3);
    ctx.stroke();
    ctx.restore();
  }
}

class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 3;
    this.vy = (Math.random() - 0.5) * 3;
    this.alpha = 1;
    this.size = Math.random() * 4 + 2;
    this.color = color;
  }

  update(delta = 1) {
    this.x += this.vx * delta;
    this.y += this.vy * delta;
    this.alpha -= 0.02 * delta;
  }

  draw() {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.size, this.size);
    ctx.restore();
  }
}

function updateHUD() {
  potValueEl.textContent = `$${state.pot.toFixed(2)}`;
  walletValueEl.textContent = `$${state.wallet.toFixed(2)}`;
  insertButton.disabled = state.wallet < ENTRY_COST || state.active;
}

function spawnBots() {
  bots.length = 0;
  const colors = ['#ff3cac', '#ffb74d', '#9575cd'];
  const positions = [
    { x: world.width * 0.28, y: world.barrierThickness + 320 },
    { x: world.width * 0.5, y: world.height * 0.36 + 40 },
    { x: world.width * 0.72, y: world.barrierThickness + 560 },
  ];
  for (let i = 0; i < BOT_COUNT; i += 1) {
    const spot = positions[i % positions.length];
    const tint = colors[i % colors.length];
    const sprite = spriteAssets?.botFactory ? spriteAssets.botFactory(tint) : null;
    bots.push(new Bot(spot.x, spot.y, tint, sprite));
  }
}

function resetGame() {
  player.x = world.width / 2;
  player.y = world.height - world.barrierThickness - 200;
  player.vx = 0;
  player.vy = 0;
  player.thrusterWarmth = 0;
  player.health = player.maxHealth;
  bullets.length = 0;
  botBullets.length = 0;
  particles.length = 0;
  cashOutState.holding = false;
  cashOutState.holdStart = 0;
  cashOutState.cooldownUntil = performance.now();
  barrierDamageBuffer = 0;
  camera.x = clamp(player.x - canvas.width / 2, 0, Math.max(world.width - canvas.width, 0));
  camera.y = clamp(player.y - canvas.height / 2, 0, Math.max(world.height - canvas.height, 0));
  spawnBots();
}

function insertAndSpawn() {
  if (state.wallet < ENTRY_COST || state.active) return;
  state.wallet -= ENTRY_COST;
  state.pot = ENTRY_COST + BOT_COUNT * BOT_CONTRIBUTION;
  updateHUD();
  overlay.classList.add('hidden');
  state.active = true;
  state.gameOver = false;
  shooting = false;
  mouseDrive = false;
  state.lastShot = 0;
  cashOutState.holding = false;
  cashOutState.holdStart = 0;
  cashOutState.cooldownUntil = performance.now();
  resetGame();
}

insertButton.addEventListener('click', insertAndSpawn);

document.addEventListener('keydown', (event) => {
  state.keys.add(event.key.toLowerCase());
});

document.addEventListener('keyup', (event) => {
  state.keys.delete(event.key.toLowerCase());
});

function updatePointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  state.mouse.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
  state.mouse.y = ((event.clientY - rect.top) / rect.height) * canvas.height;
}

let shooting = false;
let mouseDrive = false;

canvas.addEventListener('pointermove', (event) => {
  updatePointerPosition(event);
});

canvas.addEventListener('pointerdown', (event) => {
  updatePointerPosition(event);
  canvas.setPointerCapture(event.pointerId);
  if (event.button === 0) {
    shooting = true;
    shoot();
  } else if (event.button === 2) {
    mouseDrive = true;
  }
});

canvas.addEventListener('pointerup', (event) => {
  if (event.button === 0) {
    shooting = false;
  } else if (event.button === 2) {
    mouseDrive = false;
  }
  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }
});

canvas.addEventListener('pointercancel', () => {
  shooting = false;
  mouseDrive = false;
});

canvas.addEventListener('contextmenu', (event) => {
  event.preventDefault();
});

window.addEventListener('blur', () => {
  shooting = false;
  mouseDrive = false;
  state.keys.clear();
});

function shoot() {
  if (!state.active) return;
  const now = performance.now();
  if (now - state.lastShot < state.shootInterval) return;
  state.lastShot = now;
  const mouseWorld = getMouseWorldPosition();
  const angle = Math.atan2(mouseWorld.y - player.y, mouseWorld.x - player.x);
  const muzzleDistance = player.sprite?.muzzleLength ?? player.radius + 6;
  const muzzleX = player.x + Math.cos(angle) * muzzleDistance;
  const muzzleY = player.y + Math.sin(angle) * muzzleDistance;
  bullets.push(new Bullet(muzzleX, muzzleY, angle));
  for (let i = 0; i < 4; i += 1) {
    particles.push(new Particle(muzzleX, muzzleY, '#ff3cac'));
  }
}

function completeCashOut() {
  state.active = false;
  state.gameOver = true;
  shooting = false;
  mouseDrive = false;
  const winnings = state.pot;
  state.wallet += winnings;
  state.pot = 0;
  updateHUD();
  cashOutState.holding = false;
  botBullets.length = 0;
  barrierDamageBuffer = 0;
  showOverlay('Cash Out Complete', `You extracted $${winnings.toFixed(2)} from the arena.`);
}

function interruptCashOut(now) {
  if (cashOutState.holding) {
    cashOutState.holding = false;
    cashOutState.holdStart = 0;
  }
  cashOutState.cooldownUntil = Math.max(cashOutState.cooldownUntil, now + CASH_OUT_COOLDOWN);
}

function updateCashOut(timestamp) {
  if (!state.active) {
    cashOutState.holding = false;
    return;
  }

  const now = timestamp;
  if (cashOutState.holding) {
    if (!state.keys.has('g')) {
      cashOutState.holding = false;
      cashOutState.holdStart = 0;
    } else if (now - cashOutState.holdStart >= CASH_OUT_HOLD_DURATION) {
      completeCashOut();
    }
    return;
  }

  if (!state.keys.has('g')) return;
  if (now < cashOutState.cooldownUntil) return;

  cashOutState.holding = true;
  cashOutState.holdStart = now;
}

function handlePlayerDefeat() {
  state.active = false;
  state.gameOver = true;
  shooting = false;
  mouseDrive = false;
  const loss = state.pot;
  state.pot = 0;
  updateHUD();
  botBullets.length = 0;
  barrierDamageBuffer = 0;
  showOverlay('Defeat', loss > 0 ? `You were eliminated and lost the $${loss.toFixed(2)} pot.` : 'You were eliminated.');
}

function handlePlayerHit(damage, timestamp) {
  if (!state.active) return;
  player.health = Math.max(player.health - damage, 0);
  interruptCashOut(timestamp);
  for (let i = 0; i < 6; i += 1) {
    particles.push(new Particle(player.x, player.y, '#ff3cac'));
  }
  if (player.health <= 0) {
    handlePlayerDefeat();
  }
}

function handleBotShooting(timestamp) {
  bots.forEach((bot) => {
    if (timestamp - bot.lastShot < BOT_SHOOT_INTERVAL) return;
    bot.lastShot = timestamp;
    const centerX = bot.x;
    const centerY = bot.y;
    const angle = Math.atan2(player.y - centerY, player.x - centerX);
    botBullets.push(new BotBullet(centerX, centerY, angle));
  });
}

function applyPlayerConstraints(candidateX, candidateY, delta, timestamp) {
  const innerLeft = world.barrierThickness + player.radius;
  const innerRight = world.width - world.barrierThickness - player.radius;
  const innerTop = world.barrierThickness + player.radius;
  const innerBottom = world.height - world.barrierThickness - player.radius;

  let clampedX = clamp(candidateX, innerLeft, innerRight);
  let clampedY = clamp(candidateY, innerTop, innerBottom);
  const touchedBarrier = clampedX !== candidateX || clampedY !== candidateY;

  player.x = clampedX;
  player.y = clampedY;

  if (touchedBarrier) {
    applyBarrierDamage(delta, timestamp);
  }
}

function applyBarrierDamage(delta, timestamp) {
  if (!state.active) return;
  const seconds = delta / 60;
  barrierDamageBuffer += BARRIER_DAMAGE_PER_SECOND * seconds;
  if (barrierDamageBuffer >= 1) {
    const damage = Math.floor(barrierDamageBuffer);
    barrierDamageBuffer -= damage;
    handlePlayerHit(damage, timestamp);
    for (let i = 0; i < 3; i += 1) {
      particles.push(new Particle(player.x, player.y, '#ff8e53'));
    }
  }
}

function handleMovement(delta, timestamp) {
  const { keys } = state;
  let inputX = 0;
  let inputY = 0;

  if (keys.has('w') || keys.has('arrowup')) inputY -= 1;
  if (keys.has('s') || keys.has('arrowdown')) inputY += 1;
  if (keys.has('a') || keys.has('arrowleft')) inputX -= 1;
  if (keys.has('d') || keys.has('arrowright')) inputX += 1;

  if (mouseDrive) {
    const mouseWorld = getMouseWorldPosition();
    const dx = mouseWorld.x - player.x;
    const dy = mouseWorld.y - player.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 8) {
      inputX += dx / distance;
      inputY += dy / distance;
    }
  }

  const damping = Math.pow(player.damping, Math.max(delta, 0));
  player.vx *= damping;
  player.vy *= damping;

  const inputMagnitude = Math.hypot(inputX, inputY);
  if (inputMagnitude > 0) {
    const nx = inputX / inputMagnitude;
    const ny = inputY / inputMagnitude;
    player.vx += nx * player.acceleration * delta;
    player.vy += ny * player.acceleration * delta;
  }

  const speed = Math.hypot(player.vx, player.vy);
  if (speed > player.maxSpeed) {
    const scale = player.maxSpeed / speed;
    player.vx *= scale;
    player.vy *= scale;
  }

  if (player.sprite) {
    const targetWarmth = speed > 0.4 ? 1 : 0;
    player.thrusterWarmth += (targetWarmth - player.thrusterWarmth) * Math.min(delta * 0.15, 1);
  }

  if (speed < 0.01) {
    player.vx = 0;
    player.vy = 0;
  }

  if (player.vx !== 0 || player.vy !== 0) {
    const candidateX = player.x + player.vx * delta;
    const candidateY = player.y + player.vy * delta;
    applyPlayerConstraints(candidateX, candidateY, delta, timestamp);
  } else {
    applyPlayerConstraints(player.x, player.y, delta, timestamp);
  }
}

function updateCamera(delta) {
  const targetX = clamp(player.x - canvas.width / 2, 0, Math.max(world.width - canvas.width, 0));
  const targetY = clamp(player.y - canvas.height / 2, 0, Math.max(world.height - canvas.height, 0));
  const smoothing = 1 - Math.pow(1 - CAMERA_SMOOTHING, Math.max(delta, 0));
  camera.x += (targetX - camera.x) * smoothing;
  camera.y += (targetY - camera.y) * smoothing;
}

function updateBullets(delta) {
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const bullet = bullets[i];
    bullet.update(delta);
    if (bullet.life <= 0) {
      bullets.splice(i, 1);
      continue;
    }
    for (let j = bots.length - 1; j >= 0; j -= 1) {
      const bot = bots[j];
      const distance = Math.hypot(bullet.x - bot.x, bullet.y - bot.y);
      if (distance <= bot.hitRadius) {
        bot.health -= 20;
        bullets.splice(i, 1);
        for (let k = 0; k < 6; k += 1) {
          particles.push(new Particle(bullet.x, bullet.y, bot.tint));
        }
        if (bot.health <= 0) {
          bots.splice(j, 1);
        }
        break;
      }
    }
  }
}

function updateBotBullets(delta, timestamp) {
  for (let i = botBullets.length - 1; i >= 0; i -= 1) {
    const bullet = botBullets[i];
    if (!bullet) {
      botBullets.splice(i, 1);
      continue;
    }
    bullet.update(delta);
    if (
      bullet.life <= 0 ||
      bullet.x < -20 ||
      bullet.x > world.width + 20 ||
      bullet.y < -20 ||
      bullet.y > world.height + 20
    ) {
      botBullets.splice(i, 1);
      continue;
    }

    const distance = Math.hypot(bullet.x - player.x, bullet.y - player.y);
    if (distance <= player.radius) {
      botBullets.splice(i, 1);
      handlePlayerHit(BOT_BULLET_DAMAGE, timestamp);
      if (!state.active) {
        return;
      }
    }
  }
}

function updateParticles(delta) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const particle = particles[i];
    particle.update(delta);
    if (particle.alpha <= 0) {
      particles.splice(i, 1);
    }
  }
}

function drawBackground() {
  ctx.save();
  if (spaceBackdrop) {
    ctx.fillStyle = '#050414';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!spaceBackdrop.pattern) {
      spaceBackdrop.pattern = ctx.createPattern(spaceBackdrop.tile, 'repeat');
    }

    const tileWidth = spaceBackdrop.tile.width;
    const tileHeight = spaceBackdrop.tile.height;
    const parallax = 0.35;
    const offsetX = -((camera.x * parallax) % tileWidth);
    const offsetY = -((camera.y * parallax) % tileHeight);

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.fillStyle = spaceBackdrop.pattern;
    ctx.fillRect(-tileWidth, -tileHeight, canvas.width + tileWidth * 2, canvas.height + tileHeight * 2);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.translate(-camera.x * 0.12, -camera.y * 0.12);
    ctx.drawImage(spaceBackdrop.nebula, 0, 0);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.translate(-camera.x * 0.05, -camera.y * 0.05);
    ctx.drawImage(spaceBackdrop.farStars, 0, 0);
    ctx.restore();
  } else {
    ctx.fillStyle = '#0c0617';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const gridSpacing = 96;
    const offsetX = -(camera.x % gridSpacing);
    const offsetY = -(camera.y % gridSpacing);

    ctx.strokeStyle = 'rgba(255, 60, 172, 0.12)';
    ctx.lineWidth = 1;
    for (let x = offsetX; x < canvas.width; x += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = offsetY; y < canvas.height; y += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawBarrier() {
  const { barrierThickness } = world;
  const edges = [
    { x: 0, y: 0, width: world.width, height: barrierThickness, orientation: 'horizontal' },
    { x: 0, y: world.height - barrierThickness, width: world.width, height: barrierThickness, orientation: 'horizontal' },
    { x: 0, y: 0, width: barrierThickness, height: world.height, orientation: 'vertical' },
    { x: world.width - barrierThickness, y: 0, width: barrierThickness, height: world.height, orientation: 'vertical' },
  ];

  edges.forEach((edge) => {
    const gradient =
      edge.orientation === 'horizontal'
        ? ctx.createLinearGradient(edge.x, edge.y, edge.x, edge.y + edge.height)
        : ctx.createLinearGradient(edge.x, edge.y, edge.x + edge.width, edge.y);
    gradient.addColorStop(0, 'rgba(255, 118, 20, 0.85)');
    gradient.addColorStop(0.5, 'rgba(255, 45, 104, 0.9)');
    gradient.addColorStop(1, 'rgba(255, 199, 0, 0.8)');
    ctx.fillStyle = gradient;
    ctx.fillRect(edge.x, edge.y, edge.width, edge.height);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    const step = 18;
    if (edge.orientation === 'horizontal') {
      for (let i = 0; i < edge.width; i += step) {
        ctx.fillRect(edge.x + i, edge.y + (i % (step * 2)), 6, 6);
      }
    } else {
      for (let i = 0; i < edge.height; i += step) {
        ctx.fillRect(edge.x + (i % (step * 2)), edge.y + i, 6, 6);
      }
    }
  });
}

function drawPlayer() {
  const mouseWorld = getMouseWorldPosition();
  const angle = Math.atan2(mouseWorld.y - player.y, mouseWorld.x - player.x);

  if (player.sprite) {
    drawShipSprite(player.sprite, player.x, player.y, angle, {
      thrusterIntensity: player.thrusterWarmth,
      glowColor: player.color,
      showMuzzle: shooting && state.active,
    });
    drawHealthBar(player.x, player.y + player.sprite.hitRadius + 20, player.health, player.maxHealth);
  } else {
    drawFallbackPlayer(angle);
    drawHealthBar(player.x, player.y + 30, player.health, player.maxHealth);
  }
}

function drawBots() {
  bots.forEach((bot) => bot.draw());
}

function drawHealthBar(x, y, value, maxValue) {
  const width = 60;
  const height = 6;
  ctx.save();
  ctx.fillStyle = 'rgba(12, 6, 23, 0.7)';
  ctx.fillRect(x - width / 2, y, width, height);
  ctx.fillStyle = '#3cfbff';
  ctx.fillRect(x - width / 2, y, (width * value) / maxValue, height);
  ctx.strokeStyle = 'rgba(60, 251, 255, 0.8)';
  ctx.strokeRect(x - width / 2, y, width, height);
  ctx.restore();
}

function drawFallbackPlayer(angle) {
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(angle);

  ctx.fillStyle = '#0b0411';
  ctx.fillRect(-20, -16, 40, 32);

  ctx.fillStyle = player.color;
  ctx.fillRect(-16, -12, 32, 24);

  ctx.fillStyle = '#ff3cac';
  ctx.fillRect(8, -6, 20, 12);

  ctx.fillStyle = '#f5ff5c';
  ctx.fillRect(-12, -8, 8, 6);
  ctx.fillRect(-12, 2, 8, 6);

  ctx.restore();
}

function drawFallbackBotSprite(bot, angle) {
  ctx.save();
  ctx.translate(bot.x, bot.y);
  ctx.rotate(angle);

  ctx.fillStyle = '#101221';
  ctx.fillRect(-bot.width / 2, -bot.height / 2, bot.width, bot.height);

  ctx.fillStyle = bot.tint;
  ctx.fillRect(-bot.width / 2 + 6, -bot.height / 2 + 8, bot.width - 12, bot.height * 0.45);
  ctx.fillRect(-bot.width / 2 + 8, -bot.height / 2 + bot.height * 0.4, bot.width - 16, bot.height * 0.35);

  ctx.fillStyle = '#ffde59';
  ctx.fillRect(bot.width / 2 - 14, -bot.height / 2 + 6, 10, 10);
  ctx.restore();
}

function drawShipSprite(asset, x, y, angle, { thrusterIntensity = 0, glowColor = '#3cfbff', showMuzzle = false } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle + asset.rotationOffset);

  if (thrusterIntensity > 0 && asset.thrusterAnchor) {
    const { offsetX, offsetY, length, width } = asset.thrusterAnchor;
    const intensity = Math.min(1, Math.max(0, thrusterIntensity));
    const flameLength = length * (0.6 + Math.random() * 0.4) * intensity;
    const gradient = ctx.createLinearGradient(offsetX, offsetY, offsetX - flameLength, offsetY);
    gradient.addColorStop(0, `rgba(245, 255, 92, ${0.55 * intensity})`);
    gradient.addColorStop(0.5, `rgba(255, 95, 0, ${0.45 * intensity})`);
    gradient.addColorStop(1, 'rgba(12, 6, 23, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(offsetX, offsetY - width / 2);
    ctx.lineTo(offsetX, offsetY + width / 2);
    ctx.lineTo(offsetX - flameLength, offsetY);
    ctx.closePath();
    ctx.fill();
  }

  if (asset.glowRadius) {
    const glow = ctx.createRadialGradient(0, 0, asset.glowRadius * 0.4, 0, 0, asset.glowRadius);
    glow.addColorStop(0, `${hexToRgba(glowColor, 0.2)}`);
    glow.addColorStop(1, 'rgba(60, 251, 255, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, asset.glowRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.drawImage(asset.canvas, -asset.anchorX, -asset.anchorY);

  if (asset.muzzle && showMuzzle) {
    const { offsetX, offsetY, length, width } = asset.muzzle;
    const spark = Math.random() * 0.35;
    ctx.fillStyle = `rgba(245, 255, 92, ${0.45 + spark})`;
    ctx.fillRect(offsetX, offsetY - width / 2, length, width);
  }

  ctx.restore();
}

function buildSpriteAssets() {
  try {
    const playerMaskData = [
      0, 0, 0, 1, 2, 2,
      0, 0, 1, 1, 2, 2,
      0, 1, 1, 2, 2, 2,
      0, 1, 1, 2, 2, 2,
      0, 1, 2, 2, 2, 2,
      1, 1, 2, 2, 2, 2,
      1, 1, 2, 2, 2, 2,
      1, 1, 2, 2, 2, 2,
      1, 1, 1, 2, 2, 2,
      0, 1, 1, 2, 2, 2,
      0, 0, 1, 2, 2, 2,
      0, 0, 1, 1, 2, 2,
      0, 0, 0, 1, 2, 2,
      0, 0, 0, 1, 2, 2,
    ];

    const botMaskData = [
      0, 0, 1, 2, 2,
      0, 1, 1, 2, 2,
      0, 1, 2, 2, 2,
      1, 1, 2, 2, 2,
      1, 1, 2, 2, 2,
      1, 1, 2, 2, 2,
      1, 1, 2, 2, 2,
      0, 1, 2, 2, 2,
      0, 1, 1, 2, 2,
      0, 0, 1, 2, 2,
      0, 0, 1, 2, 2,
    ];

    const playerMask = new Mask(playerMaskData, 6, 14, true, false);
    const botMask = new Mask(botMaskData, 5, 11, true, false);

    const playerPalette = {
      primary: '#3cfbff',
      secondary: '#8cfff4',
      outline: '#071322',
      highlight: '#f5ff5c',
      cockpit: '#0d0a28',
    };

    const botPaletteBase = {
      outline: '#0c0d1a',
      secondary: '#ffd2f7',
      highlight: '#ffe8a7',
      cockpit: '#140d2c',
    };

    const playerAsset = createShipAsset(playerMask, {
      scale: 4,
      palette: playerPalette,
      detail: { stripes: true, fins: true },
      muzzle: { offsetX: null, offsetY: 0, length: 3.2, width: 1.2 },
      thruster: { offsetX: null, offsetY: 0, length: 5.2, width: 2.6 },
    });

    const botFactory = (tint) => {
      const palette = {
        primary: tint,
        secondary: lightenColor(tint, 0.35),
        outline: botPaletteBase.outline,
        highlight: botPaletteBase.highlight,
        cockpit: botPaletteBase.cockpit,
      };
      return createShipAsset(botMask, {
        scale: 3,
        palette,
        detail: { stripes: false, fins: false },
        muzzle: { offsetX: null, offsetY: 0, length: 2.4, width: 1 },
        thruster: { offsetX: null, offsetY: 0, length: 4, width: 2 },
      });
    };

    const background = createSpaceBackdrop();

    return { player: playerAsset, botFactory, background };
  } catch (error) {
    console.warn('Failed to build sprite assets', error);
    return null;
  }
}

function createShipAsset(mask, { scale = 4, palette, detail = {}, muzzle = {}, thruster = {} } = {}) {
  const sprite = new Sprite(mask, false);
  const baseCanvas = document.createElement('canvas');
  baseCanvas.width = sprite.canvas.width;
  baseCanvas.height = sprite.canvas.height;
  const baseCtx = baseCanvas.getContext('2d');
  baseCtx.drawImage(sprite.canvas, 0, 0);

  const scaledCanvas = document.createElement('canvas');
  scaledCanvas.width = baseCanvas.width * scale;
  scaledCanvas.height = baseCanvas.height * scale;
  const scaledCtx = scaledCanvas.getContext('2d');
  scaledCtx.imageSmoothingEnabled = false;
  scaledCtx.drawImage(baseCanvas, 0, 0, scaledCanvas.width, scaledCanvas.height);

  applySpritePalette(scaledCtx, scaledCanvas.width, scaledCanvas.height, palette);
  addShipDetails(scaledCtx, scaledCanvas.width, scaledCanvas.height, scale, palette, detail);

  const rotatedCanvas = rotateCanvas(scaledCanvas, Math.PI / 2);
  const anchorX = rotatedCanvas.width / 2;
  const anchorY = rotatedCanvas.height / 2;

  const asset = {
    canvas: rotatedCanvas,
    width: rotatedCanvas.width,
    height: rotatedCanvas.height,
    anchorX,
    anchorY,
    rotationOffset: 0,
    glowRadius: Math.max(rotatedCanvas.width, rotatedCanvas.height) * 0.45,
  };

  const muzzleStartX = muzzle.offsetX != null ? muzzle.offsetX * scale : rotatedCanvas.width - scale * 1.2;
  const muzzleStartY = muzzle.offsetY != null ? anchorY + muzzle.offsetY * scale : anchorY;
  asset.muzzle = {
    offsetX: muzzleStartX - anchorX,
    offsetY: muzzleStartY - anchorY,
    length: (muzzle.length ?? 3) * scale,
    width: (muzzle.width ?? 1.1) * scale,
  };
  asset.muzzleLength = asset.muzzle.offsetX + asset.muzzle.length;

  const thrusterStartX = thruster.offsetX != null ? thruster.offsetX * scale : scale * 1.6;
  const thrusterStartY = thruster.offsetY != null ? anchorY + thruster.offsetY * scale : anchorY;
  asset.thrusterAnchor = {
    offsetX: thrusterStartX - anchorX,
    offsetY: thrusterStartY - anchorY,
    length: (thruster.length ?? 5) * scale,
    width: Math.max(scale * 1.5, (thruster.width ?? 2.4) * scale),
  };

  asset.hitRadius = Math.max(rotatedCanvas.width, rotatedCanvas.height) / 2 - scale;

  return asset;
}

function applySpritePalette(ctx, width, height, palette) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;
  const primary = hexToRgb(palette.primary);
  const secondary = hexToRgb(palette.secondary ?? palette.primary);
  const outline = hexToRgb(palette.outline ?? '#050810');
  const highlight = hexToRgb(palette.highlight ?? palette.secondary ?? palette.primary);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4;
      const alpha = data[idx + 3];
      if (alpha === 0) continue;
      const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;

      if (brightness < 50) {
        data[idx] = outline.r;
        data[idx + 1] = outline.g;
        data[idx + 2] = outline.b;
        continue;
      }

      const vertical = y / height;
      const accent = Math.max(0, 1 - Math.abs(vertical - 0.45) * 1.8);
      const mix = Math.min(1, 0.25 + accent * 0.55);
      const mixed = mixRgb(primary, secondary, mix);
      const final = mixRgb(mixed, highlight, Math.pow(1 - vertical, 1.4) * 0.2);

      data[idx] = Math.round(final.r);
      data[idx + 1] = Math.round(final.g);
      data[idx + 2] = Math.round(final.b);
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

function addShipDetails(ctx, width, height, scale, palette, detail = {}) {
  const midY = height / 2;
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = hexToRgba(palette.secondary ?? palette.primary, 0.28);
  ctx.fillRect(width * 0.28, scale, scale * 1.2, height - scale * 2);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = hexToRgba(palette.highlight ?? palette.primary, 0.5);
  ctx.fillRect(width - scale * 4, midY - scale * 1.6, scale * 2.4, scale * 3.2);
  ctx.restore();

  if (detail.stripes) {
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = hexToRgba(palette.primary, 0.45);
    ctx.fillRect(width * 0.45, scale * 1.2, scale * 0.6, height - scale * 2.4);
    ctx.fillRect(width * 0.55, scale * 1.6, scale * 0.6, height - scale * 3);
    ctx.restore();
  }

  ctx.save();
  ctx.strokeStyle = hexToRgba(palette.outline ?? '#050810', 0.45);
  ctx.lineWidth = Math.max(1, scale * 0.5);
  ctx.beginPath();
  ctx.moveTo(scale * 1.2, midY);
  ctx.lineTo(width - scale * 1.2, midY);
  ctx.stroke();
  ctx.restore();
}

function rotateCanvas(sourceCanvas, radians) {
  const rotated = document.createElement('canvas');
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));
  rotated.width = Math.ceil(sourceCanvas.width * cos + sourceCanvas.height * sin);
  rotated.height = Math.ceil(sourceCanvas.width * sin + sourceCanvas.height * cos);
  const rctx = rotated.getContext('2d');
  rctx.imageSmoothingEnabled = false;
  rctx.translate(rotated.width / 2, rotated.height / 2);
  rctx.rotate(radians);
  rctx.drawImage(sourceCanvas, -sourceCanvas.width / 2, -sourceCanvas.height / 2);
  return rotated;
}

function createSpaceBackdrop() {
  const tileSize = 256;
  const tile = document.createElement('canvas');
  tile.width = tileSize;
  tile.height = tileSize;
  const tctx = tile.getContext('2d');
  tctx.fillStyle = '#040314';
  tctx.fillRect(0, 0, tileSize, tileSize);

  for (let i = 0; i < 220; i += 1) {
    const size = Math.random() < 0.82 ? 1 : 2;
    const alpha = 0.25 + Math.random() * 0.55;
    const r = 210 + Math.random() * 45;
    const g = 210 + Math.random() * 35;
    const b = 255;
    tctx.fillStyle = `rgba(${r.toFixed(0)}, ${g.toFixed(0)}, ${b.toFixed(0)}, ${alpha.toFixed(2)})`;
    const x = Math.random() * tileSize;
    const y = Math.random() * tileSize;
    tctx.fillRect(x, y, size, size);
  }

  for (let i = 0; i < 28; i += 1) {
    const radius = 0.6 + Math.random() * 1.5;
    const hue = 200 + Math.random() * 80;
    const saturation = 70 + Math.random() * 20;
    const lightness = 60 + Math.random() * 15;
    tctx.fillStyle = `hsla(${hue.toFixed(0)}, ${saturation.toFixed(0)}%, ${lightness.toFixed(0)}%, 0.45)`;
    tctx.beginPath();
    tctx.arc(Math.random() * tileSize, Math.random() * tileSize, radius, 0, Math.PI * 2);
    tctx.fill();
  }

  const farStars = document.createElement('canvas');
  farStars.width = world.width + 400;
  farStars.height = world.height + 400;
  const fctx = farStars.getContext('2d');
  for (let i = 0; i < 130; i += 1) {
    const x = Math.random() * farStars.width;
    const y = Math.random() * farStars.height;
    const size = 1 + Math.random() * 2.5;
    const gradient = fctx.createRadialGradient(x, y, 0, x, y, size * 4);
    gradient.addColorStop(0, `rgba(245, 255, 210, ${0.4 + Math.random() * 0.3})`);
    gradient.addColorStop(1, 'rgba(4, 3, 18, 0)');
    fctx.fillStyle = gradient;
    fctx.beginPath();
    fctx.arc(x, y, size * 4, 0, Math.PI * 2);
    fctx.fill();
  }

  const nebula = document.createElement('canvas');
  nebula.width = world.width + 400;
  nebula.height = world.height + 400;
  const nctx = nebula.getContext('2d');
  const nebulaCount = 4;
  for (let i = 0; i < nebulaCount; i += 1) {
    const nx = Math.random() * nebula.width;
    const ny = Math.random() * nebula.height;
    const radius = Math.max(world.width, world.height) * (0.22 + Math.random() * 0.18);
    const hue = 200 + Math.random() * 60;
    const gradient = nctx.createRadialGradient(nx, ny, 0, nx, ny, radius);
    gradient.addColorStop(0, `hsla(${hue.toFixed(0)}, 85%, 55%, 0.32)`);
    gradient.addColorStop(1, 'rgba(4, 3, 18, 0)');
    nctx.fillStyle = gradient;
    nctx.beginPath();
    nctx.arc(nx, ny, radius, 0, Math.PI * 2);
    nctx.fill();
  }

  return { tile, farStars, nebula, pattern: null };
}

function hexToRgb(hex) {
  const normalized = hex.replace('#', '');
  const bigint = parseInt(normalized.length === 3 ? normalized.repeat(2) : normalized, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b]
    .map((channel) => {
      const clamped = Math.max(0, Math.min(255, Math.round(channel)));
      return clamped.toString(16).padStart(2, '0');
    })
    .join('')}`;
}

function lightenColor(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(
    r + (255 - r) * amount,
    g + (255 - g) * amount,
    b + (255 - b) * amount
  );
}

function mixRgb(a, b, t) {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

function hexToRgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawParticles() {
  particles.forEach((particle) => particle.draw());
}

function drawUI() {
  ctx.save();
  ctx.fillStyle = 'rgba(12, 6, 23, 0.5)';
  ctx.fillRect(24, canvas.height - 70, 240, 46);
  ctx.strokeStyle = 'rgba(60, 251, 255, 0.4)';
  ctx.strokeRect(24, canvas.height - 70, 240, 46);

  ctx.fillStyle = '#ff3cac';
  ctx.font = '16px "Press Start 2P"';
  ctx.fillText('BOTS LEFT', 40, canvas.height - 42);
  ctx.fillStyle = '#f5ff5c';
  ctx.font = '20px "Press Start 2P"';
  ctx.fillText(String(bots.length).padStart(2, '0'), 40, canvas.height - 18);

  ctx.fillStyle = '#3cfbff';
  ctx.font = '12px "Press Start 2P"';
  ctx.fillText(`POT: $${state.pot.toFixed(2)}`, 150, canvas.height - 36);
  ctx.fillText(`HP: ${Math.max(player.health, 0)}`, 150, canvas.height - 20);

  if (state.active) {
    ctx.fillStyle = '#f5ff5c';
    ctx.font = '10px "Press Start 2P"';
    ctx.fillText('CASH OUT [G]', 40, canvas.height - 4);

    const cooldownRemaining = Math.max(0, cashOutState.cooldownUntil - currentTimestamp);
    const barX = 150;
    const barY = canvas.height - 14;
    const barWidth = 104;
    const barHeight = 6;
    ctx.fillStyle = 'rgba(12, 6, 23, 0.7)';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    let progress = 0;
    if (cashOutState.holding) {
      progress = Math.min((currentTimestamp - cashOutState.holdStart) / CASH_OUT_HOLD_DURATION, 1);
      ctx.fillStyle = '#3cfbff';
      ctx.fillRect(barX, barY, barWidth * progress, barHeight);
      ctx.fillStyle = '#ff3cac';
      ctx.font = '8px "Press Start 2P"';
      ctx.fillText('HOLDING...', barX, barY - 2);
    } else if (cooldownRemaining > 0) {
      progress = Math.min(cooldownRemaining / CASH_OUT_COOLDOWN, 1);
      ctx.fillStyle = '#ff3cac';
      ctx.fillRect(barX, barY, barWidth * progress, barHeight);
      ctx.fillStyle = '#ff3cac';
      ctx.font = '8px "Press Start 2P"';
      ctx.fillText('HIT! RECOVERING', barX, barY - 2);
    } else {
      ctx.fillStyle = '#3cfbff';
      ctx.fillRect(barX, barY, barWidth, barHeight);
      ctx.font = '8px "Press Start 2P"';
      ctx.fillText('READY', barX, barY - 2);
    }

    ctx.strokeStyle = 'rgba(60, 251, 255, 0.8)';
    ctx.strokeRect(barX, barY, barWidth, barHeight);
  }
  drawMiniMap();
  ctx.restore();
}

function drawMiniMap() {
  const width = 220;
  const height = 160;
  const padding = 24;
  const x = canvas.width - width - padding;
  const y = padding;
  const innerPadding = 12;

  ctx.save();
  ctx.fillStyle = 'rgba(12, 6, 23, 0.7)';
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = 'rgba(60, 251, 255, 0.45)';
  ctx.strokeRect(x, y, width, height);

  const innerWidth = width - innerPadding * 2;
  const innerHeight = height - innerPadding * 2;
  const scale = Math.min(innerWidth / world.width, innerHeight / world.height);
  const offsetX = x + innerPadding + (innerWidth - world.width * scale) / 2;
  const offsetY = y + innerPadding + (innerHeight - world.height * scale) / 2;

  ctx.fillStyle = 'rgba(6, 3, 12, 0.95)';
  ctx.fillRect(offsetX, offsetY, world.width * scale, world.height * scale);

  const barrierScaled = world.barrierThickness * scale;
  ctx.fillStyle = 'rgba(255, 95, 0, 0.28)';
  ctx.fillRect(offsetX, offsetY, world.width * scale, barrierScaled);
  ctx.fillRect(offsetX, offsetY + world.height * scale - barrierScaled, world.width * scale, barrierScaled);
  ctx.fillRect(offsetX, offsetY, barrierScaled, world.height * scale);
  ctx.fillRect(offsetX + world.width * scale - barrierScaled, offsetY, barrierScaled, world.height * scale);

  const safeX = offsetX + barrierScaled;
  const safeY = offsetY + barrierScaled;
  const safeWidth = (world.width - world.barrierThickness * 2) * scale;
  const safeHeight = (world.height - world.barrierThickness * 2) * scale;
  ctx.strokeStyle = 'rgba(255, 168, 0, 0.6)';
  ctx.lineWidth = 2;
  ctx.strokeRect(safeX, safeY, safeWidth, safeHeight);

  bots.forEach((bot) => {
    ctx.fillStyle = bot.tint;
    ctx.fillRect(offsetX + bot.x * scale - 3, offsetY + bot.y * scale - 3, 6, 6);
  });

  ctx.fillStyle = '#3cfbff';
  ctx.beginPath();
  ctx.arc(offsetX + player.x * scale, offsetY + player.y * scale, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(60, 251, 255, 0.8)';
  ctx.stroke();

  const viewportX = offsetX + camera.x * scale;
  const viewportY = offsetY + camera.y * scale;
  const viewportWidth = Math.min(canvas.width, world.width) * scale;
  const viewportHeight = Math.min(canvas.height, world.height) * scale;
  ctx.strokeStyle = 'rgba(245, 255, 92, 0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(viewportX, viewportY, viewportWidth, viewportHeight);

  ctx.restore();
}

function checkWinState() {
  if (!state.active || state.gameOver) return;
  if (bots.length === 0) {
    state.active = false;
    state.gameOver = true;
    const winnings = state.pot;
    state.wallet += winnings;
    state.pot = 0;
    shooting = false;
    mouseDrive = false;
    updateHUD();
    showOverlay('Victory!', `You cleared the arena and collected $${winnings.toFixed(2)}.`);
  }
}

function showOverlay(title, message, { showList = false } = {}) {
  overlay.classList.remove('hidden');
  overlay.querySelector('h1').textContent = title;
  overlay.querySelector('p').textContent = message;
  overlayList.style.display = showList ? 'grid' : 'none';
  overlayHint.textContent = showList
    ? 'Press the button above to insert $1 and enter the arena.'
    : 'Hit the insert button to rejoin the arena.';
}

function update(delta, timestamp) {
  updateCashOut(timestamp);
  if (state.active) {
    handleMovement(delta, timestamp);
    if (shooting) {
      shoot();
    }
    handleBotShooting(timestamp);
    updateBullets(delta);
    updateBotBullets(delta, timestamp);
    updateParticles(delta);
    checkWinState();
  } else {
    player.vx *= 0.9;
    player.vy *= 0.9;
    if (player.sprite) {
      player.thrusterWarmth += (0 - player.thrusterWarmth) * Math.min(delta * 0.2, 1);
    }
    updateParticles(delta);
  }
  updateCamera(delta);
}

function draw() {
  drawBackground();
  ctx.save();
  ctx.translate(-camera.x, -camera.y);
  drawBarrier();
  drawBots();
  drawPlayer();
  drawParticles();
  bullets.forEach((bullet) => bullet.draw());
  botBullets.forEach((bullet) => bullet.draw());
  ctx.restore();
  drawUI();
}

let lastTimestamp = 0;
function loop(timestamp) {
  const delta = (timestamp - lastTimestamp) / (1000 / 60);
  lastTimestamp = timestamp;
  currentTimestamp = timestamp;
  update(delta, timestamp);
  draw();
  requestAnimationFrame(loop);
}

resetGame();
updateHUD();
showOverlay('Skill Gamble Arena', INTRO_MESSAGE, { showList: true });
requestAnimationFrame(loop);