import { useEffect, useMemo, useState } from "react";
import { bestCoverage, catalogNeeds, colorWord, inventoryKey, missingKinds, shoppingList, type Need } from "../catalog/inventory";
import { CATALOG, findPattern } from "../patterns";
import { MATERIALS, type MaterialKind } from "../recipe/materials";
import { resolveColor } from "../recipe/schema";
import { Plate } from "./Gallery";
import { useRenders, useSwatches } from "./renders";
import { swatchName } from "../catalog/swatch";
import { href } from "./router";
import { coloursSpec, coloursText, parseBoxEntry, parseColours, recolor } from "../catalog/variation";
import { FlyScene } from "../render/FlyScene";
import { simulate } from "../tying/simulate";
import { ridesPointUp } from "../tying/hook";
import type { Recipe } from "../recipe/schema";
import { FLY_BOX_KEY, INVENTORY_KEY, useStoredSet } from "./storage";

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const STORED_NOTE =
  "Saved in this browser only: clearing your browsing data starts it empty again, and another browser or device has its own.";

/** Links between the visitor's own pages. */
export function BenchNav({ current }: { current: "box" | "log" | "materials" | "trip" }) {
  const links = [
    ["box", href.box(), "Fly box"],
    ["log", href.log(), "Tying log"],
    ["materials", href.materials(), "Materials"],
    ["trip", href.trip(), "Plan a trip"],
  ] as const;
  return (
    <nav className="bench-nav" aria-label="Your bench">
      {links.map(([id, url, name]) => (
        <a key={id} href={url} aria-current={id === current ? "page" : undefined}>
          {name}
        </a>
      ))}
    </nav>
  );
}

/**
 * Pictures of flies in the visitor's colours, drawn here in one offscreen 3D view (the
 * gallery's pictures are of the patterns as tied). null while drawing, or without WebGL.
 */
function useVariationPictures(flies: { key: string; recipe: Recipe }[]): Record<string, string | null> {
  const [pictures, setPictures] = useState<Record<string, string>>({});
  const keys = flies.map((f) => f.key).join("\n");
  useEffect(() => {
    if (flies.length === 0) return;
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;left:-10000px;top:0;width:600px;height:400px";
    document.body.appendChild(host);
    let scene: FlyScene | null = null;
    const drawn: Record<string, string> = {};
    try {
      scene = new FlyScene(host, { background: null, fov: 20 });
      for (const f of flies) {
        const build = simulate(f.recipe);
        scene.setBuild(build);
        // As the gallery pictures them: point-up flies point up.
        scene.setTurnedOver(ridesPointUp(f.recipe));
        scene.setTime(build.duration);
        scene.setView("default");
        drawn[f.key] = scene.snapshot().toDataURL("image/png");
      }
    } catch {
      // No WebGL: the plates go without pictures.
    }
    scene?.dispose();
    host.remove();
    setPictures(drawn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys]);
  return Object.fromEntries(flies.map((f) => [f.key, pictures[f.key] ?? null]));
}

export function FlyBox() {
  const box = useStoredSet(FLY_BOX_KEY);
  const renders = useRenders();
  useEffect(() => {
    document.title = "Fly box, Flybench";
  }, []);
  const saved = CATALOG.filter((e) => box.has(e.recipe.id));
  // Flies saved in the visitor's colours: "id?colours=…" entries.
  const variations = [...box.values].flatMap((value) => {
    const { id, colours } = parseBoxEntry(value);
    const recipe = findPattern(id)?.recipe;
    const entry = recipe && CATALOG.find((e) => e.recipe.id === (recipe.variantOf ?? recipe.id));
    if (!colours || !recipe || !entry) return [];
    const parsed = parseColours(colours, recipe);
    return Object.keys(parsed).length
      ? [{ value, recipe: recolor(recipe, parsed), entry, colours: coloursSpec(parsed, recipe), text: coloursText(parsed, recipe) }]
      : [];
  });
  const pictures = useVariationPictures(useMemo(() => variations.map((v) => ({ key: v.value, recipe: v.recipe })), [variations.map((v) => v.value).join("\n")]));
  return (
    <main className="gallery">
      <BenchNav current="box" />
      <section className="intro">
        <h1>Your fly box</h1>
        <p>Flies you have saved.</p>
        <p className="stored-note">{STORED_NOTE}</p>
      </section>
      {saved.length === 0 && variations.length === 0 ? (
        <div className="empty-results">
          <p>Your fly box is empty.</p>
          <p>
            Open a pattern and choose “Add to fly box” to keep it here. <a href={href.gallery()}>Browse the patterns</a>.
          </p>
        </div>
      ) : (
        <>
          <ul className="plates boxed">
            {saved.map((e) => (
              <Plate key={e.recipe.id} entry={e} render={renders?.[e.recipe.id]} />
            ))}
          </ul>
          {variations.length > 0 && (
            <>
              <h2 className="box-heading">In your colours</h2>
              <ul className="plates boxed">
                {variations.map((v) => (
                  <Plate
                    key={v.value}
                    entry={v.entry}
                    render={renders?.[v.entry.recipe.id]}
                    picture={pictures[v.value]}
                    link={href.fly(v.recipe.id, undefined, undefined, v.colours)}
                    note={`${v.recipe.variant ? `${v.recipe.variant}. ` : ""}${v.text}`}
                    action={
                      <button className="link-button plate-remove" onClick={() => box.set(v.value, false)}>
                        Remove from your fly box
                      </button>
                    }
                  />
                ))}
              </ul>
            </>
          )}
          <ShoppingList flies={[...saved.map((e) => ({ recipe: e.recipe, name: e.recipe.name })), ...variations.map((v) => ({ recipe: v.recipe, name: `${v.recipe.name} (your colours)` }))]} />
        </>
      )}
    </main>
  );
}

/** What the flies in the box still need, merged across them, less what the Materials page says is owned. */
function ShoppingList({ flies }: { flies: { recipe: Recipe; name: string }[] }) {
  const owned = useStoredSet(INVENTORY_KEY);
  const [copied, setCopied] = useState(false);
  const list = shoppingList(
    flies.map((f) => f.recipe),
    owned.values,
  );
  const nameOf = (r: Recipe) => flies.find((f) => f.recipe === r)!.name;
  const material = (n: Need) => {
    const colour = colorWord(n.color, n.kind);
    return capitalize(`${colour === "natural" ? "" : `${colour} `}${MATERIALS[n.kind].name}`);
  };
  const missing = list.filter((i) => i.status === "missing");
  const substitutes = list.filter((i) => i.status === "substitute");
  const lines = (items: typeof list) =>
    items.map((i) => (
      <li key={inventoryKey(i.need)}>
        <strong>{material(i.need)}</strong> for {i.flies.map(nameOf).join(", ")}
      </li>
    ));
  const text = [
    ...missing.map((i) => `${material(i.need)} (${i.flies.map(nameOf).join(", ")})`),
    ...substitutes.map((i) => `${material(i.need)}, or use another colour you have (${i.flies.map(nameOf).join(", ")})`),
  ].join("\n");
  return (
    <section className="shopping">
      <h2 className="box-heading">Shopping list</h2>
      <p className="stored-note">
        {owned.values.size === 0 ? (
          <>
            Everything these flies need. Tick what you already have on <a href={href.materials()}>your materials</a> page,
            and this list leaves it out. Hooks and thread are left out too.
          </>
        ) : (
          <>
            What these flies need, less what you have ticked on <a href={href.materials()}>your materials</a> page. Hooks
            and thread are left out.
          </>
        )}
      </p>
      {list.length === 0 ? (
        <p>You have everything these flies need.</p>
      ) : (
        <>
          {missing.length > 0 && <ul className="shopping-list">{lines(missing)}</ul>}
          {substitutes.length > 0 && (
            <>
              <h3>You have these in another colour</h3>
              <ul className="shopping-list">{lines(substitutes)}</ul>
            </>
          )}
          <p>
            <button
              className="box-toggle"
              onClick={() =>
                navigator.clipboard?.writeText(text).then(
                  () => setCopied(true),
                  () => setCopied(false),
                )
              }
            >
              Copy the list
            </button>{" "}
            <span aria-live="polite">{copied ? "Copied." : ""}</span>
          </p>
        </>
      )}
    </section>
  );
}

export function Materials() {
  const owned = useStoredSet(INVENTORY_KEY);
  const swatches = useSwatches();
  useEffect(() => {
    document.title = "Your materials, Flybench";
  }, []);
  const byKind = useMemo(() => catalogNeeds(CATALOG.flatMap((e) => [e.recipe, ...e.variants])), []);
  const kinds = [...byKind.keys()].sort((a, b) => MATERIALS[a].name.localeCompare(MATERIALS[b].name));
  const family = (e: (typeof CATALOG)[number]) => missingKinds(bestCoverage([e.recipe, ...e.variants], owned.values));
  const tieable = CATALOG.filter((e) => family(e) === 0);
  const oneShort = CATALOG.filter((e) => family(e) === 1);

  return (
    <main className="reading materials-page">
      <BenchNav current="materials" />
      <h1>Your materials</h1>
      <p className="lede">
        Tick what you have. The gallery can then show what you can tie now, and what you are one material short of.
        Another colour of the same material counts as a substitute.
      </p>
      <p className="stored-note">{STORED_NOTE}</p>
      <p className="summary" aria-live="polite">
        {owned.values.size === 0 ? (
          "Nothing ticked yet."
        ) : (
          <>
            You can tie {tieable.length} {tieable.length === 1 ? "pattern" : "patterns"}
            {oneShort.length > 0 && <>, and {oneShort.length} more with one material added</>}.{" "}
            <a href={href.gallery("have=1")}>Show them</a>
          </>
        )}
      </p>
      <ul className="inventory">
        {kinds.map((kind: MaterialKind) => (
          <li key={kind}>
            <span className="inventory-name">{capitalize(MATERIALS[kind].name)}</span>
            <span className="chips">
              {byKind.get(kind)!.map((color) => {
                const key = inventoryKey({ kind, color });
                const on = owned.has(key);
                const picture = swatches?.[swatchName(kind, color)];
                return (
                  <button key={key} className={picture ? (on ? "on pictured" : "pictured") : on ? "on" : ""} aria-pressed={on} onClick={() => owned.toggle(key)}>
                    {picture ? (
                      <img src={picture} alt="" width={120} height={90} loading="lazy" />
                    ) : (
                      <span className="swatch" style={{ background: resolveColor(color === "natural" ? "#999999" : color) }} aria-hidden="true" />
                    )}
                    <span>{colorWord(color, kind)}</span>
                  </button>
                );
              })}
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
