import { useMemo } from "react";
import type { CatalogEntry } from "../catalog/search";
import { lang } from "../i18n/lang";
import { draftOf, isOwnFly, isOwnId, ownRecipe, type OwnFly } from "../edit/own";
import { findPattern, KNOWN_PARTS, PATTERNS } from "../patterns";
import type { Recipe } from "../recipe/schema";
import { OWN_FLIES_KEY, readList, useStoredList } from "./storage";

/** The visitor's own flies (the fly builder), kept in this browser. */

const parts = new Set(KNOWN_PARTS);

export interface Own {
  fly: OwnFly;
  /** The fly as it loads; null while it is unfinished (or breaks a rule). */
  recipe: Recipe | null;
  /** Its name, finished or not. */
  name: string;
}

/** Read once per text: the same object each time, so a page doesn't tie the fly again on every render. */
const read = new Map<string, Omit<Own, "fly"> & { kdl: string }>();

function own(fly: OwnFly): Own {
  let r = read.get(fly.id);
  if (!r || r.kdl !== fly.kdl) {
    const recipe = ownRecipe(fly.kdl, parts);
    // The id is the stored one, whatever the text says.
    const loaded = recipe && { ...recipe, id: fly.id };
    r = { kdl: fly.kdl, recipe: loaded, name: loaded?.name ?? draftOf(fly.kdl, parts)?.name ?? fly.id };
    read.set(fly.id, r);
  }
  return { fly, recipe: r.recipe, name: r.name };
}

export function useOwnFlies(): { flies: Own[]; save: (flies: OwnFly[]) => void; stored: OwnFly[] } {
  const { items, save } = useStoredList(OWN_FLIES_KEY, isOwnFly);
  const flies = useMemo(() => items.map(own).sort((a, b) => a.name.localeCompare(b.name, lang())), [items, lang()]);
  return { flies, save, stored: items };
}

/** A pattern, or one of the visitor's own finished flies, by id. */
export function findFly(id: string): Recipe | undefined {
  if (!isOwnId(id)) return findPattern(id)?.recipe;
  const fly = readList(OWN_FLIES_KEY).find((f): f is OwnFly => isOwnFly(f) && f.id === id);
  return (fly && own(fly).recipe) ?? undefined;
}

/** The patterns' recipes and the visitor's finished flies, for what counts both (the tying log). */
export function allRecipes(flies: Own[]): Recipe[] {
  return [...PATTERNS.map((p) => p.recipe), ...flies.flatMap((f) => f.recipe ?? [])];
}

/** One of the visitor's own flies as a gallery plate shows it. */
export const ownEntry = (recipe: Recipe): CatalogEntry => ({ recipe, variants: [], materials: new Set(recipe.materials.map((m) => m.kind)) });
