import { useEffect, useMemo, useState } from "react";
import { SPECIES_LABELS } from "../catalog/describe";
import { coverage, missingKinds } from "../catalog/inventory";
import { REGION_LABELS } from "../catalog/naturals";
import { sizesText, suggestBox, WATER_LABELS, type Species, type Suggestion, type Water } from "../catalog/trip";
import { NATURALS } from "../naturals";
import { PATTERNS } from "../patterns";
import { REGIONS } from "../recipe/natural";
import { MONTHS, SPECIES } from "../recipe/schema";
import { useRegion } from "./Naturals";
import { BenchNav } from "./Personal";
import { renderUrls, useRenders } from "./renders";
import { href, replaceUrl } from "./router";
import { FLY_BOX_KEY, INVENTORY_KEY, useStoredSet } from "./storage";

const MONTH_NAMES = MONTHS.map((m) => m.charAt(0).toUpperCase() + m.slice(1));
const WATERS = Object.keys(WATER_LABELS) as Water[];
/** How many flies make the box; the rest are listed under it. */
const BOX_SIZE = 12;

/** The trip as the address has it: ?month=6&water=river&species=trout (month 1-based). */
function readQuery(): { month: number; water: Water; species: Species } {
  const q = new URLSearchParams(location.search);
  const month = Number(q.get("month"));
  const water = q.get("water");
  const species = q.get("species");
  return {
    month: Number.isInteger(month) && month >= 1 && month <= 12 ? month - 1 : new Date().getMonth(),
    water: WATERS.includes(water as Water) ? (water as Water) : "river",
    species: SPECIES.includes(species as Species) ? (species as Species) : "trout",
  };
}

export function Trip() {
  const [region, chooseRegion] = useRegion();
  const [trip, setTrip] = useState(readQuery);
  const box = useStoredSet(FLY_BOX_KEY);
  const owned = useStoredSet(INVENTORY_KEY);
  const renders = useRenders();
  useEffect(() => {
    document.title = "A fly box for a trip, Flybench";
  }, []);
  useEffect(() => {
    replaceUrl(href.trip(`month=${trip.month + 1}&water=${trip.water}&species=${trip.species}`));
  }, [trip]);
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
          {s.sizes.length > 0 && <span className="trip-sizes">, size {sizesText(s.sizes)}</span>}
          <p className="trip-why">
            {s.matches.length > 0 ? (
              <>
                For{" "}
                {s.matches.map((n, i) => (
                  <span key={n.id}>
                    {i > 0 && (i === s.matches.length - 1 ? " and " : ", ")}
                    <a href={href.natural(n.id)}>{n.name.toLowerCase()}</a>
                  </span>
                ))}
              </>
            ) : (
              "In season"
            )}
            {missing !== null && (missing === 0 ? ". You can tie it" : `. Needs ${missing} more ${missing === 1 ? "material" : "materials"}`)}.
          </p>
        </div>
        <button className="link-button" aria-pressed={box.has(s.recipe.id)} onClick={() => box.toggle(s.recipe.id)}>
          {box.has(s.recipe.id) ? "In your fly box" : "Add to fly box"}
        </button>
      </li>
    );
  };

  return (
    <main className="reading trip-page">
      <BenchNav current="trip" />
      <h1>A fly box for a trip</h1>
      <p className="lede">
        Where and when you fish, and for what: the flies to take, matched to what hatches then, in the sizes to tie them.
      </p>

      <fieldset className="chips region-choice">
        <legend>Where</legend>
        {REGIONS.map((r) => (
          <button key={r} className={region === r ? "on" : ""} aria-pressed={region === r} onClick={() => chooseRegion(r)}>
            {REGION_LABELS[r]}
          </button>
        ))}
      </fieldset>
      <fieldset className="chips region-choice">
        <legend>On what water</legend>
        {WATERS.map((w) => (
          <button key={w} className={trip.water === w ? "on" : ""} aria-pressed={trip.water === w} onClick={() => setTrip({ ...trip, water: w })}>
            {WATER_LABELS[w]}
          </button>
        ))}
      </fieldset>
      <div className="trip-selects">
        <label>
          When{" "}
          <select value={trip.month} onChange={(e) => setTrip({ ...trip, month: Number(e.target.value) })}>
            {MONTH_NAMES.map((m, i) => (
              <option key={m} value={i}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label>
          For{" "}
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
        <p>Choose where you fish to see the flies for it.</p>
      ) : suggestions.length === 0 ? (
        <p>No pattern here suits that water and fish. Try another month or another fish.</p>
      ) : (
        <>
          <h2>
            {SPECIES_LABELS[trip.species]} in {MONTH_NAMES[trip.month]}, {REGION_LABELS[region]}
          </h2>
          <ul className="trip-flies">{chosen.map(item)}</ul>
          <p>
            <button
              className="box-toggle"
              disabled={allIn}
              onClick={() => chosen.forEach((s) => box.set(s.recipe.id, true))}
            >
              {allIn ? "All in your fly box" : `Add all ${chosen.length} to your fly box`}
            </button>{" "}
            {box.values.size > 0 && <a href={href.box()}>Your fly box and shopping list</a>}
          </p>
          {more.length > 0 && (
            <details className="trip-more">
              <summary>{more.length} more that would fish</summary>
              <ul className="trip-flies">{more.map(item)}</ul>
            </details>
          )}
          <p className="stored-note">
            Sizes are matched to the naturals about then, within two sizes of how each pattern is usually tied. Hatches
            move with altitude, water temperature and the year: see the <a href={href.naturals()}>hatch calendar</a>.
          </p>
        </>
      )}
    </main>
  );
}
