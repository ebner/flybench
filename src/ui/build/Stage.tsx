import { useEffect, useMemo, useRef, useState } from "react";
import { rearLimit, type Compiled, type Part, type PartsFly } from "../../edit/parts";
import { FlyScene } from "../../render/FlyScene";
import { stepAt, stepEnd, type Build as Built } from "../../tying/simulate";
import { t } from "../../i18n/ui";
import type { Player } from "../usePlayer";
import { StepBar } from "../StepBar";
import { TransportIcon } from "../PatternPage";

/** A handle on the fly: which part, what it sets, where it is on the shank's plane (gapes). */
interface Handle {
  key: string;
  part: string;
  what: "tip" | "from" | "to" | "fibre";
  at: (L: number) => { x: number; y: number };
  label: string;
}

const rad = (deg: number) => (deg * Math.PI) / 180;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round2 = (v: number) => Math.round(v * 100) / 100;

/** Where a part starts along the shank, and which of its settings says so. */
export const startKey = (p: Part): "at" | "from" => (p.how === "dubbed" || p.how === "spun" || p.how === "thread" || p.how === "weight" ? "from" : "at");

/** The root of a bunch: on top of the shank, or under it. */
const rootOf = (p: Part, L: number) => ({ x: (p.at ?? 0) * L, y: p.side === "under" ? -0.1 : 0.1 });

function handlesOf(p: Part): Handle[] {
  const out: Handle[] = [];
  const h = t.workbench.handle;
  // (A fur strip pulled over the body has its tail, too.)
  if ((p.how === "bunch" || p.how === "extended" || p.how === "pulled") && p.length !== undefined && p.side !== "across") {
    out.push({
      key: `${p.id}:tip`,
      part: p.id,
      what: "tip",
      label: h.tip,
      at: (L) => {
        const r = rootOf(p, L);
        const a = rad(p.angle ?? 0);
        const dir = p.forward ? 1 : -1;
        return { x: r.x + dir * Math.cos(a) * p.length!, y: r.y + (p.side === "under" ? -1 : 1) * Math.sin(a) * p.length! };
      },
    });
  }
  const span = ["wound", "dubbed", "spun", "thread", "pulled", "palmered", "weight", "sleeve", "woven"].includes(p.how);
  if (span) {
    const k = startKey(p);
    out.push({ key: `${p.id}:from`, part: p.id, what: "from", label: h.from, at: (L) => ({ x: (p[k] ?? 0) * L, y: -0.18 }) });
    if (p.to !== undefined) out.push({ key: `${p.id}:to`, part: p.id, what: "to", label: h.to, at: (L) => ({ x: p.to! * L, y: -0.18 }) });
  }
  const fibre = p.mats[0]?.props?.fibre;
  if ((p.role === "hackle" && (p.how === "wound" || p.how === "parachute")) && typeof fibre === "number") {
    out.push({
      key: `${p.id}:fibre`,
      part: p.id,
      what: "fibre",
      label: h.fibre,
      at: (L) => ({ x: ((p.at ?? 0.7) + (p.to ?? p.at ?? 0.9)) * 0.5 * L, y: -fibre }),
    });
  }
  return out;
}

/** The part's new settings for a handle dragged to (x, y) on the shank's plane. */
/** `rear`: how far back along the shank its positions may go (behind the bend, for a thread binding hair there). */
function dragged(p: Part, what: Handle["what"], x: number, y: number, L: number, rear = 0): Partial<Part> {
  if (what === "tip") {
    const r = rootOf(p, L);
    const dx = p.forward ? x - r.x : r.x - x;
    const dy = (p.side === "under" ? -1 : 1) * (y - r.y);
    return { length: round2(clamp(Math.hypot(dx, dy), 0.2, 8)), angle: Math.round(clamp((Math.atan2(dy, dx) * 180) / Math.PI, 0, 90)) };
  }
  if (what === "fibre") return { mats: p.mats.map((m, i) => (i === 0 ? { ...m, props: { ...m.props, fibre: round2(clamp(-y, 0.3, 4)) } } : m)) };
  const u = Math.round(clamp(x / L, rear, 1) * 40) / 40;
  if (what === "from") return { [startKey(p)]: u } as Partial<Part>;
  return { to: u };
}

export function Stage({
  build,
  compiled,
  fly,
  focus,
  selected,
  guide,
  watching,
  player,
  onSelect,
  onDrag,
  onDragEnd,
  tools,
  focused,
  framing,
}: {
  build: Built | null;
  compiled: Compiled;
  fly: PartsFly;
  /** The parts shown in full; null: the whole fly. */
  focus: ReadonlySet<string> | null;
  /** The part whose handles show. */
  selected: string | null;
  guide: boolean;
  watching: boolean;
  player: Player;
  /** A part tapped on the fly (null: empty space, for the whole fly). */
  onSelect: (id: string | null, add: boolean) => void;
  onDrag: (id: string, patch: Partial<Part>, first: boolean) => void;
  onDragEnd: () => void;
  tools: React.ReactNode;
  /** Parts are chosen and the rest is faint: the stage offers the whole fly. */
  focused: boolean;
  /** What the camera frames: a new value (another fly, another hook) frames the fly afresh; edits keep the view. */
  framing: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const scene = useRef<FlyScene | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const handleEls = useRef(new Map<string, HTMLButtonElement>());
  const part = fly.parts.find((p) => p.id === selected);
  const handles = useMemo(() => (part && !watching ? handlesOf(part) : []), [part, watching]);
  const handlesRef = useRef(handles);
  handlesRef.current = handles;
  const shank = useRef(2);
  shank.current = build?.hook.shankLength ?? 2;
  const [dragging, setDragging] = useState<string | null>(null);
  const tap = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let s: FlyScene;
    try {
      s = new FlyScene(container.current!, { background: null });
    } catch {
      setUnavailable(true);
      return;
    }
    s.setFollow(false);
    s.setView("side");
    s.onDraw = () => {
      for (const h of handlesRef.current) {
        const el = handleEls.current.get(h.key);
        if (!el) continue;
        const p = h.at(shank.current);
        const at = s.screenOf(p.x, p.y);
        el.style.visibility = at ? "visible" : "hidden";
        if (at) el.style.transform = `translate(${at.x}px, ${at.y}px)`;
      }
    };
    scene.current = s;
    return () => {
      s.dispose();
      scene.current = null;
    };
  }, []);

  // The fly as it is, in the view the visitor has it in; framed afresh for another fly or hook.
  const framed = useRef<string | null>(null);
  useEffect(() => {
    const s = scene.current;
    if (!s || !build) return;
    s.setBuild(build, framed.current === framing);
    framed.current = framing;
    s.setTime(watching ? player.time : build.duration);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [build]);
  useEffect(() => {
    if (build) scene.current?.setTime(watching || player.playing ? player.time : build.duration);
  }, [player.time, player.playing, watching, build]);
  // The chosen parts in full, the rest faint.
  useEffect(() => {
    const s = scene.current;
    if (!s || !build) return;
    if (!focus || watching) return s.setFocus(null);
    s.setFocus(new Set(compiled.owners.flatMap((id, i) => (id && focus.has(id) ? [i] : []))), focus.has("thread"));
  }, [focus, build, compiled, watching]);
  // The proportion guide, in the theme's ink.
  useEffect(() => {
    const apply = () => scene.current?.setProportions(guide, getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || undefined);
    apply();
    if (!guide) return;
    const watch = new MutationObserver(apply);
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => watch.disconnect();
  }, [guide, build]);

  const drag = (h: Handle) => (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    setDragging(h.key);
    let first = true;
    const move = (ev: PointerEvent) => {
      const s = scene.current;
      const box = container.current?.getBoundingClientRect();
      const p = fly.parts.find((x) => x.id === h.part);
      if (!s || !box || !p) return;
      const at = s.shankPointAt(ev.clientX - box.left, ev.clientY - box.top);
      if (!at) return;
      onDrag(h.part, dragged(p, h.what, at.x, at.y, shank.current, rearLimit(fly, p)), first);
      first = false;
    };
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      setDragging(null);
      onDragEnd();
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  };
  // Arrow keys move a focused handle a step at a time.
  const key = (h: Handle) => (e: React.KeyboardEvent) => {
    const p = fly.parts.find((x) => x.id === h.part);
    if (!p) return;
    const step = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
    if (!step) return;
    e.preventDefault();
    const now = h.at(shank.current);
    onDrag(h.part, dragged(p, h.what, now.x + step[0]! * 0.05, now.y + step[1]! * 0.05, shank.current, rearLimit(fly, p)), true);
  };

  const current = build && build.steps.length ? stepAt(build, player.time) : -1;
  const step = current >= 0 ? build!.steps[current] : undefined;

  return (
    <section className={watching ? "wb-stage watching" : "wb-stage"} aria-label={t.pattern.stage}>
      {unavailable && <p className="viewer-unavailable">{t.viewer.noWebgl}</p>}
      <div
        className="wb-canvas"
        ref={container}
        onPointerDown={(e) => (tap.current = { x: e.clientX, y: e.clientY })}
        onPointerUp={(e) => {
          // A tap, not a turn of the fly: choose the part under it (with Shift, add it).
          const down = tap.current;
          tap.current = null;
          if (watching || !down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
          const box = container.current!.getBoundingClientRect();
          const i = scene.current?.pickStep(e.clientX - box.left, e.clientY - box.top);
          const id = i === null || i === undefined ? null : owner(compiled, i);
          onSelect(id, e.shiftKey);
        }}
      />
      <div className="wb-handles">
        {handles.map((h) => (
          <button
            key={h.key}
            ref={(el) => {
              if (el) handleEls.current.set(h.key, el);
              else handleEls.current.delete(h.key);
            }}
            className={dragging === h.key ? "wb-handle dragging" : "wb-handle"}
            aria-label={h.label}
            title={h.label}
            onPointerDown={drag(h)}
            onKeyDown={key(h)}
            onKeyUp={() => onDragEnd()}
          />
        ))}
      </div>
      <div className="wb-toolbar">{tools}</div>
      {watching && build ? (
        <div className="wb-player">
          <div className="now" aria-live="polite">
            {step && (
              <>
                <p className="now-index">{t.pattern.stepOf(current + 1, build.steps.length)}</p>
                <h2>{step.title}</h2>
                <p className="now-text">{step.text}</p>
              </>
            )}
          </div>
          <div className="transport">
            <StepBar build={build} time={player.time} onSeek={(time) => (player.pause(), player.seek(time))} />
            <div className="transport-buttons">
              <button onClick={() => step && player.playFrom(build.steps[Math.max(0, current - 1)]!.start)} disabled={current <= 0} aria-label={t.pattern.previous}>
                <TransportIcon name="previous" />
              </button>
              <button
                className="play"
                onClick={() => (player.playing ? player.pause() : player.time >= build.duration - 1e-3 ? player.playFrom(0) : player.play())}
                aria-label={player.playing ? t.pattern.pause : t.pattern.play}
              >
                <TransportIcon name={player.playing ? "pause" : "play"} />
              </button>
              <button onClick={() => step && player.playFrom(step.start)} aria-label={t.pattern.replay}>
                <TransportIcon name="replay" />
              </button>
              <button
                onClick={() => current < build.steps.length - 1 && player.seek(stepEnd(build.steps[current]!))}
                disabled={current >= build.steps.length - 1}
                aria-label={t.pattern.next}
              >
                <TransportIcon name="next" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="wb-hint">
          {focused ? (
            <button className="wb-whole" onClick={() => onSelect(null, false)}>
              {t.workbench.showWhole}
            </button>
          ) : null}
          <p>{part ? t.workbench.dragHint : t.workbench.focusHint}</p>
        </div>
      )}
    </section>
  );
}

/** Which part a step is for. */
export const owner = (compiled: Compiled, step: number): string | null => compiled.owners[step] ?? null;
