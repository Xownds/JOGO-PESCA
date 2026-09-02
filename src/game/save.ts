import { AREAS, MISSION_POOL } from "./data";
import { hashString, todayKey } from "./format";
import type { AreaId, MissionState, SaveData } from "./types";

export const SAVE_KEY = "fisgada-save";
export const SAVE_VERSION = 1;

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    money: 40,
    level: 1,
    xp: 0,
    inventory: [],
    discovered: [],
    ownedRods: ["wood"],
    ownedHooks: ["basic"],
    ownedLines: ["nylon"],
    ownedBags: ["sack"],
    unlockedAreas: ["beach"],
    rod: "wood",
    hook: "basic",
    line: "nylon",
    bag: "sack",
    area: "beach",
    stats: {
      caught: 0,
      sold: 0,
      earned: 0,
      deepest: 0,
      perfects: 0,
      rares: 0,
      escaped: 0,
      snapped: 0,
    },
    missions: pickMissions(1, todayKey()),
    missionDate: todayKey(),
    achievements: [],
    daily: { lastClaim: "", streak: 0 },
    chestAt: 0,
    tutorial: 0,
    settings: { muted: false, music: true, sfx: true, shake: true },
  };
}

export function pickMissions(level: number, date: string): MissionState[] {
  const pool = MISSION_POOL.filter((m) => {
    if (m.kind === "depth" && m.target > 80 && level < 12) return false;
    if (m.kind === "depth" && m.target > 30 && level < 4) return false;
    if (m.kind === "species" && level < 8) return false;
    if (m.kind === "earn" && m.target >= 8000 && level < 14) return false;
    if (m.kind === "rare" && m.target >= 5 && level < 8) return false;
    return true;
  });
  const seed = hashString(date + "|m|" + level);
  const used = new Set<string>();
  const out: MissionState[] = [];
  let i = 0;
  while (out.length < 3 && i < 40) {
    const m = pool[(seed + i * 17) % pool.length]!;
    i++;
    if (used.has(m.kind + m.target)) continue;
    used.add(m.kind + m.target);
    out.push({ ...m, id: m.id + "-" + date.slice(5), progress: 0, claimed: false });
  }
  return out;
}

function migrate(raw: Partial<SaveData> & { version?: number }): SaveData {
  const base = defaultSave();
  const merged: SaveData = {
    ...base,
    ...raw,
    stats: { ...base.stats, ...(raw.stats ?? {}) },
    daily: { ...base.daily, ...(raw.daily ?? {}) },
    settings: { ...base.settings, ...(raw.settings ?? {}) },
    inventory: Array.isArray(raw.inventory) ? raw.inventory : [],
    discovered: Array.isArray(raw.discovered) ? raw.discovered : [],
    ownedRods: raw.ownedRods?.length ? raw.ownedRods : ["wood"],
    ownedHooks: raw.ownedHooks?.length ? raw.ownedHooks : ["basic"],
    ownedLines: raw.ownedLines?.length ? raw.ownedLines : ["nylon"],
    ownedBags: raw.ownedBags?.length ? raw.ownedBags : ["sack"],
    unlockedAreas: (raw.unlockedAreas?.length
      ? raw.unlockedAreas
      : ["beach"]) as AreaId[],
    missions: Array.isArray(raw.missions) ? raw.missions : base.missions,
    achievements: Array.isArray(raw.achievements) ? raw.achievements : [],
    version: SAVE_VERSION,
  };
  if (!AREAS.some((a) => a.id === merged.area)) merged.area = "beach";
  const today = todayKey();
  if (merged.missionDate !== today) {
    merged.missions = pickMissions(merged.level, today);
    merged.missionDate = today;
  }
  return merged;
}

export function loadSave(): SaveData {
  if (typeof window === "undefined") return defaultSave();
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return migrate(parsed);
  } catch {
    return defaultSave();
  }
}

export function persistSave(data: SaveData): void {
  if (typeof window === "undefined") return;
  try {
    const blob = JSON.stringify(data);
    localStorage.setItem(SAVE_KEY + ":bak", localStorage.getItem(SAVE_KEY) ?? "");
    localStorage.setItem(SAVE_KEY, blob);
  } catch {
    // quota / private mode
  }
}

export function exportSave(data: SaveData): string {
  return JSON.stringify(data);
}

export function importSave(json: string): SaveData | null {
  try {
    const parsed = JSON.parse(json) as Partial<SaveData>;
    return migrate(parsed);
  } catch {
    return null;
  }
}
