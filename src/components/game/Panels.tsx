import {
  ACHIEVEMENTS,
  AREAS,
  BAGS,
  FISH,
  HOOKS,
  LINES,
  RARITY_COLOR,
  RODS,
  bagCap,
  fishById,
} from "@/game/data";
import { formatMoney, formatWeight, rarityLabel } from "@/game/format";
import { useGame } from "@/game/store";
import { cn } from "@/lib/cn";
import type { Rarity, ShopCat } from "@/game/types";
import { Check, Lock, Volume2, VolumeX, Waves } from "lucide-react";

export function InventoryPanel() {
  const save = useGame((s) => s.save);
  const selected = useGame((s) => s.selected);
  const toggle = useGame((s) => s.toggleSelect);
  const sellSelected = useGame((s) => s.sellSelected);
  const sellCommons = useGame((s) => s.sellCommons);
  const sellAll = useGame((s) => s.sellAll);
  const cap = bagCap(save.bag);

  return (
    <div className="sheet px-4 pt-5">
      <Header title="Mochila" sub={`${save.inventory.length}/${cap} peixes`} />
      {save.inventory.length === 0 ? (
        <p className="mt-8 text-center text-sm text-foam-dim">
          A mochila está vazia. Lance a linha.
        </p>
      ) : (
        <ul className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pb-4">
          {save.inventory.map((item) => {
            const fish = fishById(item.fishId);
            if (!fish) return null;
            const on = selected.includes(item.uid);
            return (
              <li key={item.uid}>
                <button
                  type="button"
                  onClick={() => toggle(item.uid)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left shadow-[0_0_0_1px_rgb(255_255_255/0.08)]",
                    on ? "bg-cyan/15" : "bg-surface/80",
                  )}
                >
                  <span
                    className="size-10 shrink-0 rounded-lg"
                    style={{
                      background: fish.body,
                      boxShadow: `inset 0 0 0 2px ${RARITY_COLOR[fish.rarity]}`,
                    }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display font-semibold">{fish.name}</span>
                    <span className="block text-xs text-foam-dim">
                      {rarityLabel(fish.rarity)} · {formatWeight(item.weight)}
                      {item.golden ? " · dourado" : ""}
                    </span>
                  </span>
                  <span className="font-display text-sm font-semibold tabular-nums text-amber">
                    {formatMoney(item.value)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="grid grid-cols-3 gap-2 pt-2">
        <button type="button" className="btn btn-ghost text-xs" onClick={sellSelected}>
          Vender
        </button>
        <button type="button" className="btn btn-ghost text-xs" onClick={sellCommons}>
          Comuns
        </button>
        <button type="button" className="btn btn-amber text-xs" onClick={sellAll}>
          Tudo
        </button>
      </div>
    </div>
  );
}

export function ShopPanel() {
  const cat = useGame((s) => s.shopCat);
  const setCat = useGame((s) => s.setShopCat);
  const save = useGame((s) => s.save);
  const cats: { id: ShopCat; label: string }[] = [
    { id: "rods", label: "Varas" },
    { id: "hooks", label: "Anzóis" },
    { id: "lines", label: "Linhas" },
    { id: "bags", label: "Mochilas" },
    { id: "areas", label: "Áreas" },
  ];
  return (
    <div className="sheet px-4 pt-5">
      <Header title="Loja" sub={formatMoney(save.money)} />
      <div className="mt-3 flex gap-1 overflow-x-auto pb-1">
        {cats.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCat(c.id)}
            className={cn(
              "shrink-0 rounded-full px-3 py-2 text-xs font-bold",
              cat === c.id ? "bg-cyan text-ink" : "bg-surface text-foam-dim",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pb-4">
        {cat === "rods" ? <RodList /> : null}
        {cat === "hooks" ? <HookList /> : null}
        {cat === "lines" ? <LineList /> : null}
        {cat === "bags" ? <BagList /> : null}
        {cat === "areas" ? <AreaList /> : null}
      </div>
    </div>
  );
}

function RodList() {
  const save = useGame((s) => s.save);
  const buy = useGame((s) => s.buyRod);
  return (
    <>
      {RODS.map((r) => {
        const owned = save.ownedRods.includes(r.id);
        const eq = save.rod === r.id;
        return (
          <ShopRow
            key={r.id}
            title={r.name}
            blurb={`${r.depth} m · força ${r.force} · ${r.blurb}`}
            price={r.price}
            owned={owned}
            equipped={eq}
            onClick={() => buy(r.id)}
            swatch={r.color}
          />
        );
      })}
    </>
  );
}

function HookList() {
  const save = useGame((s) => s.save);
  const buy = useGame((s) => s.buyHook);
  return (
    <>
      {HOOKS.map((r) => {
        const owned = save.ownedHooks.includes(r.id);
        const eq = save.hook === r.id;
        return (
          <ShopRow
            key={r.id}
            title={r.name}
            blurb={`Fisgada +${Math.round(r.hook * 100)}% · raro +${Math.round(r.rare * 100)}% · ${r.blurb}`}
            price={r.price}
            owned={owned}
            equipped={eq}
            onClick={() => buy(r.id)}
            swatch="#d8e4ea"
          />
        );
      })}
    </>
  );
}

function LineList() {
  const save = useGame((s) => s.save);
  const buy = useGame((s) => s.buyLine);
  return (
    <>
      {LINES.map((r) => {
        const owned = save.ownedLines.includes(r.id);
        const eq = save.line === r.id;
        return (
          <ShopRow
            key={r.id}
            title={r.name}
            blurb={`Resistência ${r.resist} · +${r.depthBonus} m · ${r.blurb}`}
            price={r.price}
            owned={owned}
            equipped={eq}
            onClick={() => buy(r.id)}
            swatch="#9ec4d0"
          />
        );
      })}
    </>
  );
}

function BagList() {
  const save = useGame((s) => s.save);
  const buy = useGame((s) => s.buyBag);
  return (
    <>
      {BAGS.map((r) => {
        const owned = save.ownedBags.includes(r.id);
        const eq = save.bag === r.id;
        return (
          <ShopRow
            key={r.id}
            title={r.name}
            blurb={`${r.capacity} peixes · ${r.blurb}`}
            price={r.price}
            owned={owned}
            equipped={eq}
            onClick={() => buy(r.id)}
            swatch="#c4783a"
          />
        );
      })}
    </>
  );
}

function AreaList() {
  const save = useGame((s) => s.save);
  const buy = useGame((s) => s.buyArea);
  return (
    <>
      {AREAS.map((a) => {
        const owned = save.unlockedAreas.includes(a.id);
        const eq = save.area === a.id;
        const lockedLvl = save.level < a.level;
        return (
          <ShopRow
            key={a.id}
            title={a.name}
            blurb={`Até ${a.maxDepth} m · nv. ${a.level} · ${a.blurb}`}
            price={a.price}
            owned={owned}
            equipped={eq}
            locked={lockedLvl}
            lockHint={"Nível " + a.level}
            onClick={() => buy(a.id)}
            swatch={a.waterTop}
          />
        );
      })}
    </>
  );
}

function ShopRow({
  title,
  blurb,
  price,
  owned,
  equipped,
  onClick,
  swatch,
  locked,
  lockHint,
}: {
  title: string;
  blurb: string;
  price: number;
  owned: boolean;
  equipped: boolean;
  onClick: () => void;
  swatch: string;
  locked?: boolean;
  lockHint?: string;
}) {
  const label = equipped ? "Equipado" : owned ? "Equipar" : locked ? lockHint : formatMoney(price);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={equipped}
      className="flex w-full items-center gap-3 rounded-xl bg-surface/80 px-3 py-3 text-left shadow-[0_0_0_1px_rgb(255_255_255/0.08)] disabled:opacity-80"
    >
      <span className="size-10 shrink-0 rounded-lg" style={{ background: swatch }} />
      <span className="min-w-0 flex-1">
        <span className="block font-display font-semibold">{title}</span>
        <span className="block text-xs leading-snug text-foam-dim">{blurb}</span>
      </span>
      <span
        className={cn(
          "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold",
          equipped ? "bg-cyan/20 text-cyan" : owned ? "bg-foam/10 text-foam" : "bg-amber text-ink",
        )}
      >
        {label}
      </span>
    </button>
  );
}

export function CollectionPanel() {
  const save = useGame((s) => s.save);
  const found = save.discovered.length;
  const total = FISH.length;
  return (
    <div className="sheet px-4 pt-5">
      <Header title="Coleção" sub={`${found}/${total} espécies`} />
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-ocean-deep">
        <div className="h-full bg-cyan" style={{ width: (found / total) * 100 + "%" }} />
      </div>
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto pb-4">
        <div className="grid grid-cols-3 gap-2">
          {FISH.map((f) => {
            const on = save.discovered.includes(f.id);
            return (
              <div
                key={f.id}
                className="rounded-xl px-2 py-3 text-center shadow-[0_0_0_1px_rgb(255_255_255/0.08)]"
                style={{ background: on ? f.body : "#0a2430" }}
              >
                {on ? (
                  <>
                    <p className="font-display text-xs font-semibold leading-tight text-foam drop-shadow">
                      {f.name}
                    </p>
                    <p className="mt-1 text-[10px] font-bold" style={{ color: RARITY_COLOR[f.rarity] }}>
                      {rarityLabel(f.rarity as Rarity)}
                    </p>
                  </>
                ) : (
                  <>
                    <Lock className="mx-auto size-4 text-foam-dim" />
                    <p className="mt-1 text-[10px] font-semibold text-foam-dim">???</p>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function MorePanel() {
  const save = useGame((s) => s.save);
  const claimMission = useGame((s) => s.claimMission);
  const claimChest = useGame((s) => s.claimChest);
  const toggle = useGame((s) => s.toggleSetting);
  const confirm = useGame((s) => s.confirmReset);
  const setConfirm = useGame((s) => s.setConfirmReset);
  const reset = useGame((s) => s.resetProgress);
  const setArea = useGame((s) => s.setArea);
  const chestReady = Date.now() - save.chestAt > 1000 * 60 * 60 * 8;

  return (
    <div className="sheet px-4 pt-5">
      <Header title="Menu" sub={"Nível " + save.level} />
      <div className="mt-3 min-h-0 flex-1 space-y-4 overflow-y-auto pb-4">
        <section>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-foam-dim">Missões do dia</h3>
          <div className="space-y-2">
            {save.missions.map((m) => {
              const done = m.progress >= m.target;
              return (
                <div key={m.id} className="rounded-xl bg-surface/80 px-3 py-3 shadow-[0_0_0_1px_rgb(255_255_255/0.08)]">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-display text-sm font-semibold">{m.title}</p>
                    <span className="text-xs tabular-nums text-foam-dim">
                      {Math.min(m.progress, m.target)}/{m.target}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ocean-deep">
                    <div
                      className="h-full bg-cyan"
                      style={{ width: Math.min(100, (m.progress / m.target) * 100) + "%" }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-amber">{formatMoney(m.rewardMoney)}</span>
                    <button
                      type="button"
                      disabled={!done || m.claimed}
                      className="btn btn-primary h-8 px-3 text-xs disabled:opacity-40"
                      onClick={() => claimMission(m.id)}
                    >
                      {m.claimed ? "Coletada" : "Coletar"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-foam-dim">Área atual</h3>
          <div className="flex gap-2 overflow-x-auto">
            {AREAS.map((a) => {
              const open = save.unlockedAreas.includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  disabled={!open}
                  onClick={() => setArea(a.id)}
                  className={cn(
                    "shrink-0 rounded-xl px-3 py-2 text-left text-xs font-semibold",
                    save.area === a.id ? "bg-cyan text-ink" : "bg-surface text-foam",
                    !open && "opacity-40",
                  )}
                >
                  {open ? a.name : "???"}
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-foam-dim">Baú livre</h3>
          <button type="button" className="btn btn-amber w-full" onClick={claimChest} disabled={!chestReady}>
            {chestReady ? "Abrir baú" : "Baú em recarga"}
          </button>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-foam-dim">Conquistas</h3>
          <ul className="space-y-1.5">
            {ACHIEVEMENTS.map((a) => {
              const on = save.achievements.includes(a.id);
              return (
                <li key={a.id} className="flex items-center gap-2 rounded-lg bg-surface/70 px-3 py-2 text-sm">
                  {on ? <Check className="size-4 text-cyan" /> : <Lock className="size-4 text-foam-dim" />}
                  <span className="flex-1">
                    <span className="block font-semibold">{a.title}</span>
                    <span className="block text-xs text-foam-dim">{a.blurb}</span>
                  </span>
                  <span className="text-xs text-amber">{formatMoney(a.reward)}</span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="space-y-2">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-foam-dim">Ajustes</h3>
          <Toggle
            label={save.settings.muted ? "Som desligado" : "Som ligado"}
            icon={save.settings.muted ? VolumeX : Volume2}
            on={!save.settings.muted}
            onClick={() => toggle("muted")}
          />
          <Toggle label="Música" icon={Waves} on={save.settings.music} onClick={() => toggle("music")} />
          <Toggle label="Efeitos" icon={Volume2} on={save.settings.sfx} onClick={() => toggle("sfx")} />
          <Toggle label="Tremer tela" icon={Waves} on={save.settings.shake} onClick={() => toggle("shake")} />
        </section>

        <section>
          {!confirm ? (
            <button type="button" className="btn btn-ghost w-full text-coral" onClick={() => setConfirm(true)}>
              Reiniciar progresso
            </button>
          ) : (
            <div className="flex gap-2">
              <button type="button" className="btn btn-coral flex-1" onClick={reset}>
                Confirmar
              </button>
              <button type="button" className="btn btn-ghost flex-1" onClick={() => setConfirm(false)}>
                Cancelar
              </button>
            </div>
          )}
        </section>
        <p className="pb-4 text-center text-xs text-foam-dim">Fisgada · pescaria do abismo</p>
      </div>
    </div>
  );
}

function Toggle({
  label,
  icon: Icon,
  on,
  onClick,
}: {
  label: string;
  icon: typeof Volume2;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-xl bg-surface/80 px-3 py-3 shadow-[0_0_0_1px_rgb(255_255_255/0.08)]"
    >
      <span className="flex items-center gap-2 font-semibold">
        <Icon className="size-4" />
        {label}
      </span>
      <span className={cn("h-6 w-11 rounded-full p-0.5", on ? "bg-cyan" : "bg-ocean-deep")}>
        <span
          className={cn("block size-5 rounded-full bg-foam transition-transform duration-150", on && "translate-x-5")}
        />
      </span>
    </button>
  );
}

function Header({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex items-end justify-between">
      <h2 className="font-display text-2xl font-semibold">{title}</h2>
      <p className="text-sm font-semibold tabular-nums text-foam-dim">{sub}</p>
    </div>
  );
}
