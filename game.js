const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const timeEl = document.querySelector("#time");
const bestEl = document.querySelector("#best");
const overlay = document.querySelector("#overlay");
const startButton = document.querySelector("#startButton");

const state = {
  running: false,
  score: 0,
  best: Number(localStorage.getItem("spaceGemBest") || 0),
  timeLeft: 45,
  lastTime: 0,
  spawnTimer: 0,
  stars: [],
  items: [],
  player: { x: 180, y: 560, radius: 24, targetX: 180 },
};

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
  state.timeLeft = 45;
  state.spawnTimer = 0;
  state.items = [];
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
}

function spawnItem(width) {
  const roll = Math.random();
  const type = roll > 0.86 ? "star" : roll > 0.64 ? "meteor" : "gem";
  state.items.push({
    type,
    x: 24 + Math.random() * (width - 48),
    y: -30,
    radius: type === "meteor" ? 22 : 18,
    speed: type === "meteor" ? 190 : 145 + Math.random() * 70,
    spin: Math.random() * Math.PI,
  });
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
  ctx.fillText(item.type === "meteor" ? "☄️" : item.type === "star" ? "⭐" : "💎", 0, 0);
  ctx.restore();
}

function endGame() {
  state.running = false;
  state.best = Math.max(state.best, Math.max(0, state.score));
  localStorage.setItem("spaceGemBest", state.best);
  updateHud();
  overlay.querySelector("h1").textContent = "結果発表！";
  overlay.querySelector("p").textContent = `スコアは ${Math.max(0, state.score)} 点！もう一回チャレンジしてベスト更新をねらおう。`;
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
    state.spawnTimer = Math.max(0.32, 0.78 - (45 - state.timeLeft) * 0.01);
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
      state.score += item.type === "meteor" ? -15 : item.type === "star" ? 25 : 10;
      state.score = Math.max(0, state.score);
      state.items.splice(i, 1);
    } else if (item.y > rect.height + 50) {
      state.items.splice(i, 1);
    }
  }

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
resize();
drawBackground(canvas.getBoundingClientRect().width, canvas.getBoundingClientRect().height, 0);
drawPlayer(state.player);
