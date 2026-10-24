import { useEffect, useRef } from "react";
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
}

export function Viewer({ build, time, follow, onFollowChange, callout, onCalloutClick }: ViewerProps) {
  const container = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLButtonElement>(null);
  const scene = useRef<FlyScene | null>(null);
  const followChange = useRef(onFollowChange);
  followChange.current = onFollowChange;

  useEffect(() => {
    // A transparent canvas over the page's paper, so the fly can cast a soft CSS shadow on it.
    const s = new FlyScene(container.current!, { background: null });
    s.onFollowChange = (on) => followChange.current(on);
    // Positioned directly each frame, without re-rendering React.
    s.onAnchor = (point) => {
      const el = label.current;
      if (!el) return;
      el.style.visibility = point ? "" : "hidden";
      if (point) el.style.transform = `translate(${Math.round(point.x)}px, ${Math.round(point.y)}px)`;
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
    scene.current?.setTime(time);
  }, [build, time]);

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
      </div>
    </div>
  );
}
