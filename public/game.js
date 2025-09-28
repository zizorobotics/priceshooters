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
const INTRO_MESSAGE =
  "Drop $1 to spawn and battle rival mercenaries for the arena pot. Static bots keep the field busy for this prototype—land your neon shots to win!";

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

const player = {
  x: canvas.width / 2,
  y: canvas.height - 120,
  radius: 18,
  speed: 2.8,
  health: 100,
  maxHealth: 100,
  color: '#3cfbff',
};

const bots = [];
const bullets = [];
const particles = [];

class Bot {
  constructor(x, y, tint) {
    this.x = x;
    this.y = y;
    this.width = 44;
    this.height = 44;
    this.health = 60;
    this.maxHealth = 60;
    this.tint = tint;
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
    { x: canvas.width * 0.2, y: canvas.height * 0.32 },
    { x: canvas.width * 0.5 - 22, y: canvas.height * 0.2 },
    { x: canvas.width * 0.76, y: canvas.height * 0.38 },
  ];
  for (let i = 0; i < BOT_COUNT; i += 1) {
    const spot = positions[i % positions.length];
    bots.push(new Bot(spot.x, spot.y, colors[i % colors.length]));
  }
}

function resetGame() {
  player.x = canvas.width / 2;
  player.y = canvas.height - 120;
  player.health = player.maxHealth;
  bullets.length = 0;
  particles.length = 0;
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
  const angle = Math.atan2(state.mouse.y - player.y, state.mouse.x - player.x);
  const muzzleX = player.x + Math.cos(angle) * (player.radius + 6);
  const muzzleY = player.y + Math.sin(angle) * (player.radius + 6);
  bullets.push(new Bullet(muzzleX, muzzleY, angle));
  for (let i = 0; i < 4; i += 1) {
    particles.push(new Particle(muzzleX, muzzleY, '#ff3cac'));
  }
}

function handleMovement(delta) {
  const { keys } = state;
  let vx = 0;
  let vy = 0;
  if (keys.has('w') || keys.has('arrowup')) vy -= 1;
  if (keys.has('s') || keys.has('arrowdown')) vy += 1;
  if (keys.has('a') || keys.has('arrowleft')) vx -= 1;
  if (keys.has('d') || keys.has('arrowright')) vx += 1;

  if (vx !== 0 || vy !== 0) {
    const length = Math.hypot(vx, vy);
    vx = (vx / length) * player.speed * delta;
    vy = (vy / length) * player.speed * delta;
    player.x = Math.min(Math.max(player.radius, player.x + vx), canvas.width - player.radius);
    player.y = Math.min(Math.max(player.radius, player.y + vy), canvas.height - player.radius);
  }
}

function handleMouseStride(delta) {
  if (!mouseDrive) return;
  const dx = state.mouse.x - player.x;
  const dy = state.mouse.y - player.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1) return;
  const step = Math.min(player.speed * delta, distance);
  const nx = dx / distance;
  const ny = dy / distance;
  player.x = Math.min(Math.max(player.radius, player.x + nx * step), canvas.width - player.radius);
  player.y = Math.min(Math.max(player.radius, player.y + ny * step), canvas.height - player.radius);
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

  ctx.strokeStyle = 'rgba(255, 60, 172, 0.15)';
  ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  ctx.restore();
}

function drawPlayer() {
  const angle = Math.atan2(state.mouse.y - player.y, state.mouse.x - player.x);

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

function update(delta) {
  if (!state.active) return;
  handleMovement(delta);
  handleMouseStride(delta);
  if (shooting) {
    shoot();
  }
  updateBullets(delta);
  updateParticles(delta);
  checkWinState();
}

function draw() {
  drawBackground();
  drawBots();
  drawPlayer();
  drawParticles();
  bullets.forEach((bullet) => bullet.draw());
  drawUI();
}

let lastTimestamp = 0;
function loop(timestamp) {
  const delta = (timestamp - lastTimestamp) / (1000 / 60);
  lastTimestamp = timestamp;
  update(delta);
  draw();
  requestAnimationFrame(loop);
}

resetGame();
updateHUD();
showOverlay('Skill Gamble Arena', INTRO_MESSAGE, { showList: true });
requestAnimationFrame(loop);
