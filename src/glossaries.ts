import { parseGlossary, registerGlossary } from "./i18n/glossary";

/**
 * The glossaries, loaded for the app (the step texts and the dressing take their Swedish and
 * German words from them). A broken file is a test failure; here it is left out and reported.
 */
const sources = import.meta.glob("../glossary/*.kdl", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

export const GLOSSARY_ERRORS: string[] = [];

for (const [path, text] of Object.entries(sources)) {
  const file = path.split("/").pop()!;
  const result = parseGlossary(text);
  if (result.ok) registerGlossary(result.glossary);
  else GLOSSARY_ERRORS.push(...result.errors.map((e) => `${file}: line ${e.line}: ${e.message}`));
}
