import { useEffect, useMemo } from "react";
import { factsLine } from "../catalog/describe";
import { learningPath, technique } from "../catalog/techniques";
import { PATTERNS } from "../patterns";
import { renderUrls, useRenders } from "./renders";
import { href } from "./router";

export function Learn() {
  useEffect(() => {
    document.title = "Learn to tie, Flybench";
  }, []);
  const path = useMemo(() => learningPath(PATTERNS.map((p) => p.recipe)), []);
  const renders = useRenders();
  return (
    <main className="reading learn">
      <h1>Learn to tie, one fly at a time</h1>
      <p className="lede">
        Each fly on this path adds only a few new techniques to what the ones before it taught, starting with the
        easiest. Tie them in order and you will have met every technique in the catalog.
      </p>
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
                </h2>
                <p className="path-facts">{factsLine(r)}</p>
                <p>
                  New here:{" "}
                  {stage.learns.map((id, i) => (
                    <span key={id}>
                      {i > 0 && (i === stage.learns.length - 1 ? " and " : ", ")}
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
