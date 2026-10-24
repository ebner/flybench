import { useEffect, useMemo, useState } from "react";
import { findPattern, PATTERN_ERRORS, PATTERNS, variantFamily } from "../patterns";
import type { Recipe } from "../recipe/schema";
import { materialsList } from "../tying/describe";
import { simulate, stepAt } from "../tying/simulate";
import { usePlayer } from "./usePlayer";
import { Viewer } from "./Viewer";

const DEFAULT_PATTERN = "red-tag";

/** The pattern id in the URL hash, e.g. #/elk-hair-caddis. */
function useHashPattern(): string {
  const read = () => decodeURIComponent(location.hash.replace(/^#\/?/, "")) || DEFAULT_PATTERN;
  const [id, setId] = useState(read);
  useEffect(() => {
    const onChange = () => setId(read());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return id;
}

export function App() {
  const id = useHashPattern();
  const pattern = findPattern(id) ?? findPattern(DEFAULT_PATTERN) ?? PATTERNS[0];
  return (
    <>
      {PATTERN_ERRORS.length > 0 && (
        <details className="load-errors">
          <summary>{PATTERN_ERRORS.length} problem(s) in pattern files</summary>
          <ul>
            {PATTERN_ERRORS.map((e, i) => (
              <li key={i}>
                <code>{e}</code>
              </li>
            ))}
          </ul>
        </details>
      )}
      {pattern ? <PatternView key={pattern.recipe.id} recipe={pattern.recipe} /> : <p className="empty">No patterns.</p>}
    </>
  );
}

function PatternHeader({ recipe }: { recipe: Recipe }) {
  const family = variantFamily(recipe);
  const mains = PATTERNS.filter((p) => p.recipe.variantOf === undefined);
  const facts = [recipe.type, ...recipe.imitates, recipe.difficulty];
  const origin = [recipe.origin?.originator, recipe.origin?.region, recipe.origin?.year].filter(Boolean).join(", ");
  return (
    <header>
      <select
        className="pattern-picker"
        value={recipe.variantOf ?? recipe.id}
        onChange={(e) => (location.hash = `#/${e.target.value}`)}
        aria-label="Pattern"
      >
        {mains.map((p) => (
          <option key={p.recipe.id} value={p.recipe.id}>
            {p.recipe.name}
          </option>
        ))}
      </select>
      <h1>{recipe.name}</h1>
      {family.length > 1 && (
        <nav className="variants" aria-label="Variants">
          {family.map((p) => (
            <a key={p.recipe.id} href={`#/${p.recipe.id}`} className={p.recipe.id === recipe.id ? "active" : ""}>
              {p.recipe.variant ?? "Standard"}
            </a>
          ))}
        </nav>
      )}
      <p className="facts">{facts.join(" · ")}</p>
      {recipe.aliases.length > 0 && <p className="aliases">Also: {recipe.aliases.join(", ")}</p>}
      {recipe.description && <p>{recipe.description}</p>}
      {origin && <p className="origin">Origin: {origin}</p>}
    </header>
  );
}

/** Multi-line recipe text: blank lines separate paragraphs, single line breaks are just wrapping. */
function Paragraphs({ text }: { text: string }) {
  return (
    <>
      {text.split(/\n\s*\n/).map((p, i) => (
        <p key={i}>{p.replace(/\s*\n\s*/g, " ")}</p>
      ))}
    </>
  );
}

function PatternNotes({ recipe }: { recipe: Recipe }) {
  return (
    <>
      {recipe.history && (
        <details>
          <summary>History</summary>
          <Paragraphs text={recipe.history} />
        </details>
      )}
      {recipe.fishing && (
        <details>
          <summary>Fishing</summary>
          <Paragraphs text={recipe.fishing} />
        </details>
      )}
      {recipe.sources.length > 0 && (
        <details>
          <summary>Sources</summary>
          <ul className="sources">
            {recipe.sources.map((s) => (
              <li key={s.title}>{s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.title}</a> : s.title}</li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

function PatternView({ recipe }: { recipe: Recipe }) {
  const build = useMemo(() => simulate(recipe), [recipe]);
  const [stopAt, setStopAt] = useState<number | null>(null);
  const player = usePlayer(build.duration, stopAt);
  const current = stepAt(build, player.time);
  const step = build.steps[current]!;

  const playStep = (i: number) => {
    const s = build.steps[Math.max(0, Math.min(build.steps.length - 1, i))]!;
    setStopAt(s.start + s.duration);
    player.playFrom(s.start);
  };
  const playAll = () => {
    setStopAt(null);
    player.play();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement && e.target.type !== "range") return;
      if (e.key === " ") {
        e.preventDefault();
        if (player.playing) player.pause();
        else playAll();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        playStep(current + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        // Within the first second of a step, go to the previous one; otherwise replay this one.
        playStep(player.time - step.start < 1 ? current - 1 : current);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="app">
      <main className="stage">
        <Viewer build={build} time={player.time} />
        <div className="now">
          <div className="now-head">
            <span className="now-index">
              Step {current + 1} of {build.steps.length}
            </span>
            <h2>{step.title}</h2>
          </div>
          <p>{step.text}</p>
        </div>
        <div className="transport">
          <button onClick={() => playStep(current - 1)} disabled={current === 0} aria-label="Previous step">
            ⏮
          </button>
          <button onClick={() => (player.playing ? player.pause() : playAll())} aria-label={player.playing ? "Pause" : "Play"}>
            {player.playing ? "⏸" : "▶"}
          </button>
          <button onClick={() => playStep(current)} aria-label="Replay step">
            ↻
          </button>
          <button
            onClick={() => playStep(current + 1)}
            disabled={current === build.steps.length - 1}
            aria-label="Next step"
          >
            ⏭
          </button>
          <div className="scrub">
            <input
              type="range"
              min={0}
              max={build.duration}
              step="any"
              value={player.time}
              onChange={(e) => {
                player.pause();
                setStopAt(null);
                player.seek(Number(e.target.value));
              }}
              aria-label="Timeline"
            />
            <div className="ticks">
              {build.steps.slice(1).map((s) => (
                <span key={s.index} style={{ left: `${(s.start / build.duration) * 100}%` }} />
              ))}
            </div>
          </div>
          <select value={player.speed} onChange={(e) => player.setSpeed(Number(e.target.value))} aria-label="Speed">
            <option value={0.5}>0.5×</option>
            <option value={1}>1×</option>
            <option value={2}>2×</option>
          </select>
        </div>
      </main>

      <aside className="side">
        <PatternHeader recipe={recipe} />
        <PatternNotes recipe={recipe} />
        <section>
          <h3>Materials</h3>
          <dl className="materials">
            {materialsList(recipe).map((m) => (
              <div key={m.role}>
                <dt>{m.role}</dt>
                <dd>
                  {m.name}
                  {m.detail && <span className="detail"> · {m.detail}</span>}
                </dd>
              </div>
            ))}
          </dl>
        </section>
        <section>
          <h3>Steps</h3>
          <ol className="steps">
            {build.steps.map((s) => (
              <li key={s.index} className={s.index === current ? "active" : s.index < current ? "done" : ""}>
                <button onClick={() => playStep(s.index)}>
                  <strong>{s.title}</strong>
                  <span>{s.text}</span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      </aside>
    </div>
  );
}
