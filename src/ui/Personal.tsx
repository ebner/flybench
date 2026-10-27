import { useEffect, useMemo } from "react";
import { catalogNeeds, colorWord, coverage, inventoryKey, missingKinds } from "../catalog/inventory";
import { CATALOG } from "../patterns";
import { MATERIALS, type MaterialKind } from "../recipe/materials";
import { resolveColor } from "../recipe/schema";
import { Plate } from "./Gallery";
import { useRenders } from "./renders";
import { href } from "./router";
import { FLY_BOX_KEY, INVENTORY_KEY, useStoredSet } from "./storage";

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function FlyBox() {
  const box = useStoredSet(FLY_BOX_KEY);
  const renders = useRenders();
  useEffect(() => {
    document.title = "Fly box, Flybench";
  }, []);
  const saved = CATALOG.filter((e) => box.has(e.recipe.id));
  return (
    <main className="gallery">
      <section className="intro">
        <h1>Your fly box</h1>
        <p>Flies you have saved, kept in this browser.</p>
      </section>
      {saved.length === 0 ? (
        <div className="empty-results">
          <p>Your fly box is empty.</p>
          <p>
            Open a pattern and choose “Add to fly box” to keep it here. <a href={href.gallery()}>Browse the patterns</a>.
          </p>
        </div>
      ) : (
        <ul className="plates boxed">
          {saved.map((e) => (
            <Plate key={e.recipe.id} entry={e} render={renders?.[e.recipe.id]} />
          ))}
        </ul>
      )}
    </main>
  );
}

export function Materials() {
  const owned = useStoredSet(INVENTORY_KEY);
  useEffect(() => {
    document.title = "Your materials, Flybench";
  }, []);
  const byKind = useMemo(() => catalogNeeds(CATALOG.flatMap((e) => [e.recipe, ...e.variants])), []);
  const kinds = [...byKind.keys()].sort((a, b) => MATERIALS[a].name.localeCompare(MATERIALS[b].name));
  const tieable = CATALOG.filter((e) => coverage(e.recipe, owned.values).missing.length === 0);
  const oneShort = CATALOG.filter((e) => missingKinds(coverage(e.recipe, owned.values)) === 1);

  return (
    <main className="reading materials-page">
      <h1>Your materials</h1>
      <p className="lede">
        Tick what you have. The gallery can then show what you can tie now, and what you are one material short of.
        Another colour of the same material counts as a substitute.
      </p>
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
                return (
                  <button key={key} className={on ? "on" : ""} aria-pressed={on} onClick={() => owned.toggle(key)}>
                    <span className="swatch" style={{ background: resolveColor(color === "natural" ? "#999999" : color) }} aria-hidden="true" />
                    {colorWord(color, kind)}
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
