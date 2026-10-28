import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { DIFFICULTY_LABELS, factsLine } from "../catalog/describe";
import type { Recipe } from "../recipe/schema";
import { FlyScene } from "../render/FlyScene";
import { materialsList } from "../tying/describe";
import { stepEnd, type Build } from "../tying/simulate";
import { href } from "./router";

/**
 * The printable recipe card: the finished fly, the dressing and the numbered steps, each with
 * a small picture of the fly after it, drawn here in the browser. Shown only in print; it
 * opens the print dialog once its pictures are ready and calls `onDone` when printing ends.
 */
export function PrintCard({ recipe, build, onDone }: { recipe: Recipe; build: Build; onDone: () => void }) {
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
      setPictures([scene.snapshot(), ...shots]);
    } catch {
      // No WebGL: the card prints without pictures.
      setPictures([]);
    } finally {
      scene?.dispose();
      host.remove();
    }
  }, [build]);

  useEffect(() => {
    if (!pictures) return;
    document.documentElement.classList.add("printing-card");
    const done = () => {
      document.documentElement.classList.remove("printing-card");
      onDone();
    };
    addEventListener("afterprint", done, { once: true });
    // Let the pictures load before the dialog takes its copy of the page.
    const t = setTimeout(() => print(), 300);
    return () => {
      clearTimeout(t);
      removeEventListener("afterprint", done);
      document.documentElement.classList.remove("printing-card");
    };
  }, [pictures, onDone]);

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
