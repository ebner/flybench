import { useEffect, useState } from "react";
import { FlyScene } from "../render/FlyScene";
import type { Recipe } from "../recipe/schema";
import { ridesPointUp } from "../tying/hook";
import { simulate } from "../tying/simulate";

/**
 * Pictures of flies in the visitor's colours, or of their own flies, drawn here in one offscreen
 * 3D view (the gallery's pictures are of the patterns as tied). null while drawing, or without WebGL.
 */
export function useFlyPictures(flies: { key: string; recipe: Recipe }[]): Record<string, string | null> {
  const [pictures, setPictures] = useState<Record<string, string>>({});
  // Drawn again when a fly changes, not only when another is added (an own fly edited).
  const keys = flies.map((f) => `${f.key}\u0000${JSON.stringify(f.recipe)}`).join("\n");
  useEffect(() => {
    if (flies.length === 0) return;
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;left:-10000px;top:0;width:600px;height:400px";
    document.body.appendChild(host);
    let scene: FlyScene | null = null;
    const drawn: Record<string, string> = {};
    try {
      scene = new FlyScene(host, { background: null, fov: 20 });
      for (const f of flies) {
        const build = simulate(f.recipe);
        scene.setBuild(build);
        // As the gallery pictures them: point-up flies point up.
        scene.setTurnedOver(ridesPointUp(f.recipe));
        scene.setTime(build.duration);
        scene.setView("default");
        drawn[f.key] = scene.snapshot().toDataURL("image/png");
      }
    } catch {
      // No WebGL: the plates go without pictures.
    }
    scene?.dispose();
    host.remove();
    setPictures(drawn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys]);
  return Object.fromEntries(flies.map((f) => [f.key, pictures[f.key] ?? null]));
}
