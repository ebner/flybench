import { useMemo, useState } from "react";
import { STYLES, type Style } from "../../edit/parts";
import { HOOK_MODEL_IDS, TUBE_MODEL_IDS, type Recipe } from "../../recipe/schema";
import { hookModelName } from "../../tying/describe";
import { PATTERNS } from "../../patterns";
import { t } from "../../i18n/ui";
import { lang } from "../../i18n/lang";
import { renderUrls, useHookPictures, useRenders } from "../renders";
import type { Own } from "../ownFlies";

/** Where a new fly starts: a style, a pattern, a bare hook; or the fly being built, or one saved. */
export function Start({
  draftName,
  flies,
  onDraft,
  onStyle,
  onPattern,
  onHook,
  onEdit,
}: {
  draftName: string | null;
  flies: Own[];
  onDraft: () => void;
  onStyle: (s: Style) => void;
  onPattern: (id: string) => void;
  onHook: (model: Recipe["hook"]["model"]) => void;
  onEdit: (id: string) => void;
}) {
  const renders = useRenders();
  const hooks = useHookPictures();
  const [query, setQuery] = useState("");
  const s = t.workbench.start;
  const picture = (id: string) => {
    const info = renders?.[id];
    return info ? renderUrls(id, info).card : null;
  };
  const patterns = useMemo(() => {
    const q = query.trim().toLocaleLowerCase(lang());
    return PATTERNS.map((p) => p.recipe).filter((r) => !q || r.name.toLocaleLowerCase(lang()).includes(q) || r.aliases.some((a) => a.toLocaleLowerCase(lang()).includes(q)));
  }, [query]);
  return (
    <main className="reading wb-start">
      <h1>{t.workbench.title}</h1>
      <p className="lede">{t.workbench.intro}</p>

      {draftName && (
        <section className="wb-start-draft">
          <button className="box-toggle" onClick={onDraft}>
            {s.draft(draftName)}
          </button>
          <p className="stored-note">{s.draftIntro}</p>
        </section>
      )}

      {flies.length > 0 && (
        <section>
          <h2>{s.yours}</h2>
          <ul className="wb-start-list">
            {flies.map((f) => (
              <li key={f.fly.id}>
                <button className="link" onClick={() => onEdit(f.fly.id)}>
                  {f.name}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2>{s.styles}</h2>
        <p className="stored-note">{s.stylesIntro}</p>
        <ul className="wb-start-grid">
          {(Object.keys(STYLES) as Style[]).map((style) => {
            const img = picture(STYLES[style]);
            return (
              <li key={style}>
                <button className="wb-start-tile" onClick={() => onStyle(style)}>
                  {img ? <img src={img} alt="" loading="lazy" width={480} height={320} /> : <span className="wb-swatch-blank" />}
                  <span className="wb-part-name">{t.workbench.style[style]}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2>{s.bare}</h2>
        <p className="stored-note">{s.bareIntro}</p>
        <ul className="wb-start-grid hooks">
          {[...HOOK_MODEL_IDS, ...TUBE_MODEL_IDS].map((model) => (
            <li key={model}>
              <button className="wb-start-tile" onClick={() => onHook(model)}>
                {hooks?.[model] ? <img src={hooks[model]} alt="" loading="lazy" width={240} height={180} /> : <span className="wb-swatch-blank" />}
                <span>{hookModelName(model)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>{s.patterns}</h2>
        <p className="stored-note">{s.patternsIntro}</p>
        <label className="search">
          <span className="visually-hidden">{s.search}</span>
          <input type="search" placeholder={s.search} value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <ul className="wb-start-grid">
          {patterns.map((r) => {
            const img = picture(r.id);
            return (
              <li key={r.id}>
                <button className="wb-start-tile" onClick={() => onPattern(r.id)}>
                  {img ? <img src={img} alt="" loading="lazy" width={480} height={320} /> : <span className="wb-swatch-blank" />}
                  <span className="wb-part-name">{r.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
