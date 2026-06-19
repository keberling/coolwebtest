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
  { name: 'Goldie', kind: 'fish', color: '#ffb703', belly: '#ffe8a3', fin: '#fb8500', points: 10, size: 0.7, rare: false },
  { name: 'Bubbles', kind: 'fish', color: '#4cc9f0', belly: '#caf0f8', fin: '#0077b6', points: 15, size: 0.75, rare: false },
  { name: 'Stripey', kind: 'fish', color: '#90be6d', belly: '#d4e7ba', fin: '#588157', points: 20, size: 0.85, rare: false },
  { name: 'Sunset', kind: 'fish', color: '#f94144', belly: '#ffc9c9', fin: '#c1121f', points: 30, size: 0.9, rare: false },
  { name: 'King Fin', kind: 'fish', color: '#7b2cbf', belly: '#e0aaff', fin: '#5a189a', points: 50, size: 1.2, rare: true },
  { name: 'Rainbow Ray', kind: 'fish', color: '#ff006e', belly: '#ffafcc', fin: '#c9184a', points: 40, size: 1.0, rare: true },
  { name: 'Sharp Tooth', kind: 'shark', color: '#5c6770', belly: '#ced4da', fin: '#343a40', points: 120, size: 2.0, rare: true, mega: true },
  { name: 'Splashy', kind: 'whale', color: '#023e8a', belly: '#90e0ef', fin: '#0077b6', points: 200, size: 2.8, rare: true, mega: true },
];

const COMMON_FISH = FISH_TYPES.filter((f) => !f.rare && f.kind === 'fish');
const SHARK = FISH_TYPES.find((f) => f.kind === 'shark');
const WHALE = FISH_TYPES.find((f) => f.kind === 'whale');

let width = 0;
let height = 0;
let horizonY = 0;
let nearWaterY = 0;
let dockTopY = 0;
let vanishX = 0;
let handScale = 1;
let fisherGender = 'boy';
let castAnim = 0;
let rodTip = { x: 0, y: 0 };
let castRelease = { x: 0, y: 0 };

let gameState = STATE.IDLE;
let score = 0;
let caughtCount = 0;
let bucket = [];

let hook = {
  xNorm: 0.5, z: 0.6, targetXNorm: 0.5, targetZ: 0.6, x: 0, y: 0,
};
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

  horizonY = height * 0.26;
  nearWaterY = height * 0.72;
  dockTopY = height * 0.84;
  vanishX = width * 0.5;
  handScale = Math.min(1.2, Math.max(0.8, height / 680));

  if (gameState === STATE.IDLE) {
    initScene();
  }
}

function project(xNorm, z) {
  const spread = 0.1 + z * 0.9;
  const x = vanishX + (xNorm - 0.5) * width * spread;
  const y = horizonY + (nearWaterY - horizonY) * z;
  const scale = 0.18 + z * 0.82;
  return { x, y, scale };
}

function waterSpread(z) {
  return 0.1 + z * 0.9;
}

function waterLeftX(z) {
  return vanishX - width * waterSpread(z) * 0.5;
}

function waterRightX(z) {
  return vanishX + width * waterSpread(z) * 0.5;
}

function waterSurfaceY(z) {
  return horizonY + (nearWaterY - horizonY) * z;
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function pickFishType() {
  const roll = Math.random();
  if (roll < 0.03) return WHALE;
  if (roll < 0.08) return SHARK;
  if (roll < 0.14) return FISH_TYPES[4];
  if (roll < 0.22) return FISH_TYPES[5];
  return COMMON_FISH[Math.floor(Math.random() * COMMON_FISH.length)];
}

function pickSwimFishType() {
  const roll = Math.random();
  if (roll < 0.04) return WHALE;
  if (roll < 0.1) return SHARK;
  if (roll < 0.18) return FISH_TYPES[4 + Math.floor(Math.random() * 2)];
  return COMMON_FISH[Math.floor(Math.random() * COMMON_FISH.length)];
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
    li.className = fish.mega ? 'mega' : fish.rare ? 'rare' : '';
    li.textContent = `${fish.name} (+${fish.points})`;
    bucketList.appendChild(li);
  });
}

function initScene() {
  initSwimFish();
  lilyPads = Array.from({ length: 8 }, () => ({
    xNorm: rand(0.15, 0.85),
    z: rand(0.35, 0.88),
    r: rand(0.8, 1.4),
    phase: rand(0, Math.PI * 2),
  }));
  reeds = Array.from({ length: 14 }, (_, i) => ({
    side: i % 2 === 0 ? 'left' : 'right',
    z: rand(0.45, 0.95),
    h: rand(0.6, 1.2),
    phase: i * 0.5,
  }));
}

function initSwimFish() {
  swimFish = Array.from({ length: 9 }, () => {
    const type = pickSwimFishType();
    const isMega = type.kind === 'shark' || type.kind === 'whale';
    return {
      type,
      xNorm: rand(0.12, 0.88),
      z: isMega ? rand(0.4, 0.7) : rand(0.3, 0.82),
      speed: rand(isMega ? 0.0004 : 0.0008, isMega ? 0.001 : 0.002) * (Math.random() > 0.5 ? 1 : -1),
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

  hook.targetXNorm = rand(0.22, 0.78);
  hook.targetZ = rand(0.42, 0.82);
  hook.xNorm = hook.targetXNorm;
  hook.z = hook.targetZ;
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
  bucket.unshift({ name: fish.name, points: fish.points, rare: fish.rare, mega: fish.mega, kind: fish.kind });
  updateUI();
  updateBucket();

  const cheers = [
    `Awesome! You caught ${fish.name}!`,
    `Wow! ${fish.name} is a keeper!`,
    `Nice one! ${fish.name} (+${fish.points})`,
    fish.kind === 'whale' ? `INCREDIBLE! You caught a WHALE — ${fish.name}!` : null,
    fish.kind === 'shark' ? `AMAZING! A real SHARK — ${fish.name}!` : null,
    fish.rare && !fish.mega ? `WHOA! Rare fish — ${fish.name}!` : null,
    `Great job catching ${fish.name}!`,
  ].filter(Boolean);
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
  const idle = -1.25;
  if (pose === 'idle' || pose === 'waiting') {
    return idle + Math.sin(Date.now() * 0.0015) * 0.05;
  }
  if (pose === 'excited') {
    return -0.95 + Math.sin(Date.now() * 0.02) * 0.1;
  }
  if (pose === 'happy') {
    return -0.85 + Math.sin(Date.now() * 0.008) * 0.07;
  }
  if (pose === 'reeling') {
    return -1.05 + Math.sin(Date.now() * 0.015) * 0.12;
  }
  if (pose === 'casting') {
    if (t < 0.3) {
      const p = t / 0.3;
      return idle + p * 0.55;
    }
    if (t < 0.5) {
      const p = (t - 0.3) / 0.2;
      return idle + 0.55 - p * 1.35;
    }
    return idle - 0.8 + Math.min(1, (t - 0.5) / 0.5) * 0.45;
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

function getGripCenter() {
  return { x: width * 0.5, y: height * 0.87 };
}

function updateRodTip() {
  const { pose, t } = getCastPose();
  const rodAngle = calcRodAngle(pose, t);
  const s = handScale;
  const grip = getGripCenter();
  const rodLen = 130 * s;
  rodTip.x = grip.x + Math.cos(rodAngle) * rodLen * 0.25;
  rodTip.y = grip.y + Math.sin(rodAngle) * rodLen;
}

function drawRodFP(gripX, gripY, rodAngle, s) {
  const rodLen = 130 * s;
  const tipX = gripX + Math.cos(rodAngle) * rodLen * 0.25;
  const tipY = gripY + Math.sin(rodAngle) * rodLen;

  ctx.strokeStyle = '#5c3d2e';
  ctx.lineWidth = 5 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(gripX, gripY);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();

  ctx.strokeStyle = '#8b6914';
  ctx.lineWidth = 2.5 * s;
  ctx.beginPath();
  ctx.moveTo(tipX - Math.cos(rodAngle) * 14 * s, tipY - Math.sin(rodAngle) * 14 * s);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();

  ctx.fillStyle = '#c0c0c0';
  ctx.beginPath();
  ctx.arc(tipX, tipY, 3 * s, 0, Math.PI * 2);
  ctx.fill();
}

function drawFirstPersonHands() {
  const { pose, t } = getCastPose();
  const rodAngle = calcRodAngle(pose, t);
  const s = handScale;
  const isGirl = fisherGender === 'girl';
  const shirt = isGirl ? '#f72585' : '#4361ee';
  const sleeve = isGirl ? '#b5179e' : '#3a0ca3';
  const skin = '#ffcba4';
  const skinShadow = '#e8a87c';
  const grip = getGripCenter();
  const leftX = width * 0.36;
  const rightX = width * 0.64;
  const armY = height * 0.94;

  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.beginPath();
  ctx.ellipse(width * 0.5, height - 8, width * 0.42, 18, 0, 0, Math.PI * 2);
  ctx.fill();

  const drawArm = (x1, y1, x2, y2, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 22 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(x1 + (x2 - x1) * 0.3, y1 - 30 * s, x2, y2);
    ctx.stroke();
  };

  drawArm(leftX - 30, armY, grip.x - 14, grip.y + 4, sleeve);
  drawArm(rightX + 30, armY, grip.x + 14, grip.y + 4, sleeve);

  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.moveTo(width * 0.28, height);
  ctx.lineTo(width * 0.72, height);
  ctx.lineTo(width * 0.62, dockTopY + 10);
  ctx.lineTo(width * 0.38, dockTopY + 10);
  ctx.closePath();
  ctx.fill();

  drawRodFP(grip.x, grip.y, rodAngle, s);

  const drawHand = (hx, hy, flip) => {
    ctx.save();
    ctx.translate(hx, hy);
    if (flip) ctx.scale(-1, 1);
    ctx.fillStyle = skinShadow;
    ctx.beginPath();
    ctx.ellipse(0, 4, 12 * s, 10 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.ellipse(0, 0, 11 * s, 9 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  drawHand(grip.x - 14, grip.y + 2, false);
  drawHand(grip.x + 14, grip.y + 2, true);

  if (pose === 'happy' || pose === 'excited') {
    ctx.font = `${Math.floor(18 * s)}px Fredoka, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#1a3a4a';
    ctx.fillText(pose === 'happy' ? ':D' : '!', width * 0.5, dockTopY - 6);
  }

  updateRodTip();
}

function drawForegroundDock() {
  const grad = ctx.createLinearGradient(0, dockTopY, 0, height);
  grad.addColorStop(0, '#c4956a');
  grad.addColorStop(0.4, '#a67c52');
  grad.addColorStop(1, '#7a5535');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, height);
  ctx.lineTo(width, height);
  ctx.lineTo(width, dockTopY + 6);
  ctx.lineTo(0, dockTopY + 14);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(70, 40, 20, 0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 10; i++) {
    const px = (i / 10) * width;
    ctx.beginPath();
    ctx.moveTo(px, dockTopY + 10 + i * 0.4);
    ctx.lineTo(px + 8, height);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  ctx.fillRect(0, dockTopY, width, 4);
}

function toggleFisher() {
  if (gameState !== STATE.IDLE && gameState !== STATE.CELEBRATE) return;
  fisherGender = fisherGender === 'boy' ? 'girl' : 'boy';
  charToggle.textContent = fisherGender === 'boy' ? '👦 Boy' : '👧 Girl';
}

function drawSky() {
  const grad = ctx.createLinearGradient(0, 0, 0, horizonY);
  grad.addColorStop(0, '#7ec8f2');
  grad.addColorStop(0.45, '#5ba8d4');
  grad.addColorStop(1, '#4a9ec8');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, horizonY);

  const sunX = width * 0.72;
  const sunY = height * 0.1;
  const sunGlow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 110);
  sunGlow.addColorStop(0, 'rgba(255, 249, 196, 0.9)');
  sunGlow.addColorStop(0.4, 'rgba(255, 214, 10, 0.35)');
  sunGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = sunGlow;
  ctx.fillRect(sunX - 110, sunY - 110, 220, 220);

  ctx.fillStyle = '#ffe066';
  ctx.beginPath();
  ctx.arc(sunX, sunY, 36, 0, Math.PI * 2);
  ctx.fill();

  const hills = ctx.createLinearGradient(0, horizonY - 60, 0, horizonY);
  hills.addColorStop(0, '#3d6b4f');
  hills.addColorStop(1, '#2d5a3f');
  ctx.fillStyle = hills;
  ctx.beginPath();
  ctx.moveTo(waterLeftX(0), horizonY);
  for (let i = 0; i <= 20; i++) {
    const xNorm = i / 20;
    const x = project(xNorm, 0).x;
    const h = Math.sin(xNorm * 12) * 18 + Math.sin(xNorm * 28) * 8;
    ctx.lineTo(x, horizonY - 28 - h);
  }
  ctx.lineTo(waterRightX(0), horizonY);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  [[0.15, 0.08, 1], [0.38, 0.05, 0.85], [0.58, 0.1, 0.9], [0.78, 0.06, 0.75]].forEach(([px, py, s]) => {
    const cx = width * px;
    const cy = height * py;
    ctx.beginPath();
    ctx.arc(cx, cy, 20 * s, 0, Math.PI * 2);
    ctx.arc(cx + 26 * s, cy - 9 * s, 16 * s, 0, Math.PI * 2);
    ctx.arc(cx + 48 * s, cy + 2 * s, 18 * s, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawWater() {
  const t = Date.now() * 0.001;
  const topL = waterLeftX(0);
  const topR = waterRightX(0);
  const botL = waterLeftX(1);
  const botR = waterRightX(1);

  const surfaceGrad = ctx.createLinearGradient(0, horizonY, 0, nearWaterY);
  surfaceGrad.addColorStop(0, '#3eb5e8');
  surfaceGrad.addColorStop(0.35, '#2196c4');
  surfaceGrad.addColorStop(0.7, '#1565a8');
  surfaceGrad.addColorStop(1, '#0d4f82');
  ctx.fillStyle = surfaceGrad;
  ctx.beginPath();
  ctx.moveTo(topL, horizonY);
  ctx.lineTo(topR, horizonY);
  ctx.lineTo(botR, nearWaterY);
  ctx.lineTo(botL, nearWaterY);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = 0.07;
  for (let i = 0; i < 6; i++) {
    const z = 0.2 + i * 0.12;
    const p = project(0.5, z);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    const cx = ((t * 25 + i * 180) % (width + 80)) - 40;
    ctx.ellipse(cx, p.y, 70 * p.scale, 14 * p.scale, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  for (let zi = 1; zi <= 6; zi++) {
    const z = zi / 6;
    const left = waterLeftX(z);
    const right = waterRightX(z);
    const baseY = waterSurfaceY(z);
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.12 + z * 0.2})`;
    ctx.lineWidth = 1 + z * 1.5;
    ctx.beginPath();
    const steps = 12;
    for (let s = 0; s <= steps; s++) {
      const x = left + (right - left) * (s / steps);
      const wave = Math.sin(s * 0.9 + t * 1.4 + zi) * (2 + z * 2);
      if (s === 0) ctx.moveTo(x, baseY + wave);
      else ctx.lineTo(x, baseY + wave);
    }
    ctx.stroke();
  }
}

function drawReeds() {
  const t = Date.now() * 0.001;
  const sorted = [...reeds].sort((a, b) => b.z - a.z);
  sorted.forEach((reed) => {
    const sway = Math.sin(t * 1.2 + reed.phase) * (4 + reed.z * 6);
    const xNorm = reed.side === 'left' ? 0.04 : 0.96;
    const base = project(xNorm, reed.z);
    const h = reed.h * (40 + reed.z * 50);
    const tipX = base.x + sway;
    const tipY = base.y - h;
    ctx.strokeStyle = '#3d7a48';
    ctx.lineWidth = 2 + reed.z * 3;
    ctx.beginPath();
    ctx.moveTo(base.x, base.y);
    ctx.quadraticCurveTo(base.x + sway * 0.6, base.y - h * 0.5, tipX, tipY);
    ctx.stroke();
  });
}

function drawLilyPads() {
  const t = Date.now() * 0.001;
  const sorted = [...lilyPads].sort((a, b) => a.z - b.z);
  sorted.forEach((pad) => {
    const p = project(pad.xNorm, pad.z);
    const bob = Math.sin(t + pad.phase) * (1 + pad.z * 2);
    const r = pad.r * (8 + p.scale * 14);
    ctx.fillStyle = '#40916c';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + bob, r, r * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2d6a4f';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y + bob);
    ctx.lineTo(p.x + r * 0.55, p.y + bob);
    ctx.stroke();
  });
}

function drawRegularFish(type, s, alpha, happy) {
  ctx.fillStyle = 'rgba(0, 30, 50, 0.2)';
  ctx.beginPath();
  ctx.ellipse(2, 6, 20 * s, 8 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = type.color;
  ctx.beginPath();
  ctx.ellipse(0, 0, 24 * s, 15 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = type.belly;
  ctx.beginPath();
  ctx.ellipse(3 * s, 5 * s, 15 * s, 9 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = type.fin;
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
}

function drawShark(type, s, alpha, happy) {
  ctx.fillStyle = 'rgba(0, 20, 40, 0.25)';
  ctx.beginPath();
  ctx.ellipse(4, 14, 50 * s, 14 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = type.color;
  ctx.beginPath();
  ctx.moveTo(-55 * s, 0);
  ctx.quadraticCurveTo(-20 * s, -22 * s, 30 * s, -10 * s);
  ctx.quadraticCurveTo(55 * s, 0, 30 * s, 12 * s);
  ctx.quadraticCurveTo(-20 * s, 20 * s, -55 * s, 0);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = type.belly;
  ctx.beginPath();
  ctx.ellipse(5 * s, 8 * s, 28 * s, 10 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = type.fin;
  ctx.beginPath();
  ctx.moveTo(-5 * s, -12 * s);
  ctx.lineTo(8 * s, -32 * s);
  ctx.lineTo(18 * s, -10 * s);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-40 * s, 2 * s);
  ctx.lineTo(-62 * s, -18 * s);
  ctx.lineTo(-58 * s, 6 * s);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(28 * s, -6 * s, 5 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#212529';
  ctx.beginPath();
  ctx.arc(30 * s, -6 * s, 2.2 * s, 0, Math.PI * 2);
  ctx.fill();

  if (happy) {
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 5; i++) {
      const tx = (10 + i * 7) * s;
      ctx.beginPath();
      ctx.moveTo(tx, 6 * s);
      ctx.lineTo(tx + 3 * s, 12 * s);
      ctx.lineTo(tx + 6 * s, 6 * s);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawWhale(type, s, alpha, happy) {
  ctx.fillStyle = 'rgba(0, 20, 40, 0.2)';
  ctx.beginPath();
  ctx.ellipse(0, 18, 70 * s, 16 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = type.color;
  ctx.beginPath();
  ctx.ellipse(0, 0, 55 * s, 28 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = type.belly;
  ctx.beginPath();
  ctx.ellipse(8 * s, 12 * s, 38 * s, 16 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = type.fin;
  ctx.beginPath();
  ctx.moveTo(-50 * s, -4 * s);
  ctx.lineTo(-78 * s, -30 * s);
  ctx.lineTo(-72 * s, 8 * s);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(10 * s, -24 * s);
  ctx.lineTo(22 * s, -40 * s);
  ctx.lineTo(28 * s, -20 * s);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = type.color;
  ctx.beginPath();
  ctx.ellipse(38 * s, -8 * s, 8 * s, 5 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(30 * s, -10 * s, 5 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a3a4a';
  ctx.beginPath();
  ctx.arc(31 * s, -10 * s, 2.5 * s, 0, Math.PI * 2);
  ctx.fill();

  if (happy) {
    ctx.strokeStyle = '#1a3a4a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(36 * s, 2 * s, 8 * s, 0.2, Math.PI - 0.2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(20 * s, -32 * s);
    ctx.quadraticCurveTo(24 * s, -55 * s, 30 * s, -70 * s);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, 55 * s, 28 * s, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drawCreature(fish, x, y, facing, scale, happy, depth) {
  const type = fish.type || fish;
  const s = scale * type.size * (depth || 1);
  const alpha = 0.55 + (depth || 1) * 0.4;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  ctx.globalAlpha = alpha;

  if (type.kind === 'shark') drawShark(type, s, alpha, happy);
  else if (type.kind === 'whale') drawWhale(type, s, alpha, happy);
  else drawRegularFish(type, s, alpha, happy);

  ctx.restore();
}

function drawFish(fish, x, y, facing, scale, happy, depth) {
  drawCreature(fish, x, y, facing, scale, happy, depth);
}

function creatureBiteScale(type) {
  if (type.kind === 'whale') return 0.75;
  if (type.kind === 'shark') return 0.9;
  return 1.15;
}

function creatureCelebrateScale(type) {
  if (type.kind === 'whale') return 1.1;
  if (type.kind === 'shark') return 1.0;
  return 1.8;
}

function drawSwimmingFish() {
  swimFish.forEach((fish) => {
    fish.xNorm += fish.speed;
    fish.wiggle += 0.07;
    const margin = fish.type.kind === 'whale' ? 0.08 : fish.type.kind === 'shark' ? 0.06 : 0.04;
    if (fish.xNorm < margin) { fish.xNorm = margin; fish.speed *= -1; }
    if (fish.xNorm > 1 - margin) { fish.xNorm = 1 - margin; fish.speed *= -1; }
  });

  const sorted = [...swimFish].sort((a, b) => a.z - b.z);
  sorted.forEach((fish) => {
    const p = project(fish.xNorm, fish.z);
    const wobble = Math.sin(fish.wiggle) * (2 + fish.z * 3);
    drawFish(fish, p.x, p.y + wobble, fish.speed > 0 ? 1 : -1, p.scale, false, fish.z);
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

function hookTargetPos() {
  return project(hook.targetXNorm, hook.targetZ);
}

function updateHookPosition() {
  updateRodTip();
  const target = hookTargetPos();

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
      hook.x = castRelease.x + (target.x - castRelease.x) * flyT;
      const drop = castRelease.y + (target.y - castRelease.y) * flyT;
      const loft = Math.sin(flyT * Math.PI) * -80 * (1 - flyT * 0.5);
      hook.y = drop + loft;
    } else {
      const splashT = (castAnim - 0.82) / 0.18;
      hook.x = target.x;
      hook.y = target.y + splashT * 16;
      if (castAnim >= 1 && ripples.length < 3) {
        ripples.push({ x: target.x, y: target.y, r: 0, life: 1, z: hook.targetZ });
        ripples.push({ x: target.x, y: target.y, r: 0, life: 0.7, z: hook.targetZ });
      }
      if (castAnim >= 1) {
        hook.xNorm = hook.targetXNorm;
        hook.z = hook.targetZ;
        hook.y = target.y;
        startWaiting();
      }
    }
    return;
  }

  if (gameState === STATE.WAITING) {
    bobberDip = calcBobberDip(5, 0.003);
    const p = project(hook.xNorm, hook.z);
    hook.x = p.x;
    hook.y = p.y + bobberDip;
    return;
  }

  if (gameState === STATE.BITING) {
    bobberDip = calcBobberDip(16, 0.018) + calcBobberDip(6, 0.04);
    const p = project(hook.xNorm, hook.z);
    hook.x = p.x;
    hook.y = p.y + bobberDip;
    return;
  }

  if (gameState === STATE.REELING) {
    reelT = Math.min(1, reelT + 0.05);
    const ease = 1 - Math.pow(1 - reelT, 2);
    const p = project(hook.xNorm, hook.z);
    hook.x = p.x + (rodTip.x - p.x) * ease;
    hook.y = p.y + (rodTip.y - p.y) * ease;
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

  const showBobber = hook.y < dockTopY && gameState !== STATE.REELING;
  if (showBobber) {
    const bobScale = hook.z ? project(hook.xNorm, hook.z).scale : 0.8;
    ctx.save();
    ctx.translate(hook.x, hook.y);
    ctx.scale(bobScale, bobScale);
    drawBobber(0, 0, gameState === STATE.BITING);
    ctx.restore();
  }

  if (gameState === STATE.CASTING && castAnim > 0.5 && castAnim < 0.85) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(hook.x, hook.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  if (gameState === STATE.BITING && bitingFish) {
    const mega = bitingFish.kind === 'shark' || bitingFish.kind === 'whale';
    const biteScale = project(hook.xNorm, hook.z).scale;
    const fx = hook.x + (mega ? 55 : 32) * biteScale;
    const fy = hook.y + (mega ? 22 : 12) * biteScale + calcBobberDip(8, 0.02);
    drawCreature({ type: bitingFish }, fx, fy, -1, creatureBiteScale(bitingFish) * biteScale, true, 1);
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
  const cy = height * 0.48;
  const bounce = Math.abs(Math.sin(Date.now() * 0.006)) * 14;
  const mega = caughtFish.kind === 'shark' || caughtFish.kind === 'whale';
  const heldScale = creatureCelebrateScale(caughtFish) * 1.3;
  drawCreature({ type: caughtFish }, cx, cy - bounce, 1, heldScale, true, 1);

  ctx.fillStyle = mega ? '#48cae4' : '#fee440';
  ctx.font = `bold ${Math.floor(width * 0.045)}px Fredoka, sans-serif`;
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 8;
  ctx.fillText(mega ? 'MEGA CATCH!' : 'CAUGHT!', cx, cy - (mega ? 130 : 100));
  ctx.shadowBlur = 0;

  for (let i = 0; i < 10; i++) {
    const angle = (Date.now() * 0.002 + i) * Math.PI * 2 / 10;
    const dist = 80 + Math.sin(Date.now() * 0.004 + i) * 22;
    ctx.fillStyle = ['#ff6b35', '#06d6a0', '#fee440', '#4cc9f0'][i % 4];
    ctx.beginPath();
    ctx.arc(cx + Math.cos(angle) * dist, cy - 20 + Math.sin(angle) * dist * 0.6, 7, 0, Math.PI * 2);
    ctx.fill();
  }
}

function update() {
  if (gameState === STATE.CELEBRATE) celebrateTimer -= 1;
}

function draw() {
  drawSky();
  drawWater();
  drawReeds();
  drawLilyPads();
  drawSwimmingFish();
  drawRipples();
  drawCelebration();
  drawLineAndHook();
  drawForegroundDock();
  drawFirstPersonHands();
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