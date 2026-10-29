import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DIFFICULTY_LABELS, factsSentence } from "../catalog/describe";
import { stepTechnique, technique } from "../catalog/techniques";
import { variantFamily } from "../patterns";
import { allRecipes, findFly, useOwnFlies } from "./ownFlies";
import { isOwnId } from "../edit/own";
import { resolveColor, type Recipe } from "../recipe/schema";
import { colourWord, materialName, materialsList } from "../tying/describe";
import { fishing, fishingText } from "../tying/fishing";
import { ridesPointUp } from "../tying/hook";
import { simulate, stepAt, stepEnd, stepProgress } from "../tying/simulate";
import { Paragraphs } from "./Paragraphs";
import { match, materialColor } from "../catalog/inventory";
import { href, replaceUrl } from "./router";
import { FLY_BOX_KEY, INVENTORY_KEY, useStoredSet } from "./storage";
import { useWakeLock } from "./wakeLock";
import { usePlayer } from "./usePlayer";
import { NotFound } from "./NotFound";
import { naturalLengthFor } from "../catalog/naturals";
import { findNatural } from "../naturals";
import { PrintCard } from "./PrintCard";
import { useNaturalPictures, useWaterStills } from "./renders";
import { StepBar } from "./StepBar";
import { Viewer } from "./Viewer";
import { t } from "../i18n/ui";
import { lang } from "../i18n/lang";
import { inPageLanguage } from "../i18n/prose";
import { linkTo } from "./linkTo";
import { boxEntry, coloursSpec, parseBoxEntry, DYE_COLORS, parseColours, recolor, tiedColour, type Colours } from "../catalog/variation";
import { LogForm, useLog } from "./Log";
import { tiedCounts } from "../catalog/log";

export function PatternPage({ id, step, size, colours }: { id: string; step?: number; size?: number; colours?: string }) {
  // A pattern, or one of the visitor's own flies (kept in this browser).
  useOwnFlies();
  const recipe = findFly(id);
  if (!recipe) {
    return (
      <NotFound heading={t.notFound.pattern(id)}>
        <p>{t.notFound.patternHint(linkTo(href.gallery()))}</p>
      </NotFound>
    );
  }
  // An own fly is in the visitor's words: it has no translations, and its labels stay.
  return <PatternView key={id} recipe={isOwnId(id) ? recipe : inPageLanguage(recipe)} linkedStep={step} linkedSize={size} linkedColours={colours} />;
}

const Icon = {
  previous: <path d="M5.5 5H8v14H5.5zM19 5 9 12l10 7z" />,
  play: <path d="M7 4.5v15L19.5 12z" />,
  pause: <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />,
  replay: <path d="M5 12a7 7 0 1 0 2.05-4.95M5 4v4h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
  next: <path d="M16 5h2.5v14H16zM5 5l10 7-10 7z" />,
  more: <path d="M5 10.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6Zm7 0a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6Zm7 0a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6Z" />,
};

const SPEEDS = [
  [0.5, "half"],
  [1, "normal"],
  [2, "double"],
] as const;

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
function PatternView({
  recipe: original,
  linkedStep,
  linkedSize,
  linkedColours,
}: {
  recipe: Recipe;
  linkedStep?: number;
  linkedSize?: number;
  linkedColours?: string;
}) {
  // The hook size can be changed to see the same fly at another size: proportions stay,
  // thread bulk changes as it would at the vise.
  // Tubes are sized by length, so only hooks offer other sizes.
  const tiedSize = original.hook.size;
  // A shared link can open the fly on another hook size (one the size menu offers).
  const [size, setSize] = useState(() =>
    tiedSize !== undefined && linkedSize !== undefined && hookSizes(tiedSize).includes(linkedSize) ? linkedSize : tiedSize,
  );
  // The colour playground: some parts in other colours (a link can carry them).
  const [colours, setColours] = useState(() => parseColours(linkedColours ?? "", original));
  const spec = coloursSpec(colours, original);
  const sized = (s: typeof size) =>
    recolor(s === original.hook.size ? original : { ...original, hook: { ...original.hook, size: s } }, colours);
  const recipe = useMemo(() => sized(size), [original, size, spec]);
  // The step texts are in the page's language: made again when it changes.
  const language = lang();
  const build = useMemo(() => simulate(recipe), [recipe, language]);
  const fishingFor = useMemo(() => fishing(recipe), [recipe]);
  // The stills show the fly as tied: not on another hook size or in other colours.
  const waterStills = useWaterStills("patterns", recipe.id);
  const stills = size === tiedSize && spec === "" ? (waterStills === undefined ? "loading" : waterStills) : null;
  const [inWater, setInWater] = useState(false);
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
  const log = useLog();
  const own = useOwnFlies();
  const yours = isOwnId(original.id);
  // The fly box entry for these colours, however it was written (a link from before a part was renamed).
  const savedVariation = spec
    ? [...box.values].find((v) => {
        const e = parseBoxEntry(v);
        return e.id === recipe.id && e.colours !== "" && coloursSpec(parseColours(e.colours, original), original) === spec;
      })
    : undefined;
  const [logging, setLogging] = useState<"form" | "done" | null>(null);
  const tiedButton = useRef<HTMLButtonElement>(null);
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
  // `toStep`: go to the start of this step instead (a link that names a size and a step).
  const changeSize = (s: number, toStep?: number) => {
    const next = simulate(sized(s));
    const same = (i: number) => next.steps[Math.min(i, next.steps.length - 1)]!;
    const progress = stepProgress(step, player.time);
    const t =
      toStep !== undefined
        ? same(toStep).start
        : player.time >= build.duration - 0.001
          ? next.duration
          : progress >= 1
            ? stepEnd(same(current))
            : same(current).start + progress * same(current).duration;
    setSize(s);
    player.seek(t, next.duration);
    if (toStep !== undefined) {
      player.pause();
      setStopAt(null);
    } else if (stopAt !== null) setStopAt(stepEnd(same(stepAt(build, stopAt))));
  };
  const family = variantFamily(recipe);
  const recipeStep = recipe.steps[current]!;
  // What goes wrong at this step: the pattern's own warning, then its technique's usual mistakes.
  const mistakes = [...(recipeStep.mistake ? [recipeStep.mistake] : []), ...(technique(stepTechnique(original, current) ?? "")?.mistakes ?? [])];
  const [showMistakes, setShowMistakes] = useState(false);
  const inUse = "material" in recipeStep ? recipeStep.material : "thread";
  const inUseMaterial = recipe.materials.find((m) => m.id === inUse);
  const callout = inUseMaterial ? materialName(inUseMaterial) : current === 0 && recipeStep.op !== "attach-thread" ? null : t.pattern.thread;
  const showInDressing = () => {
    setFlash(inUse);
    document.getElementById(`dressing-${inUse}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    setTimeout(() => setFlash(null), 1600);
  };

  useEffect(() => {
    document.title = t.site.titled(`${recipe.name}${recipe.variant ? ` (${recipe.variant})` : ""}`);
  }, [recipe, lang()]);

  // The step this page last wrote into the address (null: none yet). The address reaches
  // the router a render later, when playback may have moved on, so the page tells its own
  // writes from links by this, not by the current step.
  const written = useRef<number | undefined | null>(null);
  // Open at the linked step, paused at its start, and follow a link to another step of this fly.
  useEffect(() => {
    if (linkedStep === written.current) return;
    setInWater(false);
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
  // Keep the URL on the current step, hook size and colours, so it can be shared.
  const writtenSize = useRef<number | undefined | null>(null);
  const writtenColours = useRef<string | null>(null);
  useEffect(() => {
    written.current = current > 0 ? current + 1 : undefined;
    writtenSize.current = size !== tiedSize ? size : undefined;
    writtenColours.current = spec;
    replaceUrl(href.fly(recipe.id, written.current, writtenSize.current, spec || undefined));
  }, [recipe.id, current, size, tiedSize, spec]);
  // A link to this fly in other colours (or its own) changes them.
  useEffect(() => {
    if (writtenColours.current === null || (linkedColours ?? "") === writtenColours.current) return;
    setColours(parseColours(linkedColours ?? "", original));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedColours]);
  // A link to this fly on another size (or on the size it is tied on) changes it.
  useEffect(() => {
    if (writtenSize.current === null || linkedSize === writtenSize.current || tiedSize === undefined) return;
    const target = linkedSize !== undefined && hookSizes(tiedSize).includes(linkedSize) ? linkedSize : tiedSize;
    // The link names its step too (none means step 1), unless it is the one already shown.
    if (target !== size) changeSize(target, linkedStep === written.current ? undefined : (linkedStep ?? 1) - 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedSize]);

  // Stepping, playing or seeking takes the fly back to the vise.
  const playStep = (i: number) => {
    setInWater(false);
    const s = build.steps[Math.max(0, Math.min(build.steps.length - 1, i))]!;
    setStopAt(stepEnd(s));
    player.playFrom(s.start);
  };
  const playAll = () => {
    setInWater(false);
    setStopAt(null);
    player.play();
  };
  // Vise mode pauses after every step: play the next one; a step paused halfway resumes.
  const playNext = () => {
    setInWater(false);
    if (player.time >= step.start + step.duration - 0.05) return playStep(current + 1);
    setStopAt(stepEnd(step));
    player.play();
  };
  const play = () => (vise ? playNext() : playAll());
  // Back to the start of step 1, paused: holding the previous-step button, or Home.
  const toStart = () => {
    setInWater(false);
    player.pause();
    setStopAt(null);
    player.seek(0);
  };
  const hold = useRef({ timer: 0, fired: false });
  const [moreOpen, setMoreOpen] = useState(false);
  // The recipe card is made on the first request and kept (with its pictures) for more prints.
  // What the fly imitates, which can be shown with it in the viewer, at the size its hook matches.
  const naturals = recipe.naturals.flatMap((id) => findNatural(id) ?? []);
  const naturalPictures = useNaturalPictures();
  const [compare, setCompare] = useState<{ id: string; at: "beside" | "over" } | null>(null);
  const compared = compare ? (findNatural(compare.id) ?? null) : null;
  const showNatural = (next: typeof compare) => {
    setCompare(next);
    // On a phone the stage is above the notes: bring it into view.
    const stage = document.querySelector(".stage");
    if (next && stage && stage.getBoundingClientRect().bottom < 80) stage.scrollIntoView({ behavior: "smooth" });
  };
  const [printRequest, setPrintRequest] = useState(0);
  const [preparing, setPreparing] = useState(false);
  const printed = useCallback(() => setPreparing(false), []);
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
      } else if (vise && (e.key === "PageDown" || e.key === "PageUp")) {
        // A page-turner pedal or presentation clicker at the vise: next step, or back.
        e.preventDefault();
        if (e.key === "PageDown") playNext();
        else playStep(player.time - step.start < 1 ? current - 1 : current);
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
      <section className="stage" aria-label={t.pattern.stage}>
        <Viewer
          build={build}
          time={player.time}
          follow={follow}
          onFollowChange={setFollow}
          callout={callout}
          onCalloutClick={showInDressing}
          pointUp={ridesPointUp(recipe)}
          guide
          water={fishingFor}
          waterOpen={inWater}
          onWater={(on) => {
            setInWater(on);
            if (on) player.pause();
          }}
          natural={compared ? { natural: compared, length: naturalLengthFor(compared, recipe), at: compare!.at } : null}
          stills={stills}
        />
        <div
          className="now"
          ref={nowRef}
          aria-live="polite"
          onClick={vise ? playNext : undefined}
        >
          {inWater ? (
            <>
              <p className="now-index">{t.pattern.finished}</p>
              <h2>{t.pattern.inTheWater}</h2>
              <p className="now-text">{fishingText(fishingFor)}</p>
            </>
          ) : (
            <>
              <p className="now-index">{t.pattern.stepOf(current + 1, build.steps.length)}</p>
              <h2>{step.title}</h2>
              <p className="now-text">{step.text}</p>
            </>
          )}
          {!inWater && mistakes.length > 0 && (
            <details
              className="mistakes"
              open={showMistakes}
              onToggle={(e) => {
                const details = e.currentTarget;
                setShowMistakes(details.open);
                // The instructions pane scrolls: bring the list into it when it opens.
                const pane = nowRef.current;
                if (!details.open || !pane) return;
                const below = details.getBoundingClientRect().bottom - pane.getBoundingClientRect().bottom;
                if (below > 0) pane.scrollTop += below;
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <summary>{t.pattern.mistakes}</summary>
              <ul>
                {mistakes.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </details>
          )}
          {vise && <p className="vise-hint">{t.pattern.viseHint}</p>}
        </div>
        <div className="transport">
          <StepBar
            build={build}
            time={player.time}
            onSeek={(t) => {
              setInWater(false);
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
            aria-label={t.pattern.previous}
            title={t.pattern.previousTitle}
          >
            <TransportIcon name="previous" />
          </button>
          <button className="play" onClick={() => (player.playing ? player.pause() : play())} aria-label={player.playing ? t.pattern.pause : t.pattern.play}>
            <TransportIcon name={player.playing ? "pause" : "play"} />
          </button>
          <button onClick={() => playStep(current)} aria-label={t.pattern.replay}>
            <TransportIcon name="replay" />
          </button>
          <button onClick={() => playStep(current + 1)} disabled={current === build.steps.length - 1} aria-label={t.pattern.next}>
            <TransportIcon name="next" />
          </button>
          <button className="vise-toggle" aria-pressed={vise} onClick={toggleVise}>
            {vise ? t.pattern.leaveVise : t.pattern.vise}
          </button>
          <select value={player.speed} onChange={(e) => player.setSpeed(Number(e.target.value))} aria-label={t.pattern.speed}>
            {SPEEDS.map(([v, speed]) => (
              <option key={v} value={v}>
                {t.pattern.speeds[speed]}
              </option>
            ))}
          </select>
          {/* On a narrow stage, vise mode and speed are behind a "more" button. */}
          <div className="more">
            <button className="more-toggle" aria-expanded={moreOpen} aria-label={t.pattern.more} onClick={() => setMoreOpen(!moreOpen)}>
              <TransportIcon name="more" />
            </button>
            {moreOpen && (
              <div className="more-menu" onClick={() => setMoreOpen(false)}>
                <button aria-pressed={vise} onClick={toggleVise}>
                  {vise ? t.pattern.leaveVise : t.pattern.vise}
                </button>
                {SPEEDS.map(([v, speed]) => (
                  <button key={v} aria-pressed={player.speed === v} onClick={() => player.setSpeed(v)}>
                    {t.pattern.speeds[speed]}
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
          {t.pattern.allPatterns}
        </a>
        <h1>{recipe.name}</h1>
        {recipe.aliases.length > 0 && <p className="aliases">{t.pattern.alsoCalled(recipe.aliases.join(", "))}</p>}
        {family.length > 1 && (
          <nav className="variants" aria-label={t.pattern.versions}>
            {family.map((p) => (
              <a key={p.recipe.id} href={href.fly(p.recipe.id)} aria-current={p.recipe.id === recipe.id ? "page" : undefined}>
                {inPageLanguage(p.recipe).variant ?? t.pattern.standard}
              </a>
            ))}
          </nav>
        )}
        <p className="facts">
          {factsSentence(recipe)} {DIFFICULTY_LABELS[recipe.difficulty]}.
        </p>
        {recipe.description && <p className="description">{recipe.description}</p>}
        {yours && <p className="origin">{t.build.yourOwn}</p>}
        {origin && <p className="origin">{t.pattern.firstTied(origin)}</p>}
        <div className="pattern-actions">
          <button className="box-toggle" aria-pressed={box.has(mainId)} onClick={() => box.toggle(mainId)}>
            {box.has(mainId) ? t.pattern.inBox : t.pattern.addToBox}
          </button>
          <button
            className="box-toggle print-toggle"
            onClick={() => {
              if (preparing) return;
              setPreparing(true);
              setPrintRequest((r) => r + 1);
            }}
            aria-busy={preparing}
          >
            {preparing ? t.pattern.preparing : t.pattern.print}
          </button>
          <a className="build-link-out" href={href.build(yours ? `edit=${recipe.id}` : `from=${recipe.id}`)}>
            {yours ? t.build.edit : t.build.editCopy}
          </a>
        </div>
        {(() => {
          const tied = tiedCounts(log.items, allRecipes(own.flies)).get(mainId) ?? 0;
          return (
            <>
              <p className="tied">
                {/* Always there, so a screen reader hears what changes in it. */}
                <span aria-live="polite">{logging === "done" ? t.pattern.added : ""}</span>
                {tied > 0 && (
                  <>
                    {t.pattern.tied(tied)}
                  </>
                )}
                {logging !== "form" && (
                  <button ref={tiedButton} className="link-button" onClick={() => setLogging("form")}>
                    {t.pattern.iTied}
                  </button>
                )}
                {tied > 0 && (
                  <>
                    {" "}
                    <a href={href.log()}>{t.pattern.yourLog}</a>
                  </>
                )}
              </p>
              {logging === "form" && (
                <LogForm
                  id={recipe.id}
                  sizes={tiedSize !== undefined ? hookSizes(tiedSize) : []}
                  size={recipe.hook.size}
                  colours={spec || undefined}
                  onClose={(logged) => {
                    setLogging(logged ? "done" : null);
                    // Back to the button the form came from.
                    requestAnimationFrame(() => tiedButton.current?.focus());
                  }}
                />
              )}
            </>
          );
        })()}
        {printRequest > 0 && <PrintCard recipe={recipe} build={build} request={printRequest} onPrinted={printed} />}

        {naturals.length > 0 && (
          <section className="imitates">
            <h3>{t.pattern.imitates}</h3>
            <ul>
              {naturals.map((n) => (
                <li key={n.id}>
                  <a href={href.natural(n.id)} className="imitates-natural">
                    {naturalPictures?.[n.id] && <img src={naturalPictures[n.id]} alt="" width={96} height={64} loading="lazy" />}
                    <span>{n.name}</span>
                  </a>
                  <span className="compare">
                    {(["beside", "over"] as const).map((at) => (
                      <button
                        key={at}
                        className="link-button"
                        aria-pressed={compare?.id === n.id && compare.at === at}
                        onClick={() => showNatural(compare?.id === n.id && compare.at === at ? null : { id: n.id, at })}
                      >
                        {at === "beside" ? t.pattern.beside : t.pattern.over}
                      </button>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <h3>{t.pattern.dressing}</h3>
        {spec && (
          <p className="variation-note">{t.pattern.inYourColours}</p>
        )}
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
                    {t.pattern.size}
                    <select value={size} onChange={(e) => changeSize(Number(e.target.value))} aria-label={t.pattern.hookSize}>
                      {hookSizes(tiedSize).map((s) => (
                        <option key={s} value={s}>
                          {s}
                          {s === tiedSize ? t.pattern.asTied : ""}
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
                    <span className="owned">{t.pattern.have}</span>
                  ) : o === "substitute" ? (
                    <span className="owned substitute">{t.pattern.substitute}</span>
                  ) : o === "missing" ? (
                    <span className="owned missing">{t.pattern.missing}</span>
                  ) : null;
                })()}
              </dd>
            </div>
          ))}
        </dl>

        <ColourPlayground
          original={original}
          colours={colours}
          onChange={setColours}
          saved={savedVariation !== undefined}
          onSave={() => (savedVariation ? box.set(savedVariation, false) : box.set(boxEntry(recipe.id, spec), true))}
        />

        <h3>{t.pattern.steps}</h3>
        <ol className="steps">
          {build.steps.map((s) => (
            <li key={s.index} className={s.index === current ? "active" : s.index < current ? "done" : ""}>
              <button onClick={() => playStep(s.index)} aria-current={s.index === current ? "step" : undefined}>
                <strong>{s.title}</strong>
                <span>{s.text}</span>
              </button>
              {(() => {
                const how = technique(stepTechnique(original, s.index) ?? "");
                return how ? (
                  <a className="how-to" href={href.technique(how.id)}>
                    {t.pattern.howTo(how.name)}
                  </a>
                ) : null;
              })()}
            </li>
          ))}
        </ol>

        {recipe.history && (
          <section>
            <h3>{t.pattern.history}</h3>
            <Paragraphs text={recipe.history} />
          </section>
        )}
        {recipe.fishing && (
          <section>
            <h3>{t.pattern.fishing}</h3>
            <Paragraphs text={recipe.fishing} />
          </section>
        )}
        {recipe.sources.length > 0 && (
          <section>
            <h3>{t.pattern.sources}</h3>
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

/** Other colours for the pattern's parts: the fly, its steps and its dressing follow. */
function ColourPlayground({
  original,
  colours,
  onChange,
  saved,
  onSave,
}: {
  original: Recipe;
  colours: Colours;
  onChange: (c: Colours) => void;
  saved: boolean;
  onSave: () => void;
}) {
  const changed = Object.keys(colours).length > 0;
  const parts = materialsList(original).filter((p) => p.id !== "hook" && p.id !== "treble");
  const asTied = (id: string) => {
    if (id === "thread") return original.thread.color;
    const m = original.materials.find((m) => m.id === id)!;
    return materialColor(m);
  };
  return (
    <details className="playground" open={changed || undefined}>
      <summary>{t.playground.summary}</summary>
      <p>{t.playground.intro}</p>
      <div className="playground-parts">
        {parts.map((p) => {
          const tied = asTied(p.id);
          const shown = colours[p.id] ?? tied;
          return (
            <label key={p.id}>
              <span className="swatch" style={{ background: resolveColor(shown === "natural" ? "#999999" : shown) }} aria-hidden="true" />
              <span className="playground-part">{p.role}</span>
              <select
                value={colours[p.id] ?? ""}
                onChange={(e) => {
                  const next = { ...colours };
                  if (e.target.value) next[p.id] = e.target.value as Colours[string];
                  else delete next[p.id];
                  onChange(next);
                }}
              >
                <option value="">{t.playground.asTied(colourWord(tied, original.materials.find((m) => m.id === p.id)?.kind))}</option>
                {DYE_COLORS.filter((c) => c !== tiedColour(original, p.id)).map((c) => (
                  <option key={c} value={c}>
                    {colourWord(c)}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
      </div>
      {changed && (
        <div className="pattern-actions">
          <button className="box-toggle" aria-pressed={saved} onClick={onSave}>
            {saved ? t.playground.saved : t.playground.save}
          </button>
          <button className="link-button" onClick={() => onChange({})}>
            {t.playground.reset}
          </button>
        </div>
      )}
    </details>
  );
}
