const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const castBtn = document.getElementById('cast-btn');
const reelBtn = document.getElementById('reel-btn');
const messageEl = document.getElementById('message');
const biteAlert = document.getElementById('bite-alert');
const caughtCountEl = document.getElementById('caught-count');
const scoreEl = document.getElementById('score');
const bucketList = document.getElementById('bucket-list');

const STATE = {
  IDLE: 'idle',
  CASTING: 'casting',
  WAITING: 'waiting',
  BITING: 'biting',
  REELING: 'reeling',
  CELEBRATE: 'celebrate',
};

const FISH_TYPES = [
  { name: 'Goldie', color: '#ffb703', belly: '#ffe8a3', points: 10, size: 0.7, rare: false },
  { name: 'Bubbles', color: '#4cc9f0', belly: '#caf0f8', points: 15, size: 0.75, rare: false },
  { name: 'Stripey', color: '#90be6d', belly: '#d4e7ba', points: 20, size: 0.85, rare: false },
  { name: 'Sunset', color: '#f94144', belly: '#ffc9c9', points: 30, size: 0.9, rare: false },
  { name: 'King Fin', color: '#7b2cbf', belly: '#e0aaff', points: 50, size: 1.2, rare: true },
  { name: 'Rainbow Ray', color: '#ff006e', belly: '#ffafcc', points: 40, size: 1.0, rare: true },
];

let width = 0;
let height = 0;
let waterTop = 0;
let dockY = 0;

let gameState = STATE.IDLE;
let score = 0;
let caughtCount = 0;
let bucket = [];

let hook = { x: 0, y: 0, targetX: 0, targetY: 0, t: 0 };
let bobber = { bob: 0 };
let swimFish = [];
let biteTimer = null;
let biteDeadline = null;
let bitingFish = null;
let caughtFish = null;
let celebrateTimer = 0;
let waitStart = 0;
let ripples = [];

function resize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  width = canvas.width = Math.floor(rect.width * dpr);
  height = canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  width = rect.width;
  height = rect.height;
  waterTop = height * 0.38;
  dockY = waterTop - 8;
  if (gameState === STATE.IDLE) initSwimFish();
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function pickFishType() {
  const roll = Math.random();
  if (roll < 0.12) return FISH_TYPES[4];
  if (roll < 0.22) return FISH_TYPES[5];
  return FISH_TYPES[Math.floor(Math.random() * 4)];
}

function setMessage(text) {
  messageEl.textContent = text;
}

function updateUI() {
  caughtCountEl.textContent = caughtCount;
  scoreEl.textContent = score;
}

function updateBucket() {
  bucketList.innerHTML = '';
  if (bucket.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'No fish yet — go catch some!';
    bucketList.appendChild(li);
    return;
  }
  bucket.slice(0, 12).forEach((fish) => {
    const li = document.createElement('li');
    li.className = fish.rare ? 'rare' : '';
    li.textContent = `${fish.name} (+${fish.points})`;
    bucketList.appendChild(li);
  });
}

function initSwimFish() {
  swimFish = Array.from({ length: 7 }, () => {
    const type = pickFishType();
    return {
      type,
      x: rand(40, width - 40),
      y: rand(waterTop + 40, height - 30),
      speed: rand(0.4, 1.2) * (Math.random() > 0.5 ? 1 : -1),
      wiggle: rand(0, Math.PI * 2),
    };
  });
}

function setButtons({ cast, reel }) {
  castBtn.classList.toggle('hidden', !cast);
  reelBtn.classList.toggle('hidden', !reel);
}

function clearBiteTimers() {
  clearTimeout(biteTimer);
  clearTimeout(biteDeadline);
  biteTimer = null;
  biteDeadline = null;
  biteAlert.classList.add('hidden');
}

function castLine() {
  if (gameState !== STATE.IDLE && gameState !== STATE.CELEBRATE) return;

  clearBiteTimers();
  gameState = STATE.CASTING;
  setButtons({ cast: false, reel: false });
  setMessage('Casting...');

  hook.x = width * 0.18;
  hook.y = dockY - 20;
  hook.targetX = rand(width * 0.3, width * 0.85);
  hook.targetY = rand(waterTop + 50, height - 50);
  hook.t = 0;
  ripples = [];
}

function startWaiting() {
  gameState = STATE.WAITING;
  waitStart = Date.now();
  setMessage('Watch the bobber... a fish might bite!');

  const waitTime = rand(1500, 4500);
  biteTimer = setTimeout(() => {
    if (gameState !== STATE.WAITING) return;
    startBite();
  }, waitTime);
}

function startBite() {
  gameState = STATE.BITING;
  bitingFish = pickFishType();
  biteAlert.classList.remove('hidden');
  setButtons({ cast: false, reel: true });
  setMessage('Quick! Reel in!');

  ripples.push({ x: hook.targetX, y: hook.targetY, r: 0, life: 1 });

  biteDeadline = setTimeout(() => {
    if (gameState !== STATE.BITING) return;
    fishGotAway();
  }, 1800);
}

function fishGotAway() {
  clearBiteTimers();
  gameState = STATE.IDLE;
  bitingFish = null;
  setButtons({ cast: true, reel: false });
  setMessage('Aw, it got away! Cast again!');
}

function reelIn() {
  if (gameState !== STATE.BITING) return;

  clearBiteTimers();
  gameState = STATE.REELING;
  setButtons({ cast: false, reel: false });
  caughtFish = bitingFish;
  bitingFish = null;
  setMessage('Reeling...');

  setTimeout(() => {
    celebrateCatch();
  }, 600);
}

function celebrateCatch() {
  gameState = STATE.CELEBRATE;
  const fish = caughtFish;
  caughtCount += 1;
  score += fish.points;
  bucket.unshift({ name: fish.name, points: fish.points, rare: fish.rare });
  updateUI();
  updateBucket();

  const cheers = [
    `Awesome! You caught ${fish.name}!`,
    `Wow! ${fish.name} is a keeper!`,
    `Nice one! ${fish.name} (+${fish.points})`,
    fish.rare ? `WHOA! Rare fish — ${fish.name}!` : `Great job catching ${fish.name}!`,
  ];
  setMessage(cheers[Math.floor(Math.random() * cheers.length)]);
  celebrateTimer = 120;

  setTimeout(() => {
    gameState = STATE.IDLE;
    caughtFish = null;
    setButtons({ cast: true, reel: false });
    setMessage('Cast your line again!');
    initSwimFish();
  }, 2200);
}

function drawSky() {
  const grad = ctx.createLinearGradient(0, 0, 0, waterTop);
  grad.addColorStop(0, '#87ceeb');
  grad.addColorStop(1, '#5ba8d4');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, waterTop);

  ctx.fillStyle = '#fff9c4';
  ctx.beginPath();
  ctx.arc(width * 0.82, height * 0.1, 36, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  [[0.15, 0.12], [0.35, 0.08], [0.55, 0.15]].forEach(([px, py], i) => {
    const cx = width * px;
    const cy = height * py;
    ctx.beginPath();
    ctx.arc(cx, cy, 20 + i * 4, 0, Math.PI * 2);
    ctx.arc(cx + 24, cy - 8, 16 + i * 3, 0, Math.PI * 2);
    ctx.arc(cx + 44, cy, 18 + i * 3, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawDock() {
  ctx.fillStyle = '#c68642';
  ctx.fillRect(0, dockY, width * 0.32, 14);
  ctx.fillStyle = '#8b5a2b';
  for (let x = 0; x < width * 0.32; x += 18) {
    ctx.fillRect(x, dockY + 14, 8, height - dockY - 14);
  }

  ctx.fillStyle = '#6b4423';
  ctx.fillRect(width * 0.14, dockY - 55, 10, 55);

  ctx.fillStyle = '#4a7c59';
  ctx.beginPath();
  ctx.arc(width * 0.145, dockY - 60, 28, 0, Math.PI * 2);
  ctx.fill();
}

function drawWater() {
  const grad = ctx.createLinearGradient(0, waterTop, 0, height);
  grad.addColorStop(0, '#2a9fd6');
  grad.addColorStop(0.5, '#1d8acb');
  grad.addColorStop(1, '#0f5f8f');
  ctx.fillStyle = grad;
  ctx.fillRect(0, waterTop, width, height - waterTop);

  const t = Date.now() * 0.001;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x <= width; x += 6) {
    const y = waterTop + Math.sin(x * 0.02 + t) * 4;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawFish(fish, x, y, facing, scale, happy) {
  const s = scale * fish.type.size;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);

  ctx.fillStyle = fish.type.color;
  ctx.beginPath();
  ctx.ellipse(0, 0, 22 * s, 14 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = fish.type.belly;
  ctx.beginPath();
  ctx.ellipse(2 * s, 4 * s, 14 * s, 8 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = fish.type.color;
  ctx.beginPath();
  ctx.moveTo(-20 * s, 0);
  ctx.lineTo(-32 * s, -12 * s);
  ctx.lineTo(-28 * s, 0);
  ctx.lineTo(-32 * s, 12 * s);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(10 * s, -4 * s, 5 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a3a4a';
  ctx.beginPath();
  ctx.arc(11 * s, -4 * s, 2.5 * s, 0, Math.PI * 2);
  ctx.fill();

  if (happy) {
    ctx.strokeStyle = '#1a3a4a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(14 * s, 4 * s, 5 * s, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawSwimmingFish() {
  const t = Date.now() * 0.001;
  swimFish.forEach((fish) => {
    fish.x += fish.speed;
    fish.wiggle += 0.08;
    if (fish.x < 30) { fish.x = 30; fish.speed *= -1; }
    if (fish.x > width - 30) { fish.x = width - 30; fish.speed *= -1; }

    const wobble = Math.sin(fish.wiggle) * 4;
    drawFish(fish, fish.x, fish.y + wobble, fish.speed > 0 ? 1 : -1, 1, false);
  });
}

function drawLineAndHook() {
  const showLine = gameState !== STATE.IDLE && gameState !== STATE.CELEBRATE;
  if (!showLine) return;

  let hx = hook.targetX;
  let hy = hook.targetY;

  if (gameState === STATE.CASTING) {
    hook.t = Math.min(1, hook.t + 0.04);
    const ease = 1 - Math.pow(1 - hook.t, 3);
    hx = hook.x + (hook.targetX - hook.x) * ease;
    hy = hook.y + (hook.targetY - hook.y) * ease;
    if (hook.t >= 1) startWaiting();
  }

  if (gameState === STATE.WAITING || gameState === STATE.BITING) {
    bobber.bob = Math.sin(Date.now() * 0.004) * 3;
    if (gameState === STATE.BITING) {
      bobber.bob = Math.sin(Date.now() * 0.02) * 8;
    }
    hy += bobber.bob;
  }

  if (gameState === STATE.REELING || gameState === STATE.CELEBRATE) {
    hy = dockY - 10;
    hx = width * 0.18;
  }

  hook.targetX = hx;
  hook.targetY = hy;

  const rodX = width * 0.18;
  const rodY = dockY - 20;

  ctx.strokeStyle = '#3d2b1f';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(rodX, rodY);
  ctx.lineTo(hx, hy);
  ctx.stroke();

  ctx.fillStyle = gameState === STATE.BITING ? '#fee440' : '#f94144';
  ctx.beginPath();
  ctx.ellipse(hx, hy, 9, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillRect(hx - 2, hy - 14, 4, 6);

  if (gameState === STATE.BITING && bitingFish) {
    const fx = hx + 30;
    const fy = hy + 10 + Math.sin(Date.now() * 0.03) * 5;
    drawFish({ type: bitingFish }, fx, fy, -1, 1.1, true);
  }
}

function drawRipples() {
  ripples.forEach((r) => {
    r.r += 1.5;
    r.life -= 0.02;
    ctx.strokeStyle = `rgba(255, 255, 255, ${r.life * 0.5})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
    ctx.stroke();
  });
  ripples = ripples.filter((r) => r.life > 0);
}

function drawCelebration() {
  if (!caughtFish || celebrateTimer <= 0) return;

  const cx = width * 0.5;
  const cy = height * 0.45;
  const bounce = Math.sin(Date.now() * 0.008) * 10;
  drawFish({ type: caughtFish }, cx, cy + bounce, 1, 1.6, true);

  ctx.fillStyle = '#fee440';
  ctx.font = 'bold 28px Fredoka, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CAUGHT!', cx, cy - 70);

  for (let i = 0; i < 8; i++) {
    const angle = (Date.now() * 0.003 + i) * Math.PI * 2 / 8;
    const dist = 60 + Math.sin(Date.now() * 0.005 + i) * 15;
    ctx.fillStyle = ['#ff6b35', '#06d6a0', '#fee440', '#4cc9f0'][i % 4];
    ctx.beginPath();
    ctx.arc(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist, 6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function update() {
  if (gameState === STATE.CELEBRATE) celebrateTimer -= 1;
}

function draw() {
  drawSky();
  drawWater();
  drawDock();
  drawSwimmingFish();
  drawRipples();
  drawLineAndHook();
  drawCelebration();
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

castBtn.addEventListener('click', castLine);
reelBtn.addEventListener('click', reelIn);

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const y = e.clientY - rect.top;
  if (y < waterTop + 20) return;
  if (gameState === STATE.BITING) reelIn();
  else if (gameState === STATE.IDLE || gameState === STATE.CELEBRATE) castLine();
});

window.addEventListener('resize', resize);
resize();
initSwimFish();
updateUI();
setButtons({ cast: true, reel: false });
loop();