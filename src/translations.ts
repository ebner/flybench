import { LANGS, type Lang } from "./i18n/lang";
import { parseNaturalProse, parsePatternProse, registerNaturalProse, registerPatternProse } from "./i18n/prose";

/** The prose translations (translations/<lang>/patterns|naturals/<id>.kdl), loaded for the app. */
const patternFiles = import.meta.glob("../translations/*/patterns/*.kdl", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const naturalFiles = import.meta.glob("../translations/*/naturals/*.kdl", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

export const TRANSLATION_ERRORS: string[] = [];

const langOf = (path: string) => LANGS.find((l) => path.includes(`/translations/${l}/`)) as Lang | undefined;

for (const [path, text] of Object.entries(patternFiles)) {
  const l = langOf(path);
  const r = parsePatternProse(text);
  if (l && r.ok) registerPatternProse(l, r.prose);
  else if (!r.ok) TRANSLATION_ERRORS.push(...r.errors.map((e) => `${path}: line ${e.line}: ${e.message}`));
}
for (const [path, text] of Object.entries(naturalFiles)) {
  const l = langOf(path);
  const r = parseNaturalProse(text);
  if (l && r.ok) registerNaturalProse(l, r.prose);
  else if (!r.ok) TRANSLATION_ERRORS.push(...r.errors.map((e) => `${path}: line ${e.line}: ${e.message}`));
}
