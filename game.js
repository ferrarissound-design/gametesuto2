const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const timeEl = document.querySelector("#time");
const bestEl = document.querySelector("#best");
const comboEl = document.querySelector("#combo");
const overlay = document.querySelector("#overlay");
const startButton = document.querySelector("#startButton");
const soundButton = document.querySelector("#soundButton");

const state = {
  running: false,
  soundOn: false,
  score: 0,
  combo: 1,
  streak: 0,
  shield: 0,
  best: Number(localStorage.getItem("spaceGemBest") || 0),
  timeLeft: 45,
  lastTime: 0,
  spawnTimer: 0,
  stars: [],
  items: [],
  particles: [],
  player: { x: 180, y: 560, radius: 24, targetX: 180 },
};

let audioContext;
bestEl.textContent = state.best;

function resize() {
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * ratio);
  canvas.height = Math.floor(rect.height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  state.player.y = rect.height - 78;
  state.player.x = Math.min(state.player.x, rect.width - 35);
  state.player.targetX = state.player.x;
}

function resetGame() {
  const width = canvas.getBoundingClientRect().width;
  state.running = true;
  state.score = 0;
  state.combo = 1;
  state.streak = 0;
  state.shield = 0;
  state.timeLeft = 45;
  state.spawnTimer = 0;
  state.items = [];
  state.particles = [];
  state.player.x = width / 2;
  state.player.targetX = width / 2;
  state.lastTime = performance.now();
  overlay.classList.add("hidden");
  updateHud();
  requestAnimationFrame(loop);
}

function updateHud() {
  scoreEl.textContent = Math.max(0, state.score);
  timeEl.textContent = Math.ceil(state.timeLeft);
  bestEl.textContent = state.best;
  comboEl.textContent = state.shield ? `🛡️x${state.combo}` : `x${state.combo}`;
}

function playTone(frequency, duration = 0.08, type = "sine") {
  if (!state.soundOn) return;
  audioContext ??= new AudioContext();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.05, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

function spawnItem(width) {
  const elapsed = 45 - state.timeLeft;
  const roll = Math.random();
  const type = roll > 0.93 ? "shield" : roll > 0.84 ? "star" : roll > 0.61 ? "meteor" : "gem";
  state.items.push({
    type,
    x: 24 + Math.random() * (width - 48),
    y: -30,
    radius: type === "meteor" ? 22 : 18,
    speed: (type === "meteor" ? 190 : 145 + Math.random() * 70) + elapsed * 3.2,
    spin: Math.random() * Math.PI,
  });
}

function burst(x, y, color, count = 10) {
  for (let i = 0; i < count; i += 1) {
    state.particles.push({
      x,
      y,
      color,
      life: 0.45,
      vx: (Math.random() - 0.5) * 190,
      vy: (Math.random() - 0.8) * 190,
    });
  }
}

function drawBackground(width, height, delta) {
  if (!state.stars.length) {
    state.stars = Array.from({ length: 70 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: 1 + Math.random() * 2.4,
      speed: 15 + Math.random() * 42,
    }));
  }

  ctx.clearRect(0, 0, width, height);
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#152969");
  gradient.addColorStop(1, "#060914");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(255,255,255,0.85)";
  for (const star of state.stars) {
    star.y += star.speed * delta;
    if (star.y > height) {
      star.y = -4;
      star.x = Math.random() * width;
    }
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlayer(player) {
  ctx.save();
  ctx.translate(player.x, player.y);
  if (state.shield) {
    ctx.strokeStyle = "rgba(72, 247, 255, 0.8)";
    ctx.lineWidth = 4;
    ctx.shadowColor = "#48f7ff";
    ctx.shadowBlur = 22;
    ctx.beginPath();
    ctx.arc(0, 0, 40, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.shadowColor = "#48f7ff";
  ctx.shadowBlur = 18;
  ctx.fillStyle = "#f5fbff";
  ctx.beginPath();
  ctx.moveTo(0, -34);
  ctx.lineTo(23, 22);
  ctx.lineTo(0, 12);
  ctx.lineTo(-23, 22);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#48f7ff";
  ctx.beginPath();
  ctx.arc(0, -8, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ff8a2a";
  ctx.beginPath();
  ctx.moveTo(-10, 23);
  ctx.lineTo(0, 42 + Math.random() * 10);
  ctx.lineTo(10, 23);
  ctx.fill();
  ctx.restore();
}

function drawItem(item) {
  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.rotate(item.spin);
  ctx.font = `${item.radius * 2}px serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowBlur = 14;
  ctx.shadowColor = item.type === "meteor" ? "#ff5b5b" : "#ffe66d";
  const icons = { meteor: "☄️", star: "⭐", shield: "🛡️", gem: "💎" };
  ctx.fillText(icons[item.type], 0, 0);
  ctx.restore();
}

function drawParticles(delta) {
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const particle = state.particles[i];
    particle.life -= delta;
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    particle.vy += 260 * delta;
    if (particle.life <= 0) {
      state.particles.splice(i, 1);
      continue;
    }
    ctx.globalAlpha = Math.max(0, particle.life / 0.45);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function collectItem(item) {
  if (item.type === "meteor") {
    if (state.shield) {
      state.shield = 0;
      burst(item.x, item.y, "#48f7ff", 18);
      playTone(160, 0.12, "sawtooth");
      return;
    }
    state.score = Math.max(0, state.score - 15);
    state.combo = 1;
    state.streak = 0;
    burst(item.x, item.y, "#ff5b5b", 12);
    playTone(120, 0.12, "square");
    return;
  }

  if (item.type === "shield") {
    state.shield = 1;
    state.streak += 1;
    burst(item.x, item.y, "#48f7ff", 14);
    playTone(620, 0.1, "triangle");
    return;
  }

  state.streak += 1;
  state.combo = Math.min(5, 1 + Math.floor(state.streak / 5));
  state.score += (item.type === "star" ? 25 : 10) * state.combo;
  burst(item.x, item.y, item.type === "star" ? "#ffe66d" : "#ff4fd8", 12 + state.combo);
  playTone(item.type === "star" ? 880 : 520, 0.08, "sine");
}

function endGame() {
  state.running = false;
  state.best = Math.max(state.best, Math.max(0, state.score));
  localStorage.setItem("spaceGemBest", state.best);
  updateHud();
  overlay.querySelector("h1").textContent = "結果発表！";
  overlay.querySelector("p").textContent = `スコアは ${Math.max(0, state.score)} 点！コンボとシールドを使って、次はもっと高得点をねらおう。`;
  startButton.textContent = "もう一度あそぶ";
  overlay.classList.remove("hidden");
}

function loop(now) {
  if (!state.running) return;
  const rect = canvas.getBoundingClientRect();
  const delta = Math.min((now - state.lastTime) / 1000, 0.033);
  state.lastTime = now;
  state.timeLeft -= delta;
  state.spawnTimer -= delta;

  drawBackground(rect.width, rect.height, delta);

  if (state.spawnTimer <= 0) {
    spawnItem(rect.width);
    state.spawnTimer = Math.max(0.26, 0.78 - (45 - state.timeLeft) * 0.012);
  }

  state.player.x += (state.player.targetX - state.player.x) * 0.22;
  drawPlayer(state.player);

  for (let i = state.items.length - 1; i >= 0; i -= 1) {
    const item = state.items[i];
    item.y += item.speed * delta;
    item.spin += delta * 2.5;
    drawItem(item);

    const dx = item.x - state.player.x;
    const dy = item.y - state.player.y;
    const hit = Math.hypot(dx, dy) < item.radius + state.player.radius;
    if (hit) {
      collectItem(item);
      state.items.splice(i, 1);
    } else if (item.y > rect.height + 50) {
      if (item.type !== "meteor") {
        state.combo = 1;
        state.streak = 0;
      }
      state.items.splice(i, 1);
    }
  }

  drawParticles(delta);
  updateHud();
  if (state.timeLeft <= 0) {
    endGame();
    return;
  }
  requestAnimationFrame(loop);
}

function movePlayer(clientX) {
  const rect = canvas.getBoundingClientRect();
  state.player.targetX = Math.max(34, Math.min(rect.width - 34, clientX - rect.left));
}

window.addEventListener("resize", resize);
canvas.addEventListener("pointerdown", (event) => movePlayer(event.clientX));
canvas.addEventListener("pointermove", (event) => {
  if (event.pressure > 0 || event.buttons) movePlayer(event.clientX);
});
startButton.addEventListener("click", resetGame);
soundButton.addEventListener("click", () => {
  state.soundOn = !state.soundOn;
  soundButton.setAttribute("aria-pressed", String(state.soundOn));
  soundButton.textContent = state.soundOn ? "🔊 効果音オン" : "🔈 効果音";
  playTone(660, 0.06, "triangle");
});
resize();
drawBackground(canvas.getBoundingClientRect().width, canvas.getBoundingClientRect().height, 0);
drawPlayer(state.player);
