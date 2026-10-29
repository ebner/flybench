import type { Adjective, Noun } from "./glossary";

/**
 * Putting glossary words together: a noun with its article and a colour, in the form a
 * sentence needs. Only what the generated texts use.
 */

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Swedish

export type SvForm = "indefinite" | "definite" | "plural" | "plural-definite";

/** The noun alone in a form ("ull", "ullen", "hackel", "hacklen"). */
export function svNoun(n: Noun, form: SvForm = "indefinite"): string {
  if (form === "indefinite") return n.text;
  if (n.mass && form.startsWith("plural")) return form === "plural" ? n.text : n.forms.definite!;
  return n.forms[form]!;
}

/**
 * A noun with a colour: "röd ull", "rött garn"; definite "den röda ullen", "det röda garnet";
 * "rosa ull", "den rosa ullen". A shade named after a feather is joined on: "grizzly-tupphackel".
 */
export function svPhrase(n: Noun, colour: Adjective | undefined, form: "indefinite" | "definite", many = false): string {
  const plural = many && !n.mass;
  const nounForm: SvForm = form === "definite" ? (plural ? "plural-definite" : "definite") : plural ? "plural" : "indefinite";
  const article = plural ? "de" : n.gender === "ett" ? "det" : "den";
  if (!colour) return form === "definite" && n.article ? `${article} ${svNoun(n, nounForm)}` : svNoun(n, nounForm);
  if (colour.compound) return `${form === "definite" && n.article ? `${article} ` : ""}${colour.text}-${svNoun(n, nounForm)}`;
  const adjective = colour.invariable ? colour.text : plural || form === "definite" ? colour.forms.plural! : n.gender === "ett" ? colour.forms.neuter! : colour.text;
  return form === "indefinite" ? `${adjective} ${svNoun(n, nounForm)}` : `${article} ${adjective} ${svNoun(n, nounForm)}`;
}

// German

export type Case = "nom" | "acc" | "dat" | "gen";
export type Gender = "m" | "f" | "n";

const DEFINITE: Record<Case, Record<Gender | "pl", string>> = {
  nom: { m: "der", f: "die", n: "das", pl: "die" },
  acc: { m: "den", f: "die", n: "das", pl: "die" },
  dat: { m: "dem", f: "der", n: "dem", pl: "den" },
  gen: { m: "des", f: "der", n: "des", pl: "der" },
};
const INDEFINITE: Record<Case, Record<Gender, string>> = {
  nom: { m: "ein", f: "eine", n: "ein" },
  acc: { m: "einen", f: "eine", n: "ein" },
  dat: { m: "einem", f: "einer", n: "einem" },
  gen: { m: "eines", f: "einer", n: "eines" },
};
/** Adjective endings: after the definite article (weak), after "ein" (mixed), with no article (strong). */
const ENDINGS: Record<"weak" | "mixed" | "strong", Record<Case, Record<Gender | "pl", string>>> = {
  weak: {
    nom: { m: "e", f: "e", n: "e", pl: "en" },
    acc: { m: "en", f: "e", n: "e", pl: "en" },
    dat: { m: "en", f: "en", n: "en", pl: "en" },
    gen: { m: "en", f: "en", n: "en", pl: "en" },
  },
  mixed: {
    nom: { m: "er", f: "e", n: "es", pl: "en" },
    acc: { m: "en", f: "e", n: "es", pl: "en" },
    dat: { m: "en", f: "en", n: "en", pl: "en" },
    gen: { m: "en", f: "en", n: "en", pl: "en" },
  },
  strong: {
    nom: { m: "er", f: "e", n: "es", pl: "e" },
    acc: { m: "en", f: "e", n: "es", pl: "e" },
    dat: { m: "em", f: "er", n: "em", pl: "en" },
    gen: { m: "en", f: "er", n: "en", pl: "er" },
  },
};

/** The noun alone in a case ("Hakenschenkel", "Hakenschenkels"; plural "Windungen"). */
export function deNoun(n: Noun, c: Case = "nom", plural = false): string {
  if (plural && !n.mass) {
    const p = n.forms.plural!;
    return c === "dat" ? (n.forms["dative-plural"] ?? (/[ns]$/.test(p) ? p : `${p}n`)) : p;
  }
  if (c === "acc") return n.forms.accusative ?? n.text;
  if (c === "dat") return n.forms.dative ?? n.text;
  if (c === "gen") return n.forms.genitive ?? (n.gender === "f" ? n.text : /(s|ß|x|z)$/.test(n.text) ? `${n.text}es` : `${n.text}s`);
  return n.text;
}

/** An adjective with its ending: "rot" + "en" = "roten"; "dunkel" + "e" = "dunkle"; "rosa" stays. */
export function deAdjective(a: Adjective, ending: string): string {
  if (a.invariable || !ending) return a.text;
  const stem = /el$/.test(a.text) && ending.startsWith("e") ? `${a.text.slice(0, -2)}l` : a.text;
  return stem.endsWith("e") && ending.startsWith("e") ? stem + ending.slice(1) : stem + ending;
}

/**
 * A noun phrase: "die rote Wolle", "den roten Draht", "einem Faden", "rote Wolle", "die rosa
 * Wolle". A shade named after a feather is joined on: "die Grizzly-Hahnenhechel".
 */
export function dePhrase(
  n: Noun,
  opts: { case: Case; article: "definite" | "indefinite" | "none"; colour?: Adjective; plural?: boolean },
): string {
  const g = n.gender as Gender;
  const plural = Boolean(opts.plural) && !n.mass;
  const key = plural ? "pl" : g;
  const article =
    opts.article === "definite" ? DEFINITE[opts.case][key] : opts.article === "indefinite" && !plural ? INDEFINITE[opts.case][g] : "";
  const declension = opts.article === "definite" ? "weak" : opts.article === "indefinite" && !plural ? "mixed" : "strong";
  const colour = opts.colour;
  const noun = deNoun(n, opts.case, plural);
  const words = colour?.compound
    ? [`${capitalize(colour.text)}-${noun}`]
    : colour
      ? [deAdjective(colour, ENDINGS[declension][opts.case][key]), noun]
      : [noun];
  return [article, ...words].filter(Boolean).join(" ");
}

/** "an dem" → "am", "zu der" → "zur": the contractions German writes. */
export function deContract(text: string): string {
  return text
    .replace(/\ban dem\b/g, "am")
    .replace(/\bin dem\b/g, "im")
    .replace(/\bvon dem\b/g, "vom")
    .replace(/\bzu dem\b/g, "zum")
    .replace(/\bzu der\b/g, "zur")
    .replace(/\bbei dem\b/g, "beim")
    .replace(/\ban das\b/g, "ans")
    .replace(/\bin das\b/g, "ins");
}
