import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { PATTERN_SECTIONS } from "../recipe/kdl";
import { formatError, type RecipeError } from "../recipe/errors";
import { loadRecipe } from "../recipe/load";
import { NATURAL_SECTIONS, NaturalSchema, type Natural } from "../recipe/natural";
import { RecipeSchema, type Recipe } from "../recipe/schema";
import { FlyScene, naturalAlone, naturalFishing, type ViewName } from "../render/FlyScene";
import { loadRealAssets, siteAssets, type RealAssets } from "../render/real/assets";
import { WATER_LOOKS } from "../render/water";
import { simulate, stepAt, stepEnd, type Build } from "../tying/simulate";
import { useTheme } from "../ui/theme";
import { usePlayer } from "../ui/usePlayer";
import { listFiles, readFile, saveFile, type FileKind } from "./api";
import { NATURALS } from "../naturals";
import { checkDraft, checkNatural, isPatternFile, newNaturalText, newPatternText } from "./draft";
import { Form } from "./Form";
import { editKdl, type Edit } from "./kdlEdit";
import { formSections } from "./schemaForm";

const NATURAL_IDS = new Set(NATURALS.map((n) => n.id));
const FORMS = { patterns: formSections(PATTERN_SECTIONS, RecipeSchema), naturals: formSections(NATURAL_SECTIONS, NaturalSchema) };
const SHAPES = { patterns: PATTERN_SECTIONS, naturals: NATURAL_SECTIONS };
const SINGULAR = { patterns: "pattern", naturals: "natural" } as const;

/**
 * The authoring studio: edit a pattern's or a natural's KDL, as text or through a form, with its
 * problems listed as you type, and watch what it describes in 3D. Only on the dev server; saving
 * writes to patterns/ or naturals/.
 */
export function Studio() {
  // Applies the light or dark theme to the page.
  useTheme();
  const params = new URLSearchParams(location.search);
  const [kind, setKind] = useState<FileKind>(params.has("natural") ? "naturals" : "patterns");
  const [saved, setSaved] = useState<Record<FileKind, Map<string, string>>>({ patterns: new Map(), naturals: new Map() });
  const [file, setFile] = useState<string | null>(null);
  const [text, setText] = useState("");
  /** A new file that is not on disk yet. */
  const [unsavedFile, setUnsavedFile] = useState(false);
  // The draft open now, for a save that finishes after another draft was opened.
  const openFile = useRef<string | null>(null);
  openFile.current = file;
  const [status, setStatus] = useState("Loading…");
  const [creating, setCreating] = useState(false);
  // A new file's id is checked against the saved files, so they must be loaded first.
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<"text" | "form">("text");
  // A problem picked in the form tab: the text tab opens at its line.
  const [jump, setJump] = useState<{ line: number; column: number } | null>(null);

  useEffect(() => {
    // A load that has been superseded (StrictMode runs this twice) must not replace the editor's text.
    let stale = false;
    (async () => {
      const all = {} as Record<FileKind, Map<string, string>>;
      for (const k of ["patterns", "naturals"] as const) {
        const files = await listFiles(k);
        const texts = await Promise.all(files.map((f) => readFile(k, f)));
        all[k] = new Map(files.map((f, i) => [f, texts[i]!]));
      }
      if (stale) return;
      setSaved(all);
      const first = initialFile(all[kind], params.get(kind === "naturals" ? "natural" : "pattern"));
      // A new file may have been opened while the files were loading: keep it.
      if (first && openFile.current === null) {
        setFile(first);
        setText(all[kind].get(first)!);
      }
      setLoaded(true);
      setStatus("");
    })().catch((e: unknown) => {
      if (!stale) setStatus(`Couldn't load the files: ${String(e)}. Is this the dev server (pnpm dev)?`);
    });
    return () => {
      stale = true;
    };
    // The kind at load time only: switching kinds later opens its first file (see switchKind).
  }, []);

  const dirty = file !== null && (unsavedFile || saved[kind].get(file) !== text);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    addEventListener("beforeunload", warn);
    return () => removeEventListener("beforeunload", warn);
  }, [dirty]);

  // The saved patterns, for the catalog rules (unique ids, variant-of targets). This file's
  // saved version is included: the draft replaces it, and errors already there aren't the draft's.
  const others = useMemo(() => {
    const list: { file: string; recipe: Recipe }[] = [];
    for (const [f, t] of saved.patterns) {
      const r = loadRecipe(t);
      if (r.ok) list.push({ file: f, recipe: r.recipe });
    }
    return list;
  }, [saved]);

  // Checked a moment behind the typing; kind, file and text are deferred together so they always match.
  const input = useMemo(() => ({ kind, file, text }), [kind, file, text]);
  const draft = useDeferredValue(input);
  const check = useMemo((): { errors: RecipeError[]; recipe?: Recipe; natural?: Natural } => {
    if (!draft.file) return { errors: [] };
    return draft.kind === "naturals" ? checkNatural(draft.text, draft.file) : checkDraft(draft.text, draft.file, others, NATURAL_IDS);
  }, [draft, others]);

  // The preview keeps showing the last version without errors while you type.
  const [shown, setShown] = useState<Recipe | null>(null);
  const [shownNatural, setShownNatural] = useState<Natural | null>(null);
  useEffect(() => {
    setShown(null);
    setShownNatural(null);
  }, [file, kind]);
  useEffect(() => {
    if (draft.file !== file || draft.kind !== kind) return;
    if (check.recipe) setShown(check.recipe);
    if (check.natural) setShownNatural(check.natural);
  }, [check, draft.file, draft.kind, file, kind]);
  const build = useMemo(() => (shown ? simulate(shown) : null), [shown]);

  const address = (k: FileKind, f: string) => history.replaceState(null, "", `?${k === "naturals" ? "natural" : "pattern"}=${f.replace(/\.kdl$/, "")}`);

  const open = (f: string) => {
    if (dirty && !confirm(`Discard the unsaved changes to ${file}?`)) return;
    setFile(f);
    setText(saved[kind].get(f) ?? "");
    setUnsavedFile(false);
    setStatus("");
    address(kind, f);
  };

  const switchKind = (k: FileKind) => {
    if (k === kind) return;
    if (dirty && !confirm(`Discard the unsaved changes to ${file}?`)) return;
    const first = initialFile(saved[k], null);
    setKind(k);
    setFile(first);
    setText(first ? saved[k].get(first)! : "");
    setUnsavedFile(false);
    setCreating(false);
    setStatus("");
    if (first) address(k, first);
  };

  // One save at a time: a slow earlier write must not land after, and over, a later one.
  const saving = useRef(false);
  const save = useCallback(async () => {
    if (!file || saving.current) return;
    saving.current = true;
    try {
      await saveFile(kind, file, text, unsavedFile);
      setSaved((m) => ({ ...m, [kind]: new Map(m[kind]).set(file, text) }));
      // Only if this draft is still open: a new one opened meanwhile is not saved yet.
      if (openFile.current === file) setUnsavedFile(false);
      const problems = (kind === "naturals" ? checkNatural(text, file) : checkDraft(text, file, others, NATURAL_IDS)).errors.length;
      setStatus(problems ? `Saved ${file}, with ${problems} ${problems === 1 ? "problem" : "problems"} still to fix` : `Saved ${file}`);
    } catch (e) {
      setStatus(`Not saved: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      saving.current = false;
    }
  }, [kind, file, text, unsavedFile, others]);

  const create = (id: string) => {
    if (dirty && !confirm(`Discard the unsaved changes to ${file}?`)) return;
    const f = `${id}.kdl`;
    setFile(f);
    setText(kind === "naturals" ? newNaturalText(id) : newPatternText(id));
    setUnsavedFile(true);
    setCreating(false);
    setStatus(`New ${SINGULAR[kind]}, not saved yet`);
    address(kind, f);
  };

  // A form change: an edit of the text in place, or a note when the text can't take it.
  const edit = (e: Edit) => {
    try {
      // From the text as it is now: a slider sends edits faster than renders.
      setText((t) => editKdl(t, e, Object.keys(SHAPES[kind])));
    } catch (err) {
      setStatus(`Couldn't change that: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const files = [...saved[kind].keys(), ...(unsavedFile && file ? [file] : [])].sort();

  return (
    <div className="studio">
      <header className="studio-bar">
        <h1>
          Flybench <span>studio</span>
        </h1>
        <div className="studio-kinds" role="group" aria-label="Files">
          <button aria-pressed={kind === "patterns"} onClick={() => switchKind("patterns")} disabled={!loaded}>
            Patterns
          </button>
          <button aria-pressed={kind === "naturals"} onClick={() => switchKind("naturals")} disabled={!loaded}>
            Naturals
          </button>
        </div>
        <label className="studio-file">
          <span className="visually-hidden">{SINGULAR[kind]} file</span>
          <select value={file ?? ""} onChange={(e) => open(e.target.value)} disabled={files.length === 0}>
            {files.map((f) => (
              <option key={f} value={f}>
                {f}
                {f === file && dirty ? " (edited)" : ""}
              </option>
            ))}
          </select>
        </label>
        {creating ? (
          <NewPatternForm noun={SINGULAR[kind]} existing={files} onCreate={create} onCancel={() => setCreating(false)} />
        ) : (
          <button onClick={() => setCreating(true)} disabled={!loaded}>
            New {SINGULAR[kind]}
          </button>
        )}
        <button className="primary" onClick={save} disabled={!dirty}>
          Save
        </button>
        <p className="studio-status" role="status">
          {status || (dirty ? "Unsaved changes" : file ? "No unsaved changes" : "")}
        </p>
        {file && !unsavedFile && (
          <a className="studio-site" href={`./${kind === "naturals" ? "natural" : "fly"}/${file.replace(/\.kdl$/, "")}/`} target="_blank" rel="noreferrer">
            Open on the site
          </a>
        )}
      </header>
      <div className="studio-panes">
        <section className="studio-left" aria-label="Recipe">
          <div className="studio-tabs" role="tablist">
            <button role="tab" aria-selected={tab === "text"} onClick={() => setTab("text")}>
              Text
            </button>
            <button role="tab" aria-selected={tab === "form"} onClick={() => setTab("form")}>
              Form
            </button>
          </div>
          {tab === "text" ? (
            <Editor text={text} onChange={setText} errors={check.errors} onSave={save} noun={SINGULAR[kind]} jump={jump} />
          ) : (
            <div className="studio-form-pane">
              <Form text={text} sections={FORMS[kind]} shapes={SHAPES[kind]} onEdit={edit} />
              <Problems
                errors={check.errors}
                noun={SINGULAR[kind]}
                onGo={(e) => {
                  setJump(e.line !== undefined ? { line: e.line, column: e.column ?? 1 } : null);
                  setTab("text");
                }}
              />
            </div>
          )}
        </section>
        {kind === "naturals" ? (
          <NaturalPreviewPane natural={shownNatural} stale={!check.natural && shownNatural !== null} />
        ) : (
          <PreviewPane build={build} recipe={shown} stale={!check.recipe && shown !== null} />
        )}
      </div>
    </div>
  );
}

/** The file to open first: the one the address names, else the first. */
function initialFile(files: Map<string, string>, wanted: string | null): string | null {
  const names = [...files.keys()].sort();
  return wanted && files.has(`${wanted}.kdl`) ? `${wanted}.kdl` : names[0] ?? null;
}

/** The problems, in the form tab: each takes you to its line in the text. */
function Problems({ errors, noun, onGo }: { errors: RecipeError[]; noun: string; onGo: (e: RecipeError) => void }) {
  if (errors.length === 0) return <p className="studio-ok">No problems: this is a valid {noun}.</p>;
  return (
    <div className="studio-problems">
      <h2>
        {errors.length} {errors.length === 1 ? "problem" : "problems"}
      </h2>
      <ul>
        {errors.map((e, i) => (
          <li key={i}>
            <button onClick={() => onGo(e)}>{formatError(e)}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NewPatternForm({ noun, existing, onCreate, onCancel }: { noun: string; existing: string[]; onCreate: (id: string) => void; onCancel: () => void }) {
  const [id, setId] = useState("");
  const problem =
    id === ""
      ? null
      : !isPatternFile(`${id}.kdl`)
        ? "Lowercase letters, digits and dashes, starting with a letter"
        : existing.includes(`${id}.kdl`)
          ? `There is already a ${noun} with that id`
          : null;
  return (
    <form
      className="studio-new"
      onSubmit={(e) => {
        e.preventDefault();
        if (id && !problem) onCreate(id);
      }}
    >
      <label>
        <span>New {noun} id</span>
        <input autoFocus value={id} onChange={(e) => setId(e.target.value.trim())} placeholder="e.g. black-pennell" aria-invalid={problem !== null} />
      </label>
      <button type="submit" disabled={!id || problem !== null}>
        Create
      </button>
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
      {problem && <span className="studio-new-problem">{problem}</span>}
    </form>
  );
}

const LINE_HEIGHT = 20;

function Editor({
  text,
  onChange,
  errors,
  onSave,
  noun,
  jump,
}: {
  text: string;
  onChange: (t: string) => void;
  errors: RecipeError[];
  onSave: () => void;
  noun: string;
  jump: { line: number; column: number } | null;
}) {
  const area = useRef<HTMLTextAreaElement>(null);
  const gutter = useRef<HTMLDivElement>(null);
  const lines = text.split("\n").length;
  const errorLines = new Set(errors.flatMap((e) => (e.line !== undefined ? [e.line] : [])));

  const goTo = (line: number, column = 1) => {
    const el = area.current!;
    const starts = [0];
    for (let i = 0; i < text.length; i++) if (text[i] === "\n") starts.push(i + 1);
    const at = (starts[line - 1] ?? 0) + column - 1;
    el.focus();
    el.setSelectionRange(at, at);
    el.scrollTop = Math.max(0, (line - 4) * LINE_HEIGHT);
  };
  // Opened from a problem in the form tab: at its line.
  useEffect(() => {
    if (jump) goTo(jump.line, jump.column);
    // Once per jump; goTo reads the text as it is now.
  }, [jump]);


  return (
    <section className="studio-editor" aria-label="Text">
      <div className="studio-code">
        <div className="studio-gutter" ref={gutter} aria-hidden="true">
          {Array.from({ length: lines }, (_, i) => (
            <div key={i} className={errorLines.has(i + 1) ? "has-error" : undefined}>
              {i + 1}
            </div>
          ))}
        </div>
        <textarea
          ref={area}
          value={text}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          aria-label="KDL recipe"
          onChange={(e) => onChange(e.target.value)}
          onScroll={(e) => {
            if (gutter.current) gutter.current.scrollTop = e.currentTarget.scrollTop;
          }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "s") {
              e.preventDefault();
              onSave();
            } else if (e.key === "Tab" && !e.shiftKey) {
              // Indent with four spaces, as the pattern files do.
              e.preventDefault();
              const el = e.currentTarget;
              el.setRangeText("    ", el.selectionStart, el.selectionEnd, "end");
              onChange(el.value);
            }
          }}
        />
      </div>
      <div className="studio-problems">
        {errors.length === 0 ? (
          <p className="studio-ok">No problems: this is a valid {noun}.</p>
        ) : (
          <>
            <h2>
              {errors.length} {errors.length === 1 ? "problem" : "problems"}
            </h2>
            <ul>
              {errors.map((e, i) => (
                <li key={i}>
                  {e.line !== undefined ? (
                    <button onClick={() => goTo(e.line!, e.column)}>{formatError(e)}</button>
                  ) : (
                    <span>{formatError(e)}</span>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}

const STUDIO_VIEWS: { view: ViewName; label: string }[] = [
  { view: "side", label: "Side" },
  { view: "three-quarter", label: "Three-quarter" },
  { view: "top", label: "Top" },
  { view: "front", label: "Front" },
];

function PreviewPane({ build, recipe, stale }: { build: Build | null; recipe: Recipe | null; stale: boolean }) {
  const duration = build?.duration ?? 0;
  const player = usePlayer(duration, null);
  const [view, setView] = useState<ViewName>("side");
  const [grid, setGrid] = useState(true);
  const { seek } = player;

  // A new version of the fly shows finished, so a change of proportions is seen at once.
  useEffect(() => {
    if (build) seek(build.duration);
  }, [build, seek]);

  if (!build || !recipe) {
    return (
      <section className="studio-preview studio-preview-empty" aria-label="Preview">
        <p>The fly appears here once the recipe has no problems.</p>
      </section>
    );
  }
  const current = stepAt(build, player.time);
  return (
    <section className="studio-preview" aria-label="Preview">
      <div className="studio-stage">
        <Preview build={build} time={player.time} view={view} grid={grid} />
        {stale && <p className="studio-stale">Showing the last version without problems</p>}
      </div>
      <div className="studio-controls">
        <div className="studio-views" role="group" aria-label="View">
          {STUDIO_VIEWS.map((v) => (
            <button key={v.view} aria-pressed={view === v.view} onClick={() => setView(v.view)}>
              {v.label}
            </button>
          ))}
        </div>
        <label className="studio-check">
          <input type="checkbox" checked={grid} onChange={(e) => setGrid(e.target.checked)} /> Gape grid
        </label>
        <button onClick={player.playing ? player.pause : player.play}>{player.playing ? "Pause" : "Play"}</button>
        <input
          className="studio-scrub"
          type="range"
          min={0}
          max={duration}
          step={0.01}
          value={player.time}
          onChange={(e) => {
            player.pause();
            player.seek(Number(e.target.value));
          }}
          aria-label="Time"
        />
      </div>
      <StepList
        build={build}
        current={current}
        onPick={(t) => {
          player.pause();
          player.seek(t);
        }}
      />
      <ReferencePhotos references={recipe.references} id={recipe.id} />
    </section>
  );
}

function StepList({ build, current, onPick }: { build: Build; current: number; onPick: (t: number) => void }) {
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    list.current?.children[current]?.scrollIntoView({ block: "nearest" });
  }, [current]);
  return (
    <ol className="studio-steps" ref={list}>
      {build.steps.map((s, i) => (
        <li key={i} aria-current={i === current ? "step" : undefined}>
          <button onClick={() => onPick(stepEnd(s))}>
            <strong>{s.title}</strong> {s.text}
          </button>
        </li>
      ))}
    </ol>
  );
}

/** The 3D fly, with the camera fixed to a view and an optional measuring grid in gapes. */
function Preview({ build, time, view, grid }: { build: Build; time: number; view: ViewName; grid: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  const scene = useRef<FlyScene | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let s: FlyScene;
    try {
      s = new FlyScene(container.current!, { background: null, fov: 12 });
    } catch {
      // No WebGL: the editor and its checks still work without the preview.
      setUnavailable(true);
      return;
    }
    scene.current = s;
    return () => {
      s.dispose();
      scene.current = null;
    };
  }, []);

  // A new build resets the scene's time; the effect below puts it back. View and grid
  // changes keep the build and its time.
  useEffect(() => {
    scene.current?.setBuild(build);
  }, [build]);
  useEffect(() => {
    scene.current?.setView(view);
  }, [view]);
  useEffect(() => {
    scene.current?.setGrid(grid);
  }, [grid]);

  useEffect(() => {
    scene.current?.setTime(time);
  }, [build, time]);

  return (
    <div className="studio-canvas" ref={container}>
      {unavailable && <p className="viewer-unavailable">No 3D preview: this browser has WebGL turned off or unavailable.</p>}
    </div>
  );
}

/** Reference photos as pictures to compare with the render (the studio runs only on this machine). */
function ReferencePhotos({ references, id }: { references: { image: string; page?: string; author?: string; note?: string; flip?: boolean }[]; id: string }) {
  return (
    <div className="studio-refs">
      <h2>Reference photos</h2>
      {references.length === 0 ? (
        <p>None yet. Add some under references, then compare with the render.</p>
      ) : (
        <ul className="studio-ref-photos">
          {references.map((r) => (
            <li key={r.image}>
              <a href={r.page ?? r.image} target="_blank" rel="noreferrer">
                <img src={r.image} alt={r.note ?? ""} loading="lazy" referrerPolicy="no-referrer" style={r.flip ? { transform: "scaleX(-1)" } : undefined} />
              </a>
              <span>
                {r.note}
                {r.author ? `, ${r.author}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p>
        Contact sheet against them: <code>pnpm refcheck {id}</code>
      </p>
    </div>
  );
}

/** A natural in 3D: on a grid in tenths of its body length, or in the realistic river. */
function NaturalPreviewPane({ natural, stale }: { natural: Natural | null; stale: boolean }) {
  const [view, setView] = useState<ViewName>("side");
  const [grid, setGrid] = useState(true);
  const [river, setRiver] = useState<"off" | "angler" | "below">("off");
  if (!natural) {
    return (
      <section className="studio-preview studio-preview-empty" aria-label="Preview">
        <p>The natural appears here once it has no problems.</p>
      </section>
    );
  }
  return (
    <section className="studio-preview" aria-label="Preview">
      <div className="studio-stage">
        <NaturalPreview natural={natural} view={view} grid={grid && river === "off"} river={river} />
        {stale && <p className="studio-stale">Showing the last version without problems</p>}
      </div>
      <div className="studio-controls">
        <div className="studio-views" role="group" aria-label="View">
          {STUDIO_VIEWS.map((v) => (
            <button key={v.view} aria-pressed={river === "off" && view === v.view} onClick={() => (setRiver("off"), setView(v.view))}>
              {v.label}
            </button>
          ))}
        </div>
        <label className="studio-check">
          <input type="checkbox" checked={grid} onChange={(e) => setGrid(e.target.checked)} disabled={river !== "off"} /> Grid (tenths of the body)
        </label>
        <div className="studio-views" role="group" aria-label="In the river">
          <button aria-pressed={river === "angler"} onClick={() => setRiver(river === "angler" ? "off" : "angler")}>
            River, above
          </button>
          <button aria-pressed={river === "below"} onClick={() => setRiver(river === "below" ? "off" : "below")}>
            River, below
          </button>
        </div>
      </div>
      <ReferencePhotos references={natural.references} id={natural.id} />
    </section>
  );
}

function NaturalPreview({ natural, view, grid, river }: { natural: Natural; view: ViewName; grid: boolean; river: "off" | "angler" | "below" }) {
  const container = useRef<HTMLDivElement>(null);
  const scene = useRef<FlyScene | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [real, setReal] = useState<RealAssets | null>(null);

  useEffect(() => {
    let s: FlyScene;
    try {
      s = new FlyScene(container.current!, { background: null, fov: 12 });
    } catch {
      setUnavailable(true);
      return;
    }
    scene.current = s;
    return () => {
      s.dispose();
      scene.current = null;
    };
  }, []);
  useEffect(() => {
    if (river !== "off" && !real) loadRealAssets(siteAssets(import.meta.env.BASE_URL)).then(setReal, () => {});
  }, [river, real]);

  // On the grid ten units long (tenths of the body); in the river at its real size in gapes.
  // A changed natural goes in in place (in the river too: setNatural puts it back in the water);
  // the river itself is made again only when the view of it changes.
  const inRiver = river !== "off" && real !== null;
  useEffect(() => {
    const s = scene.current;
    if (!s) return;
    s.setWater(null);
    s.setGrid(false);
    s.setNatural(natural, inRiver ? naturalAlone(natural) : 10);
    if (inRiver) s.setWater({ fishing: naturalFishing(natural), view: river as "angler" | "below", still: false, look: WATER_LOOKS.light, real: real! });
    else {
      s.setView(view);
      s.setGrid(grid);
    }
    // natural is left out: the effect below handles a new version of it.
  }, [view, grid, river, real]);
  useEffect(() => {
    const s = scene.current;
    if (!s) return;
    s.setNatural(natural, inRiver ? naturalAlone(natural) : 10);
    if (!inRiver) s.setGrid(grid);
  }, [natural]);

  return (
    <div className="studio-canvas" ref={container}>
      {unavailable && <p className="viewer-unavailable">No 3D preview: this browser has WebGL turned off or unavailable.</p>}
    </div>
  );
}
