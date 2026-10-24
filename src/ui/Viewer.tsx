import { useEffect, useRef } from "react";
import { FlyScene } from "../render/FlyScene";
import type { Build } from "../tying/simulate";

export function Viewer({ build, time }: { build: Build; time: number }) {
  const container = useRef<HTMLDivElement>(null);
  const scene = useRef<FlyScene | null>(null);

  useEffect(() => {
    const s = new FlyScene(container.current!);
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
    scene.current?.setTime(time);
  }, [build, time]);

  return (
    <div className="viewer">
      <div className="viewer-canvas" ref={container} />
      <button className="viewer-reset" onClick={() => scene.current?.resetCamera()} title="Reset view">
        Reset view
      </button>
    </div>
  );
}
