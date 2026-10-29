import { existsSync, readdirSync, readFileSync } from "node:fs";
import { parseGlossary, registerGlossary } from "./glossary";
import { parseNaturalProse, parsePatternProse, registerNaturalProse, registerPatternProse, type NaturalProse, type PatternProse } from "./prose";

/** For Node (tests, build scripts): loads the glossary/<lang>.kdl files from disk. */
export function loadGlossaries(root = new URL("../../", import.meta.url)) {
  for (const lang of ["sv", "de"]) {
    const file = new URL(`glossary/${lang}.kdl`, root);
    if (!existsSync(file)) continue;
    const r = parseGlossary(readFileSync(file, "utf8"));
    if (!r.ok) throw new Error(`glossary/${lang}.kdl:\n${r.errors.map((e) => `line ${e.line}: ${e.message}`).join("\n")}`);
    registerGlossary(r.glossary);
  }
}

/** For Node: loads the prose translations, translations/<lang>/{patterns,naturals}/<id>.kdl. */
export function loadTranslations(root = new URL("../../", import.meta.url)) {
  for (const lang of ["sv", "de"] as const) {
    for (const kind of ["patterns", "naturals"] as const) {
      const dir = new URL(`translations/${lang}/${kind}/`, root);
      if (!existsSync(dir)) continue;
      for (const f of readdirSync(dir).filter((f) => f.endsWith(".kdl"))) {
        const text = readFileSync(new URL(f, dir), "utf8");
        const r = kind === "patterns" ? parsePatternProse(text) : parseNaturalProse(text);
        if (!r.ok) throw new Error(`translations/${lang}/${kind}/${f}:\n${r.errors.map((e) => `line ${e.line}: ${e.message}`).join("\n")}`);
        if (kind === "patterns") registerPatternProse(lang, r.prose as PatternProse);
        else registerNaturalProse(lang, r.prose as NaturalProse);
      }
    }
  }
}
