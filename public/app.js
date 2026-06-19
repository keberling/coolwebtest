const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const castBtn = document.getElementById('cast-btn');
const reelBtn = document.getElementById('reel-btn');
const messageEl = document.getElementById('message');
const biteAlert = document.getElementById('bite-alert');
const caughtCountEl = document.getElementById('caught-count');
const scoreEl = document.getElementById('score');
const bucketList = document.getElementById('bucket-list');
const charToggle = document.getElementById('char-toggle');

const STATE = {
  IDLE: 'idle',
  CASTING: 'casting',
  WAITING: 'waiting',
  BITING: 'biting',
  REELING: 'reeling',
  CELEBRATE: 'celebrate',
};

const FISH_TYPES = [
  { name: 'Goldie', color: '#ffb703', belly: '#ffe8a3', fin: '#fb8500', points: 10, size: 0.7, rare: false },
  { name: 'Bubbles', color: '#4cc9f0', belly: '#caf0f8', fin: '#0077b6', points: 15, size: 0.75, rare: false },
  { name: 'Stripey', color: '#90be6d', belly: '#d4e7ba', fin: '#588157', points: 20, size: 0.85, rare: false },
  { name: 'Sunset', color: '#f94144', belly: '#ffc9c9', fin: '#c1121f', points: 30, size: 0.9, rare: false },
  { name: 'King Fin', color: '#7b2cbf', belly: '#e0aaff', fin: '#5a189a', points: 50, size: 1.2, rare: true },
  { name: 'Rainbow Ray', color: '#ff006e', belly: '#ffafcc', fin: '#c9184a', points: 40, size: 1.0, rare: true },
];

let width = 0;
let height = 0;
let waterTop = 0;
let dockY = 0;
let anglerX = 0;
let anglerFeetY = 0;
let anglerScale = 1;
let fisherGender = 'boy';
let castAnim = 0;
let rodTip = { x: 0, y: 0 };
let castRelease = { x: 0, y: 0 };

let gameState = STATE.IDLE;
let score = 0;
let caughtCount = 0;
let bucket = [];

let hook = { startX: 0, startY: 0, targetX: 0, targetY: 0, x: 0, y: 0, t: 0 };
let bobberDip = 0;
let swimFish = [];
let lilyPads = [];
let reeds = [];
let biteTimer = null;
let biteDeadline = null;
let bitingFish = null;
let caughtFish = null;
let celebrateTimer = 0;
let ripples = [];
let reelT = 0;

function resize() {
  const dpr = window.devicePixelRatio || 1;
  width = document.documentElement.clientWidth;
  height = document.documentElement.clientHeight;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  waterTop = height * 0.3;
  dockY = waterTop - 4;
  anglerX = width * 0.07;
  anglerFeetY = dockY - 2;
  anglerScale = Math.min(1.15, Math.max(0.75, height / 680));

  if (gameState === STATE.IDLE) {
    initScene();
  }
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
    li.textContent = 'No fish yet!';
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

function initScene() {
  initSwimFish();
  lilyPads = Array.from({ length: 6 }, () => ({
    x: rand(width * 0.35, width * 0.95),
    y: rand(waterTop + 30, height - 60),
    r: rand(14, 26),
    phase: rand(0, Math.PI * 2),
  }));
  reeds = Array.from({ length: 12 }, (_, i) => ({
    x: rand(0, width * 0.28),
    h: rand(40, 90),
    phase: i * 0.5,
  }));
}

function initSwimFish() {
  swimFish = Array.from({ length: 9 }, () => {
    const type = pickFishType();
    return {
      type,
      x: rand(60, width - 60),
      y: rand(waterTop + 60, height - 50),
      speed: rand(0.35, 1.1) * (Math.random() > 0.5 ? 1 : -1),
      wiggle: rand(0, Math.PI * 2),
      depth: rand(0.5, 1),
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

/** Bobber only dips downward (positive canvas Y). */
function calcBobberDip(intensity, speed) {
  const t = Date.now() * speed;
  return (1 - Math.cos(t)) * 0.5 * intensity;
}

function castLine() {
  if (gameState !== STATE.IDLE && gameState !== STATE.CELEBRATE) return;

  clearBiteTimers();
  gameState = STATE.CASTING;
  setButtons({ cast: false, reel: false });
  setMessage('Casting...');

  hook.targetX = rand(width * 0.3, width * 0.88);
  hook.targetY = rand(waterTop + 55, height - 55);
  castAnim = 0;
  bobberDip = 0;
  ripples = [];
  updateRodTip();
  hook.x = rodTip.x;
  hook.y = rodTip.y;
}

function startWaiting() {
  gameState = STATE.WAITING;
  setMessage('Watch the bobber dip...');

  biteTimer = setTimeout(() => {
    if (gameState !== STATE.WAITING) return;
    startBite();
  }, rand(1500, 4500));
}

function startBite() {
  gameState = STATE.BITING;
  bitingFish = pickFishType();
  biteAlert.classList.remove('hidden');
  setButtons({ cast: false, reel: true });
  setMessage('Quick! Reel in!');

  ripples.push({ x: hook.x, y: hook.y, r: 0, life: 1 });

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
  reelT = 0;
  setMessage('Reeling in...');

  setTimeout(celebrateCatch, 700);
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
    initScene();
  }, 2200);
}

function getCastPose() {
  if (gameState === STATE.CASTING) return { pose: 'casting', t: castAnim };
  if (gameState === STATE.REELING) return { pose: 'reeling', t: reelT };
  if (gameState === STATE.BITING) return { pose: 'excited', t: 0 };
  if (gameState === STATE.CELEBRATE) return { pose: 'happy', t: 0 };
  if (gameState === STATE.WAITING) return { pose: 'waiting', t: 0 };
  return { pose: 'idle', t: 0 };
}

function calcRodAngle(pose, t) {
  const idle = -0.55;
  if (pose === 'idle' || pose === 'waiting') {
    return idle + Math.sin(Date.now() * 0.0015) * 0.04;
  }
  if (pose === 'excited') {
    return -0.35 + Math.sin(Date.now() * 0.02) * 0.12;
  }
  if (pose === 'happy') {
    return -0.2 + Math.sin(Date.now() * 0.008) * 0.08;
  }
  if (pose === 'reeling') {
    return -0.4 + Math.sin(Date.now() * 0.015) * 0.15;
  }
  if (pose === 'casting') {
    if (t < 0.3) {
      const p = t / 0.3;
      return idle - p * 0.9;
    }
    if (t < 0.5) {
      const p = (t - 0.3) / 0.2;
      return idle - 0.9 + p * 1.6;
    }
    return idle + 0.7 - Math.min(1, (t - 0.5) / 0.5) * 0.35;
  }
  return idle;
}

function calcBodyLean(pose, t) {
  if (pose === 'casting') {
    if (t < 0.3) return -0.06 * (t / 0.3);
    if (t < 0.5) return -0.06 + 0.14 * ((t - 0.3) / 0.2);
    return 0.08 - Math.min(1, (t - 0.5) / 0.5) * 0.04;
  }
  if (pose === 'reeling') return 0.05;
  if (pose === 'excited') return 0.04;
  if (pose === 'happy') return -0.03;
  return Math.sin(Date.now() * 0.0012) * 0.015;
}

function getHandWorld(lean, s) {
  const lx = 18;
  const ly = -42;
  return {
    x: anglerX + (Math.cos(lean) * lx - Math.sin(lean) * ly) * s,
    y: anglerFeetY + (Math.sin(lean) * lx + Math.cos(lean) * ly) * s,
  };
}

function updateRodTip() {
  const { pose, t } = getCastPose();
  const lean = calcBodyLean(pose, t);
  const rodAngle = calcRodAngle(pose, t);
  const s = anglerScale;
  const hand = getHandWorld(lean, s);
  const rodLen = 78 * s;
  rodTip.x = hand.x + Math.cos(rodAngle) * rodLen;
  rodTip.y = hand.y + Math.sin(rodAngle) * rodLen;
}

function drawRod(handX, handY, rodAngle, s) {
  const rodLen = 78 * s;
  const tipX = handX + Math.cos(rodAngle) * rodLen;
  const tipY = handY + Math.sin(rodAngle) * rodLen;

  ctx.strokeStyle = '#5c3d2e';
  ctx.lineWidth = 4 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(handX, handY);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();

  ctx.strokeStyle = '#8b6914';
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.moveTo(tipX - Math.cos(rodAngle) * 12 * s, tipY - Math.sin(rodAngle) * 12 * s);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();

  ctx.fillStyle = '#c0c0c0';
  ctx.beginPath();
  ctx.arc(tipX, tipY, 2.5 * s, 0, Math.PI * 2);
  ctx.fill();
}

function drawAngler() {
  const { pose, t } = getCastPose();
  const lean = calcBodyLean(pose, t);
  const rodAngle = calcRodAngle(pose, t);
  const s = anglerScale;
  const isGirl = fisherGender === 'girl';
  const x = anglerX;
  const feetY = anglerFeetY;
  const shirt = isGirl ? '#f72585' : '#4361ee';
  const shirtDark = isGirl ? '#b5179e' : '#3a0ca3';
  const bottom = isGirl ? '#9d4edd' : '#2d6a4f';
  const skin = '#ffcba4';
  const skinShadow = '#e8a87c';

  ctx.save();
  ctx.translate(x, feetY);
  ctx.scale(s, s);
  ctx.rotate(lean);

  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.ellipse(10, 4, 22, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = bottom;
  if (isGirl) {
    ctx.beginPath();
    ctx.moveTo(-6, -18);
    ctx.lineTo(26, -18);
    ctx.lineTo(30, 2);
    ctx.lineTo(-10, 2);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillRect(-4, -20, 14, 18);
    ctx.fillRect(14, -20, 14, 18);
  }

  ctx.fillStyle = shirt;
  ctx.fillRect(-8, -48, 36, 32);
  ctx.fillStyle = shirtDark;
  ctx.fillRect(-8, -48, 8, 32);

  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(10, -58, 16, 0, Math.PI * 2);
  ctx.fill();

  if (isGirl) {
    ctx.fillStyle = '#6a040f';
    ctx.beginPath();
    ctx.arc(10, -64, 17, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#9d0208';
    ctx.beginPath();
    ctx.arc(-8, -56, 7, 0, Math.PI * 2);
    ctx.arc(28, -56, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff006e';
    ctx.beginPath();
    ctx.arc(-8, -50, 5, 0, Math.PI * 2);
    ctx.arc(28, -50, 5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = '#5c3d2e';
    ctx.beginPath();
    ctx.arc(10, -64, 16, Math.PI, 0);
    ctx.fill();
  }

  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(4, -60, 4, 0, Math.PI * 2);
  ctx.arc(16, -60, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a3a4a';
  ctx.beginPath();
  ctx.arc(5, -60, 2, 0, Math.PI * 2);
  ctx.arc(17, -60, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(6, -61, 0.9, 0, Math.PI * 2);
  ctx.arc(18, -61, 0.9, 0, Math.PI * 2);
  ctx.fill();

  if (pose === 'happy' || pose === 'excited') {
    ctx.strokeStyle = '#1a3a4a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(10, -52, 6, 0.15, Math.PI - 0.15);
    ctx.stroke();
  }

  ctx.fillStyle = skinShadow;
  ctx.fillRect(14, -46, 10, 14);
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(19, -38, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  const hand = getHandWorld(lean, s);
  drawRod(hand.x, hand.y, rodAngle, s);
  updateRodTip();
}

function toggleFisher() {
  if (gameState !== STATE.IDLE && gameState !== STATE.CELEBRATE) return;
  fisherGender = fisherGender === 'boy' ? 'girl' : 'boy';
  charToggle.textContent = fisherGender === 'boy' ? '👦 Boy' : '👧 Girl';
}

function drawSky() {
  const grad = ctx.createLinearGradient(0, 0, 0, waterTop);
  grad.addColorStop(0, '#7ec8f2');
  grad.addColorStop(0.45, '#5ba8d4');
  grad.addColorStop(1, '#3d8eb8');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, waterTop);

  const sunX = width * 0.78;
  const sunY = height * 0.09;
  const sunGlow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 100);
  sunGlow.addColorStop(0, 'rgba(255, 249, 196, 0.9)');
  sunGlow.addColorStop(0.4, 'rgba(255, 214, 10, 0.35)');
  sunGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = sunGlow;
  ctx.fillRect(sunX - 100, sunY - 100, 200, 200);

  ctx.fillStyle = '#ffe066';
  ctx.beginPath();
  ctx.arc(sunX, sunY, 38, 0, Math.PI * 2);
  ctx.fill();

  const hills = ctx.createLinearGradient(0, waterTop - 80, 0, waterTop);
  hills.addColorStop(0, '#3d6b4f');
  hills.addColorStop(1, '#2d5a3f');
  ctx.fillStyle = hills;
  ctx.beginPath();
  ctx.moveTo(0, waterTop);
  for (let x = 0; x <= width; x += 40) {
    const h = Math.sin(x * 0.008) * 25 + Math.sin(x * 0.02) * 12;
    ctx.lineTo(x, waterTop - 50 - h);
  }
  ctx.lineTo(width, waterTop);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  [[0.12, 0.1, 1], [0.32, 0.07, 0.85], [0.52, 0.12, 0.9], [0.68, 0.06, 0.75]].forEach(([px, py, s]) => {
    const cx = width * px;
    const cy = height * py;
    ctx.beginPath();
    ctx.arc(cx, cy, 22 * s, 0, Math.PI * 2);
    ctx.arc(cx + 28 * s, cy - 10 * s, 18 * s, 0, Math.PI * 2);
    ctx.arc(cx + 52 * s, cy + 2 * s, 20 * s, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawDock() {
  const dockW = width * 0.28;

  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(4, dockY + 6, dockW, 18);

  const plankGrad = ctx.createLinearGradient(0, dockY, 0, dockY + 18);
  plankGrad.addColorStop(0, '#d4a574');
  plankGrad.addColorStop(1, '#a67c52');
  ctx.fillStyle = plankGrad;
  ctx.fillRect(0, dockY, dockW, 18);

  ctx.strokeStyle = 'rgba(90, 55, 30, 0.4)';
  ctx.lineWidth = 1;
  for (let x = 0; x < dockW; x += 22) {
    ctx.beginPath();
    ctx.moveTo(x, dockY);
    ctx.lineTo(x, dockY + 18);
    ctx.stroke();
  }

  ctx.fillStyle = '#6b4423';
  for (let x = 8; x < dockW; x += 28) {
    ctx.fillRect(x, dockY + 18, 9, height - dockY - 18);
    ctx.fillStyle = '#5a3818';
    ctx.fillRect(x + 1, dockY + 18, 2, height - dockY - 18);
    ctx.fillStyle = '#6b4423';
  }

  const tx = width * 0.1;
  ctx.fillStyle = '#5a3818';
  ctx.fillRect(tx, dockY - 70, 12, 72);
  ctx.fillStyle = '#3d8b5a';
  ctx.beginPath();
  ctx.arc(tx + 6, dockY - 78, 32, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2d6b45';
  ctx.beginPath();
  ctx.arc(tx - 10, dockY - 62, 22, 0, Math.PI * 2);
  ctx.arc(tx + 22, dockY - 58, 20, 0, Math.PI * 2);
  ctx.fill();

}

function drawWater() {
  const t = Date.now() * 0.001;

  const surfaceGrad = ctx.createLinearGradient(0, waterTop, 0, height);
  surfaceGrad.addColorStop(0, '#3eb5e8');
  surfaceGrad.addColorStop(0.25, '#2196c4');
  surfaceGrad.addColorStop(0.6, '#1565a8');
  surfaceGrad.addColorStop(1, '#0a3d62');
  ctx.fillStyle = surfaceGrad;
  ctx.fillRect(0, waterTop, width, height - waterTop);

  ctx.globalAlpha = 0.08;
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    const cx = ((t * 30 + i * 200) % (width + 100)) - 50;
    const cy = waterTop + 80 + i * (height - waterTop) / 6;
    ctx.ellipse(cx, cy, 80, 20, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let x = 0; x <= width; x += 5) {
    const y = waterTop + Math.sin(x * 0.018 + t * 1.5) * 3 + Math.sin(x * 0.04 + t) * 1.5;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  reeds.forEach((reed) => {
    const sway = Math.sin(t * 1.2 + reed.phase) * 6;
    ctx.strokeStyle = '#3d7a48';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(reed.x, height);
    ctx.quadraticCurveTo(reed.x + sway, height - reed.h * 0.5, reed.x + sway * 1.5, height - reed.h);
    ctx.stroke();
  });
}

function drawLilyPads() {
  const t = Date.now() * 0.001;
  lilyPads.forEach((pad) => {
    const bob = Math.sin(t + pad.phase) * 2;
    ctx.fillStyle = '#40916c';
    ctx.beginPath();
    ctx.ellipse(pad.x, pad.y + bob, pad.r, pad.r * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2d6a4f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pad.x, pad.y + bob);
    ctx.lineTo(pad.x + pad.r * 0.6, pad.y + bob);
    ctx.stroke();
  });
}

function drawFish(fish, x, y, facing, scale, happy, depth) {
  const s = scale * fish.type.size * (depth || 1);
  const alpha = 0.55 + (depth || 1) * 0.4;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  ctx.globalAlpha = alpha;

  ctx.fillStyle = 'rgba(0, 30, 50, 0.2)';
  ctx.beginPath();
  ctx.ellipse(2, 6, 20 * s, 8 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = fish.type.color;
  ctx.beginPath();
  ctx.ellipse(0, 0, 24 * s, 15 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = fish.type.belly;
  ctx.beginPath();
  ctx.ellipse(3 * s, 5 * s, 15 * s, 9 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = fish.type.fin;
  ctx.beginPath();
  ctx.moveTo(-22 * s, 0);
  ctx.lineTo(-36 * s, -14 * s);
  ctx.lineTo(-30 * s, 0);
  ctx.lineTo(-36 * s, 14 * s);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(0, 10 * s);
  ctx.lineTo(-8 * s, 20 * s);
  ctx.lineTo(8 * s, 20 * s);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(12 * s, -5 * s, 6 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a3a4a';
  ctx.beginPath();
  ctx.arc(14 * s, -5 * s, 3 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(15 * s, -6 * s, 1.2 * s, 0, Math.PI * 2);
  ctx.fill();

  if (happy) {
    ctx.strokeStyle = '#1a3a4a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(16 * s, 5 * s, 5 * s, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(0, 0, 24 * s, 15 * s, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

function drawSwimmingFish() {
  swimFish.forEach((fish) => {
    fish.x += fish.speed;
    fish.wiggle += 0.07;
    if (fish.x < 40) { fish.x = 40; fish.speed *= -1; }
    if (fish.x > width - 40) { fish.x = width - 40; fish.speed *= -1; }

    const wobble = Math.sin(fish.wiggle) * 3;
    drawFish(fish, fish.x, fish.y + wobble, fish.speed > 0 ? 1 : -1, 1, false, fish.depth);
  });
}

function drawBobber(x, y, biting) {
  const surfaceY = y;

  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(x + 2, surfaceY + 10, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = biting ? '#ffd60a' : '#e63946';
  ctx.beginPath();
  ctx.ellipse(x, surfaceY + 6, 10, 13, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = biting ? '#ffee99' : '#ff758f';
  ctx.beginPath();
  ctx.ellipse(x - 3, surfaceY + 8, 4, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(x, surfaceY - 2, 9, 7, 0, Math.PI, 0);
  ctx.fill();

  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, surfaceY + 18);
  ctx.lineTo(x, surfaceY + 30);
  ctx.stroke();

  ctx.fillStyle = '#c0c0c0';
  ctx.beginPath();
  ctx.moveTo(x - 3, surfaceY + 30);
  ctx.lineTo(x + 3, surfaceY + 30);
  ctx.lineTo(x, surfaceY + 38);
  ctx.closePath();
  ctx.fill();
}

function drawFishingLine(x1, y1, x2, y2) {
  const sag = Math.min(40, (y2 - y1) * 0.12);
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2 + sag;

  ctx.strokeStyle = 'rgba(60, 40, 25, 0.7)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo(midX, midY, x2, y2);
  ctx.stroke();
}

function updateHookPosition() {
  updateRodTip();

  if (gameState === STATE.CASTING) {
    castAnim = Math.min(1, castAnim + 0.022);

    if (castAnim < 0.5) {
      hook.x = rodTip.x;
      hook.y = rodTip.y;
    } else if (castAnim < 0.82) {
      if (castAnim < 0.52) {
        castRelease.x = rodTip.x;
        castRelease.y = rodTip.y;
      }
      const flyT = (castAnim - 0.5) / 0.32;
      hook.x = castRelease.x + (hook.targetX - castRelease.x) * flyT;
      const drop = castRelease.y + (hook.targetY - castRelease.y) * flyT;
      const loft = Math.sin(flyT * Math.PI) * -70 * (1 - flyT * 0.5);
      hook.y = drop + loft;
    } else {
      const splashT = (castAnim - 0.82) / 0.18;
      hook.x = hook.targetX;
      hook.y = hook.targetY + splashT * 18;
      if (castAnim >= 1 && ripples.length < 3) {
        ripples.push({ x: hook.targetX, y: waterTop + 6, r: 0, life: 1 });
        ripples.push({ x: hook.targetX, y: waterTop + 6, r: 0, life: 0.7 });
      }
      if (castAnim >= 1) {
        hook.y = hook.targetY;
        startWaiting();
      }
    }
    return;
  }

  if (gameState === STATE.WAITING) {
    bobberDip = calcBobberDip(5, 0.003);
    hook.y = hook.targetY + bobberDip;
    hook.x = hook.targetX;
    return;
  }

  if (gameState === STATE.BITING) {
    bobberDip = calcBobberDip(16, 0.018) + calcBobberDip(6, 0.04);
    hook.y = hook.targetY + bobberDip;
    hook.x = hook.targetX;
    return;
  }

  if (gameState === STATE.REELING) {
    reelT = Math.min(1, reelT + 0.05);
    const ease = 1 - Math.pow(1 - reelT, 2);
    hook.x = hook.targetX + (rodTip.x - hook.targetX) * ease;
    hook.y = hook.targetY + (rodTip.y - hook.targetY) * ease;
    bobberDip = 0;
    return;
  }

  if (gameState === STATE.CELEBRATE) {
    hook.x = rodTip.x;
    hook.y = rodTip.y;
  }
}

function drawLineAndHook() {
  const showLine = gameState !== STATE.IDLE && gameState !== STATE.CELEBRATE;
  updateHookPosition();

  if (!showLine) return;

  drawFishingLine(rodTip.x, rodTip.y, hook.x, hook.y - 6);

  const showBobber = hook.y > waterTop - 10 && gameState !== STATE.REELING;
  if (showBobber) {
    drawBobber(hook.x, hook.y, gameState === STATE.BITING);
  }

  if (gameState === STATE.CASTING && castAnim > 0.5 && castAnim < 0.85) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(hook.x, hook.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  if (gameState === STATE.BITING && bitingFish) {
    const fx = hook.x + 40;
    const fy = hook.y + 18 + calcBobberDip(8, 0.02);
    drawFish({ type: bitingFish }, fx, fy, -1, 1.15, true, 1);
  }
}

function drawRipples() {
  ripples.forEach((r) => {
    r.r += 1.8;
    r.life -= 0.018;
    ctx.strokeStyle = `rgba(255, 255, 255, ${r.life * 0.55})`;
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
  const cy = height * 0.42;
  const bounce = Math.abs(Math.sin(Date.now() * 0.006)) * 12;
  drawFish({ type: caughtFish }, cx, cy - bounce, 1, 1.8, true, 1);

  ctx.fillStyle = '#fee440';
  ctx.font = `bold ${Math.floor(width * 0.04)}px Fredoka, sans-serif`;
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 8;
  ctx.fillText('CAUGHT!', cx, cy - 90);
  ctx.shadowBlur = 0;

  for (let i = 0; i < 10; i++) {
    const angle = (Date.now() * 0.002 + i) * Math.PI * 2 / 10;
    const dist = 70 + Math.sin(Date.now() * 0.004 + i) * 20;
    ctx.fillStyle = ['#ff6b35', '#06d6a0', '#fee440', '#4cc9f0'][i % 4];
    ctx.beginPath();
    ctx.arc(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist, 7, 0, Math.PI * 2);
    ctx.fill();
  }
}

function update() {
  if (gameState === STATE.CELEBRATE) celebrateTimer -= 1;
}

function draw() {
  drawSky();
  drawWater();
  drawLilyPads();
  drawDock();
  drawSwimmingFish();
  drawAngler();
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
charToggle.addEventListener('click', toggleFisher);

canvas.addEventListener('click', (e) => {
  if (gameState === STATE.BITING) reelIn();
  else if (gameState === STATE.IDLE || gameState === STATE.CELEBRATE) castLine();
});

window.addEventListener('resize', resize);
resize();
initScene();
updateUI();
setButtons({ cast: true, reel: false });
loop();