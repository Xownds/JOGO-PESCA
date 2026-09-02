import { create } from "zustand";
import {
  BAGS,
  DAILY_REWARDS,
  FISH,
  HOOKS,
  LINES,
  RODS,
  areaById,
  bagCap,
  hookById,
  maxReach,
} from "./data";
import { formatMoney, todayKey, xpForLevel } from "./format";
import {
  applyCatch,
  fishValue,
  fishXp,
  inventoryFull,
  needsFight,
  pickFish,
  poorCatchChance,
  rollEvent,
  rollWeight,
  scoreQuality,
  sellIds,
  stampDepth,
} from "./logic";
import { defaultSave, loadSave, persistSave, pickMissions } from "./save";
import { addTrauma, burst, resetSessionVisuals, session } from "./session";
import { sfx } from "./audio";
import type {
  AreaId,
  CatchResult,
  Phase,
  Quality,
  SaveData,
  ShopCat,
  TabId,
  Toast,
} from "./types";
import { beginCast, worldSize } from "./ocean";

let toastSeq = 1;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSave(save: SaveData): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => persistSave(save), 280);
}

type GameStore = {
  ready: boolean;
  started: boolean;
  save: SaveData;
  depth: number;
  tab: TabId;
  shopCat: ShopCat;
  phase: Phase;
  result: CatchResult | null;
  toast: Toast | null;
  levelBefore: number;
  dailyOpen: boolean;
  selected: string[];
  eventBanner: string | null;
  confirmReset: boolean;
  zoneHint: boolean;
  hydrate: () => void;
  start: () => void;
  setTab: (t: TabId) => void;
  setShopCat: (c: ShopCat) => void;
  setDepth: (d: number) => void;
  setPhase: (p: Phase) => void;
  toastMsg: (text: string, tone?: Toast["tone"]) => void;
  clearToast: () => void;
  tryCast: () => void;
  onBiteReady: () => void;
  hookAttempt: (pos: number, zone0: number, zone1: number) => void;
  startFight: () => void;
  setHolding: (v: boolean) => void;
  onFightEnd: (ok: boolean, snapped: boolean) => void;
  onReelDone: () => void;
  dismissResult: () => void;
  sellSelected: () => void;
  sellCommons: () => void;
  sellAll: () => void;
  toggleSelect: (uid: string) => void;
  buyRod: (id: string) => void;
  buyHook: (id: string) => void;
  buyLine: (id: string) => void;
  buyBag: (id: string) => void;
  buyArea: (id: AreaId) => void;
  equipRod: (id: string) => void;
  equipHook: (id: string) => void;
  equipLine: (id: string) => void;
  equipBag: (id: string) => void;
  setArea: (id: AreaId) => void;
  claimDaily: () => void;
  claimMission: (id: string) => void;
  claimChest: () => void;
  toggleSetting: (k: "muted" | "music" | "sfx" | "shake") => void;
  resetProgress: () => void;
  setConfirmReset: (v: boolean) => void;
  advanceTutorial: () => void;
};

function patchSave(set: (fn: (s: GameStore) => Partial<GameStore>) => void, fn: (save: SaveData) => SaveData) {
  set((st) => {
    const save = fn(st.save);
    scheduleSave(save);
    return { save };
  });
}

export const useGame = create<GameStore>((set, get) => ({
  ready: false,
  started: false,
  save: defaultSave(),
  depth: 8,
  tab: "fish",
  shopCat: "rods",
  phase: "idle",
  result: null,
  toast: null,
  levelBefore: 1,
  dailyOpen: false,
  selected: [],
  eventBanner: null,
  confirmReset: false,
  zoneHint: false,

  hydrate: () => {
    const save = loadSave();
    const area = areaById(save.area);
    const reach = maxReach(save.rod, save.line);
    const depth = Math.min(8, Math.min(area.maxDepth, reach));
    const today = todayKey();
    const dailyOpen = save.daily.lastClaim !== today;
    set({
      ready: true,
      save,
      depth,
      dailyOpen,
      levelBefore: save.level,
    });
  },

  start: () => set({ started: true }),

  setTab: (tab) => {
    sfx("click");
    set({ tab });
  },
  setShopCat: (shopCat) => set({ shopCat }),

  setDepth: (d) => {
    const { save } = get();
    const area = areaById(save.area);
    const reach = maxReach(save.rod, save.line);
    const clamped = Math.max(2, Math.min(area.maxDepth, d));
    set({ depth: clamped, zoneHint: clamped > reach });
  },

  setPhase: (phase) => set({ phase }),

  toastMsg: (text, tone = "info") => {
    set({ toast: { id: toastSeq++, text, tone } });
  },
  clearToast: () => set({ toast: null }),

  tryCast: () => {
    const { save, depth, phase } = get();
    if (phase !== "idle") return;
    if (inventoryFull(save)) {
      sfx("error");
      get().toastMsg("Mochila cheia. Venda peixes para continuar.", "warn");
      return;
    }
    const reach = maxReach(save.rod, save.line);
    if (depth > reach) {
      sfx("error");
      get().toastMsg("Sua vara não alcança essa profundidade!", "warn");
      set({ zoneHint: true });
      return;
    }
    const hook = hookById(save.hook);
    const event = rollEvent(hook.rare);
    const fish = pickFish(save, depth, event);
    const levelBefore = save.level;
    sfx("cast");
    set({
      phase: "casting",
      levelBefore,
      eventBanner:
        event === "school"
          ? "Um cardume apareceu!"
          : event === "golden"
            ? "Um peixe dourado brilhou no fundo!"
            : event === "giant"
              ? "Algo enorme passou pela linha..."
              : event === "mythic"
                ? "Uma criatura mítica foi sentida."
                : event === "treasure"
                  ? "Há um brilho de tesouro na água."
                  : null,
    });
    if (event) sfx("event");
    beginCast(depth, fish, event);
    if (save.tutorial === 0) {
      patchSave(set, (s) => ({ ...s, tutorial: 1 }));
    }
  },

  onBiteReady: () => {
    sfx("nibble");
    addTrauma(0.2);
    set({ phase: "bite" });
  },

  hookAttempt: (pos, zone0, zone1) => {
    const { save, depth } = get();
    const quality = scoreQuality(pos, zone0, zone1);
    session.quality = quality;
    const fish = session.planFish;
    if (!fish) return;
    if (quality === "perfect") sfx("perfect");
    else if (quality === "good") sfx("good");
    else if (quality === "poor") sfx("poor");
    else sfx("miss");

    if (quality === "miss") {
      const result: CatchResult = {
        fish,
        weight: 0,
        value: 0,
        xp: Math.round(fish.xp * 0.1),
        quality,
        golden: false,
        event: session.event,
        escaped: true,
      };
      finishEscape(set, get, result);
      return;
    }
    if (quality === "poor" && Math.random() > poorCatchChance(hookById(save.hook).hook)) {
      const result: CatchResult = {
        fish,
        weight: 0,
        value: 0,
        xp: Math.round(fish.xp * 0.12),
        quality,
        golden: false,
        event: session.event,
        escaped: true,
      };
      finishEscape(set, get, result);
      return;
    }
    const golden = session.event === "golden";
    const weight = rollWeight(fish, quality, session.event, hookById(save.hook).size);
    const value = fishValue(fish, weight, quality, golden);
    const xp = fishXp(fish, quality, golden);
    const result: CatchResult = {
      fish,
      weight,
      value,
      xp,
      quality,
      golden,
      event: session.event,
      treasure: session.event === "treasure" ? 40 + Math.round(Math.random() * 120) : undefined,
    };
    session.result = result;
    const { w: ww, h: hh } = worldSize();
    burst(ww * session.hookX, hh * 0.5, quality === "perfect" ? "#e2b93a" : "#e8f6fa", 20, 110);
    addTrauma(quality === "perfect" ? 0.4 : 0.18);

    if (needsFight(fish, weight)) {
      session.fight.fish = 100;
      session.fight.line = 40;
      session.fight.escape = 0;
      session.fight.holding = false;
      session.phase = "fighting";
      set({ phase: "fighting", result });
      return;
    }
    session.phase = "reeling";
    set({ phase: "reeling", result });
    void depth;
  },

  startFight: () => set({ phase: "fighting" }),
  setHolding: (v) => {
    session.fight.holding = v;
    if (v) sfx("pull");
  },

  onFightEnd: (ok, snapped) => {
    const result = session.result;
    const fish = session.planFish;
    if (!result && fish) {
      session.result = {
        fish,
        weight: 0,
        value: 0,
        xp: 8,
        quality: session.quality ?? "poor",
        golden: false,
        event: session.event,
        escaped: !snapped,
        snapped,
      };
    } else if (session.result) {
      session.result = { ...session.result, escaped: !ok && !snapped, snapped };
    }
    if (snapped) {
      sfx("snap");
      addTrauma(0.55);
      get().toastMsg("A linha arrebentou!", "warn");
    } else if (!ok) {
      sfx("escape");
      get().toastMsg("O peixe escapou!", "warn");
    }
    set({ phase: "result", result: session.result });
    settleResult(set, get);
  },

  onReelDone: () => {
    set({ phase: "result" });
    settleResult(set, get);
  },

  dismissResult: () => {
    resetSessionVisuals();
    set({ phase: "idle", result: null, eventBanner: null, tab: "fish" });
  },

  sellSelected: () => {
    const { save, selected } = get();
    if (!selected.length) {
      get().toastMsg("Selecione peixes para vender.", "info");
      return;
    }
    const { save: next, gained } = sellIds(save, selected);
    sfx("sell");
    scheduleSave(next);
    set({ save: next, selected: [] });
    get().toastMsg("+" + formatMoney(gained), "good");
  },
  sellCommons: () => {
    const { save } = get();
    const ids = save.inventory
      .filter((i) => FISH.find((f) => f.id === i.fishId)?.rarity === "common")
      .map((i) => i.uid);
    if (!ids.length) {
      get().toastMsg("Nenhum peixe comum na mochila.", "info");
      return;
    }
    const { save: next, gained } = sellIds(save, ids);
    sfx("sell");
    scheduleSave(next);
    set({ save: next, selected: get().selected.filter((id) => !ids.includes(id)) });
    get().toastMsg("+" + formatMoney(gained), "good");
  },
  sellAll: () => {
    const { save } = get();
    if (!save.inventory.length) return;
    const ids = save.inventory.map((i) => i.uid);
    const { save: next, gained } = sellIds(save, ids);
    sfx("sell");
    scheduleSave(next);
    set({ save: next, selected: [] });
    get().toastMsg("+" + formatMoney(gained), "good");
  },
  toggleSelect: (uid) => {
    const selected = get().selected;
    set({
      selected: selected.includes(uid) ? selected.filter((x) => x !== uid) : [...selected, uid],
    });
  },

  buyRod: (id) => buyGear(set, get, "rod", id),
  buyHook: (id) => buyGear(set, get, "hook", id),
  buyLine: (id) => buyGear(set, get, "line", id),
  buyBag: (id) => buyGear(set, get, "bag", id),
  buyArea: (id) => {
    const { save } = get();
    const area = areaById(id);
    if (save.unlockedAreas.includes(id)) {
      get().setArea(id);
      return;
    }
    if (save.level < area.level) {
      sfx("error");
      get().toastMsg("Requer nível " + area.level + ".", "warn");
      return;
    }
    if (save.money < area.price) {
      sfx("error");
      get().toastMsg("Dinheiro insuficiente.", "warn");
      return;
    }
    const next = structuredClone(save);
    next.money -= area.price;
    next.unlockedAreas.push(id);
    next.area = id;
    sfx("unlock");
    scheduleSave(next);
    set({ save: next, depth: Math.min(get().depth, area.maxDepth) });
    get().toastMsg(area.name + " desbloqueada!", "good");
  },
  equipRod: (id) => {
    if (!get().save.ownedRods.includes(id)) return;
    sfx("click");
    patchSave(set, (s) => ({ ...s, rod: id }));
  },
  equipHook: (id) => {
    if (!get().save.ownedHooks.includes(id)) return;
    sfx("click");
    patchSave(set, (s) => ({ ...s, hook: id }));
  },
  equipLine: (id) => {
    if (!get().save.ownedLines.includes(id)) return;
    sfx("click");
    patchSave(set, (s) => ({ ...s, line: id }));
  },
  equipBag: (id) => {
    if (!get().save.ownedBags.includes(id)) return;
    sfx("click");
    patchSave(set, (s) => ({ ...s, bag: id }));
  },
  setArea: (id) => {
    const { save } = get();
    if (!save.unlockedAreas.includes(id)) return;
    sfx("click");
    const area = areaById(id);
    patchSave(set, (s) => ({ ...s, area: id }));
    set({ depth: Math.min(get().depth, area.maxDepth, maxReach(save.rod, save.line)) });
  },

  claimDaily: () => {
    const { save } = get();
    const today = todayKey();
    if (save.daily.lastClaim === today) return;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const cont = save.daily.lastClaim === todayKey(yesterday);
    const streak = cont ? Math.min(7, save.daily.streak + 1) : 1;
    const reward = DAILY_REWARDS[streak - 1] ?? DAILY_REWARDS[0]!;
    const next = structuredClone(save);
    next.daily = { lastClaim: today, streak };
    next.money += reward.money;
    next.xp += reward.xp;
    next.stats.earned += reward.money;
    sfx("buy");
    scheduleSave(next);
    set({ save: next, dailyOpen: false });
    get().toastMsg("Recompensa: " + formatMoney(reward.money), "good");
  },

  claimMission: (id) => {
    const { save } = get();
    const m = save.missions.find((x) => x.id === id);
    if (!m || m.claimed || m.progress < m.target) return;
    const next = structuredClone(save);
    const mm = next.missions.find((x) => x.id === id)!;
    mm.claimed = true;
    next.money += m.rewardMoney;
    next.xp += m.rewardXp;
    next.stats.earned += m.rewardMoney;
    sfx("catch");
    scheduleSave(next);
    set({ save: next });
    get().toastMsg("+" + formatMoney(m.rewardMoney), "good");
  },

  claimChest: () => {
    const { save } = get();
    const now = Date.now();
    if (now - save.chestAt < 1000 * 60 * 60 * 8) {
      get().toastMsg("O baú ainda está fechado.", "info");
      return;
    }
    const pool = FISH.filter((f) => f.areas.includes(save.area) && f.rarity !== "mythic");
    const fish = pool[Math.floor(Math.random() * pool.length)] ?? FISH[0]!;
    const weight = rollWeight(fish, "good", null, 0);
    const value = fishValue(fish, weight, "good", false);
    const next = applyCatch(save, {
      fish,
      weight,
      value,
      xp: fish.xp,
      quality: "good",
      golden: false,
      event: null,
    });
    next.chestAt = now;
    sfx("rare");
    scheduleSave(next);
    set({ save: next });
    get().toastMsg("Baú: " + fish.name + "!", "rare");
  },

  toggleSetting: (k) => {
    patchSave(set, (s) => ({
      ...s,
      settings: { ...s.settings, [k]: !s.settings[k] },
    }));
  },

  resetProgress: () => {
    const save = defaultSave();
    persistSave(save);
    resetSessionVisuals();
    set({
      save,
      depth: 8,
      phase: "idle",
      result: null,
      selected: [],
      confirmReset: false,
      dailyOpen: true,
      tab: "fish",
    });
  },
  setConfirmReset: (confirmReset) => set({ confirmReset }),
  advanceTutorial: () => patchSave(set, (s) => ({ ...s, tutorial: Math.min(4, s.tutorial + 1) })),
}));

function buyGear(
  set: (p: Partial<GameStore> | ((s: GameStore) => Partial<GameStore>)) => void,
  get: () => GameStore,
  kind: "rod" | "hook" | "line" | "bag",
  id: string,
) {
  const { save } = get();
  const map = {
    rod: { list: RODS, owned: save.ownedRods, key: "ownedRods" as const, eq: "rod" as const },
    hook: { list: HOOKS, owned: save.ownedHooks, key: "ownedHooks" as const, eq: "hook" as const },
    line: { list: LINES, owned: save.ownedLines, key: "ownedLines" as const, eq: "line" as const },
    bag: { list: BAGS, owned: save.ownedBags, key: "ownedBags" as const, eq: "bag" as const },
  }[kind];
  const item = map.list.find((x) => x.id === id);
  if (!item) return;
  if (map.owned.includes(id)) {
    const next = structuredClone(save);
    next[map.eq] = id;
    scheduleSave(next);
    set({ save: next });
    sfx("click");
    return;
  }
  if (save.money < item.price) {
    sfx("error");
    get().toastMsg("Dinheiro insuficiente.", "warn");
    return;
  }
  const next = structuredClone(save);
  next.money -= item.price;
  (next[map.key] as string[]).push(id);
  next[map.eq] = id;
  sfx("buy");
  scheduleSave(next);
  set({ save: next });
  get().toastMsg("Novo equipamento!", "good");
}

function finishEscape(
  set: (p: Partial<GameStore> | ((s: GameStore) => Partial<GameStore>)) => void,
  get: () => GameStore,
  result: CatchResult,
) {
  addTrauma(0.3);
  const { w, h } = worldSize();
  burst(w * session.hookX, h * 0.45, "#e85d4c", 12, 70);
  session.phase = "result";
  session.result = result;
  set({ phase: "result", result });
  settleResult(set as never, get);
}

function settleResult(
  set: (p: Partial<GameStore> | ((s: GameStore) => Partial<GameStore>)) => void,
  get: () => GameStore,
) {
  const st = get();
  const result = session.result ?? st.result;
  if (!result) return;
  let next = applyCatch(st.save, result);
  if (!result.escaped && !result.snapped) {
    next = stampDepth(next, st.depth);
    if (result.fish.rarity === "mythic") sfx("mythic");
    else if (result.fish.rarity === "legendary" || result.fish.rarity === "epic") sfx("rare");
    else sfx("catch");
  } else if (result.snapped) {
    // already sfx
  } else {
    sfx("escape");
  }
  const leveled = next.level > st.levelBefore;
  if (leveled) sfx("level");
  scheduleSave(next);
  set({ save: next, result, phase: "result" });
}

export function flushSave(): void {
  persistSave(useGame.getState().save);
}

export function reachOf(save: SaveData): number {
  return maxReach(save.rod, save.line);
}

export function capOf(save: SaveData): number {
  return bagCap(save.bag);
}

export function xpNeed(save: SaveData): number {
  return xpForLevel(save.level);
}

