import { formatError } from "./recipe/errors";
import { loadNatural, type Natural } from "./recipe/natural";

const sources = import.meta.glob("../naturals/*.kdl", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

/** Problems with natural files, as "file: message" lines. Naturals with errors are left out. */
export const NATURAL_ERRORS: string[] = [];

const loaded: Natural[] = [];
for (const [path, text] of Object.entries(sources)) {
  const file = path.split("/").pop()!;
  const result = loadNatural(text);
  if (result.ok) {
    if (file !== `${result.natural.id}.kdl`) NATURAL_ERRORS.push(`${file}: file name should match the id: ${result.natural.id}.kdl`);
    loaded.push(result.natural);
  } else NATURAL_ERRORS.push(...result.errors.map((e) => `${file}: ${formatError(e)}`));
}

export const NATURALS: Natural[] = loaded.sort((a, b) => a.name.localeCompare(b.name));

export function findNatural(id: string): Natural | undefined {
  return NATURALS.find((n) => n.id === id);
}
