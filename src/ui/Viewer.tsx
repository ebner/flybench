import { useEffect, useRef, useState } from "react";
import { FlyScene } from "../render/FlyScene";
import { WATER_LOOKS } from "../render/water";
import { loadRealAssets, siteAssets, type RealAssets } from "../render/real/assets";
import { realisticCapable } from "./realistic";
import type { WaterStills } from "./renders";
import { t } from "../i18n/ui";
import type { Natural } from "../recipe/natural";
import type { Fishing } from "../tying/fishing";
import type { Build } from "../tying/simulate";

export interface ViewerProps {
  build: Build;
  time: number;
  /** Camera follows the current step. */
  follow: boolean;
  onFollowChange: (follow: boolean) => void;
  /** Label for what the current step works with, shown next to it in 3D. */
  callout: string | null;
  onCalloutClick?: () => void;
  /** The fly swims hook point up: offer to turn it over from the way it is tied. */
  pointUp?: boolean;
  /** Offer the proportion guide (the pattern page, not the small technique clips). */
  guide?: boolean;
  /** A natural to show with the fly: `length` in gapes, beside it or laid over it. */
  natural?: { natural: Natural; length: number; at: "beside" | "over" } | null;
  /** Offer the finished fly in water, fished like this. */
  water?: Fishing;
  /** The water view is open: the page closes it when the visitor steps, plays or seeks. */
  waterOpen?: boolean;
  /** The visitor opens or closes the water view (the page pauses playback while it is open). */
  onWater?: (on: boolean) => void;
  /** Path-traced pictures of this fly in the realistic water, shown first (only for the fly as tied); "loading" until it is known whether there are any. */
  stills?: WaterStills | null | "loading";
}

/** The realistic water's panorama and gravel, loaded the first time it is shown. */
export function useRealAssets(wanted: boolean): { assets: RealAssets | null; failed: boolean } {
  const [assets, setAssets] = useState<RealAssets | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!wanted || assets || failed) return;
    let live = true;
    loadRealAssets(siteAssets(import.meta.env.BASE_URL)).then(
      (a) => live && setAssets(a),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [wanted, assets, failed]);
  return { assets, failed };
}

const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function Viewer({
  build,
  time,
  follow,
  onFollowChange,
  callout,
  onCalloutClick,
  pointUp = false,
  guide = false,
  natural = null,
  water,
  waterOpen = false,
  onWater,
  stills: stillsOrLoading = null,
}: ViewerProps) {
  const stills = stillsOrLoading === "loading" ? null : stillsOrLoading;
  const [turned, setTurned] = useState(false);
  // The realistic water where the device can take it, else the drawn one.
  const [capable] = useState(realisticCapable);
  // The finished fly in water: from above (realistic) or the side (drawn), or from below.
  // "angler" stands for the side view in the drawn water (see the water effect).
  const [waterView, setWaterView] = useState<"side" | "below" | "angler">("angler");
  const inWater = waterOpen && water ? waterView : null;
  // The stills come first; the live water when the visitor asks for it (or there are no stills).
  const [explore, setExplore] = useState(false);
  // Not before it is known whether there are stills: they spare the download.
  const wantReal = inWater !== null && capable && stillsOrLoading !== "loading" && (explore || !stills);
  const { assets: real, failed } = useRealAssets(wantReal);
  const liveReal = wantReal && real && !failed ? real : null;
  // Pictures need nothing of the device; exploring live on a slow one gives the drawn water.
  // A picture that fails to load (offline, not cached) gives way to the 3D view.
  const [broken, setBroken] = useState<string | null>(null);
  const pick = inWater !== null && inWater !== "side" && stills && (!explore || (capable && !real && !failed)) ? stills[inWater] : null;
  const still = pick !== broken ? pick : null;
  // The view buttons follow what shows: the stills and the realistic water have a view from
  // above; the drawn water a side view instead.
  const drawn = inWater !== null && !still && !liveReal;
  const fromAbove = inWater === null ? capable || stills !== null : !drawn;
  const [stillWater, setStillWater] = useState(reducedMotion);
  // WebGL can be turned off (browser settings, policies, old graphics drivers).
  const [unavailable, setUnavailable] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLButtonElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);
  const [proportions, setProportions] = useState(false);
  // In the theme's ink, and again when the theme changes.
  useEffect(() => {
    const apply = () =>
      scene.current?.setProportions(proportions, getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || undefined);
    apply();
    if (!proportions) return;
    const watch = new MutationObserver(apply);
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => watch.disconnect();
  }, [proportions, build]);
  // One finger scrolls the page; a sideways drag with one finger shows how to turn the fly.
  const [hint, setHint] = useState(false);
  const touch = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!hint) return;
    const t = setTimeout(() => setHint(false), 1800);
    return () => clearTimeout(t);
  }, [hint]);
  const scene = useRef<FlyScene | null>(null);
  const followChange = useRef(onFollowChange);
  followChange.current = onFollowChange;

  useEffect(() => {
    // A transparent canvas over the page's paper, so the fly can cast a soft CSS shadow on it.
    let s: FlyScene;
    try {
      s = new FlyScene(container.current!, { background: null });
    } catch {
      setUnavailable(true);
      return;
    }
    s.onFollowChange = (on) => followChange.current(on);
    // Positioned directly each frame, without re-rendering React.
    s.onAnchor = (point) => {
      const el = label.current;
      if (!el) return;
      el.style.visibility = point ? "" : "hidden";
      if (!point) return;
      el.style.transform = `translate(${Math.round(point.x)}px, ${Math.round(point.y)}px)`;
      const text = el.firstElementChild as HTMLElement | null;
      if (!text) return;
      // The label's width on one line, measured again whenever it changes.
      if (text.dataset.for !== text.textContent) {
        text.style.maxWidth = "none";
        text.dataset.width = String(text.offsetWidth);
        text.dataset.for = text.textContent ?? "";
      }
      const width = Number(text.dataset.width);
      // It sits about 3rem to one side of the point. It moves to the other side only when it
      // doesn't fit where it is and the other side is clearly roomier, so it doesn't jump about
      // as the thread moves; where it still doesn't fit, it wraps upwards.
      const right = container.current!.clientWidth - point.x - 48;
      const left = point.x - 48;
      const flipped = el.classList.contains("flip");
      const [here, there] = flipped ? [left, right] : [right, left];
      const flip = width > here && there > here + 24 ? !flipped : flipped;
      el.classList.toggle("flip", flip);
      text.style.maxWidth = `${Math.max(96, flip ? left : right)}px`;
      // Above the point it would run into a view button over it: put it below.
      const box = container.current!.getBoundingClientRect();
      const span = Math.min(width, Math.max(96, flip ? left : right));
      const [from, to] = flip ? [point.x - 48 - span, point.x - 48] : [point.x + 48, point.x + 48 + span];
      const buttons = [...(toolsRef.current?.children ?? [])].map((b) => b.getBoundingClientRect());
      const over = buttons.filter((b) => b.right - box.left > from && b.left - box.left < to);
      const below = over.some((b) => point.y - 30 - text.offsetHeight < b.bottom - box.top + 4);
      el.classList.toggle("below", below);
    };
    scene.current = s;
    return () => {
      s.dispose();
      scene.current = null;
    };
  }, []);

  useEffect(() => {
    scene.current?.setBuild(build);
  }, [build]);

  useEffect(() => {
    scene.current?.setFollow(follow);
  }, [follow]);

  // The water, in the theme's colours. Before the fly is turned, timed and given its natural, so
  // that leaving the water clears its transform first and they are placed on the fly at the vise.
  useEffect(() => {
    const s = scene.current;
    if (!s) return;
    // The drawn water has no view from above: it shows the side. Under a still (or until the
    // stills are known) nothing needs drawing.
    const hidden = still !== null || (inWater !== null && stillsOrLoading === "loading");
    const view = hidden ? null : inWater === "angler" && !liveReal ? "side" : inWater;
    const apply = () =>
      s.setWater(
        view && water
          ? {
              fishing: water,
              view,
              still: stillWater,
              look: WATER_LOOKS[document.documentElement.dataset.theme === "dark" ? "dark" : "light"],
              real: liveReal ?? undefined,
            }
          : null,
      );
    apply();
    if (!inWater) return;
    const watch = new MutationObserver(apply);
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => watch.disconnect();
  }, [inWater, stillWater, water, build, pointUp, turned, liveReal, still, stillsOrLoading]);

  // Keyboard focus on "Explore in 3D" goes on to the view buttons when the live water replaces it.
  const exploreFocused = useRef(false);
  useEffect(() => {
    if (!still && exploreFocused.current) {
      exploreFocused.current = false;
      toolsRef.current?.querySelector("button")?.focus();
    }
  }, [still]);

  useEffect(() => {
    // In the water a point-up fly is always shown the way it swims.
    scene.current?.setTurnedOver(pointUp && (turned || inWater !== null));
  }, [build, pointUp, turned, inWater]);

  useEffect(() => {
    if (!inWater) scene.current?.setTime(time);
  }, [build, time, inWater]);


  // The natural, placed after the fly (it goes beside the finished fly), and again whenever the
  // fly changes (another hook size).
  const shownNatural = useRef(false);
  useEffect(() => {
    if (!natural && !shownNatural.current) return;
    const shown = inWater ? null : natural;
    shownNatural.current = shown !== null;
    scene.current?.setNatural(shown?.natural ?? null, shown?.length, shown?.at);
  }, [natural?.natural, natural?.length, natural?.at, build, pointUp, turned, inWater]);

  const openWater = (view: "side" | "below" | "angler" | null) => {
    if (view && !inWater) setProportions(false);
    if (view) setWaterView(view);
    if (!view !== !inWater) onWater?.(view !== null);
  };

  // Without WebGL the water's pictures still show, with nothing to explore.
  if (unavailable && !still) {
    return (
      <div className="viewer viewer-unavailable">
        <p>{t.viewer.noWebgl}</p>
      </div>
    );
  }

  return (
    <div className={inWater ? "viewer in-water" : "viewer"}>
      <div
        className="viewer-canvas"
        ref={container}
        onTouchStart={(e) => (touch.current = e.touches.length === 1 ? { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY } : null)}
        onTouchMove={(e) => {
          const t = touch.current;
          if (!t || e.touches.length !== 1) return;
          const dx = Math.abs(e.touches[0]!.clientX - t.x);
          if (dx > 24 && dx > 2 * Math.abs(e.touches[0]!.clientY - t.y)) setHint(true);
        }}
      />
      {hint && <p className="viewer-hint">{t.viewer.hint}</p>}
      {still && (
        <figure className="water-still">
          <img src={still} alt={t.viewer.stillAlt(inWater === "below" ? "below" : "angler")} onError={() => setBroken(still)} />
          {!unavailable && (
            <button
              className="water-explore"
              onClick={(e) => {
                exploreFocused.current = e.currentTarget === document.activeElement;
                setExplore(true);
              }}
              title={t.viewer.exploreTitle}
              aria-busy={explore}
            >
              {explore ? t.viewer.loadingRiver : t.viewer.explore}
            </button>
          )}
        </figure>
      )}
      <button
        ref={label}
        className="callout"
        style={{ visibility: "hidden" }}
        hidden={!callout || still !== null}
        onClick={onCalloutClick}
        tabIndex={-1}
      >
        <span key={callout}>{callout}</span>
      </button>
      <div className="viewer-tools" ref={toolsRef}>
        {inWater ? (
          <>
            {fromAbove ? (
              <button aria-pressed={inWater === "angler"} onClick={() => openWater("angler")} title={t.viewer.aboveTitle}>
                <span className="long">{t.viewer.above}</span>
                <span className="short">{t.viewer.aboveShort}</span>
              </button>
            ) : (
              <button aria-pressed={inWater === "side" || inWater === "angler"} onClick={() => openWater("side")} title={t.viewer.sideTitle}>
                {t.viewer.side}
              </button>
            )}
            <button aria-pressed={inWater === "below"} onClick={() => openWater("below")} title={t.viewer.belowTitle}>
              <span className="long">{t.viewer.below}</span>
              <span className="short">{t.viewer.belowShort}</span>
            </button>
            {!still && (
              <button aria-pressed={stillWater} onClick={() => setStillWater(!stillWater)}>
                <span className="long">{t.viewer.still}</span>
                <span className="short">{t.viewer.stillShort}</span>
              </button>
            )}
          </>
        ) : (
          <>
            <button aria-pressed={follow} onClick={() => onFollowChange(!follow)}>
              <span className="long">{follow ? t.viewer.following : t.viewer.follow}</span>
              <span className="short">{t.viewer.followShort}</span>
            </button>
            <button
              onClick={() => {
                onFollowChange(false);
                scene.current?.resetCamera();
              }}
            >
              {t.viewer.wholeFly}
            </button>
            {guide && (
              <button aria-pressed={proportions} onClick={() => setProportions(!proportions)} title={t.viewer.proportionsTitle}>
                {t.viewer.proportions}
              </button>
            )}
            {pointUp && (
              <button aria-pressed={turned} onClick={() => setTurned(!turned)} title={t.viewer.asItSwimsTitle}>
                {t.viewer.asItSwims}
              </button>
            )}
          </>
        )}
        {water && (
          <button aria-pressed={inWater !== null} onClick={() => openWater(inWater ? null : "angler")} title={t.viewer.waterTitle}>
            <span className="long">{t.viewer.water}</span>
            <span className="short">{t.viewer.waterShort}</span>
          </button>
        )}
      </div>
    </div>
  );
}
