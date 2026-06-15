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
  floats: [],
  particles: [],
  hitFlash: 0,
  keys: { left: false, right: false },
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
  state.floats = [];
  state.particles = [];
  state.hitFlash = 0;
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

  if (state.timeLeft <= 10 && state.running) {
    timeEl.style.color = "#ff4444";
    timeEl.style.textShadow = "0 0 16px rgba(255,68,68,0.9)";
    timeEl.classList.add("time-warn");
  } else {
    timeEl.style.color = "";
    timeEl.style.textShadow = "";
    timeEl.classList.remove("time-warn");
  }
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

function spawnParticles(x, y, color) {
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI * 2 * i) / 8 + Math.random() * 0.5;
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * (60 + Math.random() * 80),
      vy: Math.sin(angle) * (60 + Math.random() * 80),
      life: 1.0,
      color,
      size: 3 + Math.random() * 4,
    });
  }
}

// 奥（画面上端）で小さく、手前（プレイヤー位置）で大きくなる遠近スケール
function perspectiveScale(y, playerY) {
  const t = Math.max(0, Math.min(1, (y + 30) / (playerY + 30)));
  return 0.35 + t * 0.9;
}

function drawBackground(width, height, delta, playerX) {
  if (!state.stars.length) {
    // 3層のパララックス星空（z: 0=遠い〜1=近い）
    state.stars = Array.from({ length: 90 }, () => {
      const z = Math.random();
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        z,
        size: 0.6 + z * z * 2.6,
        speed: 14 + z * z * 95,
      };
    });
  }

  ctx.clearRect(0, 0, width, height);
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#1b3486");
  gradient.addColorStop(0.5, "#152969");
  gradient.addColorStop(1, "#060914");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // 上部の地平線グロー（奥行き感の強調）
  const glow = ctx.createRadialGradient(width / 2, -40, 20, width / 2, -40, height * 0.7);
  glow.addColorStop(0, "rgba(72, 247, 255, 0.22)");
  glow.addColorStop(1, "rgba(72, 247, 255, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  // プレイヤー位置に応じた水平パララックス（近い星ほど大きく動く）
  const parallax = ((playerX ?? width / 2) - width / 2) * 0.06;

  for (const star of state.stars) {
    star.y += star.speed * delta;
    if (star.y > height) {
      star.y = -4;
      star.x = Math.random() * width;
    }
    const px = star.x - parallax * star.z;
    ctx.globalAlpha = 0.4 + star.z * 0.55;
    ctx.fillStyle = "#ffffff";
    if (star.z > 0.6) {
      // 近い星は縦に伸ばしてスピード感のある流線に
      const len = star.size * (1.5 + star.z * 3);
      ctx.beginPath();
      ctx.ellipse(px, star.y, star.size * 0.7, len, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(px, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawPlayer(player) {
  ctx.save();
  ctx.translate(player.x, player.y);

  // 炎（機体の後ろに先に描画）
  ctx.save();
  ctx.shadowColor = "#ff8a2a";
  ctx.shadowBlur = 16;
  const flameLen = 42 + Math.random() * 12;
  const flame = ctx.createLinearGradient(0, 22, 0, flameLen);
  flame.addColorStop(0, "#fff2a8");
  flame.addColorStop(0.5, "#ff8a2a");
  flame.addColorStop(1, "rgba(255, 80, 0, 0)");
  ctx.fillStyle = flame;
  ctx.beginPath();
  ctx.moveTo(-11, 22);
  ctx.lineTo(0, flameLen);
  ctx.lineTo(11, 22);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // 機体本体：左右グラデで金属的な陰影をつける
  ctx.shadowColor = "rgba(72, 247, 255, 0.6)";
  ctx.shadowBlur = 16;
  const body = ctx.createLinearGradient(-23, 0, 23, 0);
  body.addColorStop(0, "#7f97b5");   // 暗side
  body.addColorStop(0.45, "#eef6ff");
  body.addColorStop(0.6, "#ffffff"); // ハイライト
  body.addColorStop(1, "#9fb2cc");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(0, -34);
  ctx.lineTo(23, 22);
  ctx.lineTo(0, 12);
  ctx.lineTo(-23, 22);
  ctx.closePath();
  ctx.fill();

  // 中央の明るいハイライトのスジ
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(0, -30);
  ctx.lineTo(4, 12);
  ctx.lineTo(-4, 12);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  // コックピット：ラジアルグラデのガラス球
  const glass = ctx.createRadialGradient(-3, -11, 1, 0, -8, 11);
  glass.addColorStop(0, "#d7fbff");
  glass.addColorStop(0.5, "#48f7ff");
  glass.addColorStop(1, "#0a6f86");
  ctx.fillStyle = glass;
  ctx.beginPath();
  ctx.arc(0, -8, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.arc(-3, -11, 2.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawItem(item, scale) {
  const glyph = item.type === "meteor" ? "☄️" : item.type === "star" ? "⭐" : "💎";
  const r = item.radius * scale;

  // 接地・浮遊を感じさせるキャストシャドウ（手前ほど濃く大きく）
  ctx.save();
  ctx.globalAlpha = 0.18 + (scale - 0.35) * 0.22;
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.ellipse(item.x + r * 0.35, item.y + r * 0.9, r * 0.8, r * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.rotate(item.spin);
  ctx.font = `${r * 2}px serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // 擬似押し出し（暗いコピーをズラして重ね、厚みを出す）
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.filter = "brightness(0.35)";
  ctx.fillText(glyph, r * 0.16, r * 0.16);
  ctx.restore();

  // 本体（グロー付き）
  ctx.shadowBlur = 16;
  ctx.shadowColor = item.type === "meteor" ? "#ff5b5b" : "#ffe66d";
  ctx.fillText(glyph, 0, 0);
  ctx.restore();
}

function drawFloats(delta) {
  for (let i = state.floats.length - 1; i >= 0; i--) {
    const f = state.floats[i];
    f.y -= 55 * delta;
    f.life -= delta * 1.8;
    if (f.life <= 0) {
      state.floats.splice(i, 1);
      continue;
    }
    ctx.save();
    ctx.globalAlpha = Math.min(1, f.life * 2);
    ctx.font = `bold 22px "Hiragino Sans", system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = f.color;
    ctx.shadowColor = f.color;
    ctx.shadowBlur = 10;
    ctx.fillText(f.text, f.x, f.y);
    ctx.restore();
  }
}

function drawParticles(delta) {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.x += p.vx * delta;
    p.y += p.vy * delta;
    p.vy += 140 * delta;
    p.life -= delta * 2.5;
    if (p.life <= 0) {
      state.particles.splice(i, 1);
      continue;
    }
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
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
  if (state.hitFlash > 0) state.hitFlash -= delta;

  drawBackground(rect.width, rect.height, delta, state.player.x);

  if (state.spawnTimer <= 0) {
    spawnItem(rect.width);
    state.spawnTimer = Math.max(0.32, 0.78 - (45 - state.timeLeft) * 0.01);
  }

  const keySpeed = 340;
  if (state.keys.left) state.player.targetX = Math.max(34, state.player.targetX - keySpeed * delta);
  if (state.keys.right) state.player.targetX = Math.min(rect.width - 34, state.player.targetX + keySpeed * delta);

  state.player.x += (state.player.targetX - state.player.x) * 0.28;
  drawPlayer(state.player);

  for (let i = state.items.length - 1; i >= 0; i -= 1) {
    const item = state.items[i];
    const scale = perspectiveScale(item.y, state.player.y);
    // 手前ほど速く迫る（遠近の加速感）
    item.y += item.speed * (0.55 + scale * 0.6) * delta;
    item.spin += delta * 2.5;
    drawItem(item, scale);

    const dx = item.x - state.player.x;
    const dy = item.y - state.player.y;
    const hit = Math.hypot(dx, dy) < item.radius * scale + state.player.radius;
    if (hit) {
      if (item.type === "meteor") {
        state.score -= 15;
        state.hitFlash = 0.35;
        state.floats.push({ x: item.x, y: item.y - 10, text: "-15", color: "#ff4444", life: 1.2 });
        spawnParticles(item.x, item.y, "#ff5b5b");
      } else if (item.type === "star") {
        state.score += 25;
        state.floats.push({ x: item.x, y: item.y - 10, text: "+25", color: "#ffe66d", life: 1.2 });
        spawnParticles(item.x, item.y, "#ffe66d");
      } else {
        state.score += 10;
        state.floats.push({ x: item.x, y: item.y - 10, text: "+10", color: "#48f7ff", life: 1.2 });
        spawnParticles(item.x, item.y, "#48f7ff");
      }
      state.score = Math.max(0, state.score);
      state.items.splice(i, 1);
    } else if (item.y > rect.height + 50) {
      state.items.splice(i, 1);
    }
  }

  drawParticles(delta);
  drawFloats(delta);

  if (state.hitFlash > 0) {
    ctx.save();
    ctx.globalAlpha = state.hitFlash;
    ctx.fillStyle = "#cc0000";
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.restore();
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

window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") state.keys.left = true;
  if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") state.keys.right = true;
});
window.addEventListener("keyup", (e) => {
  if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") state.keys.left = false;
  if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") state.keys.right = false;
});

startButton.addEventListener("click", resetGame);
resize();
drawBackground(canvas.getBoundingClientRect().width, canvas.getBoundingClientRect().height, 0);
drawPlayer(state.player);
