import { useEffect, useMemo, useState } from "react";
import type { Recipe } from "../recipe/schema";
import { simulate, stepEnd } from "../tying/simulate";
import { Viewer } from "./Viewer";

/**
 * One step of a pattern, played on a loop with the camera following the action:
 * the 3D example on a technique page.
 */
export function Clip({ recipe, step }: { recipe: Recipe; step: number }) {
  const build = useMemo(() => simulate(recipe), [recipe]);
  const s = build.steps[step]!;
  const [time, setTime] = useState(s.start);
  const [playing, setPlaying] = useState(!matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [follow, setFollow] = useState(true);

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let t = s.start;
    let frame = requestAnimationFrame(function tick(now) {
      // Play the step, hold the result for a moment, then start again.
      t += Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      const end = stepEnd(s);
      if (t > end + 1.2) t = s.start;
      setTime(Math.min(t, end));
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [playing, s]);

  return (
    <figure className="clip">
      <div className="clip-stage">
        <Viewer build={build} time={time} follow={follow} onFollowChange={setFollow} callout={null} />
      </div>
      <figcaption>
        <button className="link-button" onClick={() => setPlaying(!playing)}>
          {playing ? "Pause" : "Play"}
        </button>{" "}
        {s.title}, from the {recipe.name}.
      </figcaption>
    </figure>
  );
}
