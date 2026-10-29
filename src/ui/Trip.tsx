import { useEffect, useMemo, useRef, useState } from "react";
import { SPECIES_LABELS } from "../catalog/describe";
import { coverage, missingKinds } from "../catalog/inventory";
import { REGION_LABELS } from "../catalog/naturals";
import { sizesText, suggestBox, WATER_LABELS, type Species, type Suggestion, type Water } from "../catalog/trip";
import { NATURALS } from "../naturals";
import { PATTERNS } from "../patterns";
import { REGIONS } from "../recipe/natural";
import { MONTHS, SPECIES } from "../recipe/schema";
import type { Region } from "../catalog/naturals";
import { useRegion } from "./Naturals";
import { BenchNav } from "./Personal";
import { renderUrls, useRenders } from "./renders";
import { href, replaceUrl } from "./router";
import { t } from "../i18n/ui";
import { linkTo } from "./linkTo";
import { FLY_BOX_KEY, INVENTORY_KEY, useStoredSet } from "./storage";

const MONTH_NAMES = MONTHS.map((m) => m.charAt(0).toUpperCase() + m.slice(1));
const WATERS = Object.keys(WATER_LABELS) as Water[];
/** How many flies make the box; the rest are listed under it. */
const BOX_SIZE = 12;

/**
 * The trip as the address has it: ?region=british-isles&month=6&water=river&species=trout
 * (month 1-based). A shared link names its region; without one, the visitor's own is used.
 */
function readQuery(query: string): { region?: Region; month: number; water: Water; species: Species } {
  const q = new URLSearchParams(query);
  const region = q.get("region");
  const month = Number(q.get("month"));
  const water = q.get("water");
  const species = q.get("species");
  return {
    ...(REGIONS.includes(region as Region) ? { region: region as Region } : {}),
    month: Number.isInteger(month) && month >= 1 && month <= 12 ? month - 1 : new Date().getMonth(),
    water: WATERS.includes(water as Water) ? (water as Water) : "river",
    species: SPECIES.includes(species as Species) ? (species as Species) : "trout",
  };
}

const writeQuery = (t: ReturnType<typeof readQuery>, region: Region | null) =>
  `${region ? `region=${region}&` : ""}month=${t.month + 1}&water=${t.water}&species=${t.species}`;

export function Trip({ query }: { query: string }) {
  const [stored, storeRegion] = useRegion();
  const [trip, setTrip] = useState(() => readQuery(query));
  // A linked trip's region is shown without changing the visitor's own; choosing one keeps it.
  const region = trip.region ?? stored;
  const chooseRegion = (r: Region) => {
    storeRegion(r);
    setTrip({ ...trip, region: r });
  };
  const box = useStoredSet(FLY_BOX_KEY);
  const owned = useStoredSet(INVENTORY_KEY);
  const renders = useRenders();
  useEffect(() => {
    document.title = t.site.titled(t.trip.title);
  }, []);
  // The choices go into the address; an address changed from outside (Back, a link) changes them.
  const written = useRef<string | null>(null);
  useEffect(() => {
    written.current = writeQuery(trip, region);
    replaceUrl(href.trip(written.current));
  }, [trip, region]);
  useEffect(() => {
    if (written.current === null || query === written.current) return;
    // "Plan a trip" from the page itself keeps the choices.
    if (query === "") replaceUrl(href.trip(written.current));
    else setTrip(readQuery(query));
  }, [query]);
  const suggestions = useMemo(
    () => (region ? suggestBox(PATTERNS.map((p) => p.recipe), NATURALS, { region, ...trip }) : []),
    [region, trip],
  );
  const chosen = suggestions.slice(0, BOX_SIZE);
  const more = suggestions.slice(BOX_SIZE);
  const allIn = chosen.length > 0 && chosen.every((s) => box.has(s.recipe.id));

  const item = (s: Suggestion) => {
    const info = renders?.[s.recipe.id];
    const missing = owned.values.size > 0 ? missingKinds(coverage(s.recipe, owned.values)) : null;
    return (
      <li key={s.recipe.id} className="trip-fly">
        <a className="trip-picture" href={href.fly(s.recipe.id)} tabIndex={-1} aria-hidden="true">
          {info && <img src={renderUrls(s.recipe.id, info).card} alt="" width={150} height={100} loading="lazy" />}
        </a>
        <div>
          <a href={href.fly(s.recipe.id)} className="trip-name">
            {s.recipe.name}
          </a>
          {s.sizes.length > 0 && <span className="trip-sizes">{t.trip.size(sizesText(s.sizes))}</span>}
          <p className="trip-why">
            {s.matches.length > 0 ? (
              <>
                {t.trip.for2}
                {s.matches.map((n, i) => (
                  <span key={n.id}>
                    {i > 0 && (i === s.matches.length - 1 ? t.trip.and : ", ")}
                    <a href={href.natural(n.id)}>{n.name.toLowerCase()}</a>
                  </span>
                ))}
              </>
            ) : (
              t.trip.inSeason
            )}
            {missing !== null && (missing === 0 ? t.trip.canTie : t.trip.needs(missing))}.
          </p>
        </div>
        <button
          className="link-button"
          aria-pressed={box.has(s.recipe.id)}
          aria-label={`${s.recipe.name}: ${box.has(s.recipe.id) ? t.trip.inBox : t.trip.add}`}
          onClick={() => box.toggle(s.recipe.id)}
        >
          {box.has(s.recipe.id) ? t.trip.inBox : t.trip.add}
        </button>
      </li>
    );
  };

  return (
    <main className="reading trip-page">
      <BenchNav current="trip" />
      <h1>{t.trip.heading}</h1>
      <p className="lede">{t.trip.intro}</p>

      <fieldset className="chips region-choice">
        <legend>{t.trip.where}</legend>
        {REGIONS.map((r) => (
          <button key={r} className={region === r ? "on" : ""} aria-pressed={region === r} onClick={() => chooseRegion(r)}>
            {REGION_LABELS[r]}
          </button>
        ))}
      </fieldset>
      <fieldset className="chips region-choice">
        <legend>{t.trip.water}</legend>
        {WATERS.map((w) => (
          <button key={w} className={trip.water === w ? "on" : ""} aria-pressed={trip.water === w} onClick={() => setTrip({ ...trip, water: w })}>
            {WATER_LABELS[w]}
          </button>
        ))}
      </fieldset>
      <div className="trip-selects">
        <label>
          {t.trip.when}{" "}
          <select value={trip.month} onChange={(e) => setTrip({ ...trip, month: Number(e.target.value) })}>
            {MONTH_NAMES.map((m, i) => (
              <option key={m} value={i}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t.trip.for}{" "}
          <select value={trip.species} onChange={(e) => setTrip({ ...trip, species: e.target.value as Species })}>
            {SPECIES.map((s) => (
              <option key={s} value={s}>
                {SPECIES_LABELS[s].toLowerCase()}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!region ? (
        <p>{t.trip.chooseWhere}</p>
      ) : suggestions.length === 0 ? (
        <p>{t.trip.none}</p>
      ) : (
        <>
          <h2>{t.trip.heading2(SPECIES_LABELS[trip.species], MONTH_NAMES[trip.month]!, REGION_LABELS[region])}</h2>
          <ul className="trip-flies">{chosen.map(item)}</ul>
          <p>
            <button
              className="box-toggle"
              disabled={allIn}
              onClick={() => chosen.forEach((s) => box.set(s.recipe.id, true))}
            >
              {allIn ? t.trip.allIn : t.trip.addAll(chosen.length)}
            </button>{" "}
            {box.values.size > 0 && <a href={href.box()}>{t.trip.boxLink}</a>}
          </p>
          {more.length > 0 && (
            <details className="trip-more">
              <summary>{t.trip.more(more.length)}</summary>
              <ul className="trip-flies">{more.map(item)}</ul>
            </details>
          )}
          <p className="stored-note">{t.trip.note(linkTo(href.naturals()))}</p>
        </>
      )}
    </main>
  );
}
