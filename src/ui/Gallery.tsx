import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { DIFFICULTY_LABELS, factsLine, IMITATES_LABELS, originLine, SPECIES_LABELS, TYPE_LABELS } from "../catalog/describe";
import { learningPath } from "../catalog/techniques";
import { filtersFromQuery, filtersToQuery, versionMatches, type CatalogEntry, type Filters } from "../catalog/search";
import { CATALOG, catalogSearch } from "../patterns";
import { MATERIALS, type MaterialKind } from "../recipe/materials";
import { DIFFICULTIES, FLY_TYPES, IMITATES, MONTHS, SPECIES } from "../recipe/schema";
import { bestCoverage, missingKinds, type Need } from "../catalog/inventory";
import { renderUrls, useRenders, type RenderInfo } from "./renders";
import { INVENTORY_KEY, useStoredSet } from "./storage";
import { href, replaceUrl } from "./router";
import { t } from "../i18n/ui";
import { kindName, needName } from "../tying/describe";
import { inSentence } from "../i18n/grammar";
import { lang } from "../i18n/lang";
import { MONTH_NAMES } from "../i18n/months";
import { linkTo } from "./linkTo";
import { ownEntry, useOwnFlies } from "./ownFlies";
import { useFlyPictures } from "./pictures";


export function Gallery({ query }: { query: string }) {
  const [filters, setFiltersState] = useState<Filters>(() => filtersFromQuery(query));
  const [moreOpen, setMoreOpen] = useState(() => hasMoreFilters(filtersFromQuery(query)));
  // A link to all patterns, or Back and Forward, changes the address: show its filters.
  useEffect(() => {
    if (filtersToQuery(filters) !== query) setFiltersState(filtersFromQuery(query));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);
  const renders = useRenders();
  const owned = useStoredSet(INVENTORY_KEY);
  const language = lang();
  const found = useMemo(() => catalogSearch().search(filters), [filters, language]);
  // A family counts as tieable, or one material short, by its member closest to tieable,
  // among the versions that meet the filters (search matched the family on one of those).
  const family = (e: CatalogEntry) => {
    const all = [e.recipe, ...e.variants];
    const versions = all.filter((v) => versionMatches(v, filters));
    return bestCoverage(versions.length ? versions : all, owned.values);
  };
  const results = filters.have ? found.filter((e) => missingKinds(family(e)) === 0) : found;
  const oneShort = filters.have
    ? found.flatMap((e) => {
        const c = family(e);
        return missingKinds(c) === 1 ? [{ entry: e, missing: c.missing[0]!, open: c.recipe.id }] : [];
      })
    : [];

  const setFilters = (f: Filters) => {
    setFiltersState(f);
    replaceUrl(href.gallery(filtersToQuery(f)));
  };
  const toggle = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters({ ...filters, [key]: filters[key] === value ? undefined : value });

  const typeCounts = catalogSearch().facetCounts("type", FLY_TYPES, filters);
  const usedTypes = FLY_TYPES.filter((t) => CATALOG.some((e) => e.recipe.type === t));
  // The first fly on the learning path.
  const beginner = useMemo(() => {
    const first = learningPath(CATALOG.map((e) => e.recipe))[0];
    return first ? CATALOG.find((e) => e.recipe.id === first.recipe.id) : undefined;
  }, []);
  const filtered = Object.values(filters).some((v) => (Array.isArray(v) ? v.length : v));

  return (
    <main className="gallery">
      <section className="intro">
        <div className="intro-text">
          <h1>{t.gallery.heading}</h1>
          <p>{t.gallery.intro}</p>
          <p className="intro-actions">
            {beginner && (
              <a className="primary-link" href={href.fly(beginner.recipe.id)}>
                {t.gallery.beginner(beginner.recipe.name)}
              </a>
            )}
            <a href={href.learn()}>{t.gallery.path}</a>
            <a href={href.build()}>{t.build.nav}</a>
          </p>
        </div>
        {renders && <FlyOfTheDay renders={renders} />}
      </section>

      <YourFlies />

      <section className={moreOpen ? "finder more-open" : "finder"} aria-label={t.gallery.finder}>
        <label className="search">
          <span className="visually-hidden">{t.gallery.search}</span>
          <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20">
            <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M15.5 15.5 21 21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={filters.q ?? ""}
            onChange={(e) => setFilters({ ...filters, q: e.target.value || undefined })}
            placeholder={t.gallery.placeholder}
            autoComplete="off"
          />
        </label>

        {/* On a phone the types are among the "more" filters, unless one is chosen. */}
        <div className={filters.type ? "chips types chosen" : "chips types"} role="group" aria-label={t.gallery.type}>
          <button className={filters.type ? "" : "on"} aria-pressed={!filters.type} onClick={() => setFilters({ ...filters, type: undefined })}>
            {t.gallery.allTypes}
          </button>
          {usedTypes.map((t) => (
            <button
              key={t}
              className={filters.type === t ? "on" : ""}
              aria-pressed={filters.type === t}
              disabled={typeCounts.get(t) === 0 && filters.type !== t}
              onClick={() => toggle("type", t)}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        <div className="chips">
          <button
            className={filters.have ? "on" : ""}
            aria-pressed={Boolean(filters.have)}
            onClick={() => setFilters({ ...filters, have: filters.have ? undefined : "1" })}
            title={owned.values.size === 0 ? t.gallery.haveFirst : undefined}
          >
            {t.gallery.have}
          </button>
          {filters.have && owned.values.size === 0 && (
            <span className="hint">{t.gallery.nothingTicked(linkTo(href.materials()))}</span>
          )}
        </div>

        <button className="more-toggle" aria-expanded={moreOpen} onClick={() => setMoreOpen(!moreOpen)}>
          {moreOpen ? t.gallery.fewer : t.gallery.more}
        </button>
        {moreOpen && <MoreFilters filters={filters} setFilters={setFilters} toggle={toggle} />}
      </section>

      <div className="result-bar" aria-live="polite">
        <span>
          {t.gallery.count(results.length, CATALOG.length, filtered)}
        </span>
        {filtered && (
          <button className="link-button" onClick={() => setFilters({})}>
            {t.gallery.clear}
          </button>
        )}
      </div>

      {results.length === 0 && filters.have ? (
        <div className="empty-results">
          <p>{t.gallery.noneTieable(oneShort.length > 0)}</p>
        </div>
      ) : results.length === 0 ? (
        <div className="empty-results">
          <p>{t.gallery.noMatch}</p>
          <button className="link-button" onClick={() => setFilters({ q: filters.q })}>
            {t.gallery.keepSearch}
          </button>
        </div>
      ) : (
        <ul className="plates">
          {results.map((e) => (
            // With "tie with what I have", open the version that can be tied (perhaps a variant).
            <Plate key={e.recipe.id} entry={e} render={renders?.[e.recipe.id]} open={filters.have ? family(e).recipe.id : undefined} />
          ))}
        </ul>
      )}

      {oneShort.length > 0 && (
        <section className="one-short">
          <h2>{t.gallery.oneShort}</h2>
          <ul className="plates">
            {oneShort.map(({ entry, missing, open }) => (
              <Plate key={entry.recipe.id} entry={entry} render={renders?.[entry.recipe.id]} missing={missing} open={open} />
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

/** The visitor's own flies, when there are any: the finished ones as plates, the others to carry on with. */
function YourFlies() {
  const own = useOwnFlies();
  const finished = own.flies.flatMap((f) => (f.recipe ? [f.recipe] : []));
  const unfinished = own.flies.filter((f) => !f.recipe);
  const pictures = useFlyPictures(useMemo(() => finished.map((r) => ({ key: r.id, recipe: r })), [finished.map((r) => `${r.id}:${JSON.stringify(r)}`).join("\n")]));
  if (own.flies.length === 0) return null;
  return (
    <section className="your-flies">
      <h2>{t.build.yours}</h2>
      <p className="stored-note">{t.build.yoursIntro}</p>
      {finished.length > 0 && (
        <ul className="plates">
          {finished.map((r) => (
            <Plate key={r.id} entry={ownEntry(r)} picture={pictures[r.id]} />
          ))}
        </ul>
      )}
      {unfinished.length > 0 && (
        <ul className="your-unfinished">
          {unfinished.map((f) => (
            <li key={f.fly.id}>
              <a href={href.build(`edit=${f.fly.id}`)}>{t.build.carryOn(f.name)}</a>{" "}
              <button
                className="link-button danger"
                aria-label={t.build.removeLabel(f.name)}
                onClick={() => confirm(t.build.deleteConfirm(f.name)) && own.save(own.stored.filter((x) => x.id !== f.fly.id))}
              >
                {t.build.delete}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function hasMoreFilters(f: Filters) {
  return Boolean(f.imitates || f.difficulty || f.species || f.month || f.materials?.length);
}

function MoreFilters({
  filters,
  setFilters,
  toggle,
}: {
  filters: Filters;
  setFilters: (f: Filters) => void;
  toggle: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
}) {
  const imitates = IMITATES.filter((i) => CATALOG.some((e) => e.recipe.imitates.includes(i)));
  const species = SPECIES.filter((s) => CATALOG.some((e) => e.recipe.species.includes(s)));
  const usedMaterials = (Object.keys(MATERIALS) as MaterialKind[])
    .filter((m) => CATALOG.some((e) => e.materials.has(m)))
    .sort((a, b) => kindName(a).localeCompare(kindName(b), lang()));
  const chosen = filters.materials ?? [];
  const imitatesCounts = catalogSearch().facetCounts("imitates", imitates, filters);
  const difficultyCounts = catalogSearch().facetCounts("difficulty", DIFFICULTIES, filters);
  const speciesCounts = catalogSearch().facetCounts("species", species, filters);

  const chipGroup = <K extends "imitates" | "difficulty" | "species">(
    key: K,
    label: string,
    values: readonly string[],
    names: Record<string, string>,
    counts: Map<string, number>,
  ) => (
    <fieldset className="facet">
      <legend>{label}</legend>
      <div className="chips">
        {values.map((v) => (
          <button
            key={v}
            className={filters[key] === v ? "on" : ""}
            aria-pressed={filters[key] === v}
            disabled={counts.get(v) === 0 && filters[key] !== v}
            onClick={() => toggle(key, v as Filters[K])}
          >
            {names[v]}
          </button>
        ))}
      </div>
    </fieldset>
  );

  return (
    <div className="more-filters">
      {chipGroup("imitates", t.gallery.imitates, imitates, IMITATES_LABELS, imitatesCounts)}
      {chipGroup("difficulty", t.gallery.difficulty, DIFFICULTIES, DIFFICULTY_LABELS, difficultyCounts)}
      {chipGroup("species", t.gallery.fish, species, SPECIES_LABELS, speciesCounts)}
      <fieldset className="facet">
        <legend>{t.gallery.season}</legend>
        <select value={filters.month ?? ""} onChange={(e) => setFilters({ ...filters, month: (e.target.value || undefined) as Filters["month"] })}>
          <option value="">{t.gallery.anyMonth}</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={m}>
              {MONTH_NAMES[i]}
            </option>
          ))}
        </select>
      </fieldset>
      <fieldset className="facet">
        <legend>{t.gallery.materials}</legend>
        <div className="chips">
          {chosen.map((m) => (
            <button key={m} className="on removable" onClick={() => setFilters({ ...filters, materials: chosen.filter((x) => x !== m) })}>
              {kindName(m)}
              <span className="visually-hidden">{t.gallery.remove}</span>
              <svg aria-hidden="true" viewBox="0 0 12 12" width="10" height="10">
                <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </button>
          ))}
          <select
            value=""
            aria-label={t.gallery.addMaterial}
            onChange={(e) => e.target.value && setFilters({ ...filters, materials: [...chosen, e.target.value as MaterialKind] })}
          >
            <option value="">{t.gallery.addMaterialOption}</option>
            {usedMaterials
              .filter((m) => !chosen.includes(m))
              .map((m) => (
                <option key={m} value={m}>
                  {kindName(m)}
                </option>
              ))}
          </select>
        </div>
      </fieldset>
    </div>
  );
}

/**
 * The turntable sprite, loaded on demand. The card image gives way to it only once it has
 * arrived, so a card whose sprite can't load (offline, say) keeps showing its fly.
 */
function useSpin(url: string | undefined): [ready: boolean, load: () => void] {
  const [ready, setReady] = useState<string | null>(null);
  const requested = useRef<string | null>(null);
  const load = useCallback(() => {
    if (!url || requested.current === url) return;
    requested.current = url;
    const img = new Image();
    img.onload = () => setReady(url);
    // Try again on the next hover.
    img.onerror = () => (requested.current = null);
    img.src = url;
  }, [url]);
  return [ready === url, load];
}

/** A different pattern every day, turning on its stand. */
function FlyOfTheDay({ renders }: { renders: Record<string, RenderInfo> }) {
  const rendered = CATALOG.filter((e) => renders[e.recipe.id]);
  const day = Math.floor(Date.now() / 86_400_000);
  const entry = rendered[day % Math.max(1, rendered.length)];
  if (!entry) return null;
  const r = entry.recipe;
  const info = renders[r.id]!;
  const urls = renderUrls(r.id, info);
  return <FeaturedFly id={r.id} name={r.name} info={info} urls={urls} />;
}

function FeaturedFly({ id, name, info, urls }: { id: string; name: string; info: RenderInfo; urls: ReturnType<typeof renderUrls> }) {
  const [ready, load] = useSpin(urls.spin);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: no-preference)").matches) load();
  }, [load]);
  return (
    <a className="fly-of-the-day" href={href.fly(id)}>
      <div className={ready ? "fly-of-the-day-image spin-ready" : "fly-of-the-day-image"} style={{ "--spin": `url("${urls.spin}")`, "--frames": info.frames } as CSSProperties}>
        <div className="plate-spin" aria-hidden="true" />
        <img src={urls.card} alt="" width={600} height={400} />
      </div>
      <p>
        {t.gallery.flyOfTheDay} <strong>{name}</strong>
      </p>
    </a>
  );
}

/** `open`: the id of the version to open, when it isn't the main pattern. */
export function Plate({
  entry,
  render,
  missing,
  open,
  link,
  note,
  action,
  picture,
}: {
  entry: CatalogEntry;
  render?: RenderInfo;
  missing?: Need;
  /** The version to open, when not the main pattern. */
  open?: string;
  /** The address to open instead (a fly in the visitor's colours). */
  link?: string;
  note?: string;
  /** A control under the plate, outside its link. */
  action?: ReactNode;
  /** A picture drawn in the browser (a fly in the visitor's colours), instead of the rendered one. */
  picture?: string | null;
}) {
  const r = entry.recipe;
  const urls = render && picture === undefined ? renderUrls(r.id, render) : null;
  const origin = originLine(r);
  const style = urls
    ? ({ "--spin": `url("${urls.spin}")`, "--frames": render!.frames } as CSSProperties)
    : undefined;
  const [ready, load] = useSpin(urls?.spin);
  return (
    <li className="plate">
      <a href={link ?? href.fly(open ?? r.id)} onPointerEnter={load} onFocus={load}>
        <div className={ready ? "plate-image spin-ready" : "plate-image"} style={style}>
          {picture ? (
            <img src={picture} alt="" width={600} height={400} />
          ) : picture === null ? null : urls ? (
            <>
              <div className="plate-spin" aria-hidden="true" />
              <img src={urls.card} alt="" loading="lazy" width={600} height={400} />
            </>
          ) : (
            <span className="plate-missing">{t.gallery.notRendered}</span>
          )}
        </div>
        <h2>{r.name}</h2>
        <p className="plate-facts">{factsLine(r)}</p>
        <p className="plate-meta">
          {origin && <span>{origin}</span>}
          <span>{DIFFICULTY_LABELS[r.difficulty]}</span>
          {entry.variants.length > 0 && (
            <span>{t.gallery.versions(entry.variants.length + 1)}</span>
          )}
        </p>
        {note && <p className="plate-note">{note}</p>}
        {missing && (
          <p className="plate-missing-material">
            {t.gallery.needs(inSentence(needName(missing.kind, missing.color)))}
          </p>
        )}
      </a>
      {action}
    </li>
  );
}
