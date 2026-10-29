import { getLocation, InvalidKdlError, parse, type Node } from "@bgotink/kdl";
import type { Lang } from "./lang";

/**
 * The glossary: every word the generated texts and the catalog take for a language, with the
 * forms its grammar needs and the translator's notes. One file per language,
 * `glossary/<lang>.kdl`; see docs/glossary.md for the format.
 *
 * Sections hold the words of one kind: the catalog's materials and colours, the words a
 * recipe's parts are named with ("tail", "wing-case"), the tying words the step texts use,
 * the hook models, and the steps' titles.
 */
export const SECTIONS = ["materials", "colours", "parts", "words", "hooks", "steps"] as const;
export type Section = (typeof SECTIONS)[number];

export interface Source {
  title: string;
  url?: string;
}

interface EntryBase {
  /** The English id: a material kind, a colour, a part word, a hook model, a step op. */
  id: string;
  /** The base form: a noun's indefinite singular (nominative), an adjective's uninflected form. */
  text: string;
  notes: string[];
  sources: Source[];
  line: number;
}

export interface Noun extends EntryBase {
  kind: "noun";
  /** sv: "en" | "ett"; de: "m" | "f" | "n". */
  gender: string;
  /** Uncountable (wool, dubbing): no plural. */
  mass: boolean;
  /** sv: the definite form needs den/det/de before it, as it starts with an adjective ("den ovala tinseln"). */
  article: boolean;
  /**
   * Named forms. sv: definite, plural, plural-definite. de: plural, and where they differ from
   * the base form accusative, dative, dative-plural.
   */
  forms: Record<string, string>;
}

export interface Adjective extends EntryBase {
  kind: "adjective";
  /** Never inflected ("rosa", "lila"): put before the noun as it is. */
  invariable: boolean;
  /**
   * A shade named after a feather or fur rather than an adjective ("grizzly", "badger"):
   * joined to the noun ("grizzly-tupphackel", "Grizzly-Hahnenhechel"). Implies invariable.
   */
  compound: boolean;
  /** sv: neuter, plural (also the definite form). de: none; endings follow the rules. */
  forms: Record<string, string>;
}

export interface Phrase extends EntryBase {
  kind: "phrase";
}

export type Entry = Noun | Adjective | Phrase;

export interface Glossary {
  lang: Lang;
  /** "draft" until a native speaker who ties flies has reviewed it. */
  status: "draft" | "reviewed";
  sections: Record<Section, Map<string, Entry>>;
}

export interface GlossaryError {
  line: number;
  message: string;
}

const GENDERS: Record<string, string[]> = { sv: ["en", "ett"], de: ["m", "f", "n"] };
/** Forms a noun must have, unless it is a mass noun (then the plural ones aren't needed). */
const NOUN_FORMS: Record<string, { required: string[]; plural: string[]; optional: string[] }> = {
  sv: { required: ["definite"], plural: ["plural", "plural-definite"], optional: [] },
  de: { required: [], plural: ["plural"], optional: ["accusative", "dative", "genitive", "dative-plural"] },
};
const ADJECTIVE_FORMS: Record<string, string[]> = { sv: ["neuter", "plural"], de: [] };

export function parseGlossary(text: string): { ok: true; glossary: Glossary } | { ok: false; errors: GlossaryError[] } {
  let doc;
  try {
    doc = parse(text, { storeLocations: true });
  } catch (e) {
    if (e instanceof InvalidKdlError) {
      return { ok: false, errors: [{ line: e.errors?.[0]?.start?.line ?? 1, message: e.message }] };
    }
    throw e;
  }
  const errors: GlossaryError[] = [];
  const lineOf = (n: Node) => getLocation(n)?.start.line ?? 1;
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  let lang: string | undefined;
  let status: string | undefined;
  const sections = Object.fromEntries(SECTIONS.map((s) => [s, new Map<string, Entry>()])) as Record<Section, Map<string, Entry>>;

  for (const node of doc.nodes) {
    const name = node.getName();
    if (name === "language") lang = str(node.getArgument(0));
    else if (name === "status") status = str(node.getArgument(0));
    else if (!SECTIONS.includes(name as Section)) errors.push({ line: lineOf(node), message: `unknown node "${name}"` });
  }
  if (lang !== "sv" && lang !== "de") return { ok: false, errors: [{ line: 1, message: 'language must be "sv" or "de"' }, ...errors] };
  if (status !== "draft" && status !== "reviewed") errors.push({ line: 1, message: 'status must be "draft" or "reviewed"' });

  for (const node of doc.nodes) {
    const section = node.getName() as Section;
    if (!SECTIONS.includes(section)) continue;
    for (const child of node.children?.nodes ?? []) {
      const line = lineOf(child);
      const kind = child.getName();
      const id = str(child.getArgument(0));
      const base = str(child.getArgument(1));
      const where = `${section} ${id ?? "?"}`;
      if (!id || !base) {
        errors.push({ line, message: `${kind} needs an id and its ${lang} text: ${kind} <id> "<text>"` });
        continue;
      }
      if (sections[section].has(id)) errors.push({ line, message: `${where}: listed twice` });
      const props = Object.fromEntries(child.getProperties()) as Record<string, unknown>;
      const notes: string[] = [];
      const sources: Source[] = [];
      for (const c of child.children?.nodes ?? []) {
        if (c.getName() === "note" && str(c.getArgument(0))) notes.push(str(c.getArgument(0))!);
        else if (c.getName() === "source" && str(c.getArgument(0))) {
          const url = str(c.getProperty("url"));
          sources.push({ title: str(c.getArgument(0))!, ...(url ? { url } : {}) });
        } else errors.push({ line: lineOf(c), message: `${where}: unknown "${c.getName()}" (only note and source)` });
      }
      const forms: Record<string, string> = {};
      const known = new Set<string>();
      const take = (key: string, required: boolean) => {
        known.add(key);
        const v = props[key];
        if (typeof v === "string" && v.trim()) forms[key] = v;
        else if (v !== undefined) errors.push({ line, message: `${where}: ${key} must be text` });
        else if (required) errors.push({ line, message: `${where}: needs ${key}=` });
      };
      let entry: Entry;
      if (kind === "noun") {
        const gender = str(props.gender);
        known.add("gender").add("mass").add("article");
        if (!gender || !GENDERS[lang]!.includes(gender)) errors.push({ line, message: `${where}: gender must be one of ${GENDERS[lang]!.join(", ")}` });
        const mass = props.mass === true;
        const f = NOUN_FORMS[lang]!;
        f.required.forEach((k) => take(k, true));
        f.plural.forEach((k) => take(k, !mass));
        f.optional.forEach((k) => take(k, false));
        entry = { kind, id, text: base, gender: gender ?? "", mass, article: props.article === true, forms, notes, sources, line };
      } else if (kind === "adjective") {
        known.add("invariable").add("compound");
        const compound = props.compound === true;
        const invariable = compound || props.invariable === true;
        ADJECTIVE_FORMS[lang]!.forEach((k) => take(k, !invariable));
        entry = { kind, id, text: base, invariable, compound, forms, notes, sources, line };
      } else if (kind === "phrase") {
        entry = { kind, id, text: base, notes, sources, line };
      } else {
        errors.push({ line, message: `${section}: "${kind}" should be noun, adjective or phrase` });
        continue;
      }
      for (const key of Object.keys(props)) if (!known.has(key)) errors.push({ line, message: `${where}: unknown property ${key}=` });
      sections[section].set(id, entry);
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true, glossary: { lang, status: status as Glossary["status"], sections } };
}

const loaded = new Map<Lang, Glossary>();

/** Makes a language's glossary available (the app and the build scripts load the files). */
export function registerGlossary(g: Glossary) {
  loaded.set(g.lang, g);
}

export function glossary(lang: Lang): Glossary {
  const g = loaded.get(lang);
  if (!g) throw new Error(`no glossary loaded for ${lang}`);
  return g;
}

/** An entry, or an error naming what is missing: the tests make sure nothing is. */
export function term<K extends Entry["kind"]>(lang: Lang, section: Section, id: string, kind: K): Extract<Entry, { kind: K }> {
  const e = glossary(lang).sections[section].get(id);
  if (!e || e.kind !== kind) throw new Error(`glossary ${lang}: no ${kind} "${id}" in ${section}`);
  return e as Extract<Entry, { kind: K }>;
}

export function hasTerm(lang: Lang, section: Section, id: string): boolean {
  return loaded.get(lang)?.sections[section].has(id) ?? false;
}
