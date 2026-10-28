import { useEffect, useRef, useState } from "react";
import { FlyScene } from "../render/FlyScene";
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
}

export function Viewer({ build, time, follow, onFollowChange, callout, onCalloutClick, pointUp = false }: ViewerProps) {
  const [turned, setTurned] = useState(false);
  // WebGL can be turned off (browser settings, policies, old graphics drivers).
  const [unavailable, setUnavailable] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLButtonElement>(null);
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

  useEffect(() => {
    scene.current?.setTurnedOver(pointUp && turned);
  }, [build, pointUp, turned]);

  useEffect(() => {
    scene.current?.setTime(time);
  }, [build, time]);

  if (unavailable) {
    return (
      <div className="viewer viewer-unavailable">
        <p>The 3D view needs WebGL, which this browser has turned off. The steps and the dressing still work.</p>
      </div>
    );
  }

  return (
    <div className="viewer">
      <div className="viewer-canvas" ref={container} />
      <button
        ref={label}
        className="callout"
        style={{ visibility: "hidden" }}
        hidden={!callout}
        onClick={onCalloutClick}
        tabIndex={-1}
      >
        <span>{callout}</span>
      </button>
      <div className="viewer-tools">
        <button aria-pressed={follow} onClick={() => onFollowChange(!follow)}>
          {follow ? "Following the action" : "Follow the action"}
        </button>
        <button
          onClick={() => {
            onFollowChange(false);
            scene.current?.resetCamera();
          }}
        >
          Whole fly
        </button>
        {pointUp && (
          <button aria-pressed={turned} onClick={() => setTurned(!turned)} title="Tied hook point down, it swims point up">
            As it swims
          </button>
        )}
      </div>
    </div>
  );
}
