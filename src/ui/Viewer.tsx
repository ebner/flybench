import { useEffect, useRef } from "react";
import { FlyScene } from "../render/FlyScene";
import type { Build } from "../tying/simulate";
import { VIEWER_BACKGROUND, type Theme } from "./theme";

export interface ViewerProps {
  build: Build;
  time: number;
  theme: Theme;
  /** Camera follows the current step. */
  follow: boolean;
  onFollowChange: (follow: boolean) => void;
  /** Label for what the current step works with, shown next to it in 3D. */
  callout: string | null;
  onCalloutClick?: () => void;
}

export function Viewer({ build, time, theme, follow, onFollowChange, callout, onCalloutClick }: ViewerProps) {
  const container = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLButtonElement>(null);
  const scene = useRef<FlyScene | null>(null);
  const followChange = useRef(onFollowChange);
  followChange.current = onFollowChange;

  useEffect(() => {
    const s = new FlyScene(container.current!, { background: VIEWER_BACKGROUND[theme] });
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
    // The theme is applied below; the scene is created once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scene.current?.setBackground(VIEWER_BACKGROUND[theme]);
  }, [theme]);

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
