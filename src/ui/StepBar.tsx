import { useRef } from "react";
import { stepAt, stepEnd, stepProgress, type Build } from "../tying/simulate";
import { t } from "../i18n/ui";

/**
 * The steps as a row of segments, one per step, filled as far as the fly has got. A tap on a
 * segment goes to the start of that step; dragging along the bar scrubs through the steps.
 * Every step gets the same width, however long it takes, so each is easy to hit.
 */
export function StepBar({ build, time, onSeek }: { build: Build; time: number; onSeek: (t: number) => void }) {
  const bar = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; moved: boolean } | null>(null);
  const steps = build.steps;
  const current = stepAt(build, time);

  // The step under x, and how far along its segment x is.
  const at = (clientX: number) => {
    const r = bar.current!.getBoundingClientRect();
    const u = Math.min(0.9999, Math.max(0, (clientX - r.left) / r.width)) * steps.length;
    const i = Math.floor(u);
    return { step: steps[i]!, fraction: u - i };
  };

  return (
    <div className="step-bar">
      <div
        ref={bar}
        className="step-segments"
        role="slider"
        tabIndex={0}
        aria-label={t.stepBar.label}
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuenow={current + 1}
        aria-valuetext={t.stepBar.value(current + 1, steps.length, steps[current]!.title)}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, moved: false };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          if (!d.moved && Math.abs(e.clientX - d.x) < 6) return;
          d.moved = true;
          const { step, fraction } = at(e.clientX);
          onSeek(Math.min(stepEnd(step), step.start + fraction * step.duration));
        }}
        onPointerUp={(e) => {
          if (drag.current && !drag.current.moved) onSeek(at(e.clientX).step.start);
          drag.current = null;
        }}
        onPointerCancel={() => (drag.current = null)}
      >
        {steps.map((s, i) => (
          <span key={s.index} className={i === current ? "current" : undefined}>
            <span style={{ width: `${(i < current ? 1 : i === current ? stepProgress(s, time) : 0) * 100}%` }} />
          </span>
        ))}
      </div>
      <span className="step-count" aria-hidden="true">
        {current + 1}/{steps.length}
      </span>
    </div>
  );
}
