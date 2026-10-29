import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { DIFFICULTY_LABELS, SPECIES_LABELS, TYPE_LABELS } from "../catalog/describe";
import {
  blankFly,
  checkDraft,
  copyOf,
  draftOf,
  newMaterial,
  newStep,
  ownId,
  packFly,
  sharable,
  PATTERN_FORM,
  recipeText,
  renameMaterial,
  settingStart,
  threadAt,
  unpackFly,
  type OwnFly,
} from "../edit/own";
import type { Field } from "../edit/schemaForm";
import { lang } from "../i18n/lang";
import { inPageLanguage } from "../i18n/prose";
import { ruleMessage } from "../i18n/rules";
import { t } from "../i18n/ui";
import { findPattern, KNOWN_PARTS, PATTERNS } from "../patterns";
import type { RecipeError } from "../recipe/errors";
import { ARCHETYPE_PROPS, MATERIALS, type CatalogMaterial, type MaterialKind } from "../recipe/materials";
import {
  DIFFICULTIES,
  FLY_TYPES,
  HOOK_MODEL_IDS,
  isTube,
  NAMED_COLORS,
  resolveColor,
  SPECIES,
  THREAD_SIZES,
  TUBE_MODEL_IDS,
  type Material,
  type Op,
  type Recipe,
  type Step,
} from "../recipe/schema";
import { colourWord, hookModelName, kindName, materialName, opTitle, partLabel } from "../tying/describe";
import { ridesPointUp } from "../tying/hook";
import { simulate, stepAt, stepEnd, type Build as Built } from "../tying/simulate";
import { useOwnFlies } from "./ownFlies";
import { storedNote } from "./Personal";
import { href, replaceUrl, setLeaveGuard } from "./router";
import { usePlayer } from "./usePlayer";
import { Viewer } from "./Viewer";

/**
 * The fly builder: a visitor's own fly, from a bare hook or a copy of a pattern, with the 3D
 * fly, the written steps and the tying rules following each change. Saved only in this browser
 * (OWN_FLIES_KEY), shared as a link that carries the fly itself after the "#".
 */

const PARTS = new Set(KNOWN_PARTS);
const catalog = () => PATTERNS.map((p) => p.recipe);
const section = (key: string) => PATTERN_FORM.find((s) => s.key === key)!;
const STEP_ITEMS = section("steps").items!;
const MATERIAL_FIELDS = section("materials").items![0]!.fields;
const HOOK_SIZES = Array.from({ length: 12 }, (_, i) => 2 + 2 * i);
/** Steps' settings the builder labels: every field of every step (a test checks the labels). */
type StepKey = keyof typeof t.build.fields.step;
type MaterialKey = keyof typeof t.build.fields.material;

interface State {
  draft: Recipe;
  /** The saved fly's id; null until it is saved. */
  id: string | null;
  /** The text as last saved, to tell unsaved changes. */
  saved: string | null;
  /** The text it started as (or was last saved as): changed since, leaving asks first. */
  started: string;
  note?: "link" | "file" | "linkFailed" | "fileFailed" | "editFailed" | "shareFailed" | "tooBigToShare";
}

const fresh = (draft: Recipe, note?: State["note"]): State => ({ draft, id: null, saved: null, started: recipeText(draft), ...(note && { note }) });

function startFrom(query: string, stored: OwnFly[]): State {
  const params = new URLSearchParams(query);
  const edit = params.get("edit");
  const fly = edit ? stored.find((f) => f.id === edit) : undefined;
  const draft = fly && draftOf(fly.kdl, PARTS);
  if (fly && draft) {
    const own = { ...draft, id: fly.id };
    const text = recipeText(own);
    return { draft: own, id: fly.id, saved: text, started: text };
  }
  const pattern = params.get("from") ? findPattern(params.get("from")!) : undefined;
  if (pattern) {
    // In the page's language: the visitor's copy is theirs to change, in their words.
    const r = inPageLanguage(pattern.recipe);
    return fresh(copyOf(r, t.build.copyName(r.name)));
  }
  return fresh(blankFly(t.build.untitled), edit ? "editFailed" : undefined);
}

/** A part by its name; an id that isn't a part (in a file or a link) as it is, so no lookup fails. */
const partOrId = (id: string) => (PARTS.has(id) ? partLabel(id) : id || "…");

/** A tying rule's or a value's problem, in the page's language, with parts by their names. */
function say(e: RecipeError): string {
  if (e.rule) {
    const params = { ...e.params };
    for (const k of ["m", "post"]) if (typeof params[k] === "string") params[k] = partOrId(params[k] as string);
    return ruleMessage({ ...e, params });
  }
  return t.build.invalid(settingLabel(e.path));
}

function settingLabel(path: (string | number)[]): string {
  const [where, , key] = path;
  const f = t.build.fields;
  if (where === "steps") return f.step[key as StepKey] ?? t.build.steps;
  if (where === "materials") return f.material[key as MaterialKey] ?? t.build.materials;
  if (where === "hook") return f.hook[path[1] as keyof typeof f.hook] ?? t.build.hook;
  if (where === "thread") return f.thread[path[1] as keyof typeof f.thread] ?? t.build.thread;
  const top: Record<string, string> = { name: t.build.name, type: t.build.type, difficulty: t.build.difficulty, description: t.build.description };
  return top[String(where)] ?? t.build.about;
}

/** A material a step may name in an added setting (a parachute's post): one tied in upright before it, or the first. */
function postFor(draft: Recipe, index: number): string {
  const upright = draft.steps.slice(0, index).find((s) => s.op === "tie-in" && (s.angle ?? 0) >= 60);
  return (upright && "material" in upright ? upright.material : draft.materials[0]?.id) ?? "";
}

const under = (problems: RecipeError[], ...prefix: (string | number)[]) => problems.filter((p) => prefix.every((x, i) => p.path[i] === x));


export function Build({ query }: { query: string }) {
  const own = useOwnFlies();
  const [state, setState] = useState<State>(() => startFrom(query, own.stored));
  const { draft } = state;
  const edit = (fn: (d: Recipe) => Recipe) => setState((s) => ({ ...s, draft: fn(s.draft) }));
  const text = useMemo(() => recipeText(draft), [draft]);
  const dirty = text !== state.saved;
  // Work that leaving would lose: changes since it started or was last saved.
  const unsaved = text !== state.started;
  const keep = (question: string) => !unsaved || confirm(question);
  const [sel, setSel] = useState(() => draft.steps.length - 1);

  useEffect(() => {
    document.title = t.site.titled(t.build.title);
  }, [lang()]);

  // A link to another start (from the header, a pattern's "Edit a copy") starts again.
  const written = useRef(query);
  useEffect(() => {
    if (query === written.current) return;
    written.current = query;
    const next = startFrom(query, own.stored);
    setState(next);
    setSel(next.draft.steps.length - 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);
  const go = (q: string) => {
    written.current = q;
    // A shared fly's "#fly=…" goes with it, so a reload doesn't bring it back.
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
    replaceUrl(href.build(q));
  };
  useEffect(() => {
    if (state.note === "editFailed") go("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.note]);

  // A shared fly: its text is in the address after "#fly=", which never reaches a server. Read
  // on opening, and when a link is followed with the builder already open.
  const keepRef = useRef(keep);
  keepRef.current = keep;
  const nameRef = useRef(draft.name);
  nameRef.current = draft.name;
  useEffect(() => {
    let live = true;
    const open = () => {
      const packed = location.hash.startsWith("#fly=") ? location.hash.slice(5) : null;
      if (!packed) return;
      if (!keepRef.current(t.build.startOver(nameRef.current))) {
        // Kept the fly being built: the link's fly mustn't come back with a reload.
        history.replaceState(null, "", location.pathname + location.search);
        return;
      }
      unpackFly(packed).then((kdl) => {
        if (!live) return;
        const shared = kdl === null ? null : draftOf(kdl, PARTS);
        if (shared) {
          setState(fresh({ ...shared, id: "my-fly" }, "link"));
          setSel(shared.steps.length - 1);
        } else setState((s) => ({ ...s, note: "linkFailed" }));
      });
    };
    open();
    addEventListener("hashchange", open);
    return () => {
      live = false;
      removeEventListener("hashchange", open);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Leaving with unsaved work asks first: the browser's own question when the page goes,
  // the builder's when a link or Back leaves it for another page of the site.
  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    addEventListener("beforeunload", warn);
    setLeaveGuard(() => confirm(t.build.leave(draft.name)));
    return () => {
      removeEventListener("beforeunload", warn);
      setLeaveGuard(null);
    };
  }, [unsaved, draft.name]);

  const check = useMemo(() => checkDraft(draft), [draft]);
  const language = lang();
  // Made again only when what it is tied from changes, not with each letter of the name.
  const tied = check.preview && JSON.stringify({ ...check.preview, name: "", description: undefined });
  const built = useMemo(() => {
    if (!check.preview) return null;
    try {
      return simulate(check.preview);
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tied, language]);
  // While the materials have a problem, the fly as it last was stays in view.
  const last = useRef<Built | null>(null);
  if (built) last.current = built;
  const build = built ?? (check.preview ? null : last.current);
  const [stopAt, setStopAt] = useState<number | null>(null);
  const player = usePlayer(build?.duration ?? 0, stopAt);
  const [follow, setFollow] = useState(true);

  // After a change, the fly as it is at the end of the chosen step.
  useEffect(() => {
    if (!built) return;
    const i = Math.min(sel, built.steps.length - 1);
    player.pause();
    setStopAt(null);
    player.seek(i >= 0 ? stepEnd(built.steps[i]!) : 0, built.duration);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [built]);

  const choose = (i: number) => {
    setSel(i);
    const s = build?.steps[i];
    if (!s) return;
    setStopAt(stepEnd(s));
    player.playFrom(s.start);
  };

  const shown = build && build.steps.length > 0 ? stepAt(build, player.time) : -1;
  const shownStep = shown >= 0 ? build!.steps[shown] : undefined;
  const shownRecipeStep = shown >= 0 ? check.preview?.steps[shown] : undefined;
  const inUse = shownRecipeStep && "material" in shownRecipeStep ? draft.materials.find((m) => m.id === shownRecipeStep.material) : undefined;

  const setStep = (i: number, step: Step) => edit((d) => ({ ...d, steps: d.steps.map((s, j) => (j === i ? step : s)) }));
  const addStep = (op: Op) => {
    const at = draft.steps.length === 0 ? 0 : sel + 1;
    edit((d) => ({ ...d, steps: [...d.steps.slice(0, at), newStep(op, d, at, catalog()), ...d.steps.slice(at)] }));
    setSel(at);
  };
  const moveStep = (i: number, by: -1 | 1) => {
    edit((d) => {
      const steps = [...d.steps];
      [steps[i], steps[i + by]] = [steps[i + by]!, steps[i]!];
      return { ...d, steps };
    });
    setSel(i + by);
  };
  const removeStep = (i: number) => {
    edit((d) => ({ ...d, steps: d.steps.filter((_, j) => j !== i) }));
    setSel(Math.max(0, Math.min(i, draft.steps.length - 2)));
  };

  const save = () => {
    const taken = new Set(own.stored.map((f) => f.id));
    const id = state.id ?? ownId(taken);
    const fly = { ...draft, id };
    const kdl = recipeText(fly);
    own.save([...own.stored.filter((f) => f.id !== id), { id, kdl, saved: new Date().toISOString() }]);
    setState({ draft: fly, id, saved: kdl, started: kdl });
    go(`edit=${id}`);
  };
  const remove = () => {
    if (!state.id || !confirm(t.build.deleteConfirm(draft.name))) return;
    own.save(own.stored.filter((f) => f.id !== state.id));
    setState(startFrom("", []));
    setSel(0);
    go("");
  };
  const startAgain = (q: string) => {
    if (!keep(t.build.startOver(draft.name))) return;
    const next = startFrom(q, own.stored);
    setState(next);
    setSel(next.draft.steps.length - 1);
    go(q);
  };

  const fileInput = useRef<HTMLInputElement>(null);
  const openFile = async (file: File) => {
    // Generous for a recipe file (the builder's own run to tens of kilobytes), not for anything else.
    const kdl = file.size <= 1024 * 1024 ? await file.text() : "";
    const opened = draftOf(kdl, PARTS);
    if (!opened) return setState((s) => ({ ...s, note: "fileFailed" }));
    if (!keep(t.build.startOver(draft.name))) return;
    setState(fresh({ ...opened, id: "my-fly" }, "file"));
    setSel(opened.steps.length - 1);
    go("");
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${state.id ?? "my-fly"}.kdl`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const [link, setLink] = useState<{ url: string; copied: boolean } | null>(null);
  const share = async () => {
    let url: string;
    if (!sharable(text)) return setState((s) => ({ ...s, note: "tooBigToShare" }));
    try {
      url = `${location.origin}${href.build()}#fly=${await packFly(text)}`;
    } catch {
      // No CompressionStream (an older browser): the recipe can still be downloaded.
      return setState((s) => ({ ...s, note: "shareFailed" }));
    }
    try {
      await navigator.clipboard.writeText(url);
      setLink({ url, copied: true });
    } catch {
      setLink({ url, copied: false });
    }
  };
  useEffect(() => setLink(null), [text]);

  const savedFly = state.id ? own.flies.find((f) => f.fly.id === state.id) : undefined;
  const patterns = useMemo(
    () => PATTERNS.map((p) => ({ id: p.recipe.id, name: inPageLanguage(p.recipe).name, variant: inPageLanguage(p.recipe).variant })).sort((a, b) => a.name.localeCompare(b.name, language)),
    [language],
  );

  return (
    <div className="pattern build">
      <section className="stage" aria-label={t.pattern.stage}>
        {/* No steps yet: nothing to play (the 3D view needs a step to show). */}
        {build && build.steps.length > 0 ? (
          <Viewer
            build={build}
            time={player.time}
            follow={follow}
            onFollowChange={setFollow}
            callout={inUse ? materialName(inUse) : null}
            pointUp={check.preview ? ridesPointUp(check.preview) : false}
            guide
          />
        ) : (
          <div className="viewer" />
        )}
        <div className="now" aria-live="polite">
          {shownStep ? (
            <>
              <p className="now-index">{t.pattern.stepOf(shown + 1, draft.steps.length)}</p>
              <h2>{shownStep.title}</h2>
              <p className="now-text">{shownStep.text}</p>
            </>
          ) : (
            build && <p className="now-text">{t.build.noSteps}</p>
          )}
          {!built || !check.preview ? (
            <p className="build-shown">{t.build.notShown}</p>
          ) : check.preview.steps.length < draft.steps.length ? (
            <p className="build-shown">{t.build.shownUpTo(check.preview.steps.length)}</p>
          ) : null}
        </div>
      </section>

      <aside className="notes build-form">
        <h1>{t.build.heading}</h1>
        <p className="description">{t.build.intro}</p>
        <p className="stored-note">{storedNote()}</p>
        {state.note && (
          <p className={state.note === "link" || state.note === "file" ? "build-note" : "build-note problem"} role="status">
            {
              {
                link: t.build.fromLink,
                file: t.build.fromFile,
                linkFailed: t.build.linkFailed,
                fileFailed: t.build.fileFailed,
                editFailed: t.build.editFailed,
                shareFailed: t.build.shareFailed,
                tooBigToShare: t.build.tooBigToShare,
              }[state.note]
            }
          </p>
        )}
        <div className="build-start">
          <ChooseMenu label={t.build.start} placeholder="…" button={t.build.startButton} onChoose={(v) => startAgain(v === "-" ? "" : `from=${v}`)} visibleLabel>
            <option value="-">{t.build.bareHook}</option>
            <optgroup label={t.build.pattern}>
              {patterns.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.variant ? `${p.name} (${p.variant})` : p.name}
                </option>
              ))}
            </optgroup>
          </ChooseMenu>
        </div>

        <h3>{t.build.about}</h3>
        <div className="build-fields">
          <Labelled label={t.build.name}>{(id) => <input id={id} value={draft.name} maxLength={80} onChange={(e) => edit((d) => ({ ...d, name: e.target.value }))} />}</Labelled>
          <Labelled label={t.build.type}>
            {(id) => (
              <select id={id} value={draft.type} onChange={(e) => edit((d) => ({ ...d, type: e.target.value as Recipe["type"] }))}>
                {FLY_TYPES.map((v) => (
                  <option key={v} value={v}>
                    {TYPE_LABELS[v]}
                  </option>
                ))}
              </select>
            )}
          </Labelled>
          <Labelled label={t.build.difficulty}>
            {(id) => (
              <select id={id} value={draft.difficulty} onChange={(e) => edit((d) => ({ ...d, difficulty: e.target.value as Recipe["difficulty"] }))}>
                {DIFFICULTIES.map((v) => (
                  <option key={v} value={v}>
                    {DIFFICULTY_LABELS[v]}
                  </option>
                ))}
              </select>
            )}
          </Labelled>
          <Labelled label={t.build.description}>
            {(id) => (
              <textarea
                id={id}
                rows={3}
                maxLength={1000}
                value={draft.description ?? ""}
                onChange={(e) => edit(({ description: _, ...d }) => ({ ...d, ...(e.target.value.trim() && { description: e.target.value }) }) as Recipe)}
              />
            )}
          </Labelled>
        </div>
        <fieldset className="build-species">
          <legend>{t.build.species}</legend>
          {SPECIES.map((sp) => (
            <label key={sp}>
              <input
                type="checkbox"
                checked={draft.species.includes(sp)}
                onChange={(e) => edit((d) => ({ ...d, species: e.target.checked ? [...d.species, sp] : d.species.filter((x) => x !== sp) }))}
              />
              {SPECIES_LABELS[sp]}
            </label>
          ))}
        </fieldset>
        <Problems problems={under(check.problems, "name")} />

        <h3>{t.build.hook}</h3>
        <HookFields hook={draft.hook} onChange={(hook) => edit((d) => ({ ...d, hook }))} />
        <Problems problems={under(check.problems, "hook")} />

        <h3>{t.build.thread}</h3>
        <div className="build-fields">
          <Labelled label={t.build.fields.thread.color}>
            {(id) => <ColourSelect id={id} value={draft.thread.color} onChange={(color) => edit((d) => ({ ...d, thread: { ...d.thread, color } }))} />}
          </Labelled>
          <Labelled label={t.build.fields.thread.size}>
            {(id) => (
              <select id={id} value={draft.thread.size} onChange={(e) => edit((d) => ({ ...d, thread: { ...d.thread, size: e.target.value as Recipe["thread"]["size"] } }))}>
                {THREAD_SIZES.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            )}
          </Labelled>
        </div>
        <Problems problems={under(check.problems, "thread")} />

        <h3>{t.build.materials}</h3>
        {draft.materials.length === 0 && <p>{t.build.noMaterials}</p>}
        <ul className="build-list">
          {draft.materials.map((m, i) => (
            <MaterialItem
              key={i}
              material={m}
              draft={draft}
              onChange={(next) =>
                edit((d) => {
                  const renamed = next.id !== m.id ? renameMaterial(d, m.id, next.id) : d;
                  return { ...renamed, materials: renamed.materials.map((x, j) => (j === i ? next : x)) };
                })
              }
              onRemove={() => edit((d) => ({ ...d, materials: d.materials.filter((_, j) => j !== i) }))}
              problems={under(check.problems, "materials", i)}
            />
          ))}
        </ul>
        <ChooseMenu
          label={t.build.addMaterial}
          placeholder={t.build.addMaterial}
          button={t.build.addButton}
          onChoose={(k) => edit((d) => ({ ...d, materials: [...d.materials, newMaterial(k as MaterialKind, d, catalog(), KNOWN_PARTS)] }))}
        >
          {(Object.keys(MATERIALS) as MaterialKind[])
            .sort((a, b) => kindName(a).localeCompare(kindName(b), language))
            .map((k) => (
              <option key={k} value={k}>
                {kindName(k)}
              </option>
            ))}
        </ChooseMenu>

        <h3>{t.build.steps}</h3>
        <p className="build-hint">{t.build.shankHint}</p>
        <ol className="build-list build-steps">
          {draft.steps.map((s, i) => {
            const problems = under(check.problems, "steps", i);
            const title = check.preview && i < check.preview.steps.length && build?.steps[i] ? build.steps[i]!.title : opTitle(s.op);
            return (
              <li key={i} className={[i === sel ? "active" : "", problems.length ? "has-problem" : ""].join(" ").trim() || undefined}>
                <button className="build-step-title" aria-current={i === sel ? "step" : undefined} aria-expanded={i === sel} onClick={() => choose(i)}>
                  <span className="build-step-number">{t.build.stepNumber(i + 1)}</span> {title}
                </button>
                {i !== sel && <Problems problems={problems} />}
                {i === sel && (
                  <div className="build-item">
                    <Settings
                      fields={STEP_ITEMS.find((it) => it.name === s.op)!.fields.filter((f) => f.key !== "op")}
                      value={s as unknown as Record<string, unknown>}
                      label={(f) => t.build.fields.step[f.key as StepKey] ?? f.key}
                      onChange={(v) => setStep(i, v as unknown as Step)}
                      start={(f) =>
                        f.type === "material"
                          ? postFor(draft, i)
                          : f.measure === "shank"
                            ? (threadAt(draft, i) ?? 0.5)
                            : settingStart(f, "steps", s.op, catalog())
                      }
                      materials={draft.materials}
                    />
                    <Problems problems={problems} />
                    <div className="build-item-buttons">
                      <button className="link-button" disabled={i === 0} onClick={() => moveStep(i, -1)} aria-label={t.build.moveUpLabel(title)}>
                        {t.build.moveUp}
                      </button>
                      <button className="link-button" disabled={i === draft.steps.length - 1} onClick={() => moveStep(i, 1)} aria-label={t.build.moveDownLabel(title)}>
                        {t.build.moveDown}
                      </button>
                      <button className="link-button" onClick={() => removeStep(i)} aria-label={t.build.removeLabel(title)}>
                        {t.build.remove}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        <ChooseMenu
          label={draft.steps.length ? t.build.addStep : t.build.addFirst}
          placeholder={draft.steps.length ? t.build.addStep : t.build.addFirst}
          button={t.build.addButton}
          onChoose={(op) => addStep(op as Op)}
        >
          {STEP_ITEMS.map((it) => (
            <option key={it.name} value={it.name}>
              {opTitle(it.name as Op)}
            </option>
          ))}
        </ChooseMenu>
        <Problems problems={check.problems.filter((p) => p.path[0] === "steps" && typeof p.path[1] !== "number")} />

        <section className="build-todo" aria-live="polite">
          {check.todo.length === 0 && check.problems.length === 0 ? (
            <p>{t.build.finished}</p>
          ) : (
            check.todo.length > 0 && (
              <>
                <h3>{t.build.todo}</h3>
                <ul>
                  {check.todo.map((e, i) => (
                    <li key={i}>{say(e)}</li>
                  ))}
                </ul>
              </>
            )
          )}
        </section>

        <div className="pattern-actions build-actions">
          <button className="box-toggle" aria-pressed={!dirty} onClick={save} disabled={!dirty}>
            {!dirty ? t.build.saved : state.id ? t.build.saveChanges : t.build.save}
          </button>
          {state.id && (savedFly?.recipe && !dirty ? <a href={href.fly(state.id)}>{t.build.open}</a> : <span className="build-hint">{savedFly?.recipe ? "" : t.build.unfinishedPage}</span>)}
        </div>
        <div className="pattern-actions build-actions">
          <button className="link-button" onClick={share}>
            {t.build.share}
          </button>
          <button className="link-button" onClick={download}>
            {t.build.download}
          </button>
          <button className="link-button" onClick={() => fileInput.current?.click()}>
            {t.build.openFile}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".kdl,text/plain"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void openFile(f);
            }}
          />
          {state.id && (
            <button className="link-button danger" onClick={remove}>
              {t.build.delete}
            </button>
          )}
        </div>
        {link && (
          <p className="build-link" aria-live="polite">
            {link.copied ? t.build.copied : t.build.copyThis}
            <input readOnly value={link.url} onFocus={(e) => e.target.select()} aria-label={t.build.share} />
          </p>
        )}
      </aside>
    </div>
  );
}

/**
 * A menu whose choice is acted on with its button, not on change: arrow keys on a closed menu
 * change it in some browsers, which would add a step with every press.
 */
function ChooseMenu({
  label,
  placeholder,
  button,
  onChoose,
  visibleLabel = false,
  children,
}: {
  label: string;
  placeholder: string;
  button: string;
  onChoose: (value: string) => void;
  visibleLabel?: boolean;
  children: ReactNode;
}) {
  const [value, setValue] = useState("");
  const id = useId();
  return (
    <span className="build-choose">
      {visibleLabel && <label htmlFor={id}>{label}</label>}
      <select id={id} value={value} aria-label={visibleLabel ? undefined : label} onChange={(e) => setValue(e.target.value)}>
        <option value="">{placeholder}</option>
        {children}
      </select>
      <button
        className="box-toggle"
        disabled={!value}
        onClick={() => {
          setValue("");
          onChoose(value);
        }}
      >
        {button}
      </button>
    </span>
  );
}

function Labelled({ label, children }: { label: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <div className="build-control">{children(id)}</div>
    </>
  );
}

function Problems({ problems }: { problems: RecipeError[] }) {
  if (problems.length === 0) return null;
  return (
    <ul className="build-problems">
      {problems.map((p, i) => (
        <li key={i}>{say(p)}</li>
      ))}
    </ul>
  );
}

function HookFields({ hook, onChange }: { hook: Recipe["hook"]; onChange: (h: Recipe["hook"]) => void }) {
  const f = t.build.fields.hook;
  return (
    <div className="build-fields">
      <Labelled label={f.model}>
        {(id) => (
          <select
            id={id}
            value={hook.model}
            onChange={(e) => {
              const model = e.target.value as Recipe["hook"]["model"];
              // Assumption: a 25 mm tube and a size 12 hook to start from.
              if (isTube(model) === isTube(hook.model)) onChange({ ...hook, model });
              else onChange(isTube(model) ? { model, length: 25 } : { model, size: 12 });
            }}
          >
            {[...HOOK_MODEL_IDS, ...TUBE_MODEL_IDS].map((m) => (
              <option key={m} value={m}>
                {hookModelName(m)}
              </option>
            ))}
          </select>
        )}
      </Labelled>
      {isTube(hook.model) ? (
        <>
          <Labelled label={f.length}>{(id) => <NumberInput id={id} value={hook.length} step={1} onChange={(length) => onChange({ ...hook, length })} />}</Labelled>
          <Labelled label={f.treble}>
            {(id) => (
              <select id={id} value={hook.treble ?? 12} onChange={(e) => onChange({ ...hook, treble: Number(e.target.value) })}>
                {HOOK_SIZES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            )}
          </Labelled>
        </>
      ) : (
        <Labelled label={f.size}>
          {(id) => (
            <select id={id} value={hook.size ?? 12} onChange={(e) => onChange({ ...hook, size: Number(e.target.value) })}>
              {HOOK_SIZES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          )}
        </Labelled>
      )}
    </div>
  );
}

function MaterialItem({
  material: m,
  draft,
  onChange,
  onRemove,
  problems,
}: {
  material: Material;
  draft: Recipe;
  onChange: (m: Material) => void;
  onRemove: () => void;
  problems: RecipeError[];
}) {
  const language = lang();
  const cat = MATERIALS[m.kind] as CatalogMaterial;
  const taken = new Set(draft.materials.filter((x) => x !== m).map((x) => x.id));
  const parts = KNOWN_PARTS.filter((p) => p === m.id || !taken.has(p)).sort((a, b) => partLabel(a).localeCompare(partLabel(b), language));
  const allowed = new Set(["color", "label", ...ARCHETYPE_PROPS[cat.archetype]]);
  const fields = MATERIAL_FIELDS.filter((f) => f.key !== "id" && f.key !== "kind" && allowed.has(f.key)).map((f) =>
    // What the material can't go without: a colour (unless it has its own), a hackle's fibres, a bead's size.
    (f.key === "color" && !("defaultColor" in cat)) || (f.key === "fibre" && cat.archetype === "hackle") || (f.key === "mm" && (cat.archetype === "bead" || cat.archetype === "eyes"))
      ? { ...f, optional: false }
      : f,
  );
  const name = `${partLabel(m.id)}: ${materialName(m)}`;
  return (
    <li className={problems.length ? "has-problem" : undefined}>
      <details open={problems.length > 0 || undefined}>
        <summary>{name}</summary>
        <div className="build-item">
          <div className="build-fields">
            <Labelled label={t.build.fields.material.id}>
              {(id) => (
                <select id={id} value={m.id} onChange={(e) => onChange({ ...m, id: e.target.value })}>
                  {parts.map((p) => (
                    <option key={p} value={p}>
                      {partLabel(p)}
                    </option>
                  ))}
                </select>
              )}
            </Labelled>
            <Labelled label={t.build.fields.material.kind}>
              {(id) => (
                <select
                  id={id}
                  value={m.kind}
                  onChange={(e) => {
                    const kind = e.target.value as MaterialKind;
                    const fresh = newMaterial(kind, { ...draft, materials: draft.materials.filter((x) => x !== m) }, catalog(), KNOWN_PARTS);
                    onChange({ ...fresh, id: m.id, ...(m.label && { label: m.label }), ...(m.color && fresh.color && { color: m.color }) });
                  }}
                >
                  {(Object.keys(MATERIALS) as MaterialKind[])
                    .sort((a, b) => kindName(a).localeCompare(kindName(b), language))
                    .map((k) => (
                      <option key={k} value={k}>
                        {kindName(k)}
                      </option>
                    ))}
                </select>
              )}
            </Labelled>
          </div>
          <Settings
            fields={fields}
            value={m as unknown as Record<string, unknown>}
            label={(f) => t.build.fields.material[f.key as MaterialKey] ?? f.key}
            onChange={(v) => onChange(v as unknown as Material)}
            start={(f) => (f.key === "color" ? (cat.defaultColor ?? "black") : settingStart(f, "materials", m.kind, catalog()))}
            materials={draft.materials}
            kind={m.kind}
          />
          <Problems problems={problems} />
          <div className="build-item-buttons">
            <button className="link-button" onClick={onRemove} aria-label={t.build.removeLabel(name)}>
              {t.build.remove}
            </button>
          </div>
        </div>
      </details>
    </li>
  );
}

/**
 * A step's or a material's settings: those it needs and those it has, each with its control,
 * and a menu for adding one of the others. Leaving a setting out returns it to its default.
 */
function Settings({
  fields,
  value,
  label,
  onChange,
  start,
  materials,
  kind,
}: {
  fields: Field[];
  value: Record<string, unknown>;
  label: (f: Field) => string;
  onChange: (v: Record<string, unknown>) => void;
  start: (f: Field) => unknown;
  materials: Material[];
  kind?: MaterialKind;
}) {
  const shown = fields.filter((f) => !f.optional || value[f.key] !== undefined);
  const more = fields.filter((f) => f.optional && value[f.key] === undefined);
  const set = (key: string, v: unknown) => {
    const { [key]: _, ...rest } = value;
    onChange(v === undefined ? rest : { ...rest, [key]: v });
  };
  return (
    <>
      <div className="build-fields">
        {shown.map((f) => (
          <Labelled key={f.key} label={label(f)}>
            {(id) => (
              <>
                <Control id={id} field={f} value={value[f.key]} onChange={(v) => set(f.key, v)} materials={materials} kind={kind} />
                {f.optional && (
                  <button className="link-button build-leave" onClick={() => set(f.key, undefined)} aria-label={t.build.leaveOut(label(f))} title={t.build.leaveOut(label(f))}>
                    ×
                  </button>
                )}
              </>
            )}
          </Labelled>
        ))}
      </div>
      {more.length > 0 && (
        <ChooseMenu
          // Another set of settings (the material changed): a fresh choice.
          key={more.map((f) => f.key).join(" ")}
          label={t.build.more}
          placeholder={t.build.more}
          button={t.build.addButton}
          onChoose={(key) => {
            const field = more.find((f) => f.key === key);
            if (field) set(key, start(field));
          }}
        >
          {more.map((f) => (
            <option key={f.key} value={f.key}>
              {label(f)}
            </option>
          ))}
        </ChooseMenu>
      )}
    </>
  );
}

function Control({
  id,
  field: f,
  value,
  onChange,
  materials,
  kind,
}: {
  id: string;
  field: Field;
  value: unknown;
  onChange: (v: unknown) => void;
  materials: Material[];
  kind?: MaterialKind;
}) {
  switch (f.type) {
    case "material":
      return (
        <select id={id} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)}>
          {!materials.some((m) => m.id === value) && <option value={typeof value === "string" ? value : ""}>…</option>}
          {materials.map((m) => (
            <option key={m.id} value={m.id}>
              {`${partLabel(m.id)}: ${materialName(m)}`}
            </option>
          ))}
        </select>
      );
    case "number":
    case "integer": {
      const n = typeof value === "number" ? value : undefined;
      if (f.measure === "shank") {
        return (
          <span className="build-shank">
            <input id={id} type="range" min={0} max={1} step={0.01} value={n ?? 0} onChange={(e) => onChange(Number(e.target.value))} />
            <output htmlFor={id}>{t.build.shank(Math.round((n ?? 0) * 100))}</output>
          </span>
        );
      }
      return (
        <span className="build-number">
          <NumberInput id={id} value={n} step={f.type === "integer" ? 1 : 0.05} onChange={onChange} />
          {f.measure === "gape" && <span>{t.build.gapes}</span>}
        </span>
      );
    }
    case "boolean":
      return <input id={id} type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />;
    case "enum": {
      const names = (t.build.options as Record<string, Record<string, string>>)[f.key];
      return (
        <select id={id} value={String(value ?? "")} onChange={(e) => onChange(f.numeric ? Number(e.target.value) : e.target.value)}>
          {f.options!.map((o) => (
            <option key={o} value={o}>
              {names?.[o] ?? o}
            </option>
          ))}
        </select>
      );
    }
    case "color":
      return <ColourSelect id={id} value={typeof value === "string" ? value : "black"} kind={kind} onChange={onChange} />;
    case "text":
      return <textarea id={id} rows={2} maxLength={500} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} />;
    default:
      return <input id={id} maxLength={200} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} />;
  }
}

/** The named colours by their words in the page's language, and any other as a colour picker. */
function ColourSelect<T extends string>({ id, value, kind, onChange }: { id: string; value: T; kind?: MaterialKind; onChange: (c: T) => void }) {
  const language = lang();
  const named = value in NAMED_COLORS;
  const colours = useMemo(() => (Object.keys(NAMED_COLORS) as (keyof typeof NAMED_COLORS)[]).sort((a, b) => colourWord(a).localeCompare(colourWord(b), language)), [language]);
  return (
    <span className="build-colour">
      <span className="swatch" style={{ background: resolveColor(value) }} aria-hidden="true" />
      <select id={id} value={named ? value : "#"} onChange={(e) => onChange((e.target.value === "#" ? resolveColor(value) : e.target.value) as T)}>
        {colours.map((c) => (
          <option key={c} value={c}>
            {colourWord(c, kind)}
          </option>
        ))}
        <option value="#">{t.build.otherColour}</option>
      </select>
      {!named && <input type="color" value={resolveColor(value)} onChange={(e) => onChange(e.target.value as T)} aria-label={t.build.otherColour} />}
    </span>
  );
}

/** A number as typed, in the page's way of writing decimals; kept once it is one. */
function NumberInput({ id, value, step, onChange }: { id: string; value: number | undefined; step: number; onChange: (n: number) => void }) {
  const format = (n: number | undefined) => (n === undefined ? "" : n.toLocaleString(t.log.locale, { maximumFractionDigits: 3, useGrouping: false }));
  const [typed, setTyped] = useState(format(value));
  const parse = (s: string) => Number(s.trim().replace(",", "."));
  useEffect(() => {
    if (parse(typed) !== value) setTyped(format(value));
    // Only when the value changes from outside.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      value={typed}
      data-step={step}
      onChange={(e) => {
        setTyped(e.target.value);
        const n = parse(e.target.value);
        // Out of range too: the problem under the step says so, rather than the number snapping back.
        if (e.target.value.trim() !== "" && Number.isFinite(n)) onChange(n);
      }}
      onBlur={() => setTyped(format(value))}
    />
  );
}
