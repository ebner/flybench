import { useEffect, useMemo, useRef, useState } from "react";
import { DIFFICULTY_LABELS, factsSentence } from "../catalog/describe";
import { stepTechnique, technique } from "../catalog/techniques";
import { findPattern, variantFamily } from "../patterns";
import type { Recipe } from "../recipe/schema";
import { materialName, materialsList } from "../tying/describe";
import { ridesPointUp } from "../tying/hook";
import { simulate, stepAt, stepEnd, stepProgress } from "../tying/simulate";
import { Paragraphs } from "./Paragraphs";
import { match, materialColor } from "../catalog/inventory";
import { href, replaceUrl } from "./router";
import { FLY_BOX_KEY, INVENTORY_KEY, useStoredSet } from "./storage";
import { useWakeLock } from "./wakeLock";
import { usePlayer } from "./usePlayer";
import { NotFound } from "./NotFound";
import { StepBar } from "./StepBar";
import { Viewer } from "./Viewer";

export function PatternPage({ id, step }: { id: string; step?: number }) {
  const pattern = findPattern(id);
  if (!pattern) {
    return (
      <NotFound heading={<>No pattern called “{id}”</>}>
        <p>
          It may have been renamed. <a href={href.gallery()}>Browse all patterns</a> or search for it there.
        </p>
      </NotFound>
    );
  }
  return <PatternView key={id} recipe={pattern.recipe} linkedStep={step} />;
}

const Icon = {
  previous: <path d="M5.5 5H8v14H5.5zM19 5 9 12l10 7z" />,
  play: <path d="M7 4.5v15L19.5 12z" />,
  pause: <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />,
  replay: <path d="M5 12a7 7 0 1 0 2.05-4.95M5 4v4h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
  next: <path d="M16 5h2.5v14H16zM5 5l10 7-10 7z" />,
  more: <path d="M5 10.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6Zm7 0a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6Zm7 0a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6Z" />,
};

const SPEEDS: [number, string][] = [
  [0.5, "Half speed"],
  [1, "Normal speed"],
  [2, "Double speed"],
];

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

/** `linkedStep` is the step in the address (1-based), which the page also keeps up to date itself. */
function PatternView({ recipe: original, linkedStep }: { recipe: Recipe; linkedStep?: number }) {
  // The hook size can be changed to see the same fly at another size: proportions stay,
  // thread bulk changes as it would at the vise.
  // Tubes are sized by length, so only hooks offer other sizes.
  const tiedSize = original.hook.size;
  const [size, setSize] = useState(tiedSize);
  const sized = (s: typeof size) => (s === original.hook.size ? original : { ...original, hook: { ...original.hook, size: s } });
  const recipe = useMemo(() => sized(size), [original, size]);
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

  // Another hook size changes how long the steps take: keep the same point of the same step,
  // and a replayed step's stop, rather than the same number of seconds. Time and size change
  // in one render, so the address never shows a step in between.
  const changeSize = (s: number) => {
    const next = simulate(sized(s));
    const same = (i: number) => next.steps[Math.min(i, next.steps.length - 1)]!;
    const progress = stepProgress(step, player.time);
    const t =
      player.time >= build.duration - 0.001
        ? next.duration
        : progress >= 1
          ? stepEnd(same(current))
          : same(current).start + progress * same(current).duration;
    setSize(s);
    player.seek(t, next.duration);
    if (stopAt !== null) setStopAt(stepEnd(same(stepAt(build, stopAt))));
  };
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

  // The step this page last wrote into the address (null: none yet). The address reaches
  // the router a render later, when playback may have moved on, so the page tells its own
  // writes from links by this, not by the current step.
  const written = useRef<number | undefined | null>(null);
  // Open at the linked step, paused at its start, and follow a link to another step of this fly.
  useEffect(() => {
    if (linkedStep === written.current) return;
    player.pause();
    setStopAt(null);
    player.seek(build.steps[Math.min(linkedStep ?? 1, build.steps.length) - 1]!.start);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedStep]);
  // A long instruction scrolls; the next one starts at its beginning.
  const nowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    nowRef.current?.scrollTo(0, 0);
  }, [current]);
  // Keep the URL on the current step, so it can be shared.
  useEffect(() => {
    written.current = current > 0 ? current + 1 : undefined;
    replaceUrl(href.fly(recipe.id, written.current));
  }, [recipe.id, current]);

  const playStep = (i: number) => {
    const s = build.steps[Math.max(0, Math.min(build.steps.length - 1, i))]!;
    setStopAt(stepEnd(s));
    player.playFrom(s.start);
  };
  const playAll = () => {
    setStopAt(null);
    player.play();
  };
  // Vise mode pauses after every step: play the next one; a step paused halfway resumes.
  const playNext = () => {
    if (player.time >= step.start + step.duration - 0.05) return playStep(current + 1);
    setStopAt(stepEnd(step));
    player.play();
  };
  const play = () => (vise ? playNext() : playAll());
  // Back to the start of step 1, paused: holding the previous-step button, or Home.
  const toStart = () => {
    player.pause();
    setStopAt(null);
    player.seek(0);
  };
  const hold = useRef({ timer: 0, fired: false });
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => {
    if (!moreOpen) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !(e.target as Element).closest?.(".more")) setMoreOpen(false);
    };
    addEventListener("keydown", close);
    addEventListener("pointerdown", close);
    return () => {
      removeEventListener("keydown", close);
      removeEventListener("pointerdown", close);
    };
  }, [moreOpen]);
  const toggleVise = () => {
    // Playing on into the next steps is what vise mode stops: pause at this step's end.
    if (!vise && player.playing) setStopAt(stepEnd(step));
    if (vise && player.playing) setStopAt(null);
    setVise(!vise);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // With a modifier the keys are the browser's (Alt+Left is Back).
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target;
      if ((t instanceof HTMLInputElement && t.type !== "range") || t instanceof HTMLSelectElement || t instanceof HTMLTextAreaElement) return;
      // Space on a focused button or link presses it.
      if (e.key === " " && t instanceof Element && t.closest("button, a, summary")) return;
      if (e.key === "Escape" && vise) {
        toggleVise();
      } else if (e.key === " ") {
        e.preventDefault();
        if (player.playing) player.pause();
        else play();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        playStep(current + 1);
      } else if (e.key === "Home") {
        e.preventDefault();
        toStart();
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
          ref={nowRef}
          aria-live="polite"
          onClick={vise ? playNext : undefined}
        >
          <p className="now-index">
            Step {current + 1} of {build.steps.length}
          </p>
          <h2>{step.title}</h2>
          <p className="now-text">{step.text}</p>
          {vise && <p className="vise-hint">Tap here to play the next step. Esc or “Leave vise mode” to go back.</p>}
        </div>
        <div className="transport">
          <StepBar
            build={build}
            time={player.time}
            onSeek={(t) => {
              player.pause();
              setStopAt(null);
              player.seek(t);
            }}
          />
          <div className="transport-buttons">
          <button
            onPointerDown={() => {
              hold.current.fired = false;
              hold.current.timer = window.setTimeout(() => {
                hold.current.fired = true;
                toStart();
              }, 550);
            }}
            onPointerUp={() => clearTimeout(hold.current.timer)}
            onPointerLeave={() => clearTimeout(hold.current.timer)}
            onPointerCancel={() => clearTimeout(hold.current.timer)}
            onContextMenu={(e) => e.preventDefault()}
            onClick={() => {
              if (hold.current.fired) hold.current.fired = false;
              else playStep(current - 1);
            }}
            disabled={current === 0}
            aria-label="Previous step"
            title="Previous step (hold for step 1)"
          >
            <TransportIcon name="previous" />
          </button>
          <button className="play" onClick={() => (player.playing ? player.pause() : play())} aria-label={player.playing ? "Pause" : "Play"}>
            <TransportIcon name={player.playing ? "pause" : "play"} />
          </button>
          <button onClick={() => playStep(current)} aria-label="Replay this step">
            <TransportIcon name="replay" />
          </button>
          <button onClick={() => playStep(current + 1)} disabled={current === build.steps.length - 1} aria-label="Next step">
            <TransportIcon name="next" />
          </button>
          <button className="vise-toggle" aria-pressed={vise} onClick={toggleVise}>
            {vise ? "Leave vise mode" : "Vise mode"}
          </button>
          <select value={player.speed} onChange={(e) => player.setSpeed(Number(e.target.value))} aria-label="Speed">
            {SPEEDS.map(([v, name]) => (
              <option key={v} value={v}>
                {name}
              </option>
            ))}
          </select>
          {/* On a narrow stage, vise mode and speed are behind a "more" button. */}
          <div className="more">
            <button className="more-toggle" aria-expanded={moreOpen} aria-label="More" onClick={() => setMoreOpen(!moreOpen)}>
              <TransportIcon name="more" />
            </button>
            {moreOpen && (
              <div className="more-menu" onClick={() => setMoreOpen(false)}>
                <button aria-pressed={vise} onClick={toggleVise}>
                  {vise ? "Leave vise mode" : "Vise mode"}
                </button>
                {SPEEDS.map(([v, name]) => (
                  <button key={v} aria-pressed={player.speed === v} onClick={() => player.setSpeed(v)}>
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>
          </div>
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
                    <select value={size} onChange={(e) => changeSize(Number(e.target.value))} aria-label="Hook size">
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
