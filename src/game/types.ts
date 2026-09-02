export type Rarity =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary"
  | "mythic";

export type AreaId =
  | "beach"
  | "open"
  | "reef"
  | "deep"
  | "abyss"
  | "trench"
  | "mystery";

export type FishShape =
  | "sardine"
  | "round"
  | "tuna"
  | "eel"
  | "flat"
  | "shark"
  | "ray"
  | "squid"
  | "octopus"
  | "angler"
  | "marlin"
  | "jellyfish"
  | "puffer"
  | "seahorse"
  | "clown"
  | "swordfish"
  | "whale"
  | "leviathan"
  | "crab"
  | "dragon";

export type Pattern = "none" | "stripe" | "spot" | "band" | "glow" | "scale";

export type Quality = "perfect" | "good" | "poor" | "miss";

export type TabId = "fish" | "bag" | "shop" | "book" | "more";

export type ShopCat = "rods" | "hooks" | "lines" | "bags" | "areas";

export type Phase =
  | "idle"
  | "casting"
  | "sinking"
  | "waiting"
  | "bite"
  | "fighting"
  | "reeling"
  | "result";

export type GameEvent =
  | "school"
  | "golden"
  | "giant"
  | "mythic"
  | "treasure"
  | null;

export type FishDef = {
  id: string;
  name: string;
  rarity: Rarity;
  minDepth: number;
  maxDepth: number;
  minWeight: number;
  maxWeight: number;
  value: number;
  chance: number;
  areas: AreaId[];
  strength: number;
  xp: number;
  shape: FishShape;
  body: string;
  belly: string;
  fin: string;
  accent: string;
  glow?: string;
  pattern: Pattern;
};

export type AreaDef = {
  id: AreaId;
  name: string;
  blurb: string;
  maxDepth: number;
  price: number;
  level: number;
  skyTop: string;
  skyBot: string;
  waterTop: string;
  waterBot: string;
};

export type RodDef = {
  id: string;
  name: string;
  depth: number;
  force: number;
  price: number;
  color: string;
  accent: string;
  blurb: string;
};

export type HookDef = {
  id: string;
  name: string;
  price: number;
  hook: number;
  rare: number;
  size: number;
  blurb: string;
};

export type LineDef = {
  id: string;
  name: string;
  price: number;
  resist: number;
  depthBonus: number;
  pull: number;
  blurb: string;
};

export type BagDef = {
  id: string;
  name: string;
  price: number;
  capacity: number;
  blurb: string;
};

export type CaughtFish = {
  uid: string;
  fishId: string;
  weight: number;
  value: number;
  quality: Quality;
  golden: boolean;
  depth: number;
  at: number;
};

export type MissionDef = {
  id: string;
  title: string;
  kind: "catch" | "earn" | "rare" | "depth" | "sell" | "perfect" | "species";
  target: number;
  speciesId?: string;
  rewardMoney: number;
  rewardXp: number;
};

export type MissionState = MissionDef & {
  progress: number;
  claimed: boolean;
};

export type AchievementDef = {
  id: string;
  title: string;
  blurb: string;
  reward: number;
};

export type SaveData = {
  version: number;
  money: number;
  level: number;
  xp: number;
  inventory: CaughtFish[];
  discovered: string[];
  ownedRods: string[];
  ownedHooks: string[];
  ownedLines: string[];
  ownedBags: string[];
  unlockedAreas: AreaId[];
  rod: string;
  hook: string;
  line: string;
  bag: string;
  area: AreaId;
  stats: {
    caught: number;
    sold: number;
    earned: number;
    deepest: number;
    perfects: number;
    rares: number;
    escaped: number;
    snapped: number;
  };
  missions: MissionState[];
  missionDate: string;
  achievements: string[];
  daily: {
    lastClaim: string;
    streak: number;
  };
  chestAt: number;
  tutorial: number;
  settings: {
    muted: boolean;
    music: boolean;
    sfx: boolean;
    shake: boolean;
  };
};

export type Toast = {
  id: number;
  text: string;
  tone: "info" | "warn" | "good" | "rare";
};

export type CatchResult = {
  fish: FishDef;
  weight: number;
  value: number;
  xp: number;
  quality: Quality;
  golden: boolean;
  event: GameEvent;
  escaped?: boolean;
  snapped?: boolean;
  treasure?: number;
};
