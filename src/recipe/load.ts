import type { RecipeError, SourceLocation } from "./errors";
import { kdlToObject, KdlMappingError } from "./kdl";
import { RecipeSchema, type Recipe } from "./schema";
import { validateSemantics } from "./validate";

export type LoadResult = { ok: true; recipe: Recipe } | { ok: false; errors: RecipeError[] };

/** Parses, schema-validates and semantically validates a KDL recipe. */
export function loadRecipe(text: string): LoadResult {
  let mapped;
  try {
    mapped = kdlToObject(text);
  } catch (e) {
    if (e instanceof KdlMappingError) return { ok: false, errors: e.errors };
    throw e;
  }

  const parsed = RecipeSchema.safeParse(mapped.value);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((issue) => {
      const path = issue.path.map((p) => (typeof p === "symbol" ? String(p) : p));
      return withLocation({ message: issue.message, path }, mapped.locations);
    });
    return { ok: false, errors };
  }

  const semantic = validateSemantics(parsed.data);
  if (semantic.length > 0) {
    return { ok: false, errors: semantic.map((e) => withLocation(e, mapped.locations)) };
  }
  return { ok: true, recipe: parsed.data };
}

/** Attaches the source location of the closest path prefix that has one. */
function withLocation(error: RecipeError, locations: Map<string, SourceLocation>): RecipeError {
  for (let n = error.path.length; n > 0; n--) {
    const loc = locations.get(error.path.slice(0, n).join("."));
    if (loc) return { ...error, ...loc };
  }
  return error;
}
