import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { compile, CLASSIC, dryFly, kindsFor, newPart, PRESETS, ROLES, type Part, type PartsFly, type Preset, type Role } from "../edit/parts";
import { blankFly } from "../edit/own";
import { MATERIALS, type MaterialKind } from "../recipe/materials";
import { NAMED_COLORS, type NamedColor } from "../recipe/schema";
import { FlyScene } from "../render/FlyScene";
import { colourWord, kindName } from "../tying/describe";
import { simulate, stepEnd, type Build as Built } from "../tying/simulate";
import { t } from "../i18n/ui";
import { lang } from "../i18n/lang";
import { usePlayer } from "./usePlayer";
import { useSwatches } from "./renders";

/**
 * The fly builder made of parts (milestone 18, prototype): the 3D fly with handles to drag, the
 * parts in tying order, and the chosen part's material, colour and proportions.
 */

type History = { past: PartsFly[]; now: PartsFly; future: PartsFly[] };

const start = (): PartsFly => {
  const { materials: _m, steps: _s, ...meta } = blankFly(t.build.untitled);
  return dryFly(meta);
};

// Assumption: a newly added part starts in the material the patterns most often use for it on a dry fly.
const FIRST: Record<Role, { kind: MaterialKind; color?: string }> = {
  tail: { kind: "hackle-fibres", color: "brown" },
  body: { kind: "dry-fly-dubbing", color: "grey" },
  rib: { kind: "gold-wire" },
  wing: { kind: "hackle-tips", color: "grizzly" },
  hackle: { kind: "cock-hackle", color: "brown" },
};

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

function handlesOf(fly: PartsFly): Handle[] {
  const out: Handle[] = [];
  for (const p of fly.parts) {
    if (p.role === "tail" || p.role === "wing") {
      const root = (L: number) => ({ x: (p.at ?? 0) * L, y: p.role === "wing" ? 0.12 : 0.06 });
      out.push({
        key: `${p.id}:tip`,
        part: p.id,
        what: "tip",
        label: t.workbench.handle[p.role],
        at: (L) => {
          const r = root(L);
          const a = rad(p.angle ?? 0);
          return { x: r.x - Math.cos(a) * (p.length ?? 1), y: r.y + Math.sin(a) * (p.length ?? 1) };
        },
      });
    } else if (p.role === "body" || p.role === "hackle") {
      out.push({ key: `${p.id}:from`, part: p.id, what: "from", label: t.workbench.handle.from, at: (L) => ({ x: (p.from ?? 0) * L, y: -0.16 }) });
      out.push({ key: `${p.id}:to`, part: p.id, what: "to", label: t.workbench.handle.to, at: (L) => ({ x: (p.to ?? 1) * L, y: -0.16 }) });
      if (p.role === "hackle") {
        out.push({
          key: `${p.id}:fibre`,
          part: p.id,
          what: "fibre",
          label: t.workbench.handle.fibre,
          at: (L) => ({ x: (((p.from ?? 0.7) + (p.to ?? 0.9)) / 2) * L, y: -(p.props?.fibre ?? 1.5) }),
        });
      }
    }
  }
  return out;
}

export function Workbench() {
  const [history, setHistory] = useState<History>(() => ({ past: [], now: start(), future: [] }));
  const fly = history.now;
  const [selected, setSelected] = useState<string | null>(() => fly.parts[0]?.id ?? null);
  const [palette, setPalette] = useState(false);
  const [stepsOpen, setStepsOpen] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const swatches = useSwatches();

  /** A change; `merge` folds it into the last step of the history (the moves of one drag). */
  const change = (fn: (f: PartsFly) => PartsFly, merge = false) =>
    setHistory((h) => (merge ? { ...h, now: fn(h.now) } : { past: [...h.past.slice(-99), h.now], now: fn(h.now), future: [] }));
  const undo = () => setHistory((h) => (h.past.length ? { past: h.past.slice(0, -1), now: h.past.at(-1)!, future: [h.now, ...h.future] } : h));
  const redo = () => setHistory((h) => (h.future.length ? { past: [...h.past, h.now], now: h.future[0]!, future: h.future.slice(1) } : h));
  const setPart = (id: string, patch: Partial<Part>, merge = false) => {
    // An edit shows the whole fly, not a part's animation.
    setStopAt(null);
    player.pause();
    change((f) => ({ ...f, parts: follow(f.parts, id, patch) }), merge);
  };

  useEffect(() => {
    document.title = t.site.titled(t.workbench.title);
  }, [lang()]);

  const compiled = useMemo(() => compile(fly), [fly]);
  const language = lang();
  const build = useMemo<Built | null>(() => {
    try {
      return simulate(compiled.recipe);
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compiled, language]);

  const [stopAt, setStopAt] = useState<number | null>(null);
  const player = usePlayer(build?.duration ?? 0, stopAt);

  // The 3D fly, with the handles following it frame by frame.
  const container = useRef<HTMLDivElement>(null);
  const scene = useRef<FlyScene | null>(null);
  const handleEls = useRef(new Map<string, HTMLButtonElement>());
  const tap = useRef<{ x: number; y: number } | null>(null);
  const handles = useMemo(() => handlesOf(fly), [fly]);
  const handlesRef = useRef(handles);
  handlesRef.current = handles;
  const shank = build?.hook.shankLength ?? 2;
  const shankRef = useRef(shank);
  shankRef.current = shank;
  useEffect(() => {
    let s: FlyScene;
    try {
      s = new FlyScene(container.current!, { background: null });
    } catch {
      return;
    }
    s.setFollow(false);
    s.setView("side");
    s.onDraw = () => {
      for (const h of handlesRef.current) {
        const el = handleEls.current.get(h.key);
        if (!el) continue;
        const p = h.at(shankRef.current);
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

  // A new fly to show; while a handle is dragged the view stays put.
  const shownBuild = useRef<Built | null>(null);
  useEffect(() => {
    const s = scene.current;
    if (!s || !build) return;
    s.setBuild(build, dragging !== null);
    shownBuild.current = build;
    s.setTime(player.time > build.duration || !player.playing ? build.duration : player.time);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [build]);
  useEffect(() => {
    if (build && scene.current) scene.current.setTime(player.playing || stopAt !== null ? player.time : build.duration);
  }, [player.time, player.playing, stopAt, build]);
  // After a part's steps have played, the whole fly again.
  useEffect(() => {
    if (stopAt !== null && !player.playing && player.time >= stopAt - 1e-6) {
      const id = setTimeout(() => setStopAt(null), 700);
      return () => clearTimeout(id);
    }
  }, [player.playing, player.time, stopAt]);

  /** Plays how a part is tied, on the fly as it is before it. */
  const play = (partId: string, from: Built | null = build) => {
    const span = compiled.spans.get(partId);
    if (!from || !span) return;
    const first = from.steps[span[0]];
    const last = from.steps[span[1]];
    if (!first || !last) return;
    setStopAt(stepEnd(last));
    player.playFrom(first.start);
  };
  // A part just added plays once its fly is built.
  const justAdded = useRef<string | null>(null);
  useEffect(() => {
    if (justAdded.current && build) {
      play(justAdded.current, build);
      justAdded.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [build]);

  const add = (role: Role) => {
    const first = FIRST[role];
    const part = newPart(fly, role, first.kind, first.color);
    change((f) => ({ ...f, parts: [...f.parts, part] }));
    setSelected(part.id);
    setPalette(false);
    justAdded.current = part.id;
  };

  const drag = (h: Handle) => (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    setSelected(h.part);
    setDragging(h.key);
    setStopAt(null);
    let first = true;
    const move = (ev: PointerEvent) => {
      const s = scene.current;
      const box = container.current?.getBoundingClientRect();
      if (!s || !box) return;
      const p = s.shankPointAt(ev.clientX - box.left, ev.clientY - box.top);
      if (!p) return;
      const part = fly.parts.find((x) => x.id === h.part);
      if (!part) return;
      const L = shankRef.current;
      let patch: Partial<Part> = {};
      if (h.what === "tip") {
        const root = { x: (part.at ?? 0) * L, y: part.role === "wing" ? 0.12 : 0.06 };
        const dx = root.x - p.x;
        const dy = p.y - root.y;
        patch = { length: round2(snap(clamp(Math.hypot(dx, dy), 0.2, 5), CLASSIC[part.role].length)), angle: Math.round(clamp((Math.atan2(dy, dx) * 180) / Math.PI, 0, 90)) };
      } else if (h.what === "fibre") {
        patch = { props: { ...part.props, fibre: round2(snap(clamp(-p.y, 0.3, 4), 1.5)) } };
      } else {
        const u = Math.round(clamp(p.x / L, 0, 1) * 20) / 20;
        patch = h.what === "from" ? { from: Math.min(u, (part.to ?? 1) - 0.05) } : { to: Math.max(u, (part.from ?? 0) + 0.05) };
      }
      setPart(h.part, patch, !first);
      first = false;
    };
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      setDragging(null);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  };

  const part = fly.parts.find((p) => p.id === selected) ?? null;
  // The parts in the order they are tied.
  const order = [...fly.parts].sort((a, b) => (compiled.spans.get(a.id)?.[0] ?? 0) - (compiled.spans.get(b.id)?.[0] ?? 0));

  return (
    <div className="workbench">
      <section className="wb-stage" aria-label={t.pattern.stage}>
        <div
          className="wb-canvas"
          ref={container}
          onPointerDown={(e) => (tap.current = { x: e.clientX, y: e.clientY })}
          onPointerUp={(e) => {
            // A tap, not a turn of the fly: choose the part under it.
            const down = tap.current;
            tap.current = null;
            if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
            const box = container.current!.getBoundingClientRect();
            const step = scene.current?.pickStep(e.clientX - box.left, e.clientY - box.top);
            if (step === null || step === undefined) return;
            const hit = [...compiled.spans].find(([, [a, b]]) => step >= a && step <= b);
            if (hit) setSelected(hit[0]);
          }}
        />
        <div className="wb-handles">
          {handles.filter((h) => h.part === selected).map((h) => (
            <button
              key={h.key}
              ref={(el) => {
                if (el) handleEls.current.set(h.key, el);
                else handleEls.current.delete(h.key);
              }}
              className={`wb-handle${h.part === selected ? " on" : ""}${dragging === h.key ? " dragging" : ""}`}
              aria-label={h.label}
              title={h.label}
              onPointerDown={drag(h)}
            />
          ))}
        </div>
        <div className="wb-toolbar">
          <button onClick={undo} disabled={!history.past.length}>
            {t.workbench.undo}
          </button>
          <button onClick={redo} disabled={!history.future.length}>
            {t.workbench.redo}
          </button>
          <button aria-pressed={stepsOpen} onClick={() => setStepsOpen(!stepsOpen)}>
            {t.workbench.steps}
          </button>
        </div>
        <p className="wb-hint">{t.workbench.dragHint}</p>
      </section>

      <aside className="wb-side">
        <h1>{t.workbench.title}</h1>
        <p className="wb-prototype">{t.workbench.prototype}</p>

        <h2 className="wb-heading">{t.workbench.parts}</h2>
        <ul className="wb-rail">
          {order.map((p) => (
            <li key={p.id}>
              <button className={p.id === selected ? "wb-part on" : "wb-part"} aria-pressed={p.id === selected} onClick={() => setSelected(p.id)}>
                <PartIcon role={p.role} />
                <span className="wb-part-name">{t.workbench.role[p.role]}</span>
                <span className="wb-part-material">
                  <i className="wb-dot" style={{ background: dotColour(p) }} />
                  {kindName(p.kind)}
                </span>
              </button>
            </li>
          ))}
          <li>
            <button className="wb-part wb-add" onClick={() => setPalette(true)}>
              <span aria-hidden="true" className="wb-plus">
                +
              </span>
              <span className="wb-part-name">{t.workbench.addPart}</span>
            </button>
          </li>
        </ul>

        {part && (
          <PartPanel
            key={part.id}
            part={part}
            swatches={swatches}
            onChange={(patch) => setPart(part.id, patch)}
            onReplay={() => play(part.id)}
            onRemove={() => {
              change((f) => ({ ...f, parts: f.parts.filter((p) => p.id !== part.id) }));
              setSelected(null);
            }}
          />
        )}
      </aside>

      {palette && (
        <Sheet title={t.workbench.whichPart} onClose={() => setPalette(false)}>
          <ul className="wb-palette">
            {ROLES.map((role) => (
              <li key={role}>
                <button onClick={() => add(role)}>
                  <PartIcon role={role} large />
                  <span className="wb-part-name">{t.workbench.role[role]}</span>
                  <span className="wb-palette-hint">{t.workbench.roleHint[role]}</span>
                </button>
              </li>
            ))}
          </ul>
        </Sheet>
      )}

      {stepsOpen && build && (
        <Sheet title={t.workbench.steps} onClose={() => setStepsOpen(false)}>
          <p className="wb-palette-hint">{t.workbench.stepsIntro}</p>
          <ol className="wb-steps">
            {build.steps.map((s) => (
              <li key={s.index}>
                <strong>{s.title}</strong> {s.text}
              </li>
            ))}
          </ol>
        </Sheet>
      )}
    </div>
  );
}

/**
 * The parts with one changed; a rib follows its body, and a hackle that starts where the body
 * ends moves with that end, keeping its length.
 */
function follow(parts: Part[], id: string, patch: Partial<Part>): Part[] {
  const before = parts.find((p) => p.id === id);
  const next = parts.map((p) => (p.id === id ? { ...p, ...patch } : p));
  const body = next.find((p) => p.id === id);
  if (!before || !body || body.role !== "body") return next;
  const oldEnd = before.to ?? 0.7;
  const newEnd = body.to ?? 0.7;
  return next.map((p) => {
    if (p.role === "rib") return { ...p, from: body.from, to: body.to };
    if (p.role === "hackle" && Math.abs((p.from ?? 0.7) - oldEnd) < 0.02) {
      const span = (p.to ?? 0.9) - (p.from ?? 0.7);
      const from = Math.min(newEnd, 0.95);
      return { ...p, from: round2(from), to: round2(Math.min(1, from + span)) };
    }
    return p;
  });
}

/** Snaps a value to the classic one when it is within a twentieth of it. */
function snap(v: number, classic?: number): number {
  if (classic === undefined) return v;
  for (const m of Object.values(PRESETS)) if (Math.abs(v - classic * m) < classic * 0.05) return classic * m;
  return v;
}

function dotColour(p: Part): string {
  const c = p.color ?? (MATERIALS[p.kind] as { defaultColor?: string }).defaultColor ?? "grey";
  return c in NAMED_COLORS ? NAMED_COLORS[c as NamedColor] : c.startsWith("#") ? c : NAMED_COLORS.grey;
}

/** The value a preset scales, for this part: a length, the body's end, the hackle's fibres. */
function presetValue(p: Part): { get: number | undefined; classic: number; set: (v: number) => Partial<Part> } | null {
  const c = CLASSIC[p.role];
  if (p.role === "tail" || p.role === "wing") return { get: p.length, classic: c.length!, set: (v) => ({ length: round2(v) }) };
  if (p.role === "body") return { get: p.to, classic: c.to!, set: (v) => ({ to: round2(clamp(v, (p.from ?? 0) + 0.05, 1)) }) };
  if (p.role === "hackle") return { get: p.props?.fibre, classic: c.props!.fibre!, set: (v) => ({ props: { ...p.props, fibre: round2(v) } }) };
  return null;
}

function PartPanel({
  part,
  swatches,
  onChange,
  onReplay,
  onRemove,
}: {
  part: Part;
  swatches: Record<string, string> | null;
  onChange: (patch: Partial<Part>) => void;
  onReplay: () => void;
  onRemove: () => void;
}) {
  const kinds = kindsFor(part.role);
  const swatchOf = (kind: MaterialKind) => {
    if (!swatches) return null;
    const own = swatches[`${kind}--${part.color}`];
    if (own) return own;
    const any = Object.keys(swatches).find((k) => k.startsWith(`${kind}--`));
    return any ? swatches[any] : null;
  };
  const preset = presetValue(part);
  const fields = FIELDS[part.role];
  return (
    <section className="wb-panel" aria-label={t.workbench.role[part.role]}>
      <div className="wb-panel-head">
        <h2>{t.workbench.role[part.role]}</h2>
        <button className="link" onClick={onReplay}>
          {t.workbench.replay}
        </button>
      </div>

      <h3 className="wb-heading">{t.workbench.material}</h3>
      <ul className="wb-swatches">
        {kinds.map((kind) => {
          const img = swatchOf(kind);
          return (
            <li key={kind}>
              <button
                className={kind === part.kind ? "wb-swatch on" : "wb-swatch"}
                aria-pressed={kind === part.kind}
                onClick={() => onChange({ kind, ...(MATERIALS[kind].archetype === "hackle" ? { props: part.props ?? { fibre: 1.5 } } : { props: undefined }) })}
              >
                {img ? <img src={img} alt="" loading="lazy" /> : <span className="wb-swatch-blank" style={{ background: dotColour({ ...part, kind }) }} />}
                <span>{kindName(kind)}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <h3 className="wb-heading">{t.workbench.colour}</h3>
      <ul className="wb-colours">
        {(Object.keys(NAMED_COLORS) as NamedColor[]).map((c) => (
          <li key={c}>
            <button
              className={c === part.color ? "wb-colour on" : "wb-colour"}
              style={{ background: NAMED_COLORS[c] }}
              aria-pressed={c === part.color}
              aria-label={colourWord(c, part.kind)}
              title={colourWord(c, part.kind)}
              onClick={() => onChange({ color: c })}
            />
          </li>
        ))}
      </ul>

      {preset && (
        <>
          <h3 className="wb-heading">{t.workbench.proportions}</h3>
          <div className="wb-presets" role="group">
            {(Object.keys(PRESETS) as Preset[]).map((k) => {
              const v = preset.classic * PRESETS[k];
              const on = preset.get !== undefined && Math.abs(preset.get - v) < 0.02;
              return (
                <button key={k} aria-pressed={on} className={on ? "on" : ""} onClick={() => onChange(preset.set(v))}>
                  {t.workbench.presets[k]}
                </button>
              );
            })}
          </div>
        </>
      )}

      <details className="wb-more">
        <summary>{t.workbench.more}</summary>
        <div className="wb-fields">
          {fields.map((f) => (
            <Field key={f} field={f} part={part} onChange={onChange} />
          ))}
        </div>
      </details>

      <button className="link wb-remove" onClick={onRemove}>
        {t.workbench.remove}
      </button>
    </section>
  );
}

type FieldName = keyof typeof t.workbench.field;
const FIELDS: Record<Role, FieldName[]> = {
  tail: ["length", "angle", "spread", "at"],
  wing: ["length", "angle", "spread", "at"],
  body: ["from", "to", "turns"],
  rib: ["turns", "counter"],
  hackle: ["fibre", "from", "to", "turns"],
};

function Field({ field, part, onChange }: { field: FieldName; part: Part; onChange: (patch: Partial<Part>) => void }) {
  const label = t.workbench.field[field];
  if (field === "counter") {
    return (
      <label className="wb-check">
        <input type="checkbox" checked={!!part.counter} onChange={(e) => onChange({ counter: e.target.checked || undefined })} />
        {label}
      </label>
    );
  }
  const shankField = field === "from" || field === "to" || field === "at";
  const value = field === "fibre" ? part.props?.fibre : part[field];
  const shown = value === undefined ? "" : shankField ? Math.round(value * 100) : value;
  const unit = shankField ? t.workbench.unit.shank : field === "angle" || field === "spread" ? t.workbench.unit.degrees : field === "turns" ? "" : t.workbench.unit.gapes;
  return (
    <label className="wb-field">
      <span>{label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={shown}
        placeholder={field === "turns" ? t.workbench.autoTurns : undefined}
        step={shankField ? 5 : field === "angle" || field === "spread" || field === "turns" ? 1 : 0.1}
        onChange={(e) => {
          const n = e.target.value === "" ? undefined : Number(e.target.value);
          if (n !== undefined && !Number.isFinite(n)) return;
          const v = n === undefined ? undefined : shankField ? clamp(n / 100, 0, 1) : n;
          onChange(field === "fibre" ? { props: { ...part.props, fibre: v ?? 1.5 } } : ({ [field]: v } as Partial<Part>));
        }}
      />
      <span className="wb-unit">{unit}</span>
    </label>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [onClose]);
  return (
    <div className="wb-sheet-backdrop" onClick={onClose}>
      <div className="wb-sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="wb-panel-head">
          <h2>{title}</h2>
          <button className="link" onClick={onClose}>
            {t.workbench.close}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** A small drawing of a part on a hook: the hook in faint ink, the part in the accent colour. */
function PartIcon({ role, large = false }: { role: Role; large?: boolean }) {
  const part: Record<Role, ReactNode> = {
    tail: <path d="M14 20 L3 17 M14 20 L2 20 M14 20 L3 23" />,
    body: <path d="M15 20 H38" strokeWidth={5} strokeLinecap="round" />,
    rib: <path d="M16 17 L19 23 M22 17 L25 23 M28 17 L31 23 M34 17 L37 23" />,
    wing: <path d="M33 19 L30 5 M33 19 L36 6" />,
    hackle: <path d="M40 20 L40 8 M40 20 L46 10 M40 20 L34 10 M40 20 L40 31 M40 20 L46 30 M40 20 L34 30" />,
  };
  return (
    <svg className={large ? "wb-icon large" : "wb-icon"} viewBox="0 0 50 40" aria-hidden="true">
      <path className="wb-icon-hook" d="M46 20 H14 C6 20 6 34 14 34 C19 34 21 30 21 27" />
      <circle className="wb-icon-hook" cx="47.5" cy="20" r="1.5" />
      <g className="wb-icon-part">{part[role]}</g>
    </svg>
  );
}
