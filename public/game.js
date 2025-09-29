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
  speed: 2.8,
  health: 100,
  maxHealth: 100,
  color: '#3cfbff',
};

const bots = [];
const bullets = [];
const botBullets = [];
const particles = [];

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
  constructor(x, y, tint) {
    this.x = x;
    this.y = y;
    this.width = 44;
    this.height = 44;
    this.health = 60;
    this.maxHealth = 60;
    this.tint = tint;
    this.lastShot = performance.now();
  }

  draw() {
    drawBotSprite(this.x, this.y, this.tint);
    drawHealthBar(this.x + this.width / 2, this.y - 12, this.health, this.maxHealth);
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
    { x: world.width * 0.28, y: world.barrierThickness + 260 },
    { x: world.width * 0.5 - 22, y: world.height * 0.36 },
    { x: world.width * 0.72, y: world.barrierThickness + 520 },
  ];
  for (let i = 0; i < BOT_COUNT; i += 1) {
    const spot = positions[i % positions.length];
    bots.push(new Bot(spot.x, spot.y, colors[i % colors.length]));
  }
}

function resetGame() {
  player.x = world.width / 2;
  player.y = world.height - world.barrierThickness - 200;
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

canvas.addEventListener('mousemove', (event) => {
  const rect = canvas.getBoundingClientRect();
  state.mouse.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
  state.mouse.y = ((event.clientY - rect.top) / rect.height) * canvas.height;
});

let shooting = false;
let mouseDrive = false;

canvas.addEventListener('mousedown', (event) => {
  if (event.button === 0) {
    shooting = true;
    shoot();
  } else if (event.button === 2) {
    mouseDrive = true;
  }
});

document.addEventListener('mouseup', (event) => {
  if (event.button === 0) {
    shooting = false;
  } else if (event.button === 2) {
    mouseDrive = false;
  }
});

canvas.addEventListener('contextmenu', (event) => {
  event.preventDefault();
});

function shoot() {
  if (!state.active) return;
  const now = performance.now();
  if (now - state.lastShot < state.shootInterval) return;
  state.lastShot = now;
  const mouseWorld = getMouseWorldPosition();
  const angle = Math.atan2(mouseWorld.y - player.y, mouseWorld.x - player.x);
  const muzzleX = player.x + Math.cos(angle) * (player.radius + 6);
  const muzzleY = player.y + Math.sin(angle) * (player.radius + 6);
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
    const centerX = bot.x + bot.width / 2;
    const centerY = bot.y + bot.height / 2;
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
  let vx = 0;
  let vy = 0;
  if (keys.has('w') || keys.has('arrowup')) vy -= 1;
  if (keys.has('s') || keys.has('arrowdown')) vy += 1;
  if (keys.has('a') || keys.has('arrowleft')) vx -= 1;
  if (keys.has('d') || keys.has('arrowright')) vx += 1;

  if (vx === 0 && vy === 0) return;

  const length = Math.hypot(vx, vy);
  vx = (vx / length) * player.speed * delta;
  vy = (vy / length) * player.speed * delta;
  const candidateX = player.x + vx;
  const candidateY = player.y + vy;
  applyPlayerConstraints(candidateX, candidateY, delta, timestamp);
}

function handleMouseStride(delta, timestamp) {
  if (!mouseDrive) return;
  const mouseWorld = getMouseWorldPosition();
  const dx = mouseWorld.x - player.x;
  const dy = mouseWorld.y - player.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1) return;
  const step = Math.min(player.speed * delta, distance);
  const nx = dx / distance;
  const ny = dy / distance;
  const candidateX = player.x + nx * step;
  const candidateY = player.y + ny * step;
  applyPlayerConstraints(candidateX, candidateY, delta, timestamp);
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
      if (
        bullet.x > bot.x &&
        bullet.x < bot.x + bot.width &&
        bullet.y > bot.y &&
        bullet.y < bot.y + bot.height
      ) {
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

  drawHealthBar(player.x, player.y + 30, player.health, player.maxHealth);
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

function drawBotSprite(x, y, tint) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#101221';
  ctx.fillRect(0, 0, 44, 44);
  ctx.fillStyle = tint;
  ctx.fillRect(8, 8, 28, 12);
  ctx.fillRect(10, 22, 24, 14);
  ctx.fillStyle = '#ffde59';
  ctx.fillRect(30, 4, 10, 8);
  ctx.restore();
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
    ctx.fillRect(offsetX + (bot.x + bot.width / 2) * scale - 3, offsetY + (bot.y + bot.height / 2) * scale - 3, 6, 6);
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
    handleMouseStride(delta, timestamp);
    if (shooting) {
      shoot();
    }
    handleBotShooting(timestamp);
    updateBullets(delta);
    updateBotBullets(delta, timestamp);
    updateParticles(delta);
    checkWinState();
  } else {
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
