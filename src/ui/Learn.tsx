import { useEffect, useMemo } from "react";
import { factsLine } from "../catalog/describe";
import { learningPath, technique } from "../catalog/techniques";
import { PATTERNS } from "../patterns";
import { renderUrls, useRenders } from "./renders";
import { href } from "./router";
import { t } from "../i18n/ui";
import { lang } from "../i18n/lang";
import { tiedCounts } from "../catalog/log";
import { useLog } from "./Log";

export function Learn() {
  useEffect(() => {
    document.title = t.site.titled(t.learn.title);
  }, [lang()]);
  const path = useMemo(() => learningPath(PATTERNS.map((p) => p.recipe)), []);
  const renders = useRenders();
  const log = useLog();
  const tied = useMemo(() => tiedCounts(log.items, PATTERNS.map((p) => p.recipe)), [log.items]);
  const done = path.filter((s) => tied.has(s.recipe.id)).length;
  return (
    <main className="reading learn">
      <h1>{t.learn.heading}</h1>
      <p className="lede">{t.learn.intro}</p>
      {log.items.length > 0 && (
        <p className="path-progress">
          {t.learn.progress(done, path.length)}
          <a href={href.log()}>{t.learn.yourLog}</a>
        </p>
      )}
      <ol className="path">
        {path.map((stage) => {
          const r = stage.recipe;
          const info = renders?.[r.id];
          return (
            <li key={r.id}>
              <a className="path-plate" href={href.fly(r.id)}>
                {info ? <img src={renderUrls(r.id, info).card} alt="" loading="lazy" width={300} height={200} /> : null}
              </a>
              <div>
                <h2>
                  <a href={href.fly(r.id)}>{r.name}</a>
                  {tied.has(r.id) && <span className="tied-mark">{t.learn.tied}</span>}
                </h2>
                <p className="path-facts">{factsLine(r)}</p>
                <p>
                  {t.learn.newHere}
                  {stage.learns.map((id, i) => (
                    <span key={id}>
                      {i > 0 && (i === stage.learns.length - 1 ? t.learn.and : ", ")}
                      <a href={href.technique(id)}>{technique(id)?.name.toLowerCase() ?? id}</a>
                    </span>
                  ))}
                  .
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </main>
  );
}
