const INTERVAL_MS = 10000;
const EFFECT_DURATION_MS = 3500;

const canvas = document.getElementById('fx-canvas');
const ctx = canvas.getContext('2d');
const effectNameEl = document.getElementById('effect-name');
const countdownBar = document.getElementById('countdown-bar');
const countdownText = document.getElementById('countdown-text');
const effectLog = document.getElementById('effect-log');
const glitchOverlay = document.getElementById('glitch-overlay');

let width = 0;
let height = 0;
let particles = [];
let stars = [];
let matrixDrops = [];
let animationId = null;
let activeEffect = null;
let effectEndTime = 0;
let lastEffectIndex = -1;
let countdownStart = Date.now();

const palette = ['#00f5d4', '#9b5de5', '#fee440', '#f15bb5', '#00bbf9', '#ff6b6b', '#06d6a0'];

function resize() {
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;
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
      particles.forEach((p) => {
        if (now - p.born < p.delay) return;
        p.radius += p.speed;
        if (p.radius > p.maxRadius) return;
        const alpha = 1 - p.radius / p.maxRadius;
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = alpha * 0.8;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(width / 2, height / 2, p.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      });
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
      for (let i = 0; i < 5; i++) {
        setTimeout(() => launchFirework(), i * 400);
      }
    },
    draw() {
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
      document.body.classList.add('shake');
      glitchOverlay.classList.add('active');
      setTimeout(() => {
        document.body.classList.remove('shake');
        glitchOverlay.classList.remove('active');
      }, 1800);
      particles = Array.from({ length: 40 }, () => ({
        x: rand(0, width),
        y: rand(0, height),
        w: rand(40, 300),
        h: rand(2, 12),
        color: pickColor(),
        life: 1,
      }));
    },
    draw() {
      fullClear();
      particles.forEach((p) => {
        p.life -= 0.03;
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
      setTimeout(() => document.body.classList.remove('invert'), EFFECT_DURATION_MS);
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
];

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

function startEffect(effect) {
  activeEffect = effect;
  effectEndTime = Date.now() + EFFECT_DURATION_MS;
  setEffectName(effect.name);
  logEffect(effect.name);
  fullClear();
  effect.setup();
}

function triggerRandomEffect() {
  startEffect(pickRandomEffect());
  countdownStart = Date.now();
}

function animate() {
  if (activeEffect && Date.now() < effectEndTime) {
    activeEffect.draw();
  } else if (activeEffect) {
    activeEffect = null;
    fullClear();
  }

  const elapsed = Date.now() - countdownStart;
  const remaining = Math.max(0, INTERVAL_MS - elapsed);
  const progress = 1 - remaining / INTERVAL_MS;
  countdownBar.style.transform = `scaleX(${progress})`;
  countdownText.textContent = `${Math.ceil(remaining / 1000)}s`;

  animationId = requestAnimationFrame(animate);
}

window.addEventListener('resize', resize);
resize();
triggerRandomEffect();
setInterval(triggerRandomEffect, INTERVAL_MS);
animate();