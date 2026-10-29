import { useEffect } from "react";
import { localTechniques, patternsUsing, stepTechnique, technique, techniqueExample } from "../catalog/techniques";
import { PATTERNS } from "../patterns";
import { Clip } from "./Clip";
import { NotFound } from "./NotFound";
import { Paragraphs } from "./Paragraphs";
import { href } from "./router";
import { t } from "../i18n/ui";
import { lang } from "../i18n/lang";
import { inPageLanguage } from "../i18n/prose";
import { linkTo } from "./linkTo";

const recipes = () => PATTERNS.map((p) => p.recipe);

export function TechniquesIndex() {
  useEffect(() => {
    document.title = t.site.titled(t.techniques.title);
  }, [lang()]);
  const used = localTechniques().filter((t) => patternsUsing(recipes(), t.id).length > 0);
  return (
    <main className="reading">
      <h1>{t.techniques.heading}</h1>
      <p className="lede">{t.techniques.intro}</p>
      <ul className="technique-list">
        {used.map((tech) => (
          <li key={tech.id}>
            <a href={href.technique(tech.id)}>{tech.name}</a>
            <span>{tech.summary}</span>
          </li>
        ))}
      </ul>
      <p>{t.techniques.start(linkTo(href.learn()))}</p>
    </main>
  );
}

export function TechniquePage({ id }: { id: string }) {
  const tech = technique(id);
  useEffect(() => {
    if (tech) document.title = t.site.titled(tech.name);
  }, [tech, lang()]);
  if (!tech) {
    return (
      <NotFound className="reading" heading={t.notFound.technique(id)}>
        <p>
          <a href={href.techniques()}>{t.notFound.allTechniques}</a>
        </p>
      </NotFound>
    );
  }
  const example = techniqueExample(recipes(), id);
  const using = patternsUsing(recipes(), id);
  return (
    <main className="reading technique">
      <a className="back" href={href.techniques()}>
        {t.techniques.all}
      </a>
      <h1>{tech.name}</h1>
      <p className="lede">{tech.summary}</p>
      {example && <Clip key={`${example.recipe.id}:${example.step}`} recipe={inPageLanguage(example.recipe)} step={example.step} />}
      <h2>{t.techniques.how}</h2>
      <Paragraphs text={tech.how} />
      <h2>{t.techniques.mistakes}</h2>
      <ul>
        {tech.mistakes.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
      {using.length > 0 && (
        <>
          <h2>{t.techniques.using}</h2>
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
