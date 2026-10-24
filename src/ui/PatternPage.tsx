import { useEffect, useMemo, useState } from "react";
import { DIFFICULTY_LABELS, factsSentence } from "../catalog/describe";
import { findPattern, variantFamily } from "../patterns";
import type { Recipe } from "../recipe/schema";
import { materialsList } from "../tying/describe";
import { simulate, stepAt } from "../tying/simulate";
import { href, replaceHash } from "./router";
import type { Theme } from "./theme";
import { usePlayer } from "./usePlayer";
import { Viewer } from "./Viewer";

export function PatternPage({ id, step, theme }: { id: string; step?: number; theme: Theme }) {
  const pattern = findPattern(id);
  if (!pattern) {
    return (
      <main className="not-found">
        <h1>No pattern called “{id}”</h1>
        <p>
          It may have been renamed. <a href={href.gallery()}>Browse all patterns</a> or search for it there.
        </p>
      </main>
    );
  }
  return <PatternView key={id} recipe={pattern.recipe} initialStep={step} theme={theme} />;
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

const Icon = {
  previous: <path d="M5.5 5H8v14H5.5zM19 5 9 12l10 7z" />,
  play: <path d="M7 4.5v15L19.5 12z" />,
  pause: <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />,
  replay: <path d="M5 12a7 7 0 1 0 2.05-4.95M5 4v4h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
  next: <path d="M16 5h2.5v14H16zM5 5l10 7-10 7z" />,
};

function TransportIcon({ name }: { name: keyof typeof Icon }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      {Icon[name]}
    </svg>
  );
}

function PatternView({ recipe, initialStep, theme }: { recipe: Recipe; initialStep?: number; theme: Theme }) {
  const build = useMemo(() => simulate(recipe), [recipe]);
  const [stopAt, setStopAt] = useState<number | null>(null);
  const player = usePlayer(build.duration, stopAt);
  const current = stepAt(build, player.time);
  const step = build.steps[current]!;
  const family = variantFamily(recipe);

  useEffect(() => {
    document.title = `${recipe.name}${recipe.variant ? ` (${recipe.variant})` : ""}, Flybench`;
  }, [recipe]);

  // Open at the linked step, paused at its start.
  useEffect(() => {
    if (initialStep) player.seek(build.steps[Math.min(initialStep, build.steps.length) - 1]!.start);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Keep the URL on the current step, so it can be shared.
  useEffect(() => {
    replaceHash(href.fly(recipe.id, current > 0 ? current + 1 : undefined));
  }, [recipe.id, current]);

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
      const t = e.target;
      if ((t instanceof HTMLInputElement && t.type !== "range") || t instanceof HTMLSelectElement || t instanceof HTMLTextAreaElement) return;
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

  const origin = [recipe.origin?.originator, recipe.origin?.region, recipe.origin?.year].filter(Boolean).join(", ");

  return (
    <div className="pattern">
      <section className="stage" aria-label="3D tying sequence">
        <Viewer build={build} time={player.time} theme={theme} />
        <div className="now" aria-live="polite">
          <p className="now-index">
            Step {current + 1} of {build.steps.length}
          </p>
          <h2>{step.title}</h2>
          <p className="now-text">{step.text}</p>
        </div>
        <div className="transport">
          <button onClick={() => playStep(current - 1)} disabled={current === 0} aria-label="Previous step">
            <TransportIcon name="previous" />
          </button>
          <button className="play" onClick={() => (player.playing ? player.pause() : playAll())} aria-label={player.playing ? "Pause" : "Play"}>
            <TransportIcon name={player.playing ? "pause" : "play"} />
          </button>
          <button onClick={() => playStep(current)} aria-label="Replay this step">
            <TransportIcon name="replay" />
          </button>
          <button onClick={() => playStep(current + 1)} disabled={current === build.steps.length - 1} aria-label="Next step">
            <TransportIcon name="next" />
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
            <div className="ticks" aria-hidden="true">
              {build.steps.slice(1).map((s) => (
                <span key={s.index} style={{ left: `${(s.start / build.duration) * 100}%` }} />
              ))}
            </div>
          </div>
          <select value={player.speed} onChange={(e) => player.setSpeed(Number(e.target.value))} aria-label="Speed">
            <option value={0.5}>Half speed</option>
            <option value={1}>Normal speed</option>
            <option value={2}>Double speed</option>
          </select>
        </div>
      </section>

      <aside className="notes">
        <a className="back" href={href.gallery()}>
          All patterns
        </a>
        <h1>{recipe.name}</h1>
        {recipe.aliases.length > 0 && <p className="aliases">Also called {recipe.aliases.join(", ")}</p>}
        {family.length > 1 && (
          <nav className="variants" aria-label="Versions of this pattern">
            {family.map((p) => (
              <a key={p.recipe.id} href={href.fly(p.recipe.id)} aria-current={p.recipe.id === recipe.id ? "page" : undefined}>
                {p.recipe.variant ?? "Standard"}
              </a>
            ))}
          </nav>
        )}
        <p className="facts">
          {factsSentence(recipe)} {DIFFICULTY_LABELS[recipe.difficulty]}.
        </p>
        {recipe.description && <p className="description">{recipe.description}</p>}
        {origin && <p className="origin">First tied by {origin}.</p>}

        <h3>Dressing</h3>
        <dl className="dressing">
          {materialsList(recipe).map((m) => (
            <div key={m.role}>
              <dt>{m.role}</dt>
              <dd>
                {m.name}
                {m.detail && <span className="detail">, {m.detail}</span>}
              </dd>
            </div>
          ))}
        </dl>

        <h3>Steps</h3>
        <ol className="steps">
          {build.steps.map((s) => (
            <li key={s.index} className={s.index === current ? "active" : s.index < current ? "done" : ""}>
              <button onClick={() => playStep(s.index)} aria-current={s.index === current ? "step" : undefined}>
                <strong>{s.title}</strong>
                <span>{s.text}</span>
              </button>
            </li>
          ))}
        </ol>

        {recipe.history && (
          <section>
            <h3>History</h3>
            <Paragraphs text={recipe.history} />
          </section>
        )}
        {recipe.fishing && (
          <section>
            <h3>Fishing it</h3>
            <Paragraphs text={recipe.fishing} />
          </section>
        )}
        {recipe.sources.length > 0 && (
          <section>
            <h3>Sources</h3>
            <ul className="sources">
              {recipe.sources.map((s) => (
                <li key={s.title}>
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noreferrer">
                      {s.title}
                    </a>
                  ) : (
                    s.title
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </aside>
    </div>
  );
}
