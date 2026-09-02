import {
  ACHIEVEMENTS,
  AREAS,
  FISH,
  bagCap,
  hookById,
  lineById,
  rarityRank,
  rodById,
} from "./data";
import { uid, xpForLevel } from "./format";
import type {
  CatchResult,
  CaughtFish,
  FishDef,
  GameEvent,
  Quality,
  Rarity,
  SaveData,
} from "./types";

const RARE_PLUS: Rarity[] = ["rare", "epic", "legendary", "mythic"];

export function rollEvent(luck: number): GameEvent {
  const r = Math.random();
  if (r < 0.004 + luck * 0.004) return "mythic";
  if (r < 0.018 + luck * 0.01) return "golden";
  if (r < 0.04) return "giant";
  if (r < 0.1) return "school";
  if (r < 0.125) return "treasure";
  return null;
}

export function pickFish(
  save: SaveData,
  depth: number,
  event: GameEvent,
): FishDef {
  const hook = hookById(save.hook);
  const pool = FISH.filter(
    (f) => f.areas.includes(save.area) && depth >= f.minDepth && depth <= f.maxDepth + 2,
  );
  const fallback = FISH.filter((f) => f.areas.includes(save.area));
  const list = pool.length ? pool : fallback.length ? fallback : FISH;
  let weights = list.map((f) => {
    let w = f.chance;
    w *= 1 + hook.rare * rarityRank(f.rarity);
    if (event === "school" && (f.rarity === "common" || f.rarity === "uncommon")) w *= 2.2;
    if (event === "mythic" && (f.rarity === "mythic" || f.rarity === "legendary")) w *= 10;
    if (event === "golden" && rarityRank(f.rarity) >= 2) w *= 1.8;
    return Math.max(0.01, w);
  });
  const sum = weights.reduce((a, b) => a + b, 0);
  let t = Math.random() * sum;
  for (let i = 0; i < list.length; i++) {
    t -= weights[i]!;
    if (t <= 0) return list[i]!;
  }
  return list[list.length - 1]!;
}

export function rollWeight(fish: FishDef, quality: Quality, event: GameEvent, sizeBonus: number): number {
  let u = Math.random();
  if (quality === "perfect") u = Math.pow(u, 0.45);
  else if (quality === "good") u = Math.pow(u, 0.75);
  else u = Math.pow(u, 1.05);
  let w = fish.minWeight + (fish.maxWeight - fish.minWeight) * u;
  w *= 1 + sizeBonus;
  if (event === "giant") w *= 1.35 + Math.random() * 0.35;
  if (quality === "perfect") w *= 1.08;
  return Math.round(w * 100) / 100;
}

export function fishValue(
  fish: FishDef,
  weight: number,
  quality: Quality,
  golden: boolean,
): number {
  const mid = (fish.minWeight + fish.maxWeight) / 2 || 1;
  let v = fish.value * (0.55 + 0.45 * (weight / mid));
  if (quality === "perfect") v *= 1.25;
  if (quality === "poor") v *= 0.85;
  if (golden) v *= 3;
  return Math.max(1, Math.round(v));
}

export function fishXp(fish: FishDef, quality: Quality, golden: boolean): number {
  let xp = fish.xp;
  if (quality === "perfect") xp = Math.round(xp * 1.5);
  if (golden) xp = Math.round(xp * 1.35);
  return xp;
}

export function zoneWidth(rarity: Rarity, hookBonus: number): number {
  const base = {
    common: 0.3,
    uncommon: 0.24,
    rare: 0.17,
    epic: 0.12,
    legendary: 0.08,
    mythic: 0.055,
  }[rarity];
  return Math.min(0.42, base + hookBonus * 0.12);
}

export function markerSpeed(rarity: Rarity): number {
  return {
    common: 1.15,
    uncommon: 1.45,
    rare: 1.9,
    epic: 2.4,
    legendary: 2.95,
    mythic: 3.5,
  }[rarity];
}

export function needsFight(fish: FishDef, weight: number): boolean {
  if (rarityRank(fish.rarity) >= 2) return true;
  if (fish.strength >= 30 && weight > fish.maxWeight * 0.7) return true;
  return fish.rarity === "uncommon" && Math.random() < 0.35;
}

export function fightParams(save: SaveData, fish: FishDef, weight: number) {
  const rod = rodById(save.rod);
  const line = lineById(save.line);
  const hook = hookById(save.hook);
  const bulk = weight / Math.max(0.2, fish.maxWeight);
  const fishPower = fish.strength * (0.7 + bulk * 0.6);
  const drain = (5.2 + rod.force * 0.085 + hook.hook * 18) / Math.max(8, fishPower * 0.22);
  const tensionGain = 22 + fishPower * 0.35 - rod.force * 0.08 - line.resist * 0.04;
  const tensionDrop = 14 + line.pull * 10;
  const snapAt = 100 + line.resist * 0.15;
  const escapeAt = 8;
  return {
    drain: Math.max(2.4, drain),
    tensionGain: Math.max(10, tensionGain),
    tensionDrop: Math.max(8, tensionDrop),
    snapAt,
    escapeAt,
    surgeChance: 0.35 + rarityRank(fish.rarity) * 0.06,
    pull: 1 + line.pull,
  };
}

export function scoreQuality(pos: number, zoneStart: number, zoneEnd: number): Quality {
  const mid = (zoneStart + zoneEnd) / 2;
  const half = (zoneEnd - zoneStart) / 2;
  if (pos >= zoneStart && pos <= zoneEnd) {
    const inner = half * 0.28;
    if (Math.abs(pos - mid) <= inner) return "perfect";
    return "good";
  }
  const near = half * 0.55;
  if (pos > zoneStart - near && pos < zoneEnd + near) return "poor";
  return "miss";
}

export function applyCatch(save: SaveData, result: CatchResult): SaveData {
  const next: SaveData = structuredClone(save);
  if (result.escaped || result.snapped) {
    if (result.escaped) next.stats.escaped += 1;
    if (result.snapped) next.stats.snapped += 1;
    next.xp += Math.round(result.xp * 0.15);
    return applyLevel(next);
  }
  const item: CaughtFish = {
    uid: uid(),
    fishId: result.fish.id,
    weight: result.weight,
    value: result.value,
    quality: result.quality,
    golden: result.golden,
    depth: 0,
    at: Date.now(),
  };
  next.inventory.push(item);
  if (!next.discovered.includes(result.fish.id)) next.discovered.push(result.fish.id);
  next.xp += result.xp;
  next.stats.caught += 1;
  next.stats.deepest = Math.max(next.stats.deepest, item.depth);
  if (result.quality === "perfect") next.stats.perfects += 1;
  if (RARE_PLUS.includes(result.fish.rarity)) next.stats.rares += 1;
  if (result.treasure) {
    next.money += result.treasure;
    next.stats.earned += result.treasure;
  }
  bumpMissions(next, "catch", 1);
  if (RARE_PLUS.includes(result.fish.rarity)) bumpMissions(next, "rare", 1);
  if (result.quality === "perfect") bumpMissions(next, "perfect", 1);
  if (result.fish.id.includes("tubarao") || result.fish.name.toLowerCase().includes("tubarão")) {
    bumpMissions(next, "species", 1, "tubarao");
  }
  return applyLevel(checkAchievements(next));
}

export function stampDepth(save: SaveData, depth: number): SaveData {
  const next = structuredClone(save);
  const last = next.inventory[next.inventory.length - 1];
  if (last) last.depth = depth;
  next.stats.deepest = Math.max(next.stats.deepest, depth);
  bumpMissions(next, "depth", depth);
  return checkAchievements(next);
}

function bumpMissions(save: SaveData, kind: MissionStateKind, amount: number, speciesId?: string) {
  for (const m of save.missions) {
    if (m.claimed) continue;
    if (m.kind !== kind) continue;
    if (kind === "species" && m.speciesId && speciesId !== m.speciesId) continue;
    if (kind === "depth") m.progress = Math.max(m.progress, amount);
    else m.progress = Math.min(m.target, m.progress + amount);
  }
}

type MissionStateKind = SaveData["missions"][number]["kind"];

export function sellIds(save: SaveData, ids: string[]): { save: SaveData; gained: number } {
  const next = structuredClone(save);
  let gained = 0;
  next.inventory = next.inventory.filter((f) => {
    if (!ids.includes(f.uid)) return true;
    gained += f.value;
    return false;
  });
  next.money += gained;
  next.stats.sold += ids.length;
  next.stats.earned += gained;
  bumpMissions(next, "earn", gained);
  bumpMissions(next, "sell", ids.length);
  return { save: checkAchievements(next), gained };
}

export function applyLevel(save: SaveData): SaveData {
  let guard = 0;
  while (guard++ < 20) {
    const need = xpForLevel(save.level);
    if (save.xp < need) break;
    save.xp -= need;
    save.level += 1;
    const bonus = 40 + save.level * 18;
    save.money += bonus;
  }
  return save;
}

export function checkAchievements(save: SaveData): SaveData {
  const has = new Set(save.achievements);
  const grant = (id: string) => {
    const def = ACHIEVEMENTS.find((a) => a.id === id);
    if (!def || has.has(id)) return;
    has.add(id);
    save.achievements.push(id);
    save.money += def.reward;
    save.stats.earned += def.reward;
  };
  if (save.stats.caught >= 1) grant("first");
  if (save.stats.caught >= 50) grant("c50");
  if (save.stats.caught >= 200) grant("c200");
  if (save.stats.caught >= 1000) grant("c1000");
  if (save.stats.rares >= 1) grant("rare1");
  if (save.discovered.some((id) => FISH.find((f) => f.id === id)?.rarity === "epic")) grant("epic1");
  if (save.discovered.some((id) => FISH.find((f) => f.id === id)?.rarity === "legendary")) grant("leg1");
  if (save.discovered.some((id) => FISH.find((f) => f.id === id)?.rarity === "mythic")) grant("myth1");
  if (save.stats.deepest >= 50) grant("d50");
  if (save.stats.deepest >= 100) grant("d100");
  if (save.stats.deepest >= 300) grant("d300");
  if (save.discovered.length >= 20) grant("col20");
  if (save.discovered.length >= 40) grant("col40");
  if (save.discovered.length >= FISH.length) grant("colall");
  if (save.stats.earned >= 10000) grant("m10k");
  if (save.stats.earned >= 100000) grant("m100k");
  if (save.stats.earned >= 1000000) grant("m1m");
  if (save.stats.perfects >= 20) grant("perf20");
  if (save.unlockedAreas.length >= AREAS.length) grant("areas");
  if (save.ownedRods.length >= 10) grant("rods");
  return save;
}

export function inventoryFull(save: SaveData): boolean {
  return save.inventory.length >= bagCap(save.bag);
}

export function poorCatchChance(hookBonus: number): number {
  return 0.52 + hookBonus * 0.35;
}
