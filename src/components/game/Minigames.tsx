import { useEffect, useRef, useState } from "react";
import { hookById, RARITY_COLOR } from "@/game/data";
import { formatMoney, formatWeight, qualityLabel, rarityLabel } from "@/game/format";
import { markerSpeed, zoneWidth } from "@/game/logic";
import { session } from "@/game/session";
import { useGame } from "@/game/store";
import { cn } from "@/lib/cn";

export function PrecisionOverlay() {
  const save = useGame((s) => s.save);
  const hookAttempt = useGame((s) => s.hookAttempt);
  const fish = session.planFish;
  const pos = useRef(0.08);
  const dir = useRef(1);
  const bar = useRef<HTMLDivElement>(null);
  const [marker, setMarker] = useState(0.08);
  const zone = useRef<{ a: number; b: number } | null>(null);

  if (fish && !zone.current) {
    const w = zoneWidth(fish.rarity, hookById(save.hook).hook);
    const a = 0.18 + Math.random() * (0.64 - w);
    zone.current = { a, b: a + w };
  }
  const z = zone.current ?? { a: 0.38, b: 0.62 };

  useEffect(() => {
    if (!fish) return;
    let raf = 0;
    let last = performance.now();
    const speed = markerSpeed(fish.rarity);
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      pos.current += dir.current * speed * 0.42 * dt;
      if (pos.current >= 0.97) {
        pos.current = 0.97;
        dir.current = -1;
      } else if (pos.current <= 0.03) {
        pos.current = 0.03;
        dir.current = 1;
      }
      if (bar.current) {
        const el = bar.current.querySelector("[data-marker]") as HTMLElement | null;
        if (el) el.style.left = pos.current * 100 + "%";
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [fish]);

  if (!fish) return null;
  const perfectA = z.a + (z.b - z.a) * 0.36;
  const perfectB = z.a + (z.b - z.a) * 0.64;

  const fire = () => {
    setMarker(pos.current);
    hookAttempt(pos.current, z.a, z.b);
  };

  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-end px-4 pb-36">
      <div className="panel w-full max-w-md px-4 py-4">
        <p className="text-center font-display text-lg font-semibold text-foam">O peixe mordeu</p>
        <p className="mt-1 text-center text-sm text-foam-dim">
          Toque em Fisgar quando o marcador estiver na zona.
        </p>
        <div ref={bar} className="precision-track mt-4">
          <div
            className="absolute inset-y-0 bg-warn/70"
            style={{
              left: (z.a - (z.b - z.a) * 0.35) * 100 + "%",
              width: (z.b - z.a) * 170 + "%",
            }}
          />
          <div
            className="absolute inset-y-0 bg-good"
            style={{ left: z.a * 100 + "%", width: (z.b - z.a) * 100 + "%" }}
          />
          <div
            className="absolute inset-y-0 bg-amber"
            style={{ left: perfectA * 100 + "%", width: (perfectB - perfectA) * 100 + "%" }}
          />
          <div
            data-marker
            className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foam shadow-[0_0_0_3px_rgb(4_42_58)]"
            style={{ left: marker * 100 + "%" }}
          />
        </div>
        <div className="mt-2 flex justify-between text-[11px] font-semibold uppercase tracking-wide text-foam-dim">
          <span>Erro</span>
          <span>Zona ideal</span>
          <span>Erro</span>
        </div>
        <button type="button" className="btn btn-amber mt-4 w-full text-lg" onClick={fire}>
          Fisgar
        </button>
      </div>
    </div>
  );
}

export function FightOverlay() {
  const setHolding = useGame((s) => s.setHolding);
  const fish = session.planFish;
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 80);
    return () => clearInterval(id);
  }, []);

  if (!fish) return null;
  const f = session.fight;
  const danger = f.line > 78;
  const slack = f.line < 18;

  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-end px-4 pb-36">
      <div className="panel w-full max-w-md px-4 py-4">
        <p className="text-center font-display text-lg font-semibold text-foam">Peixe fisgado</p>
        <p className="mt-1 text-center text-sm text-foam-dim">
          Segure para puxar. Solte se a linha ficar vermelha.
        </p>
        <div className="mt-4 space-y-3">
          <Bar label={"Peixe · " + fish.name} value={f.fish} color="bg-coral" />
          <Bar
            label="Tensão da linha"
            value={Math.min(100, f.line)}
            color={danger ? "bg-coral" : slack ? "bg-foam-dim" : "bg-cyan"}
          />
        </div>
        {f.surge > 0 ? (
          <p className="mt-2 text-center text-sm font-bold text-amber">Ele está lutando!</p>
        ) : slack ? (
          <p className="mt-2 text-center text-sm font-bold text-foam-dim">A linha está frouxa</p>
        ) : danger ? (
          <p className="mt-2 text-center text-sm font-bold text-coral">A linha vai arrebentar</p>
        ) : (
          <p className="mt-2 text-center text-sm text-foam-dim">Mantenha a tensão no meio</p>
        )}
        <button
          type="button"
          className="btn btn-primary mt-4 w-full text-lg"
          onPointerDown={(e) => {
            e.preventDefault();
            setHolding(true);
          }}
          onPointerUp={() => setHolding(false)}
          onPointerLeave={() => setHolding(false)}
          onPointerCancel={() => setHolding(false)}
        >
          Puxar
        </button>
      </div>
    </div>
  );
}

function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs font-semibold text-foam-dim">
        <span>{label}</span>
        <span className="tabular-nums">{Math.round(value)}%</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-ocean-deep shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)]">
        <div className={cn("h-full rounded-full", color)} style={{ width: Math.max(2, value) + "%" }} />
      </div>
    </div>
  );
}

export function CatchModal() {
  const result = useGame((s) => s.result);
  const save = useGame((s) => s.save);
  const levelBefore = useGame((s) => s.levelBefore);
  const dismiss = useGame((s) => s.dismissResult);
  if (!result) return null;
  const failed = result.escaped || result.snapped;
  const leveled = save.level > levelBefore;
  const col = RARITY_COLOR[result.fish.rarity];

  return (
    <div className="absolute inset-0 z-40 flex items-end justify-center bg-ocean-deep/55 px-4 pb-28 pt-16">
      <div className="panel w-full max-w-md overflow-hidden px-5 py-5">
        {result.quality === "perfect" && !failed ? (
          <p className="mb-2 text-center font-display text-sm font-semibold tracking-wide text-amber">
            Fisgada perfeita
          </p>
        ) : null}
        <p className="text-center font-display text-xl font-semibold text-foam">
          {failed ? (result.snapped ? "A linha arrebentou" : "O peixe escapou") : "Peixe capturado"}
        </p>
        <div
          className="mx-auto mt-4 flex size-24 items-center justify-center rounded-[1.6rem]"
          style={{ background: result.fish.body, boxShadow: `0 0 0 3px ${col}` }}
        >
          <span className="font-display text-3xl font-bold text-foam">{result.fish.name.slice(0, 1)}</span>
        </div>
        <h2 className="mt-3 text-center font-display text-2xl font-semibold">{result.fish.name}</h2>
        <p className="text-center text-sm font-semibold" style={{ color: col }}>
          {rarityLabel(result.fish.rarity)}
          {result.golden ? " · Dourado" : ""}
        </p>
        {!failed ? (
          <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <Stat k="Peso" v={formatWeight(result.weight)} />
            <Stat k="Valor" v={formatMoney(result.value)} />
            <Stat k="XP" v={"+" + result.xp} />
            <Stat k="Fisgada" v={qualityLabel(result.quality)} />
          </dl>
        ) : (
          <p className="mt-3 text-center text-sm text-foam-dim">
            Preste atenção na zona ideal. Peixes raros perdoam menos.
          </p>
        )}
        {result.treasure ? (
          <p className="mt-3 text-center text-sm font-bold text-amber">
            Tesouro encontrado: {formatMoney(result.treasure)}
          </p>
        ) : null}
        {leveled ? (
          <p className="mt-3 text-center font-display text-base font-semibold text-cyan">
            Nível {save.level} alcançado
          </p>
        ) : null}
        <button type="button" className="btn btn-primary mt-5 w-full" onClick={dismiss}>
          Continuar
        </button>
      </div>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg bg-ocean-deep/60 px-3 py-2">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-foam-dim">{k}</dt>
      <dd className="font-display text-base font-semibold tabular-nums">{v}</dd>
    </div>
  );
}

export function ToastBar() {
  const toast = useGame((s) => s.toast);
  const clear = useGame((s) => s.clearToast);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(clear, 2200);
    return () => clearTimeout(t);
  }, [toast, clear]);
  if (!toast) return null;
  const tone =
    toast.tone === "warn"
      ? "bg-coral text-white"
      : toast.tone === "good"
        ? "bg-good text-ink"
        : toast.tone === "rare"
          ? "bg-amber text-ink"
          : "bg-surface text-foam";
  return (
    <div className="pointer-events-none absolute left-1/2 top-16 z-50 w-[min(92%,22rem)] -translate-x-1/2">
      <div className={cn("rounded-full px-4 py-2 text-center text-sm font-bold shadow-panel", tone)}>
        {toast.text}
      </div>
    </div>
  );
}

export function DailyModal() {
  const open = useGame((s) => s.dailyOpen);
  const save = useGame((s) => s.save);
  const claim = useGame((s) => s.claimDaily);
  const started = useGame((s) => s.started);
  if (!open || !started) return null;
  const day = Math.min(7, save.daily.streak + 1);
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-ocean-deep/60 px-5">
      <div className="panel w-full max-w-sm px-5 py-6">
        <p className="text-center font-display text-xl font-semibold">Recompensa diária</p>
        <p className="mt-1 text-center text-sm text-foam-dim">Dia {day} de 7</p>
        <div className="mt-4 grid grid-cols-7 gap-1">
          {DAILY_DOTS.map((d) => (
            <div
              key={d}
              className={cn(
                "flex h-9 items-center justify-center rounded-md text-xs font-bold",
                d < day ? "bg-cyan/30 text-cyan" : d === day ? "bg-amber text-ink" : "bg-ocean-deep text-foam-dim",
              )}
            >
              {d}
            </div>
          ))}
        </div>
        <button type="button" className="btn btn-amber mt-5 w-full" onClick={claim}>
          Coletar
        </button>
      </div>
    </div>
  );
}

const DAILY_DOTS = [1, 2, 3, 4, 5, 6, 7];

export function EventBanner() {
  const text = useGame((s) => s.eventBanner);
  if (!text) return null;
  return (
    <div className="pointer-events-none absolute left-1/2 top-24 z-20 w-[min(92%,22rem)] -translate-x-1/2">
      <div className="rounded-full bg-amber px-4 py-2 text-center font-display text-sm font-semibold text-ink shadow-panel">
        {text}
      </div>
    </div>
  );
}
