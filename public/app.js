const INTERVAL_MS = 10000;
const CLICKS_FOR_WORM = 15;
const WORM_HITS_TO_WIN = 8;
const FISH_PRIZE_MS = 6000;

const canvas = document.getElementById('fx-canvas');
const ctx = canvas.getContext('2d');
const wormCanvas = document.getElementById('worm-canvas');
const wormCtx = wormCanvas.getContext('2d');
const effectNameEl = document.getElementById('effect-name');
const countdownBar = document.getElementById('countdown-bar');
const countdownText = document.getElementById('countdown-text');
const effectLog = document.getElementById('effect-log');
const glitchOverlay = document.getElementById('glitch-overlay');
const skipHint = document.getElementById('skip-hint');
const wormScoreEl = document.getElementById('worm-score');

let width = 0;
let height = 0;
let particles = [];
let stars = [];
let matrixDrops = [];
let animationId = null;
let activeEffect = null;
let lastEffectIndex = -1;
let countdownStart = Date.now();
let effectTimeouts = [];
let nextEffectTimeout = null;
let clickCount = 0;
let wormActive = false;
let wormPath = [];
let wormProgress = 0;
let wormSegments = [];
let wormBites = [];
let wormResetTimeout = null;
let wormHits = 0;
let wormHitFlash = 0;
let wormMissFlash = 0;
let fishPrizeActive = false;
let fishPrizeStart = 0;
let fishBubbles = [];
let fishSparkles = [];

const palette = ['#00f5d4', '#9b5de5', '#fee440', '#f15bb5', '#00bbf9', '#ff6b6b', '#06d6a0'];

function resize() {
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;
  wormCanvas.width = width;
  wormCanvas.height = height;
  initStars();
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function pickColor() {
  return palette[Math.floor(Math.random() * palette.length)];
}

function initStars() {
  stars = Array.from({ length: 180 }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    z: Math.random() * width,
    speed: rand(2, 8),
  }));
}

function clearCanvas() {
  ctx.fillStyle = 'rgba(7, 7, 13, 0.25)';
  ctx.fillRect(0, 0, width, height);
}

function fullClear() {
  ctx.fillStyle = '#07070d';
  ctx.fillRect(0, 0, width, height);
}

// --- Effects ---

const effects = [
  {
    name: 'Confetti Storm',
    setup() {
      particles = Array.from({ length: 220 }, () => ({
        x: width / 2,
        y: height / 2,
        vx: rand(-12, 12),
        vy: rand(-14, 4),
        size: rand(4, 10),
        color: pickColor(),
        rotation: rand(0, Math.PI * 2),
        spin: rand(-0.2, 0.2),
        gravity: rand(0.15, 0.35),
      }));
    },
    draw() {
      fullClear();
      if (particles.length < 80) {
        for (let i = 0; i < 40; i++) {
          particles.push({
            x: width / 2,
            y: height / 2,
            vx: rand(-12, 12),
            vy: rand(-14, 4),
            size: rand(4, 10),
            color: pickColor(),
            rotation: rand(0, Math.PI * 2),
            spin: rand(-0.2, 0.2),
            gravity: rand(0.15, 0.35),
          });
        }
      }
      particles.forEach((p) => {
        p.vy += p.gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.spin;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      });
      particles = particles.filter((p) => p.y < height + 40 && p.x > -40 && p.x < width + 40);
    },
  },
  {
    name: 'Hyperspace Jump',
    setup() {
      initStars();
    },
    draw() {
      fullClear();
      const cx = width / 2;
      const cy = height / 2;
      stars.forEach((s) => {
        s.z -= s.speed * 2;
        if (s.z <= 0) {
          s.x = Math.random() * width;
          s.y = Math.random() * height;
          s.z = width;
        }
        const sx = (s.x - cx) * (width / s.z) + cx;
        const sy = (s.y - cy) * (width / s.z) + cy;
        const px = (s.x - cx) * (width / (s.z + s.speed * 8)) + cx;
        const py = (s.y - cy) * (width / (s.z + s.speed * 8)) + cy;
        ctx.strokeStyle = `rgba(0, 245, 212, ${Math.min(1, width / s.z)})`;
        ctx.lineWidth = Math.min(3, width / s.z);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(sx, sy);
        ctx.stroke();
      });
    },
  },
  {
    name: 'Neon Ripples',
    setup() {
      particles = Array.from({ length: 8 }, (_, i) => ({
        radius: 0,
        maxRadius: Math.max(width, height) * 0.7,
        speed: rand(3, 6),
        delay: i * 300,
        born: Date.now(),
        color: pickColor(),
      }));
    },
    draw() {
      fullClear();
      const now = Date.now();
      let allDone = true;
      particles.forEach((p) => {
        if (now - p.born < p.delay) {
          allDone = false;
          return;
        }
        p.radius += p.speed;
        if (p.radius > p.maxRadius) return;
        allDone = false;
        const alpha = 1 - p.radius / p.maxRadius;
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = alpha * 0.8;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(width / 2, height / 2, p.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      });
      if (allDone) this.setup();
    },
  },
  {
    name: 'Matrix Rain',
    setup() {
      const cols = Math.floor(width / 18);
      matrixDrops = Array.from({ length: cols }, (_, i) => ({
        x: i * 18,
        y: rand(-height, 0),
        speed: rand(4, 12),
        chars: Array.from({ length: rand(8, 24) }, () =>
          String.fromCharCode(0x30a0 + Math.floor(Math.random() * 96))
        ),
      }));
    },
    draw() {
      ctx.fillStyle = 'rgba(7, 7, 13, 0.12)';
      ctx.fillRect(0, 0, width, height);
      ctx.font = '16px JetBrains Mono, monospace';
      matrixDrops.forEach((drop) => {
        drop.chars.forEach((ch, i) => {
          const y = drop.y - i * 18;
          if (y < 0 || y > height) return;
          ctx.fillStyle = i === 0 ? '#00f5d4' : `rgba(0, 245, 212, ${0.15 + (1 - i / drop.chars.length) * 0.6})`;
          ctx.fillText(ch, drop.x, y);
        });
        drop.y += drop.speed;
        if (drop.y > height + drop.chars.length * 18) {
          drop.y = rand(-200, -50);
          drop.speed = rand(4, 12);
        }
      });
    },
  },
  {
    name: 'Firework Bloom',
    setup() {
      particles = [];
      this.lastFirework = 0;
    },
    draw() {
      const now = Date.now();
      if (now - this.lastFirework > 1200) {
        launchFirework();
        this.lastFirework = now;
      }
      ctx.fillStyle = 'rgba(7, 7, 13, 0.18)';
      ctx.fillRect(0, 0, width, height);
      particles.forEach((p) => {
        p.vy += 0.05;
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.015;
        if (p.life <= 0) return;
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });
      particles = particles.filter((p) => p.life > 0);
    },
  },
  {
    name: 'Aurora Swirl',
    setup() {
      particles = Array.from({ length: 6 }, (_, i) => ({
        angle: (i / 6) * Math.PI * 2,
        speed: rand(0.01, 0.025),
        radius: rand(100, 300),
        color: pickColor(),
      }));
    },
    draw() {
      fullClear();
      const cx = width / 2;
      const cy = height / 2;
      const t = Date.now() * 0.001;
      particles.forEach((p, i) => {
        p.angle += p.speed;
        const r = p.radius + Math.sin(t + i) * 60;
        const x = cx + Math.cos(p.angle) * r;
        const y = cy + Math.sin(p.angle) * r * 0.6;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, 180);
        grad.addColorStop(0, p.color + 'aa');
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(x - 180, y - 180, 360, 360);
      });
    },
  },
  {
    name: 'Gravity Flip',
    setup() {
      particles = Array.from({ length: 150 }, () => ({
        x: rand(0, width),
        y: rand(height * 0.5, height),
        vx: rand(-2, 2),
        vy: rand(-10, -4),
        size: rand(2, 6),
        color: pickColor(),
      }));
    },
    draw() {
      fullClear();
      particles.forEach((p) => {
        p.vy -= 0.12;
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -20) {
          p.y = height + 20;
          p.x = rand(0, width);
          p.vy = rand(-10, -4);
        }
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });
    },
  },
  {
    name: 'Kaleidoscope',
    setup() {
      particles = [{ segments: rand(6, 12), rotation: 0, hue: Math.random() * 360 }];
    },
    draw() {
      fullClear();
      const cx = width / 2;
      const cy = height / 2;
      const seg = particles[0];
      seg.rotation += 0.02;
      const slices = seg.segments;
      for (let i = 0; i < slices; i++) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(seg.rotation + (i / slices) * Math.PI * 2);
        const grad = ctx.createLinearGradient(-200, 0, 200, 0);
        grad.addColorStop(0, `hsla(${seg.hue + i * 30}, 80%, 60%, 0)`);
        grad.addColorStop(0.5, `hsla(${seg.hue + i * 30}, 90%, 65%, 0.7)`);
        grad.addColorStop(1, `hsla(${seg.hue + i * 30}, 80%, 60%, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, Math.max(width, height), -0.15, 0.15);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    },
  },
  {
    name: 'Glitch Storm',
    setup() {
      this.lastBurst = 0;
      particles = Array.from({ length: 40 }, () => ({
        x: rand(0, width),
        y: rand(0, height),
        w: rand(40, 300),
        h: rand(2, 12),
        color: pickColor(),
        life: 1,
      }));
      this.triggerBurst();
    },
    triggerBurst() {
      document.body.classList.add('shake');
      glitchOverlay.classList.add('active');
      const timeout = setTimeout(() => {
        document.body.classList.remove('shake');
        glitchOverlay.classList.remove('active');
      }, 700);
      effectTimeouts.push(timeout);
      for (let i = 0; i < 20; i++) {
        particles.push({
          x: rand(0, width),
          y: rand(0, height),
          w: rand(40, 300),
          h: rand(2, 12),
          color: pickColor(),
          life: 1,
        });
      }
    },
    draw() {
      const now = Date.now();
      if (now - this.lastBurst > 2000) {
        this.lastBurst = now;
        this.triggerBurst();
      }
      fullClear();
      particles.forEach((p) => {
        p.life -= 0.02;
        if (p.life <= 0) return;
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x + rand(-5, 5), p.y, p.w, p.h);
        ctx.globalAlpha = 1;
      });
      particles = particles.filter((p) => p.life > 0);
    },
  },
  {
    name: 'Orbital Dance',
    setup() {
      particles = Array.from({ length: 12 }, (_, i) => ({
        angle: (i / 12) * Math.PI * 2,
        orbit: rand(80, Math.min(width, height) * 0.35),
        speed: rand(0.02, 0.05) * (Math.random() > 0.5 ? 1 : -1),
        size: rand(8, 20),
        color: pickColor(),
        trail: [],
      }));
    },
    draw() {
      ctx.fillStyle = 'rgba(7, 7, 13, 0.15)';
      ctx.fillRect(0, 0, width, height);
      const cx = width / 2;
      const cy = height / 2;
      particles.forEach((p) => {
        p.angle += p.speed;
        const x = cx + Math.cos(p.angle) * p.orbit;
        const y = cy + Math.sin(p.angle) * p.orbit;
        p.trail.push({ x, y });
        if (p.trail.length > 30) p.trail.shift();
        p.trail.forEach((t, i) => {
          ctx.globalAlpha = i / p.trail.length;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(t.x, t.y, p.size * (i / p.trail.length), 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.globalAlpha = 1;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });
    },
  },
  {
    name: 'Reality Invert',
    setup() {
      document.body.classList.add('invert');
      particles = Array.from({ length: 80 }, () => ({
        x: rand(0, width),
        y: rand(0, height),
        size: rand(3, 8),
        color: pickColor(),
        pulse: rand(0, Math.PI * 2),
      }));
    },
    draw() {
      fullClear();
      const t = Date.now() * 0.003;
      particles.forEach((p) => {
        const s = p.size + Math.sin(t + p.pulse) * 2;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, s, 0, Math.PI * 2);
        ctx.fill();
      });
    },
  },
  {
    name: 'Lightning Web',
    setup() {
      particles = Array.from({ length: 6 }, () => ({
        points: generateLightningPath(),
        color: pickColor(),
        life: 1,
      }));
    },
    draw() {
      fullClear();
      particles.forEach((bolt) => {
        bolt.life -= 0.04;
        if (bolt.life <= 0) {
          bolt.points = generateLightningPath();
          bolt.life = 1;
          bolt.color = pickColor();
        }
        ctx.globalAlpha = bolt.life;
        ctx.strokeStyle = bolt.color;
        ctx.lineWidth = 2;
        ctx.shadowColor = bolt.color;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        bolt.points.forEach((pt, i) => {
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      });
    },
  },
  {
    name: 'Boat Parade',
    setup() {
      this.waterLevel = height * 0.62;
      this.waveOffset = 0;
      particles = Array.from({ length: Math.floor(rand(7, 11)) }, () => ({
        x: rand(-width * 0.2, width * 1.2),
        speed: rand(0.5, 1.4) * (Math.random() > 0.5 ? 1 : -1),
        size: rand(0.7, 1.5),
        hullColor: pickColor(),
        sailColor: pickColor(),
        phase: rand(0, Math.PI * 2),
        bob: rand(0.02, 0.04),
        wake: [],
      }));
    },
    draw() {
      const water = this.waterLevel;
      this.waveOffset += 0.035;
      const t = Date.now() * 0.001;

      const sky = ctx.createLinearGradient(0, 0, 0, water);
      sky.addColorStop(0, '#050818');
      sky.addColorStop(0.5, '#0c1a3a');
      sky.addColorStop(1, '#12345f');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, height);

      for (let i = 0; i < 60; i++) {
        const sx = (i * 137.5 + t * 8) % width;
        const sy = (i * 53.7) % (water * 0.7);
        const twinkle = 0.3 + Math.sin(t * 2 + i) * 0.3;
        ctx.fillStyle = `rgba(255, 255, 255, ${twinkle})`;
        ctx.beginPath();
        ctx.arc(sx, sy, 1 + (i % 3) * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }

      const moonX = width * 0.78;
      const moonY = height * 0.14;
      const moonGlow = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, 80);
      moonGlow.addColorStop(0, 'rgba(254, 228, 64, 0.35)');
      moonGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = moonGlow;
      ctx.fillRect(moonX - 80, moonY - 80, 160, 160);
      ctx.fillStyle = '#fee440';
      ctx.beginPath();
      ctx.arc(moonX, moonY, 22, 0, Math.PI * 2);
      ctx.fill();

      const sea = ctx.createLinearGradient(0, water - 40, 0, height);
      sea.addColorStop(0, '#0a4d6e');
      sea.addColorStop(0.4, '#063a55');
      sea.addColorStop(1, '#021a2b');
      ctx.fillStyle = sea;
      ctx.fillRect(0, water - 30, width, height - water + 30);

      ctx.beginPath();
      ctx.moveTo(0, waveHeight(0, water, this.waveOffset));
      for (let x = 0; x <= width; x += 6) {
        ctx.lineTo(x, waveHeight(x, water, this.waveOffset));
      }
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fillStyle = 'rgba(0, 245, 212, 0.08)';
      ctx.fill();

      ctx.strokeStyle = 'rgba(0, 245, 212, 0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, waveHeight(0, water, this.waveOffset));
      for (let x = 0; x <= width; x += 4) {
        ctx.lineTo(x, waveHeight(x, water, this.waveOffset));
      }
      ctx.stroke();

      particles.forEach((boat) => {
        boat.x += boat.speed;
        if (boat.speed > 0 && boat.x > width + 120) boat.x = -120;
        if (boat.speed < 0 && boat.x < -120) boat.x = width + 120;

        const y = waveHeight(boat.x, water, this.waveOffset)
          + Math.sin(t * 3 + boat.phase) * 4
          - 8 * boat.size;
        const tilt = Math.cos(boat.x * 0.008 + this.waveOffset) * 0.06 * boat.speed;

        boat.wake.push({ x: boat.x - boat.speed * 10, y: y + 10 * boat.size, life: 1 });
        if (boat.wake.length > 12) boat.wake.shift();
        boat.wake.forEach((w) => {
          w.life -= 0.04;
          ctx.globalAlpha = w.life * 0.35;
          ctx.fillStyle = '#00f5d4';
          ctx.beginPath();
          ctx.ellipse(w.x, w.y, 10 * boat.size, 3 * boat.size, 0, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.globalAlpha = 1;

        ctx.save();
        ctx.translate(boat.x, y);
        ctx.rotate(tilt);
        drawBoat(0, 0, boat.size, boat.hullColor, boat.sailColor, boat.speed);
        ctx.restore();
      });
    },
  },
];

function waveHeight(x, waterLevel, offset) {
  return waterLevel
    + Math.sin(x * 0.008 + offset) * 14
    + Math.sin(x * 0.02 + offset * 1.4) * 7;
}

function drawBoat(x, y, scale, hullColor, sailColor, direction) {
  const s = scale;
  const dir = direction >= 0 ? 1 : -1;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);

  ctx.fillStyle = 'rgba(0, 245, 212, 0.15)';
  ctx.beginPath();
  ctx.ellipse(-18 * s, 8 * s, 22 * s, 5 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = hullColor;
  ctx.beginPath();
  ctx.moveTo(-28 * s, 0);
  ctx.quadraticCurveTo(-10 * s, 14 * s, 18 * s, 10 * s);
  ctx.lineTo(22 * s, 4 * s);
  ctx.quadraticCurveTo(0, -2 * s, -28 * s, 0);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.moveTo(2 * s, 4 * s);
  ctx.lineTo(2 * s, -38 * s);
  ctx.stroke();

  ctx.fillStyle = sailColor;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.moveTo(2 * s, -36 * s);
  ctx.lineTo(2 * s, -6 * s);
  ctx.lineTo(26 * s, -18 * s);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.beginPath();
  ctx.moveTo(2 * s, -34 * s);
  ctx.lineTo(2 * s, -10 * s);
  ctx.lineTo(-18 * s, -20 * s);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.restore();
}

function generateLightningPath() {
  const points = [{ x: rand(0, width), y: 0 }];
  let x = points[0].x;
  let y = 0;
  while (y < height) {
    x += rand(-60, 60);
    y += rand(30, 80);
    points.push({ x, y: Math.min(y, height) });
  }
  return points;
}

function launchFirework() {
  const x = rand(width * 0.15, width * 0.85);
  const y = rand(height * 0.15, height * 0.55);
  const color = pickColor();
  const count = Math.floor(rand(40, 80));
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const speed = rand(2, 7);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: rand(2, 4),
      color,
      life: 1,
    });
  }
}

function pickRandomEffect() {
  let index;
  do {
    index = Math.floor(Math.random() * effects.length);
  } while (index === lastEffectIndex && effects.length > 1);
  lastEffectIndex = index;
  return effects[index];
}

function setEffectName(name) {
  effectNameEl.textContent = name;
  effectNameEl.classList.remove('pop');
  void effectNameEl.offsetWidth;
  effectNameEl.classList.add('pop');
}

function logEffect(name) {
  const li = document.createElement('li');
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  li.textContent = `${time} — ${name}`;
  effectLog.prepend(li);
  while (effectLog.children.length > 5) {
    effectLog.removeChild(effectLog.lastChild);
  }
}

function cleanupEffect() {
  effectTimeouts.forEach(clearTimeout);
  effectTimeouts = [];
  document.body.classList.remove('shake', 'invert');
  glitchOverlay.classList.remove('active');
}

function startEffect(effect) {
  cleanupEffect();
  activeEffect = effect;
  setEffectName(effect.name);
  logEffect(effect.name);
  fullClear();
  effect.setup();
}

function triggerRandomEffect() {
  startEffect(pickRandomEffect());
  countdownStart = Date.now();
}

function scheduleNextEffect() {
  clearTimeout(nextEffectTimeout);
  nextEffectTimeout = setTimeout(() => {
    triggerRandomEffect();
    scheduleNextEffect();
  }, INTERVAL_MS);
}

function generateWormPath() {
  const path = [];
  const rowStep = 36;
  const colStep = 18;
  const margin = 24;

  for (let y = margin; y < height - margin; y += rowStep) {
    const row = Math.floor((y - margin) / rowStep);
    const leftToRight = row % 2 === 0;
    if (leftToRight) {
      for (let x = margin; x < width - margin; x += colStep) path.push({ x, y });
    } else {
      for (let x = width - margin; x > margin; x -= colStep) path.push({ x, y });
    }
  }
  return path;
}

function getWormHead() {
  if (wormPath.length < 2) return wormPath[0] || { x: 0, y: 0, angle: 0 };
  const idx = Math.min(Math.floor(wormProgress), wormPath.length - 2);
  const t = wormProgress - idx;
  const a = wormPath[idx];
  const b = wormPath[idx + 1];
  const x = a.x + (b.x - a.x) * t;
  const y = a.y + (b.y - a.y) * t;
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  return { x, y, angle };
}

function drawWormHead(x, y, angle, chomp, hitFlash) {
  wormCtx.save();
  wormCtx.translate(x, y);
  wormCtx.rotate(angle);

  const mouthOpen = 0.4 + chomp * 0.55;
  wormCtx.fillStyle = hitFlash > 0.3 ? '#fee440' : '#06d6a0';
  wormCtx.beginPath();
  wormCtx.arc(0, 0, 18, 0, Math.PI * 2);
  wormCtx.fill();

  wormCtx.fillStyle = '#048a5e';
  wormCtx.beginPath();
  wormCtx.arc(-6, -5, 4, 0, Math.PI * 2);
  wormCtx.arc(6, -5, 4, 0, Math.PI * 2);
  wormCtx.fill();

  wormCtx.fillStyle = '#fff';
  wormCtx.beginPath();
  wormCtx.arc(-6, -5, 1.8, 0, Math.PI * 2);
  wormCtx.arc(6, -5, 1.8, 0, Math.PI * 2);
  wormCtx.fill();

  wormCtx.fillStyle = '#023020';
  wormCtx.beginPath();
  wormCtx.arc(-6, -5, 0.9, 0, Math.PI * 2);
  wormCtx.arc(6, -5, 0.9, 0, Math.PI * 2);
  wormCtx.fill();

  wormCtx.fillStyle = '#ff006e';
  wormCtx.beginPath();
  wormCtx.arc(14, 2, 10, -mouthOpen, mouthOpen);
  wormCtx.lineTo(0, 0);
  wormCtx.closePath();
  wormCtx.fill();

  wormCtx.strokeStyle = '#9b0050';
  wormCtx.lineWidth = 2;
  wormCtx.beginPath();
  wormCtx.arc(14, 2, 10, -mouthOpen, mouthOpen);
  wormCtx.stroke();

  wormCtx.restore();
}

function drawWormSegment(x, y, radius, color) {
  wormCtx.fillStyle = color;
  wormCtx.beginPath();
  wormCtx.arc(x, y, radius, 0, Math.PI * 2);
  wormCtx.fill();
  wormCtx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
  wormCtx.lineWidth = 2;
  wormCtx.stroke();
}

function isClickOnWorm(x, y) {
  const head = getWormHead();
  if (Math.hypot(x - head.x, y - head.y) < 34) return true;
  for (let i = 0; i < wormSegments.length; i++) {
    const seg = wormSegments[i];
    const radius = Math.max(8, 16 - i * 0.4);
    if (Math.hypot(x - seg.x, y - seg.y) < radius + 6) return true;
  }
  return false;
}

function updateWormScore() {
  wormScoreEl.textContent = `${wormHits} / ${WORM_HITS_TO_WIN} hits`;
}

function drawHugeFish(t) {
  fullClear();

  const elapsed = t - fishPrizeStart;
  const grow = Math.min(1, elapsed / 1200);
  const bounce = 1 + Math.sin(elapsed * 0.004) * 0.04;
  const scale = (0.2 + grow * 0.8 * bounce) * Math.min(width, height) / 500;
  const cx = width / 2;
  const cy = height / 2 + Math.sin(elapsed * 0.003) * 12;

  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 280 * scale);
  glow.addColorStop(0, 'rgba(254, 228, 64, 0.35)');
  glow.addColorStop(0.5, 'rgba(0, 245, 212, 0.15)');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  fishSparkles.forEach((s) => {
    s.y -= s.speed;
    s.twinkle += 0.1;
    if (s.y < -10) {
      s.y = height + 10;
      s.x = rand(0, width);
    }
    ctx.fillStyle = `rgba(255, 255, 255, ${0.4 + Math.sin(s.twinkle) * 0.4})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    ctx.fill();
  });

  fishBubbles.forEach((b) => {
    b.y -= b.speed;
    b.x += Math.sin(elapsed * 0.002 + b.phase) * 0.5;
    if (b.y < -20) b.y = height + 20;
    ctx.strokeStyle = `rgba(0, 245, 212, ${b.alpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.stroke();
  });

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.rotate(Math.sin(elapsed * 0.002) * 0.08);

  ctx.fillStyle = '#ff6b35';
  ctx.beginPath();
  ctx.moveTo(120, 0);
  ctx.quadraticCurveTo(60, -55, -80, -30);
  ctx.quadraticCurveTo(-200, -10, -260, 0);
  ctx.quadraticCurveTo(-200, 10, -80, 30);
  ctx.quadraticCurveTo(60, 55, 120, 0);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#e85d04';
  ctx.beginPath();
  ctx.moveTo(-250, 0);
  ctx.lineTo(-320, -50);
  ctx.lineTo(-300, 0);
  ctx.lineTo(-320, 50);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#f48c06';
  ctx.beginPath();
  ctx.moveTo(-40, -35);
  ctx.lineTo(-10, -80);
  ctx.lineTo(20, -35);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(10, 35);
  ctx.lineTo(40, 75);
  ctx.lineTo(70, 35);
  ctx.closePath();
  ctx.fill();

  for (let i = 0; i < 9; i++) {
    const sx = -180 + i * 38;
    const sy = (i % 2) * 16 - 8;
    ctx.fillStyle = 'rgba(255, 200, 100, 0.45)';
    ctx.beginPath();
    ctx.arc(sx, sy, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(55, -18, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#023047';
  ctx.beginPath();
  ctx.arc(62, -18, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(66, -22, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffd60a';
  ctx.font = 'bold 28px Space Grotesk, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PRIZE FISH', 0, -110);

  ctx.restore();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.font = `bold ${Math.floor(24 + grow * 20)}px Space Grotesk, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('YOU CAUGHT THE HUGE FISH!', cx, 60 * scale + cy + 120 * scale);
}

function initFishPrizeFx() {
  fishBubbles = Array.from({ length: 30 }, () => ({
    x: rand(0, width),
    y: rand(0, height),
    r: rand(3, 12),
    speed: rand(0.5, 2),
    alpha: rand(0.2, 0.5),
    phase: rand(0, Math.PI * 2),
  }));
  fishSparkles = Array.from({ length: 50 }, () => ({
    x: rand(0, width),
    y: rand(0, height),
    size: rand(1, 3),
    speed: rand(0.3, 1.2),
    twinkle: rand(0, Math.PI * 2),
  }));
}

function endWormGame() {
  wormActive = false;
  wormHits = 0;
  wormHitFlash = 0;
  wormMissFlash = 0;
  wormCtx.clearRect(0, 0, width, height);
  wormBites = [];
  wormSegments = [];
  wormProgress = 0;
  document.body.classList.remove('worm-game');
  wormScoreEl.classList.add('hidden');
  skipHint.textContent = 'click anywhere to skip';
}

function triggerFishPrize() {
  clearTimeout(wormResetTimeout);
  wormResetTimeout = null;
  endWormGame();
  fishPrizeActive = true;
  fishPrizeStart = Date.now();
  document.body.classList.add('fish-prize');
  initFishPrizeFx();
  setEffectName('HUGE FISH!!!');
  logEffect('You won the huge fish!');
  skipHint.textContent = 'enjoy your prize...';

  setTimeout(() => {
    fishPrizeActive = false;
    document.body.classList.remove('fish-prize');
    skipHint.textContent = 'click anywhere to skip';
    triggerRandomEffect();
    scheduleNextEffect();
  }, FISH_PRIZE_MS);
}

function wormGameLose() {
  setEffectName('Burp. Worm wins.');
  logEffect('Worm ate the screen');
  wormResetTimeout = setTimeout(() => {
    wormResetTimeout = null;
    endWormGame();
    triggerRandomEffect();
    scheduleNextEffect();
  }, 2000);
}

function updateWorm() {
  if (wormHitFlash > 0) wormHitFlash -= 0.08;
  wormProgress += wormHitFlash > 0.5 ? 0.15 : 0.55;
  const head = getWormHead();
  const chomp = Math.abs(Math.sin(Date.now() * 0.02));

  wormBites.push({ x: head.x, y: head.y, r: 22 + chomp * 10 });
  if (wormBites.length > 600) wormBites.shift();

  wormSegments.unshift({ x: head.x, y: head.y });
  const maxSegments = 28;
  if (wormSegments.length > maxSegments) wormSegments.length = maxSegments;

  wormCtx.clearRect(0, 0, width, height);
  wormCtx.fillStyle = '#07070d';
  wormBites.forEach((bite) => {
    wormCtx.beginPath();
    wormCtx.arc(bite.x, bite.y, bite.r, 0, Math.PI * 2);
    wormCtx.fill();
  });

  const colors = ['#06d6a0', '#05c293', '#04a87f', '#048a6c'];
  for (let i = wormSegments.length - 1; i > 0; i--) {
    const seg = wormSegments[i];
    const radius = 14 - i * 0.35;
    if (radius < 4) continue;
    const color = wormHitFlash > 0.3 && i < 4 ? '#fee440' : colors[i % colors.length];
    drawWormSegment(seg.x, seg.y, radius, color);
  }

  drawWormHead(head.x, head.y, head.angle, chomp, wormHitFlash);

  if (wormMissFlash > 0) {
    wormMissFlash -= 0.05;
    wormCtx.fillStyle = `rgba(255, 0, 110, ${wormMissFlash * 0.25})`;
    wormCtx.fillRect(0, 0, width, height);
  }

  const eaten = wormProgress / Math.max(1, wormPath.length - 1);
  countdownBar.style.transform = `scaleX(${eaten})`;
  countdownText.textContent = `${WORM_HITS_TO_WIN - wormHits} to win`;

  if (wormProgress >= wormPath.length - 1 && !wormResetTimeout) {
    wormGameLose();
  }
}

function triggerWorm() {
  clearTimeout(nextEffectTimeout);
  clearTimeout(wormResetTimeout);
  wormResetTimeout = null;
  wormActive = true;
  wormHits = 0;
  wormHitFlash = 0;
  wormMissFlash = 0;
  wormPath = generateWormPath();
  wormProgress = 0;
  wormSegments = [];
  wormBites = [];
  wormCtx.clearRect(0, 0, width, height);
  document.body.classList.add('worm-game');
  document.body.classList.remove('fish-prize');
  wormScoreEl.classList.remove('hidden');
  updateWormScore();
  skipHint.textContent = 'click the worm to win a huge fish!';
  setEffectName('Catch the Worm!');
  logEffect('Worm game started');
  countdownBar.style.transform = 'scaleX(0)';
  countdownText.textContent = `${WORM_HITS_TO_WIN} to win`;
}

function handleWormClick(x, y) {
  if (isClickOnWorm(x, y)) {
    wormHits += 1;
    wormHitFlash = 1;
    updateWormScore();
    wormScoreEl.classList.remove('hit-flash');
    void wormScoreEl.offsetWidth;
    wormScoreEl.classList.add('hit-flash');

    if (wormHits >= WORM_HITS_TO_WIN) {
      triggerFishPrize();
    }
  } else {
    wormMissFlash = 1;
    skipHint.textContent = 'miss! aim for the worm';
    setTimeout(() => {
      if (wormActive) skipHint.textContent = 'click the worm to win a huge fish!';
    }, 600);
  }
}

function handleClick(e) {
  if (fishPrizeActive) return;

  if (wormActive) {
    handleWormClick(e.clientX, e.clientY);
    return;
  }

  clickCount += 1;
  if (clickCount >= CLICKS_FOR_WORM) {
    clickCount = 0;
    triggerWorm();
    return;
  }

  triggerRandomEffect();
  scheduleNextEffect();
}

function animate() {
  if (fishPrizeActive) {
    drawHugeFish(Date.now());
  } else if (wormActive) {
    if (activeEffect) activeEffect.draw();
    updateWorm();
  } else if (activeEffect) {
    activeEffect.draw();
  }

  if (!wormActive && !fishPrizeActive) {
    const elapsed = Date.now() - countdownStart;
    const remaining = Math.max(0, INTERVAL_MS - elapsed);
    const progress = 1 - remaining / INTERVAL_MS;
    countdownBar.style.transform = `scaleX(${progress})`;
    countdownText.textContent = `${Math.ceil(remaining / 1000)}s`;
  }

  animationId = requestAnimationFrame(animate);
}

window.addEventListener('resize', resize);
document.addEventListener('click', handleClick);
resize();
triggerRandomEffect();
scheduleNextEffect();
animate();