const main = document.querySelector("main");
const face = document.querySelector(".face");
const stars = document.querySelector(".stars");
const burgerLayer = document.querySelector(".burgers");
const bubble = document.querySelector(".bubble");
const bubbleText = bubble.querySelector(".bubble__text");
const hud = document.querySelector(".hud");
const hudCount = hud.querySelector(".hud__count");
const hint = document.querySelector(".hint");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const maxStars = 100;

/* ---------- Stars ---------- */

function positionStar(star, size) {
  star.style.left = `${Math.random() * Math.max(0, window.innerWidth - size)}px`;
  star.style.top = `${Math.random() * Math.max(0, window.innerHeight - size)}px`;
}

function createStar() {
  if (stars.childElementCount >= maxStars) {
    return;
  }

  const star = document.createElement("span");
  const size = Math.floor(Math.random() * 3) + 1;
  const duration = Math.random() * 9000 + 7000;
  const elapsed = Math.random() * duration;

  star.className = reducedMotion.matches ? "star star--still" : "star";
  star.style.width = `${size}px`;
  star.style.height = `${size}px`;
  positionStar(star, size);

  if (!reducedMotion.matches) {
    star.style.setProperty("--duration", `${duration}ms`);
    star.style.setProperty("--peak", `${Math.random() * 0.5 + 0.5}`);
    star.style.animationDelay = `-${elapsed}ms`;
    star.addEventListener(
      "animationend",
      () => {
        star.remove();
        createStar();
      },
      { once: true },
    );
  }

  stars.append(star);
}

for (let i = 0; i < maxStars; i += 1) {
  createStar();
}

window.addEventListener("resize", () => {
  for (const star of stars.children) {
    positionStar(star, star.offsetWidth);
  }
});

/* ---------- Wurfobjekt ---------- */

// Bild, das man Paul zuwirft. Zum Austauschen einfach assets/images/burger.png
// durch ein anderes Bild ersetzen (am besten PNG mit transparentem Hintergrund)
// oder hier einen anderen Pfad eintragen. Das Seitenverhältnis ist egal.
const FOOD_IMAGE = "./assets/images/burger.png";
const CRUMB_COLORS = ["#e8a33d", "#d68f2e", "#5fbf3a", "#6b3a1e", "#f7c51e", "#c0392b"];

let foodAspect = 352 / 400; // Höhe / Breite, wird nach dem Laden aus dem Bild übernommen
const foodPreload = new Image();
foodPreload.addEventListener("load", () => {
  if (foodPreload.naturalWidth && foodPreload.naturalHeight) {
    foodAspect = foodPreload.naturalHeight / foodPreload.naturalWidth;
  }
});
foodPreload.src = FOOD_IMAGE;

const hudIcon = hud.querySelector(".hud__icon");
hudIcon.src = FOOD_IMAGE;

/* ---------- Score ---------- */

const STORAGE_KEY = "paul-burgers-eaten";
let eatenCount = 0;
try {
  eatenCount = Number.parseInt(localStorage.getItem(STORAGE_KEY), 10) || 0;
} catch {
  eatenCount = 0;
}
hudCount.textContent = eatenCount;

function addPoint() {
  eatenCount += 1;
  hudCount.textContent = eatenCount;
  hud.classList.remove("is-bumped");
  void hud.offsetWidth;
  hud.classList.add("is-bumped");
  try {
    localStorage.setItem(STORAGE_KEY, String(eatenCount));
  } catch {
    // Storage unavailable (private mode etc.), the counter just won't persist.
  }
}

/* ---------- Sound (short synthesized munch) ---------- */

let audio = null;
let noiseBuffer = null;

function ensureAudio() {
  try {
    if (!audio) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) {
        return;
      }
      audio = new Context();
      noiseBuffer = audio.createBuffer(1, Math.floor(audio.sampleRate * 0.15), audio.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) {
        data[i] = Math.random() * 2 - 1;
      }
    }
    if (audio.state === "suspended") {
      audio.resume();
    }
  } catch {
    audio = null;
  }
}

function munch(delay) {
  if (!audio || !noiseBuffer) {
    return;
  }
  const t = audio.currentTime + delay;
  const source = audio.createBufferSource();
  const filter = audio.createBiquadFilter();
  const gain = audio.createGain();
  source.buffer = noiseBuffer;
  filter.type = "bandpass";
  filter.frequency.value = 600 + Math.random() * 600;
  filter.Q.value = 1.4;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.35, t + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
  source.connect(filter).connect(gain).connect(audio.destination);
  source.start(t);
  source.stop(t + 0.14);
}

/* ---------- Speech bubble ---------- */

let bubbleTimer = 0;

function say(text) {
  bubbleText.textContent = text;
  bubble.classList.add("is-visible");
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => bubble.classList.remove("is-visible"), 1200);
}

function hideHint() {
  hint.classList.add("is-hidden");
}

/* ---------- Head state ---------- */

const BASE_SPEED = Math.hypot(145, 115);
const head = {
  x: window.innerWidth * 0.28,
  y: window.innerHeight * 0.35,
  vx: reducedMotion.matches ? 0 : 145,
  vy: reducedMotion.matches ? 0 : 115,
  w: face.offsetWidth,
  h: face.offsetHeight,
  open: 0,
  fat: 1,
  chewStart: -Infinity,
  chewUntil: -Infinity,
};

if (reducedMotion.matches) {
  head.x = (window.innerWidth - head.w) / 2;
  head.y = (window.innerHeight - head.h) / 2;
}

window.addEventListener("resize", () => {
  if (reducedMotion.matches) {
    head.x = (window.innerWidth - head.w) / 2;
    head.y = (window.innerHeight - head.h) / 2;
  }
});

// Centre of the mouth (the lip line sits at 75.3% of the picture's height).
function mouthCenter() {
  return { x: head.x + head.w * 0.48, y: head.y + head.h * 0.745 };
}

function inEllipse(px, py, cx, cy, rx, ry) {
  const dx = (px - cx) / rx;
  const dy = (py - cy) / ry;
  return dx * dx + dy * dy <= 1;
}

/* ---------- Burgers ---------- */

const burgers = [];
const crumbs = [];
const heldByPointer = new Map();
const MAX_BURGERS = 30;

function burgerSize() {
  return (head.w / head.fat) * 0.42;
}

function spawnBurger(x, y) {
  if (burgers.length >= MAX_BURGERS) {
    removeBurger(burgers.find((b) => !b.held) ?? burgers[0]);
  }
  const el = document.createElement("div");
  const size = burgerSize();
  // Längste Seite = size, damit hohe und breite Bilder gleich groß wirken.
  const w = foodAspect <= 1 ? size : size / foodAspect;
  const h = foodAspect <= 1 ? size * foodAspect : size;
  const img = document.createElement("img");
  img.src = FOOD_IMAGE;
  img.alt = "";
  img.draggable = false;
  el.className = "burger";
  el.style.width = `${w}px`;
  el.style.height = `${h}px`;
  el.append(img);
  burgerLayer.append(el);
  const burger = {
    el,
    size,
    w,
    h,
    x,
    y,
    vx: 0,
    vy: 0,
    rot: (Math.random() - 0.5) * 30,
    spin: 0,
    held: false,
    samples: [],
  };
  burgers.push(burger);
  renderBurger(burger);
  return burger;
}

function removeBurger(burger) {
  const index = burgers.indexOf(burger);
  if (index !== -1) {
    burgers.splice(index, 1);
  }
  burger.el.remove();
  for (const [id, held] of heldByPointer) {
    if (held === burger) {
      heldByPointer.delete(id);
    }
  }
}

function renderBurger(b) {
  b.el.style.transform = `translate3d(${b.x - b.w / 2}px, ${b.y - b.h / 2}px, 0) rotate(${b.rot}deg)`;
}

// Throw from (x, y) towards where the mouth will be when the burger arrives.
function aimAtMouth(b, speed) {
  const target = mouthCenter();
  let t = Math.hypot(target.x - b.x, target.y - b.y) / speed;
  for (let i = 0; i < 3; i += 1) {
    const tx = target.x + head.vx * t;
    const ty = target.y + head.vy * t;
    t = Math.hypot(tx - b.x, ty - b.y) / speed;
  }
  const tx = Math.min(Math.max(target.x + head.vx * t, 0), window.innerWidth);
  const ty = Math.min(Math.max(target.y + head.vy * t, 0), window.innerHeight);
  const distance = Math.hypot(tx - b.x, ty - b.y) || 1;
  b.vx = ((tx - b.x) / distance) * speed;
  b.vy = ((ty - b.y) / distance) * speed;
}

function throwBurger(b, vx, vy) {
  b.held = false;
  const speed = Math.hypot(vx, vy);
  if (speed < 350) {
    // A tap (or a slow drag): lob it straight at Paul.
    aimAtMouth(b, 1100);
  } else {
    const capped = Math.min(speed, 2800) / speed;
    b.vx = vx * capped;
    b.vy = vy * capped;
  }
  b.spin = Math.max(-720, Math.min(720, b.vx * 0.5)) || 240;
  hideHint();
}

function spawnCrumbs(x, y, count) {
  for (let i = 0; i < count; i += 1) {
    const el = document.createElement("span");
    const size = 3 + Math.random() * 5;
    el.className = "crumb";
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.background = CRUMB_COLORS[Math.floor(Math.random() * CRUMB_COLORS.length)];
    burgerLayer.append(el);
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.6;
    const speed = 120 + Math.random() * 260;
    crumbs.push({
      el,
      x: x + (Math.random() - 0.5) * head.w * 0.5,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0,
      maxLife: 0.6 + Math.random() * 0.5,
    });
  }
}

const CHEW_TIME = 0.8;
const QUIPS = ["Mampf!", "Mmmh!", "Lecker!", "Mehr!", "Nom nom"];

function eat(b, now) {
  removeBurger(b);
  addPoint();
  head.chewStart = now;
  head.chewUntil = now + CHEW_TIME;
  head.fat = Math.min(1.5, head.fat + 0.05);
  const mouth = mouthCenter();
  spawnCrumbs(mouth.x, mouth.y, 12);
  munch(0.02);
  munch(0.29);
  munch(0.56);
  if (eatenCount % 5 === 0) {
    say("*Rülps*");
  } else if (Math.random() < 0.35) {
    say(QUIPS[Math.floor(Math.random() * QUIPS.length)]);
  }
}

function bonk(b, cx, cy) {
  let nx = b.x - cx;
  let ny = b.y - cy;
  const length = Math.hypot(nx, ny) || 1;
  nx /= length;
  ny /= length;
  const dot = b.vx * nx + b.vy * ny;
  if (dot >= 0) {
    return; // already moving away
  }
  b.vx = (b.vx - 2 * dot * nx) * 0.7;
  b.vy = (b.vy - 2 * dot * ny) * 0.7;
  b.spin *= -1.5;
  if (!reducedMotion.matches) {
    head.vx -= nx * Math.min(-dot, 1500) * 0.08;
    head.vy -= ny * Math.min(-dot, 1500) * 0.08;
  }
  if (Math.random() < 0.6) {
    say(Math.random() < 0.5 ? "Au!" : "In den Mund!");
  }
}

/* ---------- Input ---------- */

main.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "mouse" && event.button !== 0) {
    return;
  }
  ensureAudio();
  const b = spawnBurger(event.clientX, event.clientY);
  b.held = true;
  b.samples = [{ t: event.timeStamp, x: event.clientX, y: event.clientY }];
  heldByPointer.set(event.pointerId, b);
  try {
    main.setPointerCapture(event.pointerId);
  } catch {
    // Not supported, events still arrive while the pointer stays on the page.
  }
});

main.addEventListener("pointermove", (event) => {
  const b = heldByPointer.get(event.pointerId);
  if (!b) {
    return;
  }
  const points = event.getCoalescedEvents ? event.getCoalescedEvents() : [];
  for (const point of points.length ? points : [event]) {
    b.samples.push({ t: point.timeStamp || event.timeStamp, x: point.clientX, y: point.clientY });
  }
  b.x = event.clientX;
  b.y = event.clientY;
  const cutoff = event.timeStamp - 150;
  while (b.samples.length > 2 && b.samples[0].t < cutoff) {
    b.samples.shift();
  }
});

function release(event) {
  const b = heldByPointer.get(event.pointerId);
  heldByPointer.delete(event.pointerId);
  if (!b || !burgers.includes(b)) {
    return;
  }
  const now = event.timeStamp;
  const recent = b.samples.filter((s) => s.t >= now - 90);
  recent.push({ t: now, x: event.clientX ?? b.x, y: event.clientY ?? b.y });
  const first = recent[0];
  const last = recent[recent.length - 1];
  const dt = (last.t - first.t) / 1000;
  const vx = dt > 0.008 ? (last.x - first.x) / dt : 0;
  const vy = dt > 0.008 ? (last.y - first.y) / dt : 0;
  throwBurger(b, vx, vy);
}

main.addEventListener("pointerup", release);
main.addEventListener("pointercancel", release);

window.addEventListener("keydown", (event) => {
  if (event.repeat || (event.key !== " " && event.key !== "Enter")) {
    return;
  }
  event.preventDefault();
  ensureAudio();
  const b = spawnBurger(Math.random() * window.innerWidth, window.innerHeight + 40);
  throwBurger(b, 0, 0);
});

/* ---------- Main loop ---------- */

let previousTime = 0;

function animate(time) {
  const now = time / 1000;
  const dt = previousTime ? Math.min((time - previousTime) / 1000, 0.05) : 0;
  previousTime = time;

  // Size: Paul gets chubbier with every burger and slowly digests.
  head.fat += (1 - head.fat) * Math.min(1, dt * 0.04);
  face.style.setProperty("--fat", head.fat.toFixed(3));
  const width = face.offsetWidth;
  const height = face.offsetHeight;
  head.x -= (width - head.w) / 2;
  head.y -= (height - head.h) / 2;
  head.w = width;
  head.h = height;

  // Movement (classic screensaver bounce).
  const maxX = Math.max(0, window.innerWidth - width);
  const maxY = Math.max(0, window.innerHeight - height);
  if (reducedMotion.matches) {
    head.x = maxX / 2;
    head.y = maxY / 2;
  } else {
    const speed = Math.hypot(head.vx, head.vy) || 1;
    const relaxed = speed + (BASE_SPEED - speed) * Math.min(1, dt * 0.8);
    head.vx *= relaxed / speed;
    head.vy *= relaxed / speed;
    head.x += head.vx * dt;
    head.y += head.vy * dt;
    let bounced = false;
    if (head.x <= 0 || head.x >= maxX) {
      head.x = Math.max(0, Math.min(head.x, maxX));
      head.vx = head.x <= 0 ? Math.abs(head.vx) : -Math.abs(head.vx);
      bounced = true;
    }
    if (head.y <= 0 || head.y >= maxY) {
      head.y = Math.max(0, Math.min(head.y, maxY));
      head.vy = head.y <= 0 ? Math.abs(head.vy) : -Math.abs(head.vy);
      bounced = true;
    }
    if (bounced) {
      face.style.filter = `grayscale(1) sepia(1) saturate(6) hue-rotate(${Math.random() * 360}deg)`;
    }
  }

  // Burgers.
  const mouth = mouthCenter();
  const headCx = head.x + width * 0.5;
  const headCy = head.y + height * 0.47;
  const range = width * 2.6;
  let wantOpen = heldByPointer.size ? 0.22 + 0.06 * Math.sin(now * 18) : 0;

  for (const b of [...burgers]) {
    if (!b.held) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.rot += b.spin * dt;
    }

    const radius = b.size * 0.3;
    const eatRy = height * (0.17 + head.open * 0.12) + radius;
    if (inEllipse(b.x, b.y, mouth.x, mouth.y, width * 0.4 + radius, eatRy)) {
      eat(b, now);
      continue;
    }
    if (!b.held && inEllipse(b.x, b.y, headCx, headCy, width * 0.47 + radius, height * 0.5 + radius)) {
      bonk(b, headCx, headCy);
    }

    const dx = mouth.x - b.x;
    const dy = mouth.y - b.y;
    const distance = Math.hypot(dx, dy);
    const incoming = b.held || dx * (b.vx - head.vx) + dy * (b.vy - head.vy) > 0;
    if (incoming && distance < range) {
      wantOpen = Math.max(wantOpen, 0.3 + 0.7 * (1 - distance / range));
    }

    const margin = b.size * 2;
    if (
      !b.held &&
      (b.x < -margin || b.y < -margin || b.x > window.innerWidth + margin || b.y > window.innerHeight + margin)
    ) {
      removeBurger(b);
      continue;
    }
    renderBurger(b);
  }

  // Chewing beats everything except a fresh burger flying in.
  if (now < head.chewUntil) {
    const progress = (now - head.chewStart) / CHEW_TIME;
    wantOpen = Math.max(wantOpen * 0.5, 0.5 * Math.abs(Math.sin(progress * Math.PI * 3)));
  }
  const rate = wantOpen > head.open ? 22 : 12;
  head.open += (wantOpen - head.open) * Math.min(1, dt * rate);
  face.style.setProperty("--open", head.open.toFixed(3));
  face.style.transform = `translate3d(${head.x}px, ${head.y}px, 0)`;

  // Crumbs.
  for (let i = crumbs.length - 1; i >= 0; i -= 1) {
    const c = crumbs[i];
    c.life += dt;
    if (c.life >= c.maxLife) {
      c.el.remove();
      crumbs.splice(i, 1);
      continue;
    }
    c.vy += 900 * dt;
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    c.el.style.opacity = String(1 - c.life / c.maxLife);
    c.el.style.transform = `translate3d(${c.x}px, ${c.y}px, 0) rotate(${c.life * 600}deg)`;
  }

  bubble.style.transform = `translate3d(${headCx}px, ${head.y}px, 0)`;
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
