import { useLayoutEffect, useRef, useState } from "react";
import { stepAt, stepEnd, stepProgress, type Build } from "../tying/simulate";
import { t } from "../i18n/ui";

/**
 * The steps as a row of segments, one per step, filled as far as the fly has got. A tap on a
 * segment goes to the start of that step; dragging along the bar scrubs through the steps.
 * Every step gets the same width, however long it takes, so each is easy to hit. The step under
 * the mouse, or under the finger while scrubbing, is named over the bar.
 */
export function StepBar({ build, time, onSeek }: { build: Build; time: number; onSeek: (t: number) => void }) {
  const bar = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; moved: boolean } | null>(null);
  const tip = useRef<HTMLDivElement>(null);
  const [pointed, setPointed] = useState<number | null>(null);
  const steps = build.steps;
  const current = stepAt(build, time);
  const shown = pointed !== null && pointed < steps.length ? pointed : null;

  // Over its segment, kept inside the bar at the ends.
  useLayoutEffect(() => {
    const el = tip.current;
    if (!el || shown === null) return;
    const width = bar.current!.clientWidth;
    const centre = ((shown + 0.5) / steps.length) * width;
    const half = el.offsetWidth / 2;
    el.style.left = `${Math.max(half, Math.min(width - half, centre))}px`;
  }, [shown, steps.length]);

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
          if (e.pointerType === "mouse" || d?.moved) setPointed(at(e.clientX).step.index);
          if (!d) return;
          if (!d.moved && Math.abs(e.clientX - d.x) < 6) return;
          d.moved = true;
          const { step, fraction } = at(e.clientX);
          setPointed(step.index);
          onSeek(Math.min(stepEnd(step), step.start + fraction * step.duration));
        }}
        onPointerUp={(e) => {
          if (drag.current && !drag.current.moved) onSeek(at(e.clientX).step.start);
          drag.current = null;
          if (e.pointerType !== "mouse") setPointed(null);
        }}
        onPointerLeave={() => {
          if (!drag.current) setPointed(null);
        }}
        onPointerCancel={() => {
          drag.current = null;
          setPointed(null);
        }}
      >
        {steps.map((s, i) => (
          <span key={s.index} className={i === current ? "current" : undefined}>
            <span style={{ width: `${(i < current ? 1 : i === current ? stepProgress(s, time) : 0) * 100}%` }} />
          </span>
        ))}
        {shown !== null && (
          <div ref={tip} className="step-tip" aria-hidden="true">
            {t.stepBar.tip(shown + 1, steps[shown]!.title)}
          </div>
        )}
      </div>
      <span className="step-count" aria-hidden="true">
        {current + 1}/{steps.length}
      </span>
    </div>
  );
}
