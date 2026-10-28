import { useEffect } from "react";
import { patternsUsing, stepTechnique, technique, TECHNIQUES, techniqueExample } from "../catalog/techniques";
import { PATTERNS } from "../patterns";
import { Clip } from "./Clip";
import { NotFound } from "./NotFound";
import { Paragraphs } from "./Paragraphs";
import { href } from "./router";

const recipes = () => PATTERNS.map((p) => p.recipe);

export function TechniquesIndex() {
  useEffect(() => {
    document.title = "Techniques, Flybench";
  }, []);
  const used = TECHNIQUES.filter((t) => patternsUsing(recipes(), t.id).length > 0);
  return (
    <main className="reading">
      <h1>Techniques</h1>
      <p className="lede">
        The handful of things every fly is made of. Each one is shown on a real pattern; the steps of every pattern
        link back here.
      </p>
      <ul className="technique-list">
        {used.map((t) => (
          <li key={t.id}>
            <a href={href.technique(t.id)}>{t.name}</a>
            <span>{t.summary}</span>
          </li>
        ))}
      </ul>
      <p>
        Not sure where to start? Follow the <a href={href.learn()}>learning path</a>.
      </p>
    </main>
  );
}

export function TechniquePage({ id }: { id: string }) {
  const t = technique(id);
  useEffect(() => {
    if (t) document.title = `${t.name}, Flybench`;
  }, [t]);
  if (!t) {
    return (
      <NotFound className="reading" heading={<>No technique called “{id}”</>}>
        <p>
          <a href={href.techniques()}>See all techniques</a>
        </p>
      </NotFound>
    );
  }
  const example = techniqueExample(recipes(), id);
  const using = patternsUsing(recipes(), id);
  return (
    <main className="reading technique">
      <a className="back" href={href.techniques()}>
        All techniques
      </a>
      <h1>{t.name}</h1>
      <p className="lede">{t.summary}</p>
      {example && <Clip key={`${example.recipe.id}:${example.step}`} recipe={example.recipe} step={example.step} />}
      <h2>How to do it</h2>
      <Paragraphs text={t.how} />
      <h2>Common mistakes</h2>
      <ul>
        {t.mistakes.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
      {using.length > 0 && (
        <>
          <h2>Patterns that use it</h2>
          <ul className="uses">
            {using.map((r) => {
              const step = r.steps.findIndex((_, i) => stepTechnique(r, i) === id);
              return (
                <li key={r.id}>
                  <a href={href.fly(r.id, step + 1)}>{r.name}</a>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </main>
  );
}
