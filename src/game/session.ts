import type { CatchResult, FishDef, GameEvent, Phase, Quality } from "./types";

export type SwimFish = {
  id: number;
  def: FishDef;
  x: number;
  depth: number;
  dir: number;
  speed: number;
  phase: number;
  scale: number;
  spook: number;
};

export type Bubble = {
  x: number;
  y: number;
  r: number;
  v: number;
  a: number;
};

export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  r: number;
};

export type FightState = {
  fish: number;
  line: number;
  holding: boolean;
  surge: number;
  escape: number;
};

export type Session = {
  phase: Phase;
  targetDepth: number;
  hookY: number;
  hookX: number;
  cameraY: number;
  time: number;
  trauma: number;
  rodAngle: number;
  splash: number;
  wait: number;
  event: GameEvent;
  fish: SwimFish[];
  bubbles: Bubble[];
  particles: Particle[];
  biteFish: SwimFish | null;
  planFish: FishDef | null;
  quality: Quality | null;
  fight: FightState;
  result: CatchResult | null;
  zonePulse: number;
};

export const session: Session = {
  phase: "idle",
  targetDepth: 8,
  hookY: 0,
  hookX: 0.62,
  cameraY: 0,
  time: 0,
  trauma: 0,
  rodAngle: -0.55,
  splash: 0,
  wait: 0,
  event: null,
  fish: [],
  bubbles: [],
  particles: [],
  biteFish: null,
  planFish: null,
  quality: null,
  fight: { fish: 100, line: 40, holding: false, surge: 0, escape: 0 },
  result: null,
  zonePulse: 0,
};

let idSeq = 1;
export function nextId(): number {
  return idSeq++;
}

export function resetSessionVisuals(): void {
  session.hookY = 0;
  session.cameraY = 0;
  session.rodAngle = -0.55;
  session.splash = 0;
  session.wait = 0;
  session.biteFish = null;
  session.planFish = null;
  session.quality = null;
  session.result = null;
  session.event = null;
  session.fight = { fish: 100, line: 40, holding: false, surge: 0, escape: 0 };
  session.phase = "idle";
}

export function addTrauma(v: number): void {
  session.trauma = Math.min(1, session.trauma + v);
}

export function burst(
  x: number,
  y: number,
  color: string,
  n = 14,
  speed = 80,
): void {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random());
    session.particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 0.4 + Math.random() * 0.5,
      max: 0.9,
      color,
      r: 1.5 + Math.random() * 3,
    });
  }
}
