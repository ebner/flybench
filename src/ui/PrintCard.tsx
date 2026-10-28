import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DIFFICULTY_LABELS, factsLine } from "../catalog/describe";
import type { Recipe } from "../recipe/schema";
import { FlyScene } from "../render/FlyScene";
import { materialsList } from "../tying/describe";
import { stepEnd, type Build } from "../tying/simulate";
import { href } from "./router";

/**
 * The printable recipe card: the finished fly, the dressing and the numbered steps, each with
 * a small picture of the fly after it, drawn here in the browser. Shown only in print; each
 * `request` opens the print dialog once the pictures are ready, then calls `onPrinted`.
 */
/** The box around everything that isn't white paper in a picture. */
function inkBounds(canvas: HTMLCanvasElement): { x: number; y: number; w: number; h: number } {
  const { width, height } = canvas;
  const data = canvas.getContext("2d")!.getImageData(0, 0, width, height).data;
  let [x0, y0, x1, y1] = [width, height, 0, 0];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i]! < 235 || data[i + 1]! < 235 || data[i + 2]! < 235) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
    }
  }
  if (x1 < x0) return { x: 0, y: 0, w: width, h: height };
  const m = Math.round(0.03 * width);
  const x = Math.max(0, x0 - m);
  const y = Math.max(0, y0 - m);
  return { x, y, w: Math.min(width, x1 + m) - x, h: Math.min(height, y1 + m) - y };
}

function cropped(canvas: HTMLCanvasElement, box: { x: number; y: number; w: number; h: number }): string {
  const out = document.createElement("canvas");
  out.width = box.w;
  out.height = box.h;
  out.getContext("2d")!.drawImage(canvas, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
  return out.toDataURL("image/jpeg", 0.88);
}

export function PrintCard({ recipe, build, request, onPrinted }: { recipe: Recipe; build: Build; request: number; onPrinted: () => void }) {
  const [pictures, setPictures] = useState<string[] | null>(null);

  useEffect(() => {
    // An offscreen stage the size of a step picture, rendered once per step.
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;left:-10000px;top:0;width:360px;height:200px";
    document.body.appendChild(host);
    let scene: FlyScene | null = null;
    try {
      scene = new FlyScene(host, { background: "#ffffff", fov: 20 });
      scene.setBuild(build);
      scene.setView("default");
      const shots = build.steps.map((s) => {
        scene!.setTime(stepEnd(s));
        return scene!.snapshot();
      });
      scene.setTime(build.duration);
      const finished = scene.snapshot();
      // Every picture cropped alike, to the finished fly with a little margin: same scale, less paper.
      const crop = inkBounds(finished);
      setPictures([finished, ...shots].map((c) => cropped(c, crop)));
    } catch {
      // No WebGL: the card prints without pictures.
      setPictures([]);
    } finally {
      scene?.dispose();
      host.remove();
    }
  }, [build]);

  // Each request (a click on "Print recipe card") prints the card once its pictures are ready.
  // New pictures (another hook size) don't print again: only a new request does.
  const handled = useRef(0);
  useEffect(() => {
    if (!pictures || request === handled.current) return;
    handled.current = request;
    const html = document.documentElement;
    html.classList.add("printing-card");
    // Back to printing the page itself after the dialog. Browsers differ (and may ignore a
    // print() called soon after a cancelled one), so afterprint is not relied on alone: the
    // first tap or key press after the dialog will do as well.
    const restore = () => {
      html.classList.remove("printing-card");
      removeEventListener("afterprint", restore);
      removeEventListener("pointerdown", restore, true);
      removeEventListener("keydown", restore, true);
    };
    addEventListener("afterprint", restore);
    // Let the pictures load before the dialog takes its copy of the page.
    const t = setTimeout(() => {
      print();
      onPrinted();
      addEventListener("pointerdown", restore, true);
      addEventListener("keydown", restore, true);
    }, 300);
    return () => {
      clearTimeout(t);
      restore();
    };
  }, [pictures, request, onPrinted]);

  if (!pictures) return null;
  const [finished, ...steps] = pictures;
  return createPortal(
    <article className="print-card">
      <header>
        <h1>
          {recipe.name}
          {recipe.variant ? ` (${recipe.variant})` : ""}
        </h1>
        <p>
          {factsLine(recipe)}. {DIFFICULTY_LABELS[recipe.difficulty]}.
        </p>
      </header>
      <div className="print-top">
        {finished && <img src={finished} alt="" />}
        <dl className="print-dressing">
          {materialsList(recipe).map((m) => (
            <div key={m.id}>
              <dt>{m.role}</dt>
              <dd>
                {m.name}
                {m.detail ? `, ${m.detail}` : ""}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <ol className="print-steps">
        {build.steps.map((s, i) => (
          <li key={s.index}>
            {steps[i] && <img src={steps[i]} alt="" />}
            <div>
              <strong>{s.title}</strong>
              <p>{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
      <footer>
        {location.host}
        {href.fly(recipe.id)}. Text and pictures from Flybench, CC BY 4.0.
      </footer>
    </article>,
    document.body,
  );
}
