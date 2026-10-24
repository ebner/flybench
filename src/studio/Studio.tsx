import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { formatError, type RecipeError } from "../recipe/errors";
import { loadRecipe } from "../recipe/load";
import type { Recipe } from "../recipe/schema";
import { FlyScene, type ViewName } from "../render/FlyScene";
import { simulate, stepAt, type Build } from "../tying/simulate";
import { useTheme, VIEWER_BACKGROUND, type Theme } from "../ui/theme";
import { usePlayer } from "../ui/usePlayer";
import { listPatterns, readPattern, savePattern } from "./api";
import { checkDraft, isPatternFile, newPatternText } from "./draft";

/**
 * The authoring studio: edit a pattern's KDL with its problems listed as you type, and watch
 * the fly it describes in 3D. Only on the dev server; saving writes to patterns/.
 */
export function Studio() {
  const { theme } = useTheme();
  const [saved, setSaved] = useState<Map<string, string>>(new Map());
  const [file, setFile] = useState<string | null>(null);
  const [text, setText] = useState("");
  /** A new pattern that is not on disk yet. */
  const [unsavedFile, setUnsavedFile] = useState(false);
  const [status, setStatus] = useState("Loading patterns…");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    (async () => {
      const files = await listPatterns();
      const texts = await Promise.all(files.map(readPattern));
      setSaved(new Map(files.map((f, i) => [f, texts[i]!])));
      const wanted = new URLSearchParams(location.search).get("pattern");
      const first = wanted && files.includes(`${wanted}.kdl`) ? `${wanted}.kdl` : files[0] ?? null;
      if (first) {
        setFile(first);
        setText(texts[files.indexOf(first)]!);
      }
      setStatus("");
    })().catch((e: unknown) => setStatus(`Couldn't load the patterns: ${String(e)}. Is this the dev server (npm run dev)?`));
  }, []);

  const dirty = file !== null && (unsavedFile || saved.get(file) !== text);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    addEventListener("beforeunload", warn);
    return () => removeEventListener("beforeunload", warn);
  }, [dirty]);

  // The other patterns, for the catalog rules (unique ids, variant-of targets).
  const others = useMemo(() => {
    const list: { file: string; recipe: Recipe }[] = [];
    for (const [f, t] of saved) {
      if (f === file) continue;
      const r = loadRecipe(t);
      if (r.ok) list.push({ file: f, recipe: r.recipe });
    }
    return list;
  }, [saved, file]);

  // Checked a moment behind the typing; file and text are deferred together so they always match.
  const input = useMemo(() => ({ file, text }), [file, text]);
  const draft = useDeferredValue(input);
  const check = useMemo(
    () => (draft.file ? checkDraft(draft.text, draft.file, others) : { errors: [] }),
    [draft, others],
  );

  // The preview keeps showing the last version without errors while you type.
  const [shown, setShown] = useState<Recipe | null>(null);
  useEffect(() => setShown(null), [file]);
  useEffect(() => {
    if (check.recipe && draft.file === file) setShown(check.recipe);
  }, [check.recipe, draft.file, file]);
  const build = useMemo(() => (shown ? simulate(shown) : null), [shown]);

  const open = (f: string) => {
    if (dirty && !confirm(`Discard the unsaved changes to ${file}?`)) return;
    setFile(f);
    setText(saved.get(f) ?? "");
    setUnsavedFile(false);
    setStatus("");
    history.replaceState(null, "", `?pattern=${f.replace(/\.kdl$/, "")}`);
  };

  const save = useCallback(async () => {
    if (!file) return;
    try {
      await savePattern(file, text, unsavedFile);
      setSaved((m) => new Map(m).set(file, text));
      setUnsavedFile(false);
      const problems = checkDraft(text, file, others).errors.length;
      setStatus(problems ? `Saved ${file}, with ${problems} ${problems === 1 ? "problem" : "problems"} still to fix` : `Saved ${file}`);
    } catch (e) {
      setStatus(`Not saved: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [file, text, unsavedFile, others]);

  const create = (id: string) => {
    if (dirty && !confirm(`Discard the unsaved changes to ${file}?`)) return;
    const f = `${id}.kdl`;
    setFile(f);
    setText(newPatternText(id));
    setUnsavedFile(true);
    setCreating(false);
    setStatus(`New pattern, not saved yet`);
    history.replaceState(null, "", `?pattern=${id}`);
  };

  const files = [...saved.keys(), ...(unsavedFile && file ? [file] : [])].sort();

  return (
    <div className="studio">
      <header className="studio-bar">
        <h1>
          Flybench <span>studio</span>
        </h1>
        <label className="studio-file">
          <span className="visually-hidden">Pattern file</span>
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
          <NewPatternForm existing={files} onCreate={create} onCancel={() => setCreating(false)} />
        ) : (
          <button onClick={() => setCreating(true)}>New pattern</button>
        )}
        <button className="primary" onClick={save} disabled={!dirty}>
          Save
        </button>
        <p className="studio-status" role="status">
          {status || (dirty ? "Unsaved changes" : file ? "No unsaved changes" : "")}
        </p>
        {file && !unsavedFile && (
          <a className="studio-site" href={`./#/fly/${file.replace(/\.kdl$/, "")}`} target="_blank" rel="noreferrer">
            Open on the site
          </a>
        )}
      </header>
      <div className="studio-panes">
        <Editor text={text} onChange={setText} errors={check.errors} onSave={save} />
        <PreviewPane build={build} recipe={shown} theme={theme} stale={!check.recipe && shown !== null} />
      </div>
    </div>
  );
}

function NewPatternForm({ existing, onCreate, onCancel }: { existing: string[]; onCreate: (id: string) => void; onCancel: () => void }) {
  const [id, setId] = useState("");
  const problem =
    id === ""
      ? null
      : !isPatternFile(`${id}.kdl`)
        ? "Lowercase letters, digits and dashes, starting with a letter"
        : existing.includes(`${id}.kdl`)
          ? "There is already a pattern with that id"
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
        <span>New pattern id</span>
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

function Editor({ text, onChange, errors, onSave }: { text: string; onChange: (t: string) => void; errors: RecipeError[]; onSave: () => void }) {
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

  return (
    <section className="studio-editor" aria-label="Recipe">
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
          <p className="studio-ok">No problems: this is a valid pattern.</p>
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

function PreviewPane({ build, recipe, theme, stale }: { build: Build | null; recipe: Recipe | null; theme: Theme; stale: boolean }) {
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
        <Preview build={build} time={player.time} theme={theme} view={view} grid={grid} />
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
      <div className="studio-refs">
        <h2>Reference photos</h2>
        {recipe.references.length === 0 ? (
          <p>None yet. Add some under references, then compare with the render.</p>
        ) : (
          <ul>
            {recipe.references.map((r) => (
              <li key={r.image}>
                <a href={r.page ?? r.image} target="_blank" rel="noreferrer">
                  {r.note ?? r.image}
                </a>
                {r.author ? `, ${r.author}` : ""}
              </li>
            ))}
          </ul>
        )}
        <p>
          Contact sheet against them: <code>npm run refcheck -- {recipe.id}</code>
        </p>
      </div>
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
          <button onClick={() => onPick(s.start + s.duration)}>
            <strong>{s.title}</strong> {s.text}
          </button>
        </li>
      ))}
    </ol>
  );
}

/** The 3D fly, with the camera fixed to a view and an optional measuring grid in gapes. */
function Preview({ build, time, theme, view, grid }: { build: Build; time: number; theme: Theme; view: ViewName; grid: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  const scene = useRef<FlyScene | null>(null);

  useEffect(() => {
    const s = new FlyScene(container.current!, { background: VIEWER_BACKGROUND[theme], fov: 12 });
    scene.current = s;
    return () => {
      s.dispose();
      scene.current = null;
    };
    // The theme is applied below; the scene is created once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scene.current?.setBackground(VIEWER_BACKGROUND[theme]);
  }, [theme]);

  useEffect(() => {
    const s = scene.current!;
    s.setBuild(build);
    s.setView(view);
    s.setGrid(grid);
  }, [build, view, grid]);

  useEffect(() => {
    scene.current?.setTime(time);
  }, [build, time]);

  return <div className="studio-canvas" ref={container} />;
}
