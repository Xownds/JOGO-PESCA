import { useEffect, useRef } from "react";
import { BookOpen, Fish, Map, Settings, ShoppingBag, Star, Store, Wallet } from "lucide-react";
import { areaById, bagCap, maxReach, zoneName } from "@/game/data";
import { formatDepth, formatMoney, xpForLevel } from "@/game/format";
import { setAudioPrefs, sfx, unlockAudio } from "@/game/audio";
import { startOcean } from "@/game/ocean";
import { flushSave, useGame } from "@/game/store";
import { cn } from "@/lib/cn";
import {
  CatchModal,
  DailyModal,
  EventBanner,
  FightOverlay,
  PrecisionOverlay,
  ToastBar,
} from "./Minigames";
import { CollectionPanel, InventoryPanel, MorePanel, ShopPanel } from "./Panels";

export function GameApp() {
  const hydrate = useGame((s) => s.hydrate);

  useEffect(() => {
    hydrate();
    const onHide = () => {
      if (document.hidden) flushSave();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flushSave);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flushSave);
    };
  }, [hydrate]);

  return <GameReady />;
}

function GameReady() {
  const started = useGame((s) => s.started);
  const start = useGame((s) => s.start);
  const save = useGame((s) => s.save);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setAudioPrefs(save.settings);
  }, [save.settings]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    return startOcean(el, {
      getSave: () => useGame.getState().save,
      getDepth: () => useGame.getState().depth,
      onPhase: (p) => useGame.getState().setPhase(p),
      onBiteReady: () => useGame.getState().onBiteReady(),
      onReelDone: () => useGame.getState().onReelDone(),
      onFightEnd: (ok, snapped) => useGame.getState().onFightEnd(ok, snapped),
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useGame.getState();
      if (e.code === "Space") {
        e.preventDefault();
        if (st.phase === "idle") st.tryCast();
        else if (st.phase === "bite") {
          /* precision uses button */
        } else if (st.phase === "fighting") st.setHolding(true);
      }
      if (e.code === "ArrowUp") st.setDepth(st.depth - 2);
      if (e.code === "ArrowDown") st.setDepth(st.depth + 2);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") useGame.getState().setHolding(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const onStart = () => {
    unlockAudio();
    sfx("catch");
    start();
  };

  return (
    <div className="flex min-h-dvh justify-center bg-ocean-deep">
      <div className="game-shell">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full touch-none"
          style={{ touchAction: "none" }}
        />
        {started ? <PlayUI /> : <Title onStart={onStart} />}
        <ToastBar />
      </div>
    </div>
  );
}

function Title({ onStart }: { onStart: () => void }) {
  const save = useGame((s) => s.save);
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-end bg-gradient-to-b from-ocean-deep/35 via-transparent to-ocean-deep/50 px-6 pb-16">
      <div className="mb-auto mt-20 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan">Pescaria do abismo</p>
        <h1 className="mt-2 font-display text-6xl font-semibold text-foam">Fisgada</h1>
        <p className="mx-auto mt-3 max-w-[16rem] text-sm leading-relaxed text-foam-dim">
          Lance mais fundo. Acerte o momento. Traga o que o oceano esconde.
        </p>
      </div>
      <button type="button" className="btn btn-primary w-full max-w-xs text-lg" onClick={onStart}>
        {save.stats.caught > 0 ? "Continuar" : "Pescar"}
      </button>
      {save.stats.caught > 0 ? (
        <p className="mt-3 text-xs text-foam-dim">
          Nv. {save.level} · {formatMoney(save.money)}
        </p>
      ) : (
        <p className="mt-3 text-xs text-foam-dim">Toque para começar · o som liga no primeiro toque</p>
      )}
    </div>
  );
}

function PlayUI() {
  const tab = useGame((s) => s.tab);
  const phase = useGame((s) => s.phase);
  const save = useGame((s) => s.save);
  const depth = useGame((s) => s.depth);
  const setDepth = useGame((s) => s.setDepth);
  const tryCast = useGame((s) => s.tryCast);
  const zoneHint = useGame((s) => s.zoneHint);
  const area = areaById(save.area);
  const reach = maxReach(save.rod, save.line);
  const need = xpForLevel(save.level);
  const xpPct = Math.min(100, (save.xp / need) * 100);
  const cap = bagCap(save.bag);
  const busy = phase !== "idle" && phase !== "result";
  const canFish = tab === "fish";

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 px-3 pt-[max(0.7rem,env(safe-area-inset-top))]">
        <div className="pointer-events-auto flex items-center justify-between gap-2">
          <div className="hud-chip">
            <Wallet className="size-3.5 text-amber" />
            <span className="tabular-nums">{formatMoney(save.money)}</span>
          </div>
          <div className="hud-chip max-w-[42%] truncate">
            <Map className="size-3.5 text-cyan" />
            <span className="truncate">{area.name}</span>
          </div>
          <div className="hud-chip">
            <Star className="size-3.5 text-amber" />
            <span className="tabular-nums">{save.level}</span>
          </div>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ocean-deep/70">
          <div className="h-full rounded-full bg-cyan" style={{ width: xpPct + "%" }} />
        </div>
      </div>

      {canFish ? (
        <div className="absolute inset-x-0 bottom-[calc(4.4rem+env(safe-area-inset-bottom))] z-10 px-4">
          <div className="panel px-4 py-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-foam-dim">Profundidade</span>
              <span className="font-display font-semibold tabular-nums">{formatDepth(depth)}</span>
            </div>
            <p className="text-[11px] text-foam-dim">
              {zoneName(depth)} · vara até {reach} m
            </p>
            <input
              type="range"
              min={2}
              max={area.maxDepth}
              value={depth}
              disabled={busy}
              onChange={(e) => setDepth(Number(e.target.value))}
              className="mt-2 h-8 w-full accent-cyan"
            />
            {zoneHint || depth > reach ? (
              <p className="mt-1 text-xs font-semibold text-coral">Sua vara não alcança essa profundidade!</p>
            ) : (
              <p className="mt-1 text-xs text-foam-dim">
                Peixes: {save.inventory.length}/{cap}
              </p>
            )}
            <button
              type="button"
              className="btn btn-primary mt-3 w-full text-lg"
              disabled={busy || depth > reach}
              onClick={() => {
                unlockAudio();
                tryCast();
              }}
            >
              {busy ? statusLabel(phase) : "Pescar"}
            </button>
          </div>
        </div>
      ) : null}

      {tab === "bag" ? <InventoryPanel /> : null}
      {tab === "shop" ? <ShopPanel /> : null}
      {tab === "book" ? <CollectionPanel /> : null}
      {tab === "more" ? <MorePanel /> : null}

      {phase === "bite" ? <PrecisionOverlay /> : null}
      {phase === "fighting" ? <FightOverlay /> : null}
      {phase === "result" ? <CatchModal /> : null}
      <DailyModal />
      <EventBanner />
      <BottomNav />
    </>
  );
}

function statusLabel(phase: string): string {
  switch (phase) {
    case "casting":
      return "Lançando...";
    case "sinking":
      return "Descendo...";
    case "waiting":
      return "Esperando...";
    case "bite":
      return "Fisgar!";
    case "fighting":
      return "Segurando...";
    case "reeling":
      return "Puxando...";
    default:
      return "Pescar";
  }
}

function BottomNav() {
  const tab = useGame((s) => s.tab);
  const setTab = useGame((s) => s.setTab);
  const phase = useGame((s) => s.phase);
  const busy = phase !== "idle" && phase !== "result";
  const items = [
    { id: "fish" as const, label: "Pescar", Icon: Fish },
    { id: "bag" as const, label: "Mochila", Icon: ShoppingBag },
    { id: "shop" as const, label: "Loja", Icon: Store },
    { id: "book" as const, label: "Coleção", Icon: BookOpen },
    { id: "more" as const, label: "Menu", Icon: Settings },
  ];
  return (
    <nav className="absolute inset-x-0 bottom-0 z-30 flex border-t border-line bg-ocean/90 pb-[env(safe-area-inset-bottom)] pt-1 backdrop-blur-sm">
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          className={cn("nav-item", tab === it.id && "on")}
          disabled={busy && it.id !== "fish"}
          onClick={() => setTab(it.id)}
        >
          <it.Icon className="size-5" />
          {it.label}
        </button>
      ))}
    </nav>
  );
}

