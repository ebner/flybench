import type { KeyboardEvent } from "react";
import type { FlyScene } from "../render/FlyScene";

/**
 * The keys that turn a 3D view that has the keyboard's focus: the arrows turn the fly, plus and
 * minus zoom. The page's own keys (the arrows step through the tying) wait meanwhile.
 */
export function turnKeys(scene: FlyScene | null, e: KeyboardEvent<HTMLElement>): void {
  if (!scene || e.altKey || e.ctrlKey || e.metaKey || e.target !== e.currentTarget) return;
  const turn = 0.12;
  if (e.key === "ArrowLeft") scene.orbitBy(-turn, 0);
  else if (e.key === "ArrowRight") scene.orbitBy(turn, 0);
  else if (e.key === "ArrowUp") scene.orbitBy(0, -turn);
  else if (e.key === "ArrowDown") scene.orbitBy(0, turn);
  else if (e.key === "+" || e.key === "=") scene.zoomBy(0.87);
  else if (e.key === "-") scene.zoomBy(1.15);
  else return;
  e.preventDefault();
  e.stopPropagation();
}
