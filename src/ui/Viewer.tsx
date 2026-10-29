import { useEffect, useRef, useState } from "react";
import { FlyScene } from "../render/FlyScene";
import { WATER_LOOKS } from "../render/water";
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
}: ViewerProps) {
  const [turned, setTurned] = useState(false);
  // The finished fly in water, seen from the side or from below.
  const [waterView, setWaterView] = useState<"side" | "below">("side");
  const inWater = waterOpen && water ? waterView : null;
  const [still, setStill] = useState(reducedMotion);
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
    const apply = () =>
      s.setWater(
        inWater && water
          ? { fishing: water, view: inWater, still, look: WATER_LOOKS[document.documentElement.dataset.theme === "dark" ? "dark" : "light"] }
          : null,
      );
    apply();
    if (!inWater) return;
    const watch = new MutationObserver(apply);
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => watch.disconnect();
  }, [inWater, still, water, build, pointUp, turned]);

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

  const openWater = (view: "side" | "below" | null) => {
    if (view && !inWater) setProportions(false);
    if (view) setWaterView(view);
    if (!view !== !inWater) onWater?.(view !== null);
  };

  if (unavailable) {
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
      <button
        ref={label}
        className="callout"
        style={{ visibility: "hidden" }}
        hidden={!callout}
        onClick={onCalloutClick}
        tabIndex={-1}
      >
        <span key={callout}>{callout}</span>
      </button>
      <div className="viewer-tools" ref={toolsRef}>
        {inWater ? (
          <>
            <button aria-pressed={inWater === "side"} onClick={() => openWater("side")} title={t.viewer.sideTitle}>
              {t.viewer.side}
            </button>
            <button aria-pressed={inWater === "below"} onClick={() => openWater("below")} title={t.viewer.belowTitle}>
              <span className="long">{t.viewer.below}</span>
              <span className="short">{t.viewer.belowShort}</span>
            </button>
            <button aria-pressed={still} onClick={() => setStill(!still)}>
              <span className="long">{t.viewer.still}</span>
              <span className="short">{t.viewer.stillShort}</span>
            </button>
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
          <button aria-pressed={inWater !== null} onClick={() => openWater(inWater ? null : "side")} title={t.viewer.waterTitle}>
            <span className="long">{t.viewer.water}</span>
            <span className="short">{t.viewer.waterShort}</span>
          </button>
        )}
      </div>
    </div>
  );
}
