import { formatError } from "./recipe/errors";
import { loadNatural, type Natural } from "./recipe/natural";
import { lang } from "./i18n/lang";
import { naturalInPageLanguage } from "./i18n/prose";

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

/** The naturals with their names and descriptions in the page's language, by name. */
export function localNaturals(): Natural[] {
  return NATURALS.map((n) => naturalInPageLanguage(n)).sort((a, b) => a.name.localeCompare(b.name, lang()));
}

/** A natural, its prose in the page's language. */
export function findNatural(id: string): Natural | undefined {
  const n = NATURALS.find((x) => x.id === id);
  return n && naturalInPageLanguage(n);
}
