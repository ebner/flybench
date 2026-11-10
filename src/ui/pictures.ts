import { useEffect, useState } from "react";
import { FlyScene } from "../render/FlyScene";
import type { Recipe } from "../recipe/schema";
import { ridesPointUp } from "../tying/hook";
import { simulate } from "../tying/simulate";

/**
 * Pictures of flies in the visitor's colours, or of their own flies, drawn here in one offscreen
 * 3D view (the gallery's pictures are of the patterns as tied). null while drawing, or without WebGL.
 */
// Kept for the visit by fly and recipe, so a page shown again doesn't draw its flies again.
const drawnBefore = new Map<string, string>();
const MAX_KEPT = 200;

export function useFlyPictures(flies: { key: string; recipe: Recipe }[]): Record<string, string | null> {
  // Drawn again when a fly changes, not only when another is added (an own fly edited).
  const cacheKey = (f: { key: string; recipe: Recipe }) => `${f.key}\u0000${JSON.stringify(f.recipe)}`;
  const keys = flies.map(cacheKey).join("\n");
  const [pictures, setPictures] = useState<Record<string, string>>(() =>
    Object.fromEntries(flies.flatMap((f) => (drawnBefore.has(cacheKey(f)) ? [[f.key, drawnBefore.get(cacheKey(f))!]] : []))),
  );
  useEffect(() => {
    const todo = flies.filter((f) => !drawnBefore.has(cacheKey(f)));
    const kept = () => Object.fromEntries(flies.flatMap((f) => (drawnBefore.has(cacheKey(f)) ? [[f.key, drawnBefore.get(cacheKey(f))!]] : [])));
    if (todo.length === 0) return setPictures(kept());
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;left:-10000px;top:0;width:600px;height:400px";
    document.body.appendChild(host);
    let scene: FlyScene | null = null;
    try {
      scene = new FlyScene(host, { background: null, fov: 20 });
      for (const f of todo) {
        const build = simulate(f.recipe);
        scene.setBuild(build);
        // As the gallery pictures them: point-up flies point up.
        scene.setTurnedOver(ridesPointUp(f.recipe));
        scene.setTime(build.duration);
        scene.setView("default");
        if (drawnBefore.size >= MAX_KEPT) drawnBefore.delete(drawnBefore.keys().next().value!);
        drawnBefore.set(cacheKey(f), scene.snapshot().toDataURL("image/png"));
      }
    } catch {
      // No WebGL: the plates go without pictures.
    }
    scene?.dispose();
    host.remove();
    setPictures(kept());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys]);
  return Object.fromEntries(flies.map((f) => [f.key, pictures[f.key] ?? null]));
}
