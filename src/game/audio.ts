type Bus = { master: GainNode; music: GainNode; sfx: GainNode };

let ctx: AudioContext | null = null;
let bus: Bus | null = null;
let unlocked = false;
let musicTimer: number | null = null;
let musicOn = true;
let sfxOn = true;
let muted = false;

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC({ latencyHint: "interactive" });
    const master = ctx.createGain();
    const music = ctx.createGain();
    const sfx = ctx.createGain();
    music.gain.value = 0.22;
    sfx.gain.value = 0.55;
    master.gain.value = 0.85;
    music.connect(master);
    sfx.connect(master);
    master.connect(ctx.destination);
    bus = { master, music, sfx };
  }
  return ctx;
}

export function unlockAudio(): void {
  const c = ensure();
  if (!c) return;
  if (c.state === "suspended") void c.resume();
  unlocked = true;
  if (musicOn && !muted) startMusic();
}

export function setAudioPrefs(p: { muted?: boolean; music?: boolean; sfx?: boolean }): void {
  if (p.muted !== undefined) muted = p.muted;
  if (p.music !== undefined) musicOn = p.music;
  if (p.sfx !== undefined) sfxOn = p.sfx;
  if (!bus || !ctx) return;
  const t = ctx.currentTime;
  bus.master.gain.setTargetAtTime(muted ? 0 : 0.85, t, 0.04);
  if (muted || !musicOn) stopMusic();
  else if (unlocked) startMusic();
}

function envGain(dest: AudioNode, attack: number, hold: number, release: number, peak = 1): GainNode {
  const c = ctx!;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, c.currentTime);
  g.gain.exponentialRampToValueAtTime(peak, c.currentTime + attack);
  g.gain.setValueAtTime(peak, c.currentTime + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + attack + hold + release);
  g.connect(dest);
  return g;
}

function beep(freq: number, dur: number, type: OscillatorType, peak: number, dest: GainNode): void {
  if (!ctx || !bus) return;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  const g = envGain(dest, 0.01, Math.max(0.01, dur - 0.08), 0.08, peak);
  o.connect(g);
  o.start();
  o.stop(ctx.currentTime + dur + 0.05);
  o.onended = () => {
    o.disconnect();
    g.disconnect();
  };
}

function noise(dur: number, peak: number, dest: GainNode, hp = 400): void {
  if (!ctx) return;
  const n = ctx.createBufferSource();
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  n.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = hp;
  const g = envGain(dest, 0.005, dur * 0.3, dur * 0.6, peak);
  n.connect(filter);
  filter.connect(g);
  n.start();
  n.stop(ctx.currentTime + dur);
  n.onended = () => {
    n.disconnect();
    filter.disconnect();
    g.disconnect();
  };
}

function canSfx(): boolean {
  return !!ctx && !!bus && unlocked && sfxOn && !muted;
}

export function sfx(name: SfxName): void {
  if (!canSfx() || !bus || !ctx) return;
  const dest = bus.sfx;
  const jitter = 1 + (Math.random() * 2 - 1) * 0.06;
  switch (name) {
    case "click":
      beep(620 * jitter, 0.05, "triangle", 0.12, dest);
      break;
    case "cast":
      noise(0.22, 0.2, dest, 600);
      beep(280, 0.18, "sine", 0.1, dest);
      break;
    case "splash":
      noise(0.28, 0.28, dest, 300);
      beep(180, 0.2, "sine", 0.12, dest);
      break;
    case "bubble":
      beep(880 * jitter, 0.08, "sine", 0.06, dest);
      break;
    case "nibble":
      beep(220, 0.06, "square", 0.1, dest);
      beep(160, 0.09, "sine", 0.08, dest);
      break;
    case "perfect":
      beep(523, 0.1, "sine", 0.16, dest);
      beep(784, 0.16, "sine", 0.14, dest);
      beep(1046, 0.22, "triangle", 0.12, dest);
      break;
    case "good":
      beep(494, 0.1, "sine", 0.14, dest);
      beep(659, 0.14, "triangle", 0.1, dest);
      break;
    case "poor":
      beep(330, 0.12, "triangle", 0.1, dest);
      break;
    case "miss":
      beep(160, 0.2, "sawtooth", 0.08, dest);
      beep(110, 0.28, "sine", 0.1, dest);
      break;
    case "catch":
      beep(392, 0.1, "sine", 0.14, dest);
      beep(523, 0.12, "sine", 0.12, dest);
      beep(659, 0.18, "triangle", 0.12, dest);
      break;
    case "rare":
      beep(523, 0.12, "sine", 0.14, dest);
      beep(659, 0.12, "sine", 0.12, dest);
      beep(784, 0.12, "sine", 0.12, dest);
      beep(1046, 0.28, "triangle", 0.16, dest);
      break;
    case "mythic":
      beep(196, 0.3, "sine", 0.16, dest);
      beep(392, 0.3, "triangle", 0.12, dest);
      beep(784, 0.4, "sine", 0.14, dest);
      beep(1175, 0.5, "sine", 0.1, dest);
      break;
    case "escape":
      beep(220, 0.16, "triangle", 0.1, dest);
      beep(174, 0.22, "sine", 0.1, dest);
      break;
    case "snap":
      noise(0.12, 0.35, dest, 800);
      beep(90, 0.18, "sawtooth", 0.12, dest);
      break;
    case "sell":
      beep(880, 0.07, "square", 0.08, dest);
      beep(1320, 0.1, "square", 0.07, dest);
      break;
    case "buy":
      beep(523, 0.08, "triangle", 0.12, dest);
      beep(784, 0.14, "sine", 0.1, dest);
      break;
    case "level":
      beep(392, 0.12, "sine", 0.14, dest);
      beep(523, 0.12, "sine", 0.12, dest);
      beep(659, 0.12, "sine", 0.12, dest);
      beep(784, 0.28, "triangle", 0.16, dest);
      break;
    case "unlock":
      beep(440, 0.1, "sine", 0.12, dest);
      beep(660, 0.14, "sine", 0.12, dest);
      beep(880, 0.22, "triangle", 0.14, dest);
      break;
    case "error":
      beep(180, 0.12, "square", 0.1, dest);
      break;
    case "pull":
      beep(140 * jitter, 0.05, "sine", 0.07, dest);
      break;
    case "event":
      beep(300, 0.1, "sine", 0.1, dest);
      beep(600, 0.2, "triangle", 0.12, dest);
      break;
  }
}

export type SfxName =
  | "click"
  | "cast"
  | "splash"
  | "bubble"
  | "nibble"
  | "perfect"
  | "good"
  | "poor"
  | "miss"
  | "catch"
  | "rare"
  | "mythic"
  | "escape"
  | "snap"
  | "sell"
  | "buy"
  | "level"
  | "unlock"
  | "error"
  | "pull"
  | "event";

function startMusic(): void {
  if (!ctx || !bus || musicTimer !== null) return;
  const notes = [196, 246, 293, 329, 392, 329, 293, 246];
  let i = 0;
  const tick = () => {
    if (!ctx || !bus || muted || !musicOn) return;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = notes[i % notes.length]!;
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    g.gain.exponentialRampToValueAtTime(0.045, ctx.currentTime + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.4);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 900;
    o.connect(f);
    f.connect(g);
    g.connect(bus.music);
    o.start();
    o.stop(ctx.currentTime + 1.5);
    o.onended = () => {
      o.disconnect();
      f.disconnect();
      g.disconnect();
    };
    if (i % 4 === 0) {
      const wave = ctx.createOscillator();
      wave.type = "sine";
      wave.frequency.value = 48;
      const wg = ctx.createGain();
      wg.gain.value = 0.03;
      wave.connect(wg);
      wg.connect(bus.music);
      wave.start();
      wave.stop(ctx.currentTime + 1.6);
      wave.onended = () => {
        wave.disconnect();
        wg.disconnect();
      };
    }
    i++;
    musicTimer = window.setTimeout(tick, 900);
  };
  tick();
}

function stopMusic(): void {
  if (musicTimer !== null) {
    clearTimeout(musicTimer);
    musicTimer = null;
  }
}

export function resumeAudioIfNeeded(): void {
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
}
