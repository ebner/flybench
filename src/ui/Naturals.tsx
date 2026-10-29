import { useEffect, useRef, useState } from "react";
import {
  activeIn,
  GROUP_LABELS,
  hatchMonths,
  hatchText,
  imitatedBy,
  matchingHookSizes,
  REGION_LABELS,
  RIDES_TEXT,
  sizeText,
  STAGE_LABELS,
  type Region,
} from "../catalog/naturals";
import { findNatural, localNaturals } from "../naturals";
import { CATALOG, PATTERNS } from "../patterns";
import { NATURAL_GROUPS, REGIONS, type Natural } from "../recipe/natural";
import { MONTH_NAMES } from "../i18n/months";
import { FlyScene, naturalAlone, naturalFishing } from "../render/FlyScene";
import { WATER_LOOKS } from "../render/water";
import { realisticCapable } from "./realistic";
import { useRealAssets } from "./Viewer";
import { Plate } from "./Gallery";
import { NotFound } from "./NotFound";
import { useNaturalPictures, useNaturalStills, useRenders, useWaterStills } from "./renders";
import { href } from "./router";
import { t } from "../i18n/ui";
import { lang } from "../i18n/lang";
import { linkTo } from "./linkTo";
import { REGION_KEY, useStoredSet } from "./storage";

const recipes = () => PATTERNS.map((p) => p.recipe);
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);


/** Where a natural is best seen in the water: from above if it floats, else from below. */
const seenFrom = (n: Natural): "angler" | "below" => (n.rides === "on-surface" || n.rides === "in-film" ? "angler" : "below");

/**
 * The natural: in the realistic water where the device can take it (a path-traced picture first,
 * the live river when the visitor asks), else turning in 3D on its own.
 */
export function NaturalViewer({ natural }: { natural: Natural }) {
  const container = useRef<HTMLDivElement>(null);
  const scene = useRef<FlyScene | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [capable] = useState(realisticCapable);
  const stills = useWaterStills("naturals", natural.id);
  const [view, setView] = useState<"angler" | "below">(() => seenFrom(natural));
  const [explore, setExplore] = useState(false);
  // The pictures for every device; exploring gives the live river where the device can take it,
  // else the natural turning on its own.
  const inWater = !!stills;
  const { assets, failed } = useRealAssets(capable && inWater && explore);
  const live = capable && inWater && explore && assets && !failed ? assets : null;
  // The pictures until the live river is there (and again if it fails to load).
  const [broken, setBroken] = useState<string | null>(null);
  const pick = stills && !live ? stills[view] : null;
  const still = pick !== broken ? pick : null;
  const tools = useRef<HTMLDivElement>(null);
  const exploreFocused = useRef(false);
  useEffect(() => {
    if (!still && exploreFocused.current) {
      exploreFocused.current = false;
      tools.current?.querySelector("button")?.focus();
    }
  }, [still]);
  useEffect(() => {
    let s: FlyScene;
    try {
      // The stills' field of view, so the live river takes over without a jump.
      s = new FlyScene(container.current!, { background: null, fov: 20 });
    } catch {
      setUnavailable(true);
      return;
    }
    // At its real size against the gravel and ripples, as in the stills.
    s.setNatural(natural, naturalAlone(natural));
    s.setView("default");
    scene.current = s;
    return () => {
      s.dispose();
      scene.current = null;
    };
  }, [natural]);
  useEffect(() => {
    scene.current?.setWater(live ? { fishing: naturalFishing(natural), view, still: false, look: WATER_LOOKS.light, real: live } : null);
  }, [live, view, natural]);
  // Without WebGL the pictures still show, with nothing to explore.
  if (unavailable && !still) return <p className="viewer-unavailable">{t.naturals.noWebgl}</p>;
  return (
    <div className={still || live ? "natural-viewer in-water" : "natural-viewer"}>
      <div className="natural-canvas" ref={container} />
      {still && (
        <figure className="water-still">
          <img src={still} alt={t.viewer.stillAlt(view)} onError={() => setBroken(still)} />
          {!unavailable && capable && !failed && (
            <button
              className="water-explore"
              onClick={(e) => {
                exploreFocused.current = e.currentTarget === document.activeElement;
                setExplore(true);
              }}
              title={t.viewer.exploreTitle}
              aria-busy={explore}
            >
              {explore ? t.viewer.loadingRiver : t.viewer.explore}
            </button>
          )}
        </figure>
      )}
      {inWater && (still || live) && (
        <div className="viewer-tools" ref={tools}>
          <button aria-pressed={view === "angler"} onClick={() => setView("angler")} title={t.viewer.aboveTitle}>
            {t.viewer.above}
          </button>
          <button aria-pressed={view === "below"} onClick={() => setView("below")} title={t.viewer.belowTitle}>
            {t.viewer.below}
          </button>
        </div>
      )}
    </div>
  );
}

export function useRegion(): [Region | null, (r: Region) => void] {
  const stored = useStoredSet(REGION_KEY);
  const region = REGIONS.find((r) => stored.has(r)) ?? null;
  const choose = (r: Region) => {
    for (const v of stored.values) if (v !== r) stored.set(v, false);
    stored.set(r, true);
  };
  return [region, choose];
}

function NaturalCard({ natural, picture, photo }: { natural: Natural; picture?: string; photo?: string }) {
  return (
    <li className="natural-card">
      <a href={href.natural(natural.id)}>
        <div className={photo ? "natural-card-image photo" : "natural-card-image"}>
          {(photo ?? picture) && <img src={photo ?? picture} alt="" width={480} height={320} loading="lazy" />}
        </div>
        <h3>{natural.name}</h3>
        <p className="plate-facts">
          {capitalize(STAGE_LABELS[natural.stage])}, {sizeText(natural)}
        </p>
      </a>
    </li>
  );
}

export function NaturalsIndex() {
  const pictures = useNaturalPictures();
  const stills = useNaturalStills();
  const [region, chooseRegion] = useRegion();
  const month = new Date().getMonth();
  useEffect(() => {
    document.title = t.site.titled(t.naturals.title);
  }, [lang()]);
  const naturals = localNaturals();
  const now = region ? activeIn(naturals, region, month) : [];
  // Naturals about all year (shrimps, fish, larvae) are listed apart, so the calendar shows the hatches.
  const hatchFor = (n: Natural) => n.hatches.find((h) => h.region === region);
  const allYear = (n: Natural) => hatchMonths(hatchFor(n)!).length === 12;
  const withHatch = region ? naturals.filter((n) => hatchFor(n) && !allYear(n)) : [];
  const yearRound = region ? naturals.filter((n) => hatchFor(n) && allYear(n)) : [];

  return (
    <main className="reading naturals-page">
      <h1>{t.naturals.heading}</h1>
      <p className="lede">{t.naturals.intro}</p>

      <h2>{t.naturals.calendar}</h2>
      <fieldset className="chips region-choice">
        <legend>{t.naturals.where}</legend>
        {REGIONS.map((r) => (
          <button key={r} className={region === r ? "on" : ""} aria-pressed={region === r} onClick={() => chooseRegion(r)}>
            {REGION_LABELS[r]}
          </button>
        ))}
      </fieldset>
      {region ? (
        <>
          <p className="stored-note">{t.naturals.stored(linkTo(href.trip()))}</p>
          <div className="hatch-scroll">
            <table className="hatch-calendar">
              <thead>
                <tr>
                  <th scope="col">{t.naturals.natural}</th>
                  {MONTH_NAMES.map((m, i) => (
                    <th key={m} scope="col" className={i === month ? "current" : undefined} title={m} aria-label={m}>
                      <span aria-hidden="true">{m.charAt(0).toUpperCase()}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {withHatch.map((n) => {
                  const hatch = n.hatches.find((h) => h.region === region)!;
                  const months = hatchMonths(hatch);
                  return (
                    <tr key={n.id}>
                      <th scope="row">
                        <a href={href.natural(n.id)}>{n.name}</a>
                      </th>
                      {MONTH_NAMES.map((m, i) => (
                        <td key={m} className={[months.includes(i) ? "on" : "", i === month ? "current" : ""].join(" ").trim() || undefined}>
                          <span className="visually-hidden">{months.includes(i) ? m : ""}</span>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {yearRound.length > 0 && (
            <p className="year-round">
              {t.naturals.allYear}
              {yearRound.map((n, i) => (
                <span key={n.id}>
                  {i > 0 && ", "}
                  <a href={href.natural(n.id)}>{n.name}</a>
                </span>
              ))}
              .
            </p>
          )}

          <h2>{t.naturals.monthIn(MONTH_NAMES[month]!, REGION_LABELS[region])}</h2>
          {now.length === 0 ? (
            <p>{t.naturals.quiet}</p>
          ) : (
            <ul className="this-month">
              {now.map(({ natural, hatch }) => {
                const flies = imitatedBy(recipes(), natural.id);
                return (
                  <li key={natural.id}>
                    <a href={href.natural(natural.id)}>{natural.name}</a>
                    {hatch.time && <span className="when">, {hatch.time}</span>}
                    {flies.length > 0 && (
                      <>
                        {": "}
                        {flies.slice(0, 4).map((r, i) => (
                          <span key={r.id}>
                            {i > 0 && ", "}
                            <a href={href.fly(r.id)}>{r.name}</a>
                          </span>
                        ))}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : (
        <p>{t.naturals.choose}</p>
      )}

      {NATURAL_GROUPS.map((g) => {
        const inGroup = naturals.filter((n) => n.group === g);
        if (inGroup.length === 0) return null;
        return (
          <section key={g}>
            <h2>{GROUP_LABELS[g]}</h2>
            <ul className="natural-cards">
              {inGroup.map((n) => (
                <NaturalCard key={n.id} natural={n} picture={pictures?.[n.id]} photo={stills?.[n.id]?.[seenFrom(n)]} />
              ))}
            </ul>
          </section>
        );
      })}
    </main>
  );
}

export function NaturalPage({ id }: { id: string }) {
  const natural = findNatural(id);
  const renders = useRenders();
  useEffect(() => {
    if (natural) document.title = t.site.titled(natural.name);
  }, [natural, lang()]);
  if (!natural) {
    return (
      <NotFound className="reading" heading={t.notFound.natural(id)}>
        <p>
          <a href={href.naturals()}>{t.notFound.allNaturals}</a>
        </p>
      </NotFound>
    );
  }
  const flies = imitatedBy(recipes(), natural.id);
  const sizes = matchingHookSizes(natural);
  return (
    <main className="reading natural-page">
      <a className="back" href={href.naturals()}>
        {t.naturals.all}
      </a>
      <h1>{natural.name}</h1>
      <p className="lede">{natural.description}</p>
      <NaturalViewer key={natural.id} natural={natural} />
      <dl className="natural-facts">
        <div>
          <dt>{t.naturals.group}</dt>
          <dd>
            {GROUP_LABELS[natural.group]}, {STAGE_LABELS[natural.stage]}
          </dd>
        </div>
        {natural.examples && (
          <div>
            <dt>{t.naturals.examples}</dt>
            <dd>{capitalize(natural.examples)}</dd>
          </div>
        )}
        <div>
          <dt>{t.naturals.size}</dt>
          <dd>
            {sizeText(natural)}
            {sizes.length > 0 && t.naturals.sizes(sizes[sizes.length - 1]!, sizes[0]!)}
          </dd>
        </div>
        <div>
          <dt>{t.naturals.inTheWater}</dt>
          <dd>{RIDES_TEXT[natural.rides]}</dd>
        </div>
      </dl>

      {natural.hatches.length > 0 && (
        <>
          <h2>{t.naturals.hatches}</h2>
          <table className="hatch-table">
            <tbody>
              {natural.hatches.map((h) => (
                <tr key={h.region}>
                  <th scope="row">{REGION_LABELS[h.region]}</th>
                  <td>
                    {hatchText(h)}
                    {h.time && `, ${h.time}`}
                    {h.note && <span className="hatch-note"> {h.note}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h2>{t.naturals.flies}</h2>
      {flies.length === 0 ? (
        <p>{t.naturals.noFly}</p>
      ) : (
        <ul className="plates">
          {flies.map((r) => {
            const entry = CATALOG.find((e) => e.recipe.id === r.id)!;
            return <Plate key={r.id} entry={entry} render={renders?.[r.id]} />;
          })}
        </ul>
      )}

      <h2>{t.naturals.sources}</h2>
      <ul className="sources">
        {natural.sources.map((s) => (
          <li key={s.title}>{s.url ? <a href={s.url}>{s.title}</a> : s.title}</li>
        ))}
      </ul>
    </main>
  );
}
