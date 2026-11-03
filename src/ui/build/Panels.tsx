import { useEffect, useRef, useState } from "react";
import { CLASSIC, kindsFor, PRESETS, unavailable, waysFor, waysOf, type How, type Part, type PartMaterial, type PartsFly, type Preset } from "../../edit/parts";
import { DIFFICULTY_LABELS, SPECIES_LABELS, TYPE_LABELS } from "../../catalog/describe";
import { match } from "../../catalog/inventory";
import { swatchName, swatchRecipe } from "../../catalog/swatch";
import { MATERIALS, type MaterialKind } from "../../recipe/materials";
import { DIFFICULTIES, FLY_TYPES, HOOK_MODEL_IDS, isTube, NAMED_COLORS, SPECIES, THREAD_SIZES, TUBE_MODEL_IDS, type NamedColor, type Recipe } from "../../recipe/schema";
import { FlyScene } from "../../render/FlyScene";
import { colourWord, hookModelName, kindName } from "../../tying/describe";
import { simulate } from "../../tying/simulate";
import { t } from "../../i18n/ui";
import { floats } from "../../recipe/validate";

const HOOK_SIZES = Array.from({ length: 12 }, (_, i) => 2 + 2 * i);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round2 = (v: number) => Math.round(v * 100) / 100;

/** The named colours by family, for the chips. */
// Assumption: fly tyers' usual grouping of colours.
const FAMILIES: Record<keyof typeof t.workbench.families, NamedColor[]> = {
  light: ["white", "cream", "bleached", "badger", "teal", "clear"],
  grey: ["black", "grizzly", "grey", "dun", "blue-dun", "muskrat", "snipe", "lead", "mallard"],
  brown: ["brown", "red-brown", "red-game", "coch", "ginger", "tan", "elk", "hares-ear", "pheasant-tail", "partridge", "deer", "squirrel", "moose", "turkey", "pardo"],
  warm: ["red", "fluo-red", "claret", "pink", "orange", "tippet", "yellow", "crest"],
  cool: ["olive", "green", "chartreuse", "blue", "blue-black", "purple"],
  metal: ["gold", "silver", "copper", "pearl"],
};

export const dotColour = (m: PartMaterial): string => {
  const c = m.color ?? (MATERIALS[m.kind] as { defaultColor?: string }).defaultColor ?? "grey";
  return c in NAMED_COLORS ? NAMED_COLORS[c as NamedColor] : c.startsWith("#") ? c : NAMED_COLORS.grey;
};

/** A part's material, for the inventory: its kind and colour (its own colour is "natural"). */
const need = (m: PartMaterial) => ({ kind: m.kind, color: m.color ?? "natural" });

/** The swatch picture of a kind: in this colour if there is one, else in any. */
function swatchOf(swatches: Record<string, string> | null, kind: MaterialKind, color?: string): string | null {
  if (!swatches) return null;
  if (color && swatches[swatchName(kind, color)]) return swatches[swatchName(kind, color)]!;
  const any = Object.keys(swatches).find((k) => k.startsWith(`${kind}--`));
  return any ? swatches[any]! : null;
}

/** The value a preset scales, for this part: a length, a body's end, a hackle's fibres. */
function presetOf(p: Part): { get: number | undefined; classic: number; set: (v: number) => Partial<Part> } | null {
  const c = CLASSIC[p.role];
  if (p.length !== undefined && c.length !== undefined) return { get: p.length, classic: c.length, set: (v) => ({ length: round2(v) }) };
  if (p.role === "body" && p.to !== undefined) return { get: p.to, classic: c.to!, set: (v) => ({ to: round2(clamp(v, (p.at ?? p.from ?? 0) + 0.05, 1)) }) };
  const fibre = p.mats[0]?.props?.fibre;
  if (p.role === "hackle" && typeof fibre === "number")
    return { get: fibre, classic: 1.5, set: (v) => ({ mats: p.mats.map((m, i) => (i === 0 ? { ...m, props: { ...m.props, fibre: round2(v) } } : m)) }) };
  return null;
}

export function PartPanel({
  fly,
  part,
  swatches,
  owned,
  problems,
  onChange,
  onHow,
  onMaterial,
  onMix,
  onUnmix,
  onReplay,
  onRemove,
}: {
  fly: PartsFly;
  part: Part;
  swatches: Record<string, string> | null;
  owned: Set<string>;
  problems: string[];
  onChange: (patch: Partial<Part>) => void;
  onHow: (how: How) => void;
  onMaterial: (index: number, patch: Partial<PartMaterial>) => void;
  onMix: (kind: MaterialKind, color?: string) => void;
  onUnmix: (index: number) => void;
  onReplay: () => void;
  onRemove: () => void;
}) {
  const [chosen, setMat] = useState(0);
  // Kept within the mix as it is now (an undo can take a material out of it).
  const mat = Math.max(0, Math.min(chosen, part.mats.length - 1));
  const m = part.mats[mat];
  // The ways every material in the part can be tied (a mix of cock hackle and CDC: not round a post).
  const ways = m ? waysOf(part) : [];
  const preset = presetOf(part);
  const w = t.workbench;
  return (
    <section className="wb-panel" aria-label={w.role[part.role]}>
      <div className="wb-panel-head">
        <h2>{w.role[part.role]}</h2>
        <button className="link" onClick={onReplay}>
          {w.replay}
        </button>
        <button className="link danger" onClick={onRemove} aria-label={w.removeLabel(w.role[part.role])}>
          {w.remove}
        </button>
      </div>
      {problems.length > 0 && (
        <div className="build-problems" role="alert">
          <p>{w.problem}</p>
          <ul>
            {problems.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      {part.mats.length > 0 && (
        <>
          {part.mats.length > 1 && (
            <div className="wb-mix" role="tablist">
              {part.mats.map((x, i) => (
                <button key={x.id} role="tab" aria-selected={i === mat} className={i === mat ? "on" : ""} onClick={() => setMat(i)}>
                  <i className="wb-dot" style={{ background: dotColour(x) }} />
                  {kindName(x.kind)}
                </button>
              ))}
            </div>
          )}
          {m && (
            <>
              <h3 className="wb-heading">{w.material}</h3>
              <MaterialPicker
                role={part.role}
                kind={m.kind}
                color={m.color}
                swatches={swatches}
                owned={owned}
                only={part.mats.length > 1 ? (k) => waysFor(part.role, k).includes(part.how) : undefined}
                onPick={(kind) => onMaterial(mat, { kind })}
              />
              <h3 className="wb-heading">{w.colour}</h3>
              <ColourPicker kind={m.kind} color={m.color} owned={owned} onPick={(color) => onMaterial(mat, { color })} />
            </>
          )}
          {(part.how === "bunch" || part.how === "wound" || part.how === "parachute") && (
            <div className="wb-mix-actions">
              {part.mats.length < 3 && m && (
                <button className="link" onClick={() => onMix(m.kind, undefined)} title={w.mixHint}>
                  {w.mix}
                </button>
              )}
              {part.mats.length > 1 && (
                <button
                  className="link"
                  onClick={() => {
                    onUnmix(mat);
                    setMat(0);
                  }}
                >
                  {w.unmix}
                </button>
              )}
            </div>
          )}
        </>
      )}

      {ways.length > 1 && (
        <>
          <h3 className="wb-heading">{w.tiedAs}</h3>
          <div className="wb-ways" role="group">
            {ways.map((how) => {
              const why = unavailable(fly, part, how);
              return (
                <button key={how} aria-pressed={part.how === how} className={part.how === how ? "on" : ""} disabled={!!why} title={why ? w.unavailable[why] : undefined} onClick={() => onHow(how)}>
                  {w.way[how]}
                  {why && <span className="wb-why">{w.unavailable[why]}</span>}
                </button>
              );
            })}
          </div>
        </>
      )}

      {preset && (
        <>
          <h3 className="wb-heading">{w.proportions}</h3>
          <div className="wb-presets" role="group">
            {(Object.keys(PRESETS) as Preset[]).map((k) => {
              const v = preset.classic * PRESETS[k];
              const on = preset.get !== undefined && Math.abs(preset.get - v) < 0.02;
              return (
                <button key={k} aria-pressed={on} className={on ? "on" : ""} onClick={() => onChange(preset.set(v))}>
                  {w.presets[k]}
                </button>
              );
            })}
          </div>
        </>
      )}

      <details className="wb-more">
        <summary>{w.more}</summary>
        <div className="wb-fields">
          <MoreFields part={part} mat={mat} onChange={onChange} onMaterial={onMaterial} />
        </div>
      </details>
    </section>
  );
}

function MaterialPicker({
  role,
  kind,
  color,
  swatches,
  owned,
  only,
  onPick,
}: {
  role: Part["role"];
  kind: MaterialKind;
  color?: string;
  swatches: Record<string, string> | null;
  owned: Set<string>;
  only?: (kind: MaterialKind) => boolean;
  onPick: (kind: MaterialKind) => void;
}) {
  // The visitor's own materials first, then the rest; a copied pattern's own material is kept in the list.
  const kinds = [...new Set([kind, ...kindsFor(role).filter((k) => !only || only(k))])];
  const has = (k: MaterialKind) => [...owned].some((o) => o.startsWith(`${k}:`));
  kinds.sort((a, b) => Number(has(b)) - Number(has(a)));
  return (
    <ul className="wb-swatches">
      {kinds.map((k) => {
        const img = swatchOf(swatches, k, k === kind ? color : undefined);
        return (
          <li key={k}>
            <button className={k === kind ? "wb-swatch on" : "wb-swatch"} aria-pressed={k === kind} onClick={() => onPick(k)}>
              {img ? <img src={img} alt="" loading="lazy" width={240} height={180} /> : <span className="wb-swatch-blank" />}
              <span>{kindName(k)}</span>
              {has(k) && <span className="wb-owned">{t.workbench.inYours}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function ColourPicker({ kind, color, owned, onPick }: { kind: MaterialKind; color?: string; owned: Set<string>; onPick: (color: string) => void }) {
  const [hover, setHover] = useState<string | null>(null);
  const shown = hover ?? color ?? (MATERIALS[kind] as { defaultColor?: string }).defaultColor ?? "black";
  const families = t.workbench.families;
  return (
    <div className="wb-colour-picker">
      <MaterialPreview kind={kind} color={shown} />
      <p className="wb-colour-name">{colourWord(shown, kind)}</p>
      {(Object.keys(FAMILIES) as (keyof typeof FAMILIES)[]).map((f) => (
        <div key={f} className="wb-family">
          <h4>{families[f]}</h4>
          <ul className="wb-colours">
            {FAMILIES[f].map((c) => {
              const mine = match({ kind, color: c }, owned) === "have";
              return (
                <li key={c}>
                  <button
                    className={`wb-colour${c === color ? " on" : ""}${mine ? " owned" : ""}`}
                    style={{ background: NAMED_COLORS[c] }}
                    aria-pressed={c === color}
                    aria-label={colourWord(c, kind)}
                    title={mine ? `${colourWord(c, kind)} (${t.workbench.inYours})` : colourWord(c, kind)}
                    onPointerEnter={() => setHover(c)}
                    onPointerLeave={() => setHover(null)}
                    onFocus={() => setHover(c)}
                    onBlur={() => setHover(null)}
                    onClick={() => onPick(c)}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <label className="wb-any-colour">
        {t.workbench.anyColour}
        <input type="color" value={color?.startsWith("#") ? color : color && color in NAMED_COLORS ? NAMED_COLORS[color as NamedColor] : "#808080"} onChange={(e) => onPick(e.target.value)} />
      </label>
    </div>
  );
}

/** The material in this colour on a bare hook, drawn live (its picture for any colour). */
function MaterialPreview({ kind, color }: { kind: MaterialKind; color: string }) {
  const container = useRef<HTMLDivElement>(null);
  const scene = useRef<FlyScene | null>(null);
  useEffect(() => {
    try {
      const s = new FlyScene(container.current!, { background: null, fov: 20 });
      s.setFollow(false);
      scene.current = s;
    } catch {
      return;
    }
    return () => {
      scene.current?.dispose();
      scene.current = null;
    };
  }, []);
  useEffect(() => {
    const s = scene.current;
    if (!s) return;
    try {
      const build = simulate(swatchRecipe(kind, color));
      s.setBuild(build);
      s.setView("default");
      s.setFraming("dressing");
      s.setTime(build.duration);
    } catch {
      // A colour the material can't take: the last one stays.
    }
  }, [kind, color]);
  return <div className="wb-preview" ref={container} aria-hidden="true" />;
}

type FieldKey = keyof typeof t.workbench.field;

function MoreFields({ part, mat, onChange, onMaterial }: { part: Part; mat: number; onChange: (patch: Partial<Part>) => void; onMaterial: (i: number, patch: Partial<PartMaterial>) => void }) {
  const f = t.workbench.field;
  const m = part.mats[mat];
  // A setting the part has keeps a value: emptying its field leaves it as it was.
  const num = (key: "length" | "angle" | "spread" | "width" | "collar" | "windTo", unit: string, step: number, lo: number, hi: number) =>
    part[key] !== undefined && <Num key={key} label={f[key]} value={part[key]} unit={unit} step={step} onChange={(v) => v !== undefined && onChange({ [key]: clamp(v, lo, hi) })} />;
  const shankNum = (key: "at" | "from" | "to", label: FieldKey) =>
    part[key] !== undefined && (
      <Num key={key} label={f[label] as string} value={Math.round(part[key]! * 100)} unit={t.workbench.unit.shank} step={5} onChange={(v) => v !== undefined && onChange({ [key]: clamp(v / 100, 0, 1) })} />
    );
  const g = t.workbench.unit.gapes;
  const deg = t.workbench.unit.degrees;
  return (
    <>
      {shankNum("at", "at")}
      {shankNum("from", "from")}
      {shankNum("to", "to")}
      {num("length", g, 0.1, 0.1, 10)}
      {num("angle", deg, 1, 0, 90)}
      {num("spread", deg, 1, 0, 180)}
      {num("width", g, 0.05, 0.05, 3)}
      {num("collar", g, 0.1, 0, 4)}
      {part.side !== undefined && (
        <label className="wb-field">
          <span>{f.side}</span>
          <select value={part.side} onChange={(e) => onChange({ side: e.target.value as Part["side"] })}>
            {(["top", "under", "across"] as const).map((s) => (
              <option key={s} value={s}>
                {f.sides[s]}
              </option>
            ))}
          </select>
        </label>
      )}
      {(part.how === "wound" || part.how === "parachute" || part.how === "palmered") && m && (
        <Num label={f.turns} value={m.turns} placeholder={t.workbench.autoTurns} step={1} onChange={(v) => onMaterial(mat, { turns: v === undefined ? undefined : Math.round(clamp(v, 1, 100)) })} />
      )}
      {part.how === "wound" && part.role === "rib" && (
        <label className="wb-check">
          <input type="checkbox" checked={!!part.counter} onChange={(e) => onChange({ counter: e.target.checked || undefined })} />
          {f.counter}
        </label>
      )}
      {m && typeof m.props?.fibre === "number" && (
        <Num label={f.fibre} value={m.props.fibre} unit={g} step={0.1} onChange={(v) => v !== undefined && onMaterial(mat, { props: { ...m.props, fibre: clamp(v, 0.2, 5) } })} />
      )}
      {m && typeof m.props?.count === "number" && (
        <Num label={f.count} value={m.props.count} step={1} onChange={(v) => v !== undefined && onMaterial(mat, { props: { ...m.props, count: Math.round(clamp(v, 1, 60)) } })} />
      )}
      {m && typeof m.props?.mm === "number" && (
        <Num label={f.mm} value={m.props.mm} unit="mm" step={0.1} onChange={(v) => v !== undefined && onMaterial(mat, { props: { ...m.props, mm: round2(clamp(v, 0.5, 12)) } })} />
      )}
      {part.trim?.shape !== undefined && (
        <label className="wb-field">
          <span>{f.shape}</span>
          <select value={part.trim.shape} onChange={(e) => onChange({ trim: { ...part.trim, shape: e.target.value as "round" | "wedge" | "cigar" } })}>
            {(["round", "wedge", "cigar"] as const).map((s) => (
              <option key={s} value={s}>
                {f.shapes[s]}
              </option>
            ))}
          </select>
        </label>
      )}
      {part.role === "hackle" && (part.how === "wound" || part.how === "palmered") && (
        <label className="wb-field">
          <span>{f.keep}</span>
          <select
            value={part.trim?.keep ?? ""}
            onChange={(e) => onChange({ trim: e.target.value ? { ...part.trim, keep: e.target.value as "sides" | "top" | "under" } : part.how === "palmered" ? {} : undefined })}
          >
            <option value="">{f.none}</option>
            {(["sides", "top", "under"] as const).map((k) => (
              <option key={k} value={k}>
                {f.keeps[k]}
              </option>
            ))}
          </select>
        </label>
      )}
      {m && (
        <label className="wb-field wide">
          <span>{f.label}</span>
          <input value={m.label ?? ""} maxLength={80} onChange={(e) => onMaterial(mat, { label: e.target.value || undefined })} />
        </label>
      )}
      <label className="wb-field wide">
        <span>{f.note}</span>
        <textarea value={part.notes?.[0] ?? ""} maxLength={400} rows={2} onChange={(e) => onChange({ notes: { ...part.notes, 0: e.target.value } })} />
      </label>
    </>
  );
}

function Num({ label, value, unit, step, placeholder, onChange }: { label: string; value: number | undefined; unit?: string; step: number; placeholder?: string; onChange: (v: number | undefined) => void }) {
  const shown = value === undefined ? "" : String(round2(value));
  const [typed, setTyped] = useState(shown);
  const editing = useRef(false);
  // The value as it now is, unless the visitor is typing in it.
  useEffect(() => {
    if (!editing.current) setTyped(shown);
  }, [shown]);
  const commit = () => {
    editing.current = false;
    const n = typed === "" ? undefined : Number(typed);
    if (n !== value && (n === undefined || Number.isFinite(n))) onChange(n);
    // What the fly has now (a value clamped to its range, an emptied field left as it was),
    // shown once the parent has taken the change.
    setTimeout(() => !editing.current && setTyped(latest.current), 0);
  };
  const latest = useRef(shown);
  latest.current = shown;
  return (
    <label className="wb-field">
      <span>{label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={typed}
        step={step}
        placeholder={placeholder}
        onFocus={() => (editing.current = true)}
        onChange={(e) => {
          setTyped(e.target.value);
          // The arrows of a number field step at once; typing waits for the field to be left.
          if (!(e.nativeEvent as InputEvent).inputType) {
            const n = Number(e.target.value);
            if (e.target.value !== "" && Number.isFinite(n)) onChange(n);
          }
        }}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
      />
      <span className="wb-unit">{unit}</span>
    </label>
  );
}

/** The hook: its model from pictures, its size or a tube's length. */
export function HookPanel({ hook, pictures, onChange }: { hook: Recipe["hook"]; pictures: Record<string, string> | null; onChange: (h: Recipe["hook"]) => void }) {
  const w = t.workbench;
  return (
    <section className="wb-panel" aria-label={w.hookTile}>
      <div className="wb-panel-head">
        <h2>{w.hookTile}</h2>
      </div>
      <ul className="wb-swatches hooks">
        {[...HOOK_MODEL_IDS, ...TUBE_MODEL_IDS].map((model) => (
          <li key={model}>
            <button
              className={model === hook.model ? "wb-swatch on" : "wb-swatch"}
              aria-pressed={model === hook.model}
              onClick={() => {
                // Assumption: a 25 mm tube and a size 12 hook to start from.
                if (isTube(model) === isTube(hook.model)) onChange({ ...hook, model });
                else onChange(isTube(model) ? { model, length: 25 } : { model, size: 12 });
              }}
            >
              {pictures?.[model] ? <img src={pictures[model]} alt="" loading="lazy" width={240} height={180} /> : <span className="wb-swatch-blank" />}
              <span>{hookModelName(model)}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="wb-fields">
        {isTube(hook.model) ? (
          <>
            <Num label={w.tubeLength} value={hook.length} unit="mm" step={1} onChange={(v) => v !== undefined && onChange({ ...hook, length: Math.round(clamp(v, 8, 90)) })} />
            <label className="wb-field">
              <span>{w.treble}</span>
              <select value={hook.treble ?? 12} onChange={(e) => onChange({ ...hook, treble: Number(e.target.value) })}>
                {HOOK_SIZES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <div className="wb-sizes" role="group" aria-label={w.hookSize}>
            {HOOK_SIZES.map((s) => (
              <button key={s} aria-pressed={hook.size === s} className={hook.size === s ? "on" : ""} onClick={() => onChange({ ...hook, size: s })}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/** The thread: its colour and size. */
export function ThreadPanel({ thread, owned, onChange }: { thread: Recipe["thread"]; owned: Set<string>; onChange: (th: Recipe["thread"]) => void }) {
  const w = t.workbench;
  return (
    <section className="wb-panel" aria-label={w.threadTile}>
      <div className="wb-panel-head">
        <h2>{w.threadTile}</h2>
      </div>
      <h3 className="wb-heading">{w.colour}</h3>
      <ColourPicker kind="rib-thread" color={thread.color} owned={owned} onPick={(color) => onChange({ ...thread, color })} />
      <h3 className="wb-heading">{w.threadSize}</h3>
      <div className="wb-sizes" role="group" aria-label={w.threadSize}>
        {THREAD_SIZES.map((s) => (
          <button key={s} aria-pressed={thread.size === s} className={thread.size === s ? "on" : ""} onClick={() => onChange({ ...thread, size: s })}>
            {s}
          </button>
        ))}
      </div>
    </section>
  );
}

/** What the fly is: its name, type, description, difficulty and the fish it is for. */
export function FlyDetails({ meta, onChange }: { meta: PartsFly["meta"]; onChange: (m: PartsFly["meta"], field: "type" | "difficulty" | "description" | "species") => void }) {
  const b = t.build;
  return (
    <details className="wb-details">
      <summary>{t.workbench.details}</summary>
      <div className="wb-fields">
        <label className="wb-field wide">
          <span>{b.type}</span>
          <select
            value={meta.type}
            onChange={(e) => {
              const type = e.target.value as Recipe["type"];
              // How a fly sits on the water goes when it becomes one that sinks.
              const { sits, ...rest } = { ...meta, type };
              onChange(sits && floats(rest) ? { ...rest, sits } : rest, "type");
            }}
          >
            {FLY_TYPES.map((v) => (
              <option key={v} value={v}>
                {TYPE_LABELS[v]}
              </option>
            ))}
          </select>
        </label>
        <label className="wb-field wide">
          <span>{b.difficulty}</span>
          <select value={meta.difficulty} onChange={(e) => onChange({ ...meta, difficulty: e.target.value as Recipe["difficulty"] }, "difficulty")}>
            {DIFFICULTIES.map((v) => (
              <option key={v} value={v}>
                {DIFFICULTY_LABELS[v]}
              </option>
            ))}
          </select>
        </label>
        <label className="wb-field wide">
          <span>{b.description}</span>
          <textarea value={meta.description ?? ""} rows={3} maxLength={600} onChange={(e) => onChange({ ...meta, description: e.target.value || undefined }, "description")} />
        </label>
        <fieldset className="wb-species">
          <legend>{b.species}</legend>
          {SPECIES.map((sp) => (
            <label key={sp}>
              <input
                type="checkbox"
                checked={meta.species.includes(sp)}
                onChange={(e) => onChange({ ...meta, species: e.target.checked ? [...meta.species, sp] : meta.species.filter((x) => x !== sp) }, "species")}
              />
              {SPECIES_LABELS[sp]}
            </label>
          ))}
        </fieldset>
      </div>
    </details>
  );
}
