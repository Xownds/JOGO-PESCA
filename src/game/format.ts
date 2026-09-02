import type { Quality, Rarity } from "./types";

export function formatMoney(n: number): string {
  const v = Math.max(0, Math.round(n));
  return "$" + v.toLocaleString("pt-BR");
}

export function formatWeight(kg: number): string {
  return (
    kg.toLocaleString("pt-BR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 2,
    }) + " kg"
  );
}

export function formatDepth(m: number): string {
  return Math.round(m) + " m";
}

export function rarityLabel(r: Rarity): string {
  switch (r) {
    case "common":
      return "Comum";
    case "uncommon":
      return "Incomum";
    case "rare":
      return "Raro";
    case "epic":
      return "Épico";
    case "legendary":
      return "Lendário";
    case "mythic":
      return "Mítico";
  }
}

export function qualityLabel(q: Quality): string {
  switch (q) {
    case "perfect":
      return "Perfeito";
    case "good":
      return "Bom";
    case "poor":
      return "Ruim";
    case "miss":
      return "Erro";
  }
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function todayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function xpForLevel(level: number): number {
  return Math.round(72 * Math.pow(level, 1.42));
}

export function totalXpToLevel(level: number): number {
  let t = 0;
  for (let i = 1; i < level; i++) t += xpForLevel(i);
  return t;
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
