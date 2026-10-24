import { useMemo, useState, type CSSProperties } from "react";
import { DIFFICULTY_LABELS, factsLine, IMITATES_LABELS, originLine, SPECIES_LABELS, TYPE_LABELS } from "../catalog/describe";
import { filtersFromQuery, filtersToQuery, type CatalogEntry, type Filters } from "../catalog/search";
import { CATALOG, SEARCH } from "../patterns";
import { MATERIALS, type MaterialKind } from "../recipe/materials";
import { DIFFICULTIES, FLY_TYPES, IMITATES, MONTHS, SPECIES } from "../recipe/schema";
import { renderUrls, useRenders, type RenderInfo } from "./renders";
import { href, replaceHash } from "./router";

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function Gallery({ query }: { query: string }) {
  const [filters, setFiltersState] = useState<Filters>(() => filtersFromQuery(query));
  const [moreOpen, setMoreOpen] = useState(() => hasMoreFilters(filtersFromQuery(query)));
  const renders = useRenders();
  const results = useMemo(() => SEARCH.search(filters), [filters]);

  const setFilters = (f: Filters) => {
    setFiltersState(f);
    replaceHash(href.gallery(filtersToQuery(f)));
  };
  const toggle = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters({ ...filters, [key]: filters[key] === value ? undefined : value });

  const typeCounts = SEARCH.facetCounts("type", FLY_TYPES, filters);
  const usedTypes = FLY_TYPES.filter((t) => CATALOG.some((e) => e.recipe.type === t));
  const beginner = CATALOG.find((e) => e.recipe.difficulty === "beginner");
  const filtered = Object.values(filters).some((v) => (Array.isArray(v) ? v.length : v));

  return (
    <main className="gallery">
      <section className="intro">
        <h1>Fly patterns to tie, step by step, in 3D</h1>
        <p>
          Every pattern can be turned, paused and replayed one step at a time.
          {beginner && (
            <>
              {" "}
              New to tying? Start with the <a href={href.fly(beginner.recipe.id)}>{beginner.recipe.name}</a>.
            </>
          )}
        </p>
      </section>

      <section className="finder" aria-label="Find a pattern">
        <label className="search">
          <span className="visually-hidden">Search patterns</span>
          <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20">
            <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M15.5 15.5 21 21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={filters.q ?? ""}
            onChange={(e) => setFilters({ ...filters, q: e.target.value || undefined })}
            placeholder="Search by name, insect or material"
            autoComplete="off"
          />
        </label>

        <div className="chips" role="group" aria-label="Type">
          <button className={filters.type ? "" : "on"} aria-pressed={!filters.type} onClick={() => setFilters({ ...filters, type: undefined })}>
            All types
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

        <button className="more-toggle" aria-expanded={moreOpen} onClick={() => setMoreOpen(!moreOpen)}>
          {moreOpen ? "Fewer filters" : "More filters"}
        </button>
        {moreOpen && <MoreFilters filters={filters} setFilters={setFilters} toggle={toggle} />}
      </section>

      <div className="result-bar" aria-live="polite">
        <span>
          {filtered ? `${results.length} of ${CATALOG.length} patterns` : `${CATALOG.length} patterns`}
        </span>
        {filtered && (
          <button className="link-button" onClick={() => setFilters({})}>
            Clear filters
          </button>
        )}
      </div>

      {results.length === 0 ? (
        <div className="empty-results">
          <p>No pattern matches all of these filters.</p>
          <button className="link-button" onClick={() => setFilters({ q: filters.q })}>
            Keep the search, drop the filters
          </button>
        </div>
      ) : (
        <ul className="plates">
          {results.map((e) => (
            <Plate key={e.recipe.id} entry={e} render={renders?.[e.recipe.id]} />
          ))}
        </ul>
      )}
    </main>
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
    .sort((a, b) => MATERIALS[a].name.localeCompare(MATERIALS[b].name));
  const chosen = filters.materials ?? [];
  const imitatesCounts = SEARCH.facetCounts("imitates", imitates, filters);
  const difficultyCounts = SEARCH.facetCounts("difficulty", DIFFICULTIES, filters);
  const speciesCounts = SEARCH.facetCounts("species", species, filters);

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
      {chipGroup("imitates", "Imitates", imitates, IMITATES_LABELS, imitatesCounts)}
      {chipGroup("difficulty", "Difficulty", DIFFICULTIES, DIFFICULTY_LABELS, difficultyCounts)}
      {chipGroup("species", "Fish", species, SPECIES_LABELS, speciesCounts)}
      <fieldset className="facet">
        <legend>In season</legend>
        <select value={filters.month ?? ""} onChange={(e) => setFilters({ ...filters, month: (e.target.value || undefined) as Filters["month"] })}>
          <option value="">Any month</option>
          {MONTHS.map((m) => (
            <option key={m} value={m}>
              {capitalize(m)}
            </option>
          ))}
        </select>
      </fieldset>
      <fieldset className="facet">
        <legend>Uses all of these materials</legend>
        <div className="chips">
          {chosen.map((m) => (
            <button key={m} className="on removable" onClick={() => setFilters({ ...filters, materials: chosen.filter((x) => x !== m) })}>
              {capitalize(MATERIALS[m].name)}
              <span className="visually-hidden">, remove</span>
              <svg aria-hidden="true" viewBox="0 0 12 12" width="10" height="10">
                <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </button>
          ))}
          <select
            value=""
            aria-label="Add a material"
            onChange={(e) => e.target.value && setFilters({ ...filters, materials: [...chosen, e.target.value as MaterialKind] })}
          >
            <option value="">Add a material…</option>
            {usedMaterials
              .filter((m) => !chosen.includes(m))
              .map((m) => (
                <option key={m} value={m}>
                  {capitalize(MATERIALS[m].name)}
                </option>
              ))}
          </select>
        </div>
      </fieldset>
    </div>
  );
}

function Plate({ entry, render }: { entry: CatalogEntry; render?: RenderInfo }) {
  const r = entry.recipe;
  const urls = render ? renderUrls(r.id, render) : null;
  const origin = originLine(r);
  const style = urls
    ? ({ "--spin": `url("${urls.spin}")`, "--frames": render!.frames } as CSSProperties)
    : undefined;
  return (
    <li className="plate">
      <a href={href.fly(r.id)}>
        <div className="plate-image" style={style}>
          {urls ? (
            <>
              <div className="plate-spin" aria-hidden="true" />
              <img src={urls.card} alt="" loading="lazy" width={600} height={400} />
            </>
          ) : (
            <span className="plate-missing">Not rendered yet</span>
          )}
        </div>
        <h2>{r.name}</h2>
        <p className="plate-facts">{factsLine(r)}</p>
        <p className="plate-meta">
          {origin && <span>{origin}</span>}
          <span>{DIFFICULTY_LABELS[r.difficulty]}</span>
          {entry.variants.length > 0 && (
            <span>
              {entry.variants.length + 1} versions
            </span>
          )}
        </p>
      </a>
    </li>
  );
}
