import { FISH, areaById, maxReach, zoneName } from "./data";
import { fightParams } from "./logic";
import type { AreaDef, FishDef, FishShape, SaveData } from "./types";
import {
  addTrauma,
  burst,
  nextId,
  session,
  type SwimFish,
} from "./session";

type OceanHooks = {
  getSave: () => SaveData;
  getDepth: () => number;
  onPhase: (phase: typeof session.phase) => void;
  onBiteReady: () => void;
  onReelDone: () => void;
  onFightEnd: (ok: boolean, snapped: boolean) => void;
};

const VIEW_M = 26;
let hooks: OceanHooks | null = null;
let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let raf = 0;
let last = 0;
let w = 0;
let h = 0;
let dpr = 1;
let ppm = 20;
let running = false;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function clamp(n: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, n));
}
function expLerp(cur: number, target: number, k: number, dt: number): number {
  return cur + (target - cur) * (1 - Math.exp(-k * dt));
}
function hexToRgb(hex: string): [number, number, number] {
  const n = hex.replace("#", "");
  const v = parseInt(n.length === 3 ? n.split("").map((c) => c + c).join("") : n, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
function mixHex(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const r = Math.round(lerp(A[0], B[0], t));
  const g = Math.round(lerp(A[1], B[1], t));
  const bl = Math.round(lerp(A[2], B[2], t));
  return `rgb(${r},${g},${bl})`;
}

function depthToY(depth: number): number {
  return (depth - session.cameraY) * ppm + h * 0.36;
}
function yToDepth(y: number): number {
  return session.cameraY + (y - h * 0.36) / ppm;
}

let lastArea = "";

function spawnFishForView(save: SaveData): void {
  const area = save.area;
  if (lastArea !== area) {
    session.fish = [];
    lastArea = area;
  }
  const cam = session.cameraY;
  const want = session.event === "school" ? 22 : cam > 180 ? 8 : cam > 80 ? 11 : 15;
  const pool = FISH.filter((f) => f.areas.includes(area));
  const list = pool.length ? pool : FISH;
  while (session.fish.length < want) {
    const near = list.filter((f) => depthFits(f, cam));
    const source = near.length ? near : list;
    const def = source[Math.floor(Math.random() * source.length)]!;
    const depth = clamp(
      cam + (Math.random() * VIEW_M - 4),
      2.2,
      areaById(area).maxDepth + 8,
    );
    session.fish.push(makeSwim(def, Math.random(), depth));
  }
}

function depthFits(f: FishDef, cam: number): boolean {
  const mid = (f.minDepth + f.maxDepth) / 2;
  return Math.abs(mid - cam) < 40;
}

function makeSwim(def: FishDef, x: number, depth: number): SwimFish {
  const bulky = def.shape === "whale" || def.shape === "leviathan" || def.shape === "shark" || def.shape === "octopus";
  if (bulky && depth < 8) depth = 8 + Math.random() * 12;
  depth = Math.max(2.2, depth);
  const rarityScale = 0.7 + Math.min(2.4, def.maxWeight / 12);
  const scale = depth < 7 ? Math.min(1.05, rarityScale) : rarityScale * (0.85 + Math.random() * 0.3);
  return {
    id: nextId(),
    def,
    x,
    depth,
    dir: Math.random() < 0.5 ? -1 : 1,
    speed: 0.04 + Math.random() * 0.05 + (def.shape === "tuna" ? 0.03 : 0),
    phase: Math.random() * Math.PI * 2,
    scale,
    spook: 0,
  };
}

function spawnBubbles(n: number): void {
  for (let i = 0; i < n; i++) {
    session.bubbles.push({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 1 + Math.random() * 3.5,
      v: 12 + Math.random() * 28,
      a: 0.15 + Math.random() * 0.3,
    });
  }
}

function resize(): void {
  if (!canvas || !ctx) return;
  const rect = canvas.getBoundingClientRect();
  dpr = Math.min(2, window.devicePixelRatio || 1);
  w = Math.max(1, Math.floor(rect.width));
  h = Math.max(1, Math.floor(rect.height));
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ppm = h / VIEW_M;
}

export function startOcean(el: HTMLCanvasElement, hks: OceanHooks): () => void {
  canvas = el;
  hooks = hks;
  ctx = el.getContext("2d");
  running = true;
  last = 0;
  resize();
  spawnBubbles(28);
  const ro = new ResizeObserver(() => resize());
  ro.observe(el);
  const loop = (t: number) => {
    if (!running) return;
    const now = t / 1000;
    const dt = last === 0 ? 0.016 : Math.min(0.1, now - last);
    last = now;
    update(dt);
    draw();
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  const onVis = () => {
    if (document.hidden) last = 0;
  };
  document.addEventListener("visibilitychange", onVis);
  return () => {
    running = false;
    cancelAnimationFrame(raf);
    ro.disconnect();
    document.removeEventListener("visibilitychange", onVis);
    canvas = null;
    ctx = null;
    hooks = null;
  };
}

function update(dt: number): void {
  if (!hooks) return;
  const save = hooks.getSave();
  session.time += dt;
  session.trauma = Math.max(0, session.trauma - dt * 1.6);
  session.splash = Math.max(0, session.splash - dt);
  session.zonePulse = Math.max(0, session.zonePulse - dt);

  const targetCam =
    session.phase === "idle" || session.phase === "result"
      ? 0
      : clamp(session.hookY - 6, 0, 790);
  session.cameraY = expLerp(session.cameraY, targetCam, 3.2, dt);

  const restAngle = session.phase === "casting" ? -1.15 : session.phase === "idle" ? -0.55 : -0.72;
  session.rodAngle = expLerp(session.rodAngle, restAngle, 8, dt);

  if (session.phase === "casting") {
    session.wait += dt;
    if (session.wait > 0.42) {
      session.splash = 0.5;
      session.hookY = 0.4;
      session.wait = 0;
      session.phase = "sinking";
      hooks.onPhase("sinking");
      addTrauma(0.18);
    }
  } else if (session.phase === "sinking") {
    const dist = Math.max(2, session.targetDepth);
    const spd = 18 + dist * 0.04;
    session.hookY = Math.min(session.targetDepth, session.hookY + spd * dt);
    if (session.hookY >= session.targetDepth - 0.05) {
      session.hookY = session.targetDepth;
      session.wait = 0.9 + Math.random() * 1.4 + session.targetDepth * 0.008;
      session.phase = "waiting";
      hooks.onPhase("waiting");
      session.zonePulse = 1.8;
    }
  } else if (session.phase === "waiting") {
    session.wait -= dt;
    session.hookY += Math.sin(session.time * 3.2) * 0.15 * dt;
    if (session.wait <= 0 && session.planFish) {
      const bite = makeSwim(session.planFish, session.hookX, session.hookY);
      bite.x = session.hookX + 0.18;
      bite.dir = -1;
      bite.scale = Math.max(bite.scale, 1.1);
      session.biteFish = bite;
      session.fish.push(bite);
      session.phase = "bite";
      hooks.onBiteReady();
    }
  } else if (session.phase === "bite") {
    if (session.biteFish) {
      session.biteFish.x = expLerp(session.biteFish.x, session.hookX + 0.02, 6, dt);
      session.biteFish.depth = expLerp(session.biteFish.depth, session.hookY, 6, dt);
    }
    session.hookY += Math.sin(session.time * 18) * 0.4 * dt;
  } else if (session.phase === "fighting") {
    updateFight(dt, save);
    if (session.biteFish) {
      session.biteFish.depth = session.hookY + Math.sin(session.time * 14) * 0.6;
      session.biteFish.x = session.hookX + Math.sin(session.time * 9) * 0.05;
    }
    session.hookY += Math.sin(session.time * 7) * 0.8 * dt;
  } else if (session.phase === "reeling") {
    const pull = 28 * (1 + (save ? 0 : 0));
    session.hookY = Math.max(0, session.hookY - pull * dt);
    if (session.biteFish) {
      session.biteFish.depth = session.hookY;
      session.biteFish.x = session.hookX;
    }
    if (session.hookY <= 0.4) {
      session.hookY = 0;
      session.phase = "result";
      hooks.onReelDone();
    }
  }

  spawnFishForView(save);
  const area = areaById(save.area);
  for (const f of session.fish) {
    f.x += f.dir * f.speed * dt * (f.spook > 0 ? 3 : 1);
    f.depth += Math.sin(session.time * 1.4 + f.phase) * 0.35 * dt;
    f.spook = Math.max(0, f.spook - dt);
    if (f.x < -0.15 || f.x > 1.15) {
      f.dir *= -1;
      f.x = clamp(f.x, -0.14, 1.14);
    }
    if (f.depth < 0.4) f.depth = 0.4;
    if (f.depth > area.maxDepth + 12) f.depth = area.maxDepth + 12;
  }
  if (session.fish.length > 28) session.fish.splice(0, session.fish.length - 22);

  if (session.bubbles.length < 36) spawnBubbles(4);
  for (const b of session.bubbles) {
    b.y -= b.v * dt;
    b.x += Math.sin(session.time * 2 + b.r) * 8 * dt;
    if (b.y < -8) {
      b.y = h + 10;
      b.x = Math.random() * w;
    }
  }
  for (let i = session.particles.length - 1; i >= 0; i--) {
    const p = session.particles[i]!;
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 40 * dt;
    if (p.life <= 0) session.particles.splice(i, 1);
  }
}

function updateFight(dt: number, save: SaveData): void {
  if (!hooks || !session.planFish) return;
  const f = session.fight;
  const p = fightParams(
    save,
    session.planFish,
    session.result?.weight ?? session.planFish.maxWeight * 0.6,
  );
  if (f.surge > 0) {
    f.surge -= dt;
    f.line += 38 * dt;
    f.fish -= p.drain * 0.25 * dt;
  } else if (Math.random() < p.surgeChance * dt) {
    f.surge = 0.45 + Math.random() * 0.5;
    addTrauma(0.22);
  }
  if (f.holding) {
    f.line += p.tensionGain * dt;
    f.fish -= p.drain * dt * (f.line > 78 ? 0.55 : 1);
  } else {
    f.line -= p.tensionDrop * dt;
    f.escape += dt * (f.line < p.escapeAt ? 1.6 : 0.15);
    f.fish += 1.8 * dt;
  }
  f.line = clamp(f.line, 0, p.snapAt + 10);
  f.fish = clamp(f.fish, 0, 100);
  if (f.line >= p.snapAt) {
    session.phase = "result";
    hooks.onFightEnd(false, true);
    return;
  }
  if (f.escape > 2.4) {
    session.phase = "result";
    hooks.onFightEnd(false, false);
    return;
  }
  if (f.fish <= 0) {
    session.phase = "reeling";
    hooks.onPhase("reeling");
  }
}

function draw(): void {
  if (!ctx || !hooks) return;
  const save = hooks.getSave();
  const area = areaById(save.area);
  const c = ctx;
  const shake = save.settings.shake ? session.trauma * session.trauma * 10 : 0;
  const sx = shake ? (Math.random() * 2 - 1) * shake : 0;
  const sy = shake ? (Math.random() * 2 - 1) * shake : 0;
  c.save();
  c.translate(sx, sy);
  drawSkyAndWater(c, area, save);
  drawCaustics(c);
  drawGodRays(c);
  drawFlora(c, area);
  drawDepthMarks(c, save);
  drawAmbientFish(c);
  drawBoatAndLine(c, save);
  drawBubbles(c);
  drawParticles(c);
  drawFog(c, save);
  c.restore();
}

function drawSkyAndWater(c: CanvasRenderingContext2D, area: AreaDef, save: SaveData): void {
  const waterY = depthToY(0);
  const skyH = Math.max(0, waterY);
  if (skyH > 0) {
    const g = c.createLinearGradient(0, 0, 0, skyH);
    g.addColorStop(0, area.skyTop);
    g.addColorStop(1, area.skyBot);
    c.fillStyle = g;
    c.fillRect(0, 0, w, skyH + 2);
    c.fillStyle = "rgba(255,240,180,0.9)";
    c.beginPath();
    c.arc(w * 0.82, Math.min(skyH * 0.35, 46), 22, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "rgba(255,255,255,0.78)";
    drawCloud(c, w * 0.18, skyH * 0.28, 1);
    drawCloud(c, w * 0.48, skyH * 0.18, 0.75);
  }
  const bot = h;
  const topC = mixHex(area.waterTop, "#021018", clamp(session.cameraY / 220, 0, 0.85));
  const botC = mixHex(area.waterBot, "#01060a", clamp(session.cameraY / 180, 0, 0.92));
  const wg = c.createLinearGradient(0, waterY, 0, bot);
  wg.addColorStop(0, topC);
  wg.addColorStop(1, botC);
  c.fillStyle = wg;
  c.fillRect(0, Math.max(0, waterY), w, h - Math.max(0, waterY) + 4);

  c.beginPath();
  c.moveTo(0, waterY);
  for (let x = 0; x <= w; x += 8) {
    const y =
      waterY +
      Math.sin(x * 0.03 + session.time * 1.6) * 3.2 +
      Math.sin(x * 0.011 + session.time * 0.7) * 2;
    c.lineTo(x, y);
  }
  c.strokeStyle = "rgba(255,255,255,0.45)";
  c.lineWidth = 2;
  c.stroke();

  if (session.splash > 0 && waterY > 0 && waterY < h) {
    c.fillStyle = `rgba(255,255,255,${session.splash})`;
    c.beginPath();
    c.ellipse(w * session.hookX, waterY, 28 * session.splash, 10, 0, 0, Math.PI * 2);
    c.fill();
  }
  void save;
}

function drawCloud(c: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.beginPath();
  c.arc(0, 0, 16, 0, Math.PI * 2);
  c.arc(18, 2, 14, 0, Math.PI * 2);
  c.arc(-16, 4, 12, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

function drawCaustics(c: CanvasRenderingContext2D): void {
  const waterY = depthToY(0);
  c.save();
  c.globalAlpha = 0.07;
  c.strokeStyle = "#c8fff8";
  c.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    c.beginPath();
    const y0 = waterY + 30 + i * 48 + Math.sin(session.time * 0.8 + i) * 10;
    for (let x = 0; x <= w; x += 10) {
      const y = y0 + Math.sin(x * 0.02 + session.time * 1.4 + i) * 8;
      if (x === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();
  }
  c.restore();
}

function drawGodRays(c: CanvasRenderingContext2D): void {
  const waterY = depthToY(0);
  if (session.cameraY > 90) return;
  c.save();
  c.globalCompositeOperation = "lighter";
  for (let i = 0; i < 4; i++) {
    const x = w * (0.15 + i * 0.2) + Math.sin(session.time * 0.3 + i) * 18;
    const g = c.createLinearGradient(x, waterY, x + 40, h);
    g.addColorStop(0, "rgba(180,230,255,0.16)");
    g.addColorStop(1, "rgba(180,230,255,0)");
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(x, Math.max(waterY, 0));
    c.lineTo(x + 36, Math.max(waterY, 0));
    c.lineTo(x + 90, h);
    c.lineTo(x - 20, h);
    c.closePath();
    c.fill();
  }
  c.restore();
}

function drawFlora(c: CanvasRenderingContext2D, area: AreaDef): void {
  const t = session.time;
  for (let i = 0; i < 7; i++) {
    const x = ((i * 73 + 20) % (w + 40)) - 10;
    const baseDepth = 8 + (i % 5) * 6;
    const y = depthToY(baseDepth);
    if (y < -40 || y > h + 40) continue;
    c.strokeStyle = i % 2 ? "#1e7a5a" : "#2a9a68";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(x, y + 50);
    for (let k = 0; k <= 6; k++) {
      const px = x + Math.sin(t * 1.3 + i + k * 0.4) * (6 + k);
      const py = y + 50 - k * 12;
      c.lineTo(px, py);
    }
    c.stroke();
  }
  if (area.id === "reef" || area.id === "beach") {
    for (let i = 0; i < 5; i++) {
      const x = 30 + i * (w / 5);
      const y = depthToY(6 + i * 3);
      if (y < 0 || y > h) continue;
      c.fillStyle = i % 2 ? "#e07070" : "#e0a040";
      c.beginPath();
      c.moveTo(x, y + 18);
      c.quadraticCurveTo(x - 12, y, x, y - 16);
      c.quadraticCurveTo(x + 12, y, x, y + 18);
      c.fill();
    }
  }
  if (session.cameraY > 140) {
    for (let i = 0; i < 12; i++) {
      const x = (i * 97 + session.time * 8) % w;
      const y = (i * 53 + session.time * 12) % h;
      c.fillStyle = `rgba(120,220,255,${0.15 + Math.sin(session.time + i) * 0.1})`;
      c.beginPath();
      c.arc(x, y, 1.4, 0, Math.PI * 2);
      c.fill();
    }
  }
}

function drawDepthMarks(c: CanvasRenderingContext2D, save: SaveData): void {
  const reach = maxReach(save.rod, save.line);
  c.font = "600 10px Nunito, sans-serif";
  c.textAlign = "right";
  const start = Math.floor(session.cameraY / 10) * 10;
  for (let d = start; d < session.cameraY + VIEW_M + 10; d += 10) {
    if (d <= 0) continue;
    const y = depthToY(d);
    if (y < 12 || y > h - 12) continue;
    c.fillStyle = d > reach ? "rgba(255,120,100,0.55)" : "rgba(255,255,255,0.35)";
    c.fillRect(w - 18, y, 14, 1);
    c.fillText(d + "m", w - 20, y + 3);
  }
  if (session.zonePulse > 0) {
    c.globalAlpha = Math.min(1, session.zonePulse);
    c.fillStyle = "rgba(232,246,250,0.9)";
    c.font = "700 13px Fredoka, sans-serif";
    c.textAlign = "center";
    c.fillText(zoneName(session.hookY), w / 2, 28);
    c.globalAlpha = 1;
  }
}

function drawAmbientFish(c: CanvasRenderingContext2D): void {
  const waterY = depthToY(0);
  for (const f of session.fish) {
    const px = f.x * w;
    const py = depthToY(f.depth);
    if (py < waterY + 8 || py > h + 30) continue;
    drawFishShape(c, f, px, py);
  }
}

function drawBoatAndLine(c: CanvasRenderingContext2D, save: SaveData): void {
  const waterY = depthToY(0);
  const bob = Math.sin(session.time * 1.5) * 2.4;
  const bx = w * 0.36;
  const by = waterY + bob;
  const rod = save.rod;
  const rodColor =
    rod === "wood"
      ? "#b07a3a"
      : rod === "bamboo"
        ? "#c4d36a"
        : rod === "legend"
          ? "#e2b93a"
          : rod === "mythic"
            ? "#e85d8a"
            : rod === "abyss"
              ? "#2ec4b6"
              : "#8aa4b4";

  if (waterY > -40 && waterY < h + 60) {
    c.fillStyle = "#6a3a18";
    c.beginPath();
    c.moveTo(bx - 52, by);
    c.quadraticCurveTo(bx, by + 28, bx + 58, by);
    c.lineTo(bx + 48, by - 10);
    c.lineTo(bx - 42, by - 10);
    c.closePath();
    c.fill();
    c.fillStyle = "#c4783a";
    c.fillRect(bx - 38, by - 16, 78, 8);
    c.fillStyle = "#f0d8b0";
    c.beginPath();
    c.arc(bx - 6, by - 28, 7, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#e85d4c";
    c.beginPath();
    c.ellipse(bx - 6, by - 36, 8, 4, -0.2, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#2a6a88";
    c.fillRect(bx - 12, by - 22, 14, 12);
    c.strokeStyle = rodColor;
    c.lineWidth = 3;
    c.lineCap = "round";
    const ang = session.rodAngle;
    const tipX = bx + 4 + Math.cos(ang) * 54;
    const tipY = by - 20 + Math.sin(ang) * 54;
    c.beginPath();
    c.moveTo(bx + 4, by - 20);
    c.lineTo(tipX, tipY);
    c.stroke();

    const hx = w * session.hookX;
    const hy = depthToY(session.hookY);
    c.strokeStyle = "rgba(230,250,255,0.55)";
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(tipX, tipY);
    const midY = (tipY + hy) / 2;
    c.quadraticCurveTo(hx + Math.sin(session.time * 2) * 10, midY, hx, hy);
    c.stroke();
    drawHook(c, hx, hy);
  } else {
    const hx = w * session.hookX;
    const hy = depthToY(session.hookY);
    c.strokeStyle = "rgba(230,250,255,0.45)";
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(hx, 0);
    c.lineTo(hx, hy);
    c.stroke();
    drawHook(c, hx, hy);
  }
}

function drawHook(c: CanvasRenderingContext2D, x: number, y: number): void {
  c.strokeStyle = "#d8e4ea";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(x, y - 8);
  c.lineTo(x, y + 6);
  c.arc(x - 4, y + 6, 4, 0, Math.PI * 1.15);
  c.stroke();
  c.fillStyle = "#e85d4c";
  c.beginPath();
  c.arc(x - 1, y + 2, 2.4, 0, Math.PI * 2);
  c.fill();
}

function drawBubbles(c: CanvasRenderingContext2D): void {
  for (const b of session.bubbles) {
    if (depthToY(0) > b.y + 20 && session.cameraY < 1) continue;
    c.strokeStyle = `rgba(220,250,255,${b.a})`;
    c.lineWidth = 1;
    c.beginPath();
    c.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    c.stroke();
  }
}

function drawParticles(c: CanvasRenderingContext2D): void {
  for (const p of session.particles) {
    c.globalAlpha = clamp(p.life / p.max, 0, 1);
    c.fillStyle = p.color;
    c.beginPath();
    c.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    c.fill();
  }
  c.globalAlpha = 1;
}

function drawFog(c: CanvasRenderingContext2D, save: SaveData): void {
  const reach = maxReach(save.rod, save.line);
  const y = depthToY(reach + 6);
  if (y > h) return;
  const g = c.createLinearGradient(0, y, 0, h);
  g.addColorStop(0, "rgba(2,8,14,0)");
  g.addColorStop(0.35, "rgba(2,8,14,0.55)");
  g.addColorStop(1, "rgba(1,4,8,0.92)");
  c.fillStyle = g;
  c.fillRect(0, Math.max(0, y), w, h);
  c.fillStyle = "rgba(255,255,255,0.28)";
  c.font = "600 11px Nunito, sans-serif";
  c.textAlign = "center";
  if (y < h - 40) {
    c.fillText("Sua vara não alcança o que vive aqui", w / 2, Math.min(h - 24, y + 48));
  }
}

function drawFishShape(c: CanvasRenderingContext2D, f: SwimFish, x: number, y: number): void {
  const def = f.def;
  const t = session.time;
  c.save();
  c.translate(x, y);
  c.scale(f.dir * f.scale, f.scale);
  const wag = Math.sin(t * (6 + f.speed * 20) + f.phase);
  c.rotate(wag * 0.14);
  if (def.glow) {
    c.shadowColor = def.glow;
    c.shadowBlur = 16;
  }
  paint(c, def, wag);
  c.restore();
}

function paint(c: CanvasRenderingContext2D, def: FishDef, wag: number): void {
  const shape: FishShape = def.shape;
  switch (shape) {
    case "eel":
    case "dragon":
    case "leviathan":
      paintEel(c, def, wag, shape === "leviathan" ? 1.6 : shape === "dragon" ? 1.3 : 1);
      break;
    case "shark":
      paintShark(c, def);
      break;
    case "squid":
      paintSquid(c, def, wag);
      break;
    case "octopus":
      paintOctopus(c, def, wag);
      break;
    case "ray":
      paintRay(c, def, wag);
      break;
    case "jellyfish":
      paintJelly(c, def, wag);
      break;
    case "seahorse":
      paintSeahorse(c, def);
      break;
    case "crab":
      paintCrab(c, def, wag);
      break;
    case "angler":
      paintAngler(c, def);
      break;
    case "puffer":
      paintPuffer(c, def);
      break;
    case "whale":
      paintWhale(c, def);
      break;
    default:
      paintClassic(c, def, wag, shape);
  }
}

function paintClassic(
  c: CanvasRenderingContext2D,
  def: FishDef,
  wag: number,
  shape: FishShape,
): void {
  const long = shape === "tuna" || shape === "marlin" || shape === "swordfish" || shape === "sardine";
  const bw = long ? 22 : 16;
  const bh = shape === "round" || shape === "clown" ? 12 : 8;
  c.fillStyle = def.fin;
  c.beginPath();
  c.moveTo(-bw * 0.2, 0);
  c.lineTo(-bw - 6, wag * 5);
  c.lineTo(-bw * 0.2, 4);
  c.closePath();
  c.fill();
  const g = c.createLinearGradient(-bw, 0, bw, 0);
  g.addColorStop(0, def.body);
  g.addColorStop(1, def.belly);
  c.fillStyle = g;
  c.beginPath();
  c.ellipse(0, 0, bw, bh, 0, 0, Math.PI * 2);
  c.fill();
  if (def.pattern === "stripe" || def.pattern === "band") {
    c.strokeStyle = def.accent;
    c.lineWidth = shape === "clown" ? 3 : 1.4;
    c.beginPath();
    c.moveTo(-6, -bh);
    c.lineTo(-6, bh);
    c.moveTo(4, -bh * 0.8);
    c.lineTo(4, bh * 0.8);
    c.stroke();
  }
  if (def.pattern === "spot") {
    c.fillStyle = def.accent;
    c.beginPath();
    c.arc(-4, -2, 1.6, 0, Math.PI * 2);
    c.arc(3, 2, 1.3, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = def.fin;
  c.beginPath();
  c.moveTo(-2, -bh);
  c.lineTo(4, -bh - 7);
  c.lineTo(6, -bh + 1);
  c.fill();
  if (shape === "marlin" || shape === "swordfish") {
    c.strokeStyle = def.accent;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(bw - 2, -1);
    c.lineTo(bw + 16, -3);
    c.stroke();
  }
  eye(c, bw * 0.45, -2, 2.1);
}

function paintShark(c: CanvasRenderingContext2D, def: FishDef): void {
  const g = c.createLinearGradient(-24, 0, 26, 0);
  g.addColorStop(0, def.body);
  g.addColorStop(1, def.belly);
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(28, 0);
  c.quadraticCurveTo(10, -12, -16, -6);
  c.lineTo(-28, -10);
  c.lineTo(-20, 0);
  c.lineTo(-28, 8);
  c.lineTo(-16, 6);
  c.quadraticCurveTo(10, 10, 28, 0);
  c.fill();
  c.fillStyle = def.fin;
  c.beginPath();
  c.moveTo(-2, -8);
  c.lineTo(4, -20);
  c.lineTo(8, -7);
  c.fill();
  eye(c, 16, -3, 2);
}

function paintEel(c: CanvasRenderingContext2D, def: FishDef, wag: number, s: number): void {
  c.save();
  c.scale(s, s);
  c.strokeStyle = def.body;
  c.lineWidth = 7;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(-28, wag * 3);
  c.quadraticCurveTo(-8, -8, 4, 0);
  c.quadraticCurveTo(16, 8, 26, -2);
  c.stroke();
  c.strokeStyle = def.belly;
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(-26, wag * 3 + 2);
  c.quadraticCurveTo(-8, -4, 22, 1);
  c.stroke();
  if (def.glow) {
    c.fillStyle = def.accent;
    c.beginPath();
    c.arc(18, -2, 2, 0, Math.PI * 2);
    c.fill();
  }
  eye(c, 22, -3, 1.6);
  c.restore();
}

function paintSquid(c: CanvasRenderingContext2D, def: FishDef, wag: number): void {
  c.fillStyle = def.body;
  c.beginPath();
  c.ellipse(4, 0, 10, 7, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = def.belly;
  c.beginPath();
  c.ellipse(8, 1, 5, 4, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = def.fin;
  c.lineWidth = 1.6;
  for (let i = 0; i < 6; i++) {
    c.beginPath();
    c.moveTo(-4, (i - 2.5) * 2);
    c.quadraticCurveTo(-16, (i - 2.5) * 3 + wag * 4, -24, (i - 2.5) * 4);
    c.stroke();
  }
  eye(c, 8, -2, 2);
}

function paintOctopus(c: CanvasRenderingContext2D, def: FishDef, wag: number): void {
  c.fillStyle = def.body;
  c.beginPath();
  c.arc(4, -2, 10, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = def.fin;
  c.lineWidth = 2.2;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI + 0.2;
    c.beginPath();
    c.moveTo(4, 4);
    c.quadraticCurveTo(
      4 + Math.cos(a) * 12,
      10 + wag * 3,
      4 + Math.cos(a) * 20,
      18 + Math.sin(session.time * 3 + i) * 4,
    );
    c.stroke();
  }
  eye(c, 0, -4, 2);
  eye(c, 8, -4, 2);
}

function paintRay(c: CanvasRenderingContext2D, def: FishDef, wag: number): void {
  c.fillStyle = def.body;
  c.beginPath();
  c.moveTo(16, 0);
  c.lineTo(0, -12 - wag * 3);
  c.lineTo(-18, 0);
  c.lineTo(0, 12 + wag * 3);
  c.closePath();
  c.fill();
  c.fillStyle = def.belly;
  c.beginPath();
  c.ellipse(2, 0, 8, 5, 0, 0, Math.PI * 2);
  c.fill();
  eye(c, 8, -2, 1.6);
}

function paintJelly(c: CanvasRenderingContext2D, def: FishDef, wag: number): void {
  c.fillStyle = def.body;
  c.globalAlpha = 0.85;
  c.beginPath();
  c.ellipse(0, 0, 12, 8, 0, Math.PI, 0);
  c.fill();
  c.globalAlpha = 1;
  c.strokeStyle = def.accent;
  c.lineWidth = 1.2;
  for (let i = 0; i < 5; i++) {
    c.beginPath();
    c.moveTo(-8 + i * 4, 2);
    c.quadraticCurveTo(-8 + i * 4 + wag * 3, 14, -8 + i * 4, 22);
    c.stroke();
  }
}

function paintSeahorse(c: CanvasRenderingContext2D, def: FishDef): void {
  c.strokeStyle = def.body;
  c.lineWidth = 4;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(0, 12);
  c.quadraticCurveTo(-8, 6, 0, 0);
  c.quadraticCurveTo(8, -8, 2, -12);
  c.stroke();
  c.fillStyle = def.body;
  c.beginPath();
  c.arc(2, -14, 4, 0, Math.PI * 2);
  c.fill();
  eye(c, 3, -15, 1.4);
}

function paintCrab(c: CanvasRenderingContext2D, def: FishDef, wag: number): void {
  c.fillStyle = def.body;
  c.beginPath();
  c.ellipse(0, 0, 10, 6, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = def.fin;
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(-10, -2);
  c.lineTo(-16, -6 + wag);
  c.moveTo(10, -2);
  c.lineTo(16, -6 - wag);
  c.stroke();
  eye(c, -3, -4, 1.5);
  eye(c, 3, -4, 1.5);
}

function paintAngler(c: CanvasRenderingContext2D, def: FishDef): void {
  c.fillStyle = def.body;
  c.beginPath();
  c.ellipse(0, 2, 14, 10, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = def.accent;
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(6, -8);
  c.quadraticCurveTo(14, -18, 18, -8);
  c.stroke();
  c.fillStyle = def.glow ?? "#ffe080";
  c.beginPath();
  c.arc(18, -8, 3, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#1a1010";
  c.beginPath();
  c.moveTo(-2, 4);
  c.lineTo(10, 6);
  c.lineTo(-2, 8);
  c.fill();
  eye(c, 6, -2, 2.2);
}

function paintPuffer(c: CanvasRenderingContext2D, def: FishDef): void {
  c.fillStyle = def.body;
  c.beginPath();
  c.arc(0, 0, 12, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = def.accent;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    c.beginPath();
    c.moveTo(Math.cos(a) * 12, Math.sin(a) * 12);
    c.lineTo(Math.cos(a) * 16, Math.sin(a) * 16);
    c.stroke();
  }
  eye(c, 4, -3, 2);
}

function paintWhale(c: CanvasRenderingContext2D, def: FishDef): void {
  const g = c.createLinearGradient(-36, 0, 36, 0);
  g.addColorStop(0, def.body);
  g.addColorStop(1, def.belly);
  c.fillStyle = g;
  c.beginPath();
  c.ellipse(0, 0, 34, 14, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = def.fin;
  c.beginPath();
  c.moveTo(-30, 0);
  c.lineTo(-44, -10);
  c.lineTo(-44, 10);
  c.fill();
  eye(c, 20, -4, 2.4);
}

function eye(c: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  c.shadowBlur = 0;
  c.fillStyle = "#f4f8fa";
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#102028";
  c.beginPath();
  c.arc(x + r * 0.25, y, r * 0.5, 0, Math.PI * 2);
  c.fill();
}

export function beginCast(depth: number, fish: FishDef, event: typeof session.event): void {
  session.phase = "casting";
  session.targetDepth = depth;
  session.hookY = 0;
  session.wait = 0;
  session.planFish = fish;
  session.event = event;
  session.rodAngle = -0.2;
  session.quality = null;
  session.result = null;
  session.fight = { fish: 100, line: 38 + Math.random() * 10, holding: false, surge: 0, escape: 0 };
  addTrauma(0.12);
}

export function attachBurst(): void {
  const x = (canvas ? canvas.getBoundingClientRect().width : 300) * session.hookX;
  const y = depthToY(session.hookY);
  burst(x, y, session.planFish?.glow ?? "#e8f6fa", 18, 90);
}

export function worldSize(): { w: number; h: number } {
  return { w, h };
}
