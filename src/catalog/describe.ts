import { lang } from "../i18n/lang";
import { localized } from "../i18n/localized";
import type { Recipe } from "../recipe/schema";

/** Catalog wording: short facts about a pattern, written as plain sentences, in the page's language. */

type Types = Record<Recipe["type"], string>;
type Imitates = Record<Recipe["imitates"][number], string>;
type Species = Record<Recipe["species"][number], string>;
type Difficulty = Record<Recipe["difficulty"], string>;

/** One fly of the type, for a sentence ("dry fly"). */
const TYPE_NOUNS = localized<Types>({
  en: {
    dry: "dry fly", wet: "wet fly", nymph: "nymph", emerger: "emerger", midge: "midge pattern", streamer: "streamer",
    terrestrial: "terrestrial", salmon: "salmon fly", saltwater: "saltwater fly",
  },
  sv: {
    dry: "torrfluga", wet: "våtfluga", nymph: "nymf", emerger: "emerger", midge: "fjädermyggsmönster", streamer: "streamer",
    terrestrial: "landinsektsimitation", salmon: "laxfluga", saltwater: "saltvattensfluga",
  },
  de: {
    dry: "Trockenfliege", wet: "Nassfliege", nymph: "Nymphe", emerger: "Emerger", midge: "Zuckmückenmuster", streamer: "Streamer",
    terrestrial: "Landinsektenmuster", salmon: "Lachsfliege", saltwater: "Salzwasserfliege",
  },
});

export const TYPE_LABELS = localized<Types>({
  en: {
    dry: "Dry flies", wet: "Wet flies", nymph: "Nymphs", emerger: "Emergers", midge: "Midges", streamer: "Streamers",
    terrestrial: "Terrestrials", salmon: "Salmon flies", saltwater: "Saltwater",
  },
  sv: {
    dry: "Torrflugor", wet: "Våtflugor", nymph: "Nymfer", emerger: "Emergers", midge: "Fjädermyggor", streamer: "Streamers",
    terrestrial: "Landinsekter", salmon: "Laxflugor", saltwater: "Saltvatten",
  },
  de: {
    dry: "Trockenfliegen", wet: "Nassfliegen", nymph: "Nymphen", emerger: "Emerger", midge: "Zuckmücken", streamer: "Streamer",
    terrestrial: "Landinsekten", salmon: "Lachsfliegen", saltwater: "Salzwasser",
  },
});

export const IMITATES_LABELS = localized<Imitates>({
  en: {
    mayfly: "Mayflies", caddis: "Caddis", stonefly: "Stoneflies", chironomid: "Chironomids", damselfly: "Damselflies",
    terrestrial: "Land insects", baitfish: "Baitfish", crustacean: "Shrimp and scuds", attractor: "Attractors",
  },
  sv: {
    mayfly: "Dagsländor", caddis: "Nattsländor", stonefly: "Bäcksländor", chironomid: "Fjädermyggor", damselfly: "Flicksländor",
    terrestrial: "Landinsekter", baitfish: "Småfisk", crustacean: "Märlor och räkor", attractor: "Attraktionsflugor",
  },
  de: {
    mayfly: "Eintagsfliegen", caddis: "Köcherfliegen", stonefly: "Steinfliegen", chironomid: "Zuckmücken", damselfly: "Kleinlibellen",
    terrestrial: "Landinsekten", baitfish: "Kleinfische", crustacean: "Bachflohkrebse und Garnelen", attractor: "Reizfliegen",
  },
});

export const SPECIES_LABELS = localized<Species>({
  en: {
    trout: "Trout", grayling: "Grayling", "sea-trout": "Sea trout", salmon: "Salmon", char: "Char", bass: "Bass", panfish: "Panfish",
    pike: "Pike", "striped-bass": "Striped bass", bonefish: "Bonefish",
  },
  sv: {
    trout: "Öring", grayling: "Harr", "sea-trout": "Havsöring", salmon: "Lax", char: "Röding", bass: "Svartabborre",
    panfish: "Solabborre", pike: "Gädda", "striped-bass": "Strimmig havsabborre", bonefish: "Bonefish",
  },
  de: {
    trout: "Forelle", grayling: "Äsche", "sea-trout": "Meerforelle", salmon: "Lachs", char: "Saibling", bass: "Schwarzbarsch",
    panfish: "Sonnenbarsch", pike: "Hecht", "striped-bass": "Felsenbarsch", bonefish: "Grätenfisch",
  },
});

export const DIFFICULTY_LABELS = localized<Difficulty>({
  en: { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" },
  sv: { beginner: "Nybörjare", intermediate: "Medelsvår", advanced: "Avancerad" },
  de: { beginner: "Anfänger", intermediate: "Fortgeschritten", advanced: "Anspruchsvoll" },
});

/** "a, b and c" in the page's language. */
export function list(items: string[]): string {
  if (items.length <= 1) return items.join("");
  const and = { en: "and", sv: "och", de: "und" }[lang()];
  return `${items.slice(0, -1).join(", ")} ${and} ${items.at(-1)}`;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** In a sentence: English and Swedish write these words small; German nouns keep their capital. */
const inSentence = (s: string) => (lang() === "de" ? s : s.charAt(0).toLowerCase() + s.slice(1));

/** "Dry fly imitating caddis", "Wet fly, an attractor". */
export function factsLine(r: Recipe): string {
  const noun = capitalize(TYPE_NOUNS[r.type]);
  const insects = r.imitates.filter((i) => i !== "attractor").map((i) => inSentence(IMITATES_LABELS[i]));
  const imitating = { en: "imitating", sv: "som imiterar", de: "imitiert" }[lang()];
  const attractor = { en: "an attractor", sv: "en attraktionsfluga", de: "eine Reizfliege" }[lang()];
  if (insects.length) return lang() === "de" ? `${noun}, ${imitating} ${list(insects)}` : `${noun} ${imitating} ${list(insects)}`;
  if (r.imitates.includes("attractor")) return `${noun}, ${attractor}`;
  return noun;
}

/** "Dry fly imitating caddis, for trout and grayling." */
export function factsSentence(r: Recipe): string {
  const species = r.species.map((s) => inSentence(SPECIES_LABELS[s]));
  const forWord = { en: "for", sv: "för", de: "für" }[lang()];
  return `${factsLine(r)}${species.length ? `, ${forWord} ${list(species)}` : ""}.`;
}

/** "Al Troth, 1957" or "" when unknown. */
export function originLine(r: Recipe): string {
  return [r.origin?.originator, r.origin?.year].filter(Boolean).join(", ");
}
