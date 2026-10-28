import { useEffect, useRef, useState } from "react";
import {
  activeIn,
  GROUP_LABELS,
  hatchMonths,
  imitatedBy,
  matchingHookSizes,
  REGION_LABELS,
  RIDES_TEXT,
  sizeText,
  STAGE_LABELS,
  type Region,
} from "../catalog/naturals";
import { NATURALS, findNatural } from "../naturals";
import { CATALOG, PATTERNS } from "../patterns";
import { NATURAL_GROUPS, REGIONS, type Natural } from "../recipe/natural";
import { MONTHS } from "../recipe/schema";
import { FlyScene } from "../render/FlyScene";
import { Plate } from "./Gallery";
import { NotFound } from "./NotFound";
import { useNaturalPictures, useRenders } from "./renders";
import { href } from "./router";
import { REGION_KEY, useStoredSet } from "./storage";

const recipes = () => PATTERNS.map((p) => p.recipe);
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const MONTH_NAMES = MONTHS.map(capitalize);

/** The natural turning in 3D, on its own. */
export function NaturalViewer({ natural }: { natural: Natural }) {
  const container = useRef<HTMLDivElement>(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    let scene: FlyScene;
    try {
      scene = new FlyScene(container.current!, { background: null, fov: 20 });
    } catch {
      setUnavailable(true);
      return;
    }
    scene.setNatural(natural);
    scene.setView("default");
    return () => scene.dispose();
  }, [natural]);
  if (unavailable) return <p className="viewer-unavailable">The 3D view needs WebGL, which this browser has turned off.</p>;
  return <div className="natural-viewer" ref={container} />;
}

/** The visitor's region, kept in this browser; none until they choose one. */
function useRegion(): [Region | null, (r: Region) => void] {
  const stored = useStoredSet(REGION_KEY);
  const region = REGIONS.find((r) => stored.has(r)) ?? null;
  const choose = (r: Region) => {
    for (const v of stored.values) if (v !== r) stored.set(v, false);
    stored.set(r, true);
  };
  return [region, choose];
}

function NaturalCard({ natural, picture }: { natural: Natural; picture?: string }) {
  return (
    <li className="natural-card">
      <a href={href.natural(natural.id)}>
        <div className="natural-card-image">{picture && <img src={picture} alt="" width={480} height={320} loading="lazy" />}</div>
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
  const [region, chooseRegion] = useRegion();
  const month = new Date().getMonth();
  useEffect(() => {
    document.title = "Naturals and hatches, Flybench";
  }, []);
  const now = region ? activeIn(NATURALS, region, month) : [];
  // Naturals about all year (shrimps, fish, larvae) are listed apart, so the calendar shows the hatches.
  const hatchFor = (n: Natural) => n.hatches.find((h) => h.region === region);
  const allYear = (n: Natural) => hatchMonths(hatchFor(n)!).length === 12;
  const withHatch = region ? NATURALS.filter((n) => hatchFor(n) && !allYear(n)) : [];
  const yearRound = region ? NATURALS.filter((n) => hatchFor(n) && allYear(n)) : [];

  return (
    <main className="reading naturals-page">
      <h1>Naturals and hatches</h1>
      <p className="lede">
        What the flies imitate: the insects, shrimps and small fish trout and salmon feed on, each at the stage the flies
        copy, and when they hatch where you fish.
      </p>

      <h2>Hatch calendar</h2>
      <fieldset className="chips region-choice">
        <legend>Where do you fish?</legend>
        {REGIONS.map((r) => (
          <button key={r} className={region === r ? "on" : ""} aria-pressed={region === r} onClick={() => chooseRegion(r)}>
            {REGION_LABELS[r]}
          </button>
        ))}
      </fieldset>
      {region ? (
        <>
          <p className="stored-note">
            Your region is saved in this browser. Months are when each natural hatches or is most about; dates move with
            altitude, water temperature and the year.
          </p>
          <div className="hatch-scroll">
            <table className="hatch-calendar">
              <thead>
                <tr>
                  <th scope="col">Natural</th>
                  {MONTH_NAMES.map((m, i) => (
                    <th key={m} scope="col" className={i === month ? "now" : undefined} title={m}>
                      {m.charAt(0)}
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
                        <td key={m} className={[months.includes(i) ? "on" : "", i === month ? "now" : ""].join(" ").trim() || undefined}>
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
              About all year:{" "}
              {yearRound.map((n, i) => (
                <span key={n.id}>
                  {i > 0 && ", "}
                  <a href={href.natural(n.id)}>{n.name}</a>
                </span>
              ))}
              .
            </p>
          )}

          <h2>
            {MONTH_NAMES[month]} in {REGION_LABELS[region]}
          </h2>
          {now.length === 0 ? (
            <p>Nothing much hatches this month; nymphs, shrimps and small fish are about all year.</p>
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
        <p>Choose your region to see what hatches when.</p>
      )}

      {NATURAL_GROUPS.map((g) => {
        const naturals = NATURALS.filter((n) => n.group === g);
        if (naturals.length === 0) return null;
        return (
          <section key={g}>
            <h2>{GROUP_LABELS[g]}</h2>
            <ul className="natural-cards">
              {naturals.map((n) => (
                <NaturalCard key={n.id} natural={n} picture={pictures?.[n.id]} />
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
    if (natural) document.title = `${natural.name}, Flybench`;
  }, [natural]);
  if (!natural) {
    return (
      <NotFound className="reading" heading={<>No natural called “{id}”</>}>
        <p>
          <a href={href.naturals()}>See all naturals</a>
        </p>
      </NotFound>
    );
  }
  const flies = imitatedBy(recipes(), natural.id);
  const sizes = matchingHookSizes(natural);
  return (
    <main className="reading natural-page">
      <a className="back" href={href.naturals()}>
        All naturals
      </a>
      <h1>{natural.name}</h1>
      <p className="lede">{natural.description}</p>
      <NaturalViewer natural={natural} />
      <dl className="natural-facts">
        <div>
          <dt>Group</dt>
          <dd>
            {GROUP_LABELS[natural.group]}, {STAGE_LABELS[natural.stage]}
          </dd>
        </div>
        {natural.examples && (
          <div>
            <dt>For example</dt>
            <dd>{capitalize(natural.examples)}</dd>
          </div>
        )}
        <div>
          <dt>Size</dt>
          <dd>
            {sizeText(natural)}
            {sizes.length > 0 && `, about the shank of a standard hook in sizes ${sizes[sizes.length - 1]}–${sizes[0]}`}
          </dd>
        </div>
        <div>
          <dt>In the water</dt>
          <dd>{RIDES_TEXT[natural.rides]}</dd>
        </div>
      </dl>

      {natural.hatches.length > 0 && (
        <>
          <h2>When it hatches</h2>
          <table className="hatch-table">
            <tbody>
              {natural.hatches.map((h) => (
                <tr key={h.region}>
                  <th scope="row">{REGION_LABELS[h.region]}</th>
                  <td>
                    {h.from === "january" && h.to === "december" ? "All year" : `${capitalize(h.from)} to ${h.to}`}
                    {h.time && `, ${h.time}`}
                    {h.note && <span className="hatch-note"> {h.note}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h2>Flies that imitate it</h2>
      {flies.length === 0 ? (
        <p>No pattern in Flybench imitates it yet.</p>
      ) : (
        <ul className="plates">
          {flies.map((r) => {
            const entry = CATALOG.find((e) => e.recipe.id === r.id)!;
            return <Plate key={r.id} entry={entry} render={renders?.[r.id]} />;
          })}
        </ul>
      )}

      <h2>Sources</h2>
      <ul className="sources">
        {natural.sources.map((s) => (
          <li key={s.title}>{s.url ? <a href={s.url}>{s.title}</a> : s.title}</li>
        ))}
      </ul>
    </main>
  );
}
