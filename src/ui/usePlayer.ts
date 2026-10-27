import { useCallback, useEffect, useRef, useState } from "react";

export interface Player {
  time: number;
  playing: boolean;
  speed: number;
  play(): void;
  /** Jump to t and play from there. */
  playFrom(t: number): void;
  pause(): void;
  /** Jump to t; `duration` is the timeline's length when it is changing in the same render. */
  seek(t: number, duration?: number): void;
  setSpeed(s: number): void;
}

/**
 * Playback clock for the timeline. `stopAt`, if given, is a time to pause at
 * (used to stop at the end of the step being replayed).
 */
export function usePlayer(duration: number, stopAt: number | null): Player {
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const state = useRef({ time, stopAt, duration, speed });
  state.current = { time, stopAt, duration, speed };

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const s = state.current;
      const dt = Math.min(0.1, (now - last) / 1000) * s.speed;
      last = now;
      const limit = s.stopAt !== null && s.time < s.stopAt ? s.stopAt : s.duration;
      const next = Math.min(limit, s.time + dt);
      setTime(next);
      if (next >= limit) setPlaying(false);
      else frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  const play = useCallback(() => {
    // At the end, or at the last step's end (a hair before it), play starts over.
    if (state.current.time >= state.current.duration - 0.001) setTime(0);
    setPlaying(true);
  }, []);
  const playFrom = useCallback((t: number) => {
    setTime(Math.max(0, Math.min(state.current.duration, t)));
    setPlaying(true);
  }, []);
  const pause = useCallback(() => setPlaying(false), []);
  const seek = useCallback((t: number, duration = state.current.duration) => setTime(Math.max(0, Math.min(duration, t))), []);

  return { time, playing, speed, play, playFrom, pause, seek, setSpeed };
}
