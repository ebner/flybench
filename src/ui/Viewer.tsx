import { useEffect, useRef } from "react";
import { FlyScene } from "../render/FlyScene";
import type { Build } from "../tying/simulate";
import { VIEWER_BACKGROUND, type Theme } from "./theme";

export function Viewer({ build, time, theme }: { build: Build; time: number; theme: Theme }) {
  const container = useRef<HTMLDivElement>(null);
  const scene = useRef<FlyScene | null>(null);

  useEffect(() => {
    const s = new FlyScene(container.current!, { background: VIEWER_BACKGROUND[theme] });
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
    scene.current?.setTime(time);
  }, [build, time]);

  return (
    <div className="viewer">
      <div className="viewer-canvas" ref={container} />
      <button className="viewer-reset" onClick={() => scene.current?.resetCamera()}>
        Reset view
      </button>
    </div>
  );
}
