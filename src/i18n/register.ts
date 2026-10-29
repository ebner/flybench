import { parseGlossary, registerGlossary } from "./glossary";
import type { Lang } from "./lang";
import { parseNaturalProse, parsePatternProse, registerNaturalProse, registerPatternProse } from "./prose";

/** Problems with the language files, as "file: line: message" (shown in development). */
export const LANGUAGE_FILE_ERRORS: string[] = [];

/** Registers a language's glossary and prose translations, from their files' texts by path. */
export function registerLanguage(l: Lang, files: { glossary: Record<string, string>; patterns: Record<string, string>; naturals: Record<string, string> }) {
  const report = (path: string, errors: { line: number; message: string }[]) =>
    LANGUAGE_FILE_ERRORS.push(...errors.map((e) => `${path}: line ${e.line}: ${e.message}`));
  for (const [path, text] of Object.entries(files.glossary)) {
    const r = parseGlossary(text);
    if (r.ok) registerGlossary(r.glossary);
    else report(path, r.errors);
  }
  for (const [path, text] of Object.entries(files.patterns)) {
    const r = parsePatternProse(text);
    if (r.ok) registerPatternProse(l, r.prose);
    else report(path, r.errors);
  }
  for (const [path, text] of Object.entries(files.naturals)) {
    const r = parseNaturalProse(text);
    if (r.ok) registerNaturalProse(l, r.prose);
    else report(path, r.errors);
  }
}
