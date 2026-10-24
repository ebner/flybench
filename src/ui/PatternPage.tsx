import { useEffect, useMemo, useState } from "react";
import { DIFFICULTY_LABELS, factsSentence } from "../catalog/describe";
import { stepTechnique, technique } from "../catalog/techniques";
import { findPattern, variantFamily } from "../patterns";
import type { Recipe } from "../recipe/schema";
import { materialName, materialsList } from "../tying/describe";
import { ridesPointUp } from "../tying/hook";
import { simulate, stepAt } from "../tying/simulate";
import { Paragraphs } from "./Paragraphs";
import { match, materialColor } from "../catalog/inventory";
import { href, replaceHash } from "./router";
import { FLY_BOX_KEY, INVENTORY_KEY, useStoredSet } from "./storage";
import { useWakeLock } from "./wakeLock";
import { usePlayer } from "./usePlayer";
import { Viewer } from "./Viewer";

export function PatternPage({ id, step }: { id: string; step?: number }) {
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
  return <PatternView key={id} recipe={pattern.recipe} initialStep={step} />;
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

const FOLLOW_KEY = "flybench.follow";

function readFollow(): boolean {
  try {
    return localStorage.getItem(FOLLOW_KEY) !== "off";
  } catch {
    return true;
  }
}

/** Even hook sizes around the size the pattern is tied on. */
function hookSizes(size: number): number[] {
  const sizes: number[] = [];
  for (let s = Math.max(2, size - 8); s <= Math.min(24, size + 8); s += 2) sizes.push(s);
  return sizes;
}

function PatternView({ recipe: original, initialStep }: { recipe: Recipe; initialStep?: number }) {
  // The hook size can be changed to see the same fly at another size: proportions stay,
  // thread bulk changes as it would at the vise.
  // Tubes are sized by length, so only hooks offer other sizes.
  const tiedSize = original.hook.size;
  const [size, setSize] = useState(tiedSize);
  const recipe = useMemo(() => (size === original.hook.size ? original : { ...original, hook: { ...original.hook, size } }), [original, size]);
  const build = useMemo(() => simulate(recipe), [recipe]);
  const [follow, setFollowState] = useState(readFollow);
  const setFollow = (on: boolean) => {
    setFollowState(on);
    try {
      localStorage.setItem(FOLLOW_KEY, on ? "on" : "off");
    } catch {
      // Storage unavailable: the choice lasts for this visit.
    }
  };
  const [flash, setFlash] = useState<string | null>(null);
  // Vise mode: big controls for following along at the vise; the screen stays on.
  const [vise, setVise] = useState(false);
  useWakeLock(vise);
  const box = useStoredSet(FLY_BOX_KEY);
  const owned = useStoredSet(INVENTORY_KEY);
  const mainId = original.variantOf ?? original.id;
  const ownership = (id: string) => {
    const m = recipe.materials.find((m) => m.id === id);
    if (!m || owned.values.size === 0) return null;
    return match({ kind: m.kind, color: materialColor(m) }, owned.values);
  };
  const [stopAt, setStopAt] = useState<number | null>(null);
  const player = usePlayer(build.duration, stopAt);
  const current = stepAt(build, player.time);
  const step = build.steps[current]!;
  const family = variantFamily(recipe);
  const recipeStep = recipe.steps[current]!;
  const inUse = "material" in recipeStep ? recipeStep.material : "thread";
  const inUseMaterial = recipe.materials.find((m) => m.id === inUse);
  const callout = inUseMaterial ? materialName(inUseMaterial) : current === 0 && recipeStep.op !== "attach-thread" ? null : "Thread";
  const showInDressing = () => {
    setFlash(inUse);
    document.getElementById(`dressing-${inUse}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    setTimeout(() => setFlash(null), 1600);
  };

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
      if (e.key === "Escape" && vise) {
        setVise(false);
      } else if (e.key === " ") {
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
    <div className={vise ? "pattern vise" : "pattern"}>
      <section className="stage" aria-label="3D tying sequence">
        <Viewer
          build={build}
          time={player.time}
          follow={follow}
          onFollowChange={setFollow}
          callout={callout}
          onCalloutClick={showInDressing}
          pointUp={ridesPointUp(recipe)}
        />
        <div
          className="now"
          aria-live="polite"
          onClick={vise ? () => playStep(player.time >= step.start + step.duration - 0.05 ? current + 1 : current) : undefined}
        >
          <p className="now-index">
            Step {current + 1} of {build.steps.length}
          </p>
          <h2>{step.title}</h2>
          <p className="now-text">{step.text}</p>
          {vise && <p className="vise-hint">Tap here to play the next step. Esc or “Leave vise mode” to go back.</p>}
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
          <button className="vise-toggle" aria-pressed={vise} onClick={() => setVise(!vise)}>
            {vise ? "Leave vise mode" : "Vise mode"}
          </button>
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
        <button className="box-toggle" aria-pressed={box.has(mainId)} onClick={() => box.toggle(mainId)}>
          {box.has(mainId) ? "In your fly box" : "Add to fly box"}
        </button>

        <h3>Dressing</h3>
        <dl className="dressing">
          {materialsList(recipe).map((m) => (
            <div
              key={m.id}
              id={`dressing-${m.id}`}
              className={[m.id === inUse ? "in-use" : "", m.id === flash ? "flash" : ""].join(" ").trim() || undefined}
            >
              <dt>{m.role}</dt>
              <dd>
                {m.name}
                {m.id === "hook" && tiedSize !== undefined ? (
                  <label className="detail hook-size">
                    , size{" "}
                    <select value={size} onChange={(e) => setSize(Number(e.target.value))} aria-label="Hook size">
                      {hookSizes(tiedSize).map((s) => (
                        <option key={s} value={s}>
                          {s}
                          {s === tiedSize ? " (as tied)" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  m.detail && <span className="detail">, {m.detail}</span>
                )}
                {(() => {
                  const o = ownership(m.id);
                  return o === "have" ? (
                    <span className="owned">You have this</span>
                  ) : o === "substitute" ? (
                    <span className="owned substitute">You have it in another colour</span>
                  ) : o === "missing" ? (
                    <span className="owned missing">Not in your materials</span>
                  ) : null;
                })()}
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
              {(() => {
                const t = technique(stepTechnique(original, s.index) ?? "");
                return t ? (
                  <a className="how-to" href={href.technique(t.id)}>
                    How to: {t.name.toLowerCase()}
                  </a>
                ) : null;
              })()}
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
