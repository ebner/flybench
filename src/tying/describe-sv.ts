import { hasTerm, term, type Adjective, type Noun } from "../i18n/glossary";
import { capitalize, svNoun, svPhrase } from "../i18n/grammar";
import { isTube, NAMED_COLORS, type Material, type Recipe } from "../recipe/schema";
import { hookModel } from "./hook";
import { gapeFraction, usedInPlural, type Detail, type Length, type Mount, type Place, type Reach, type Said, type What, type Writer } from "./describe";

/** Swedish: the texts generated from a recipe, with the glossary's words. A draft until reviewed. */

const word = (id: string) => term("sv", "words", id, "noun");
const material = (m: Material) => term("sv", "materials", m.kind, "noun");
const colour = (c: string | undefined): Adjective | undefined => (c && c in NAMED_COLORS ? term("sv", "colours", c, "adjective") : undefined);
/** "skaftets", "tubens": a definite noun's genitive. */
const genitive = (definite: string) => (/[sxz]$/.test(definite) ? definite : `${definite}s`);
const number = (n: number) => n.toLocaleString("sv-SE");
/** Subject and object pronouns for a noun's gender, or for several. */
const pronoun = (n: Noun | "plural") => (n === "plural" ? { subject: "de", object: "dem" } : n.gender === "ett" ? { subject: "det", object: "det" } : { subject: "den", object: "den" });
/** "en" or "ett" for a noun. */
const article = (n: Noun) => (n.gender === "ett" ? "ett" : "en");

/** "3 varv", "1 varv": a count of a noun, its plural from two on. */
function count(n: number, noun: Noun, adjective = ""): string {
  const form = n === 1 ? noun.text : svNoun(noun, "plural");
  return `${n === 1 ? article(noun) : n} ${adjective ? `${adjective} ` : ""}${form}`;
}

/** A length measured in gapes ("halva krokgapet", "två gånger krokgapet") or millimetres. */
function length(l: Length): string {
  if (l.kind === "mm") return `${number(l.mm)} mm`;
  const gape = word("gape");
  const the = svNoun(gape, "definite");
  switch (gapeFraction(l.gapes)) {
    case 0.25:
      return `en fjärdedel av ${the}`;
    case 0.5:
      return `halva ${the}`;
    case 0.75:
      return `tre fjärdedelar av ${the}`;
    case 1:
      return `${article(gape)} ${gape.text}`;
    case 1.5:
      return `en och en halv gånger ${the}`;
    case 2:
      return `två gånger ${the}`;
    default:
      return `${number(l.gapes)} gånger ${the}`;
  }
}

function writerFor(recipe: Recipe) {
  const mount: Mount = hookModel(recipe.hook).tube?.kind ?? "hook";
  const find = (id: string) => recipe.materials.find((m) => m.id === id);
  /** The material in a sentence: "den röda ullen" (definite) or "röd ull". */
  const mat = (id: string, form: "definite" | "indefinite" = "definite") => {
    const m = find(id);
    if (!m) return id;
    // A translated label says more than the glossary's name ("vita hackelstjälkar", not just
    // fibres): it follows in brackets, as it can't be inflected.
    const phrase = svPhrase(material(m), colour(m.color), form, usedInPlural(m));
    return m.label ? `${phrase} (${m.label.charAt(0).toLowerCase()}${m.label.slice(1)})` : phrase;
  };
  /** What a pronoun for the material refers to: its noun, or several. */
  const noun = (id: string): Noun | "plural" => {
    const m = find(id);
    return !m ? word("body") : usedInPlural(m) && !material(m).mass ? "plural" : material(m);
  };
  const def = (id: string) => svNoun(word(id), "definite");
  const along = def(mount === "tube" ? "tube" : "shank");
  const PLACE: Record<Place["kind"], (p: Place) => { at: string; to: string; from: string }> = {
    "bend-start": () => {
      const bend = `${genitive(def("bend"))} början`;
      return { at: `vid ${bend}`, to: `till ${bend}`, from: `från ${bend}` };
    },
    "rear-end": () => {
      const end = `${genitive(along)} bakre ände`;
      return { at: `vid ${end}`, to: `till ${end}`, from: `från ${end}` };
    },
    "behind-eye": () => ({ at: `strax bakom ${def("eye")}`, to: `till strax bakom ${def("eye")}`, from: `från strax bakom ${def("eye")}` }),
    "behind-head": (p) => {
      const head = def((p as { head: "bead" | "cone" }).head);
      return { at: `strax bakom ${head}`, to: `till strax bakom ${head}`, from: `från strax bakom ${head}` };
    },
    "behind-tube-front": () => {
      const front = `${genitive(def("tube"))} främre ände`;
      return { at: `strax bakom ${front}`, to: `till strax bakom ${front}`, from: `från strax bakom ${front}` };
    },
    halfway: () => ({ at: `mitt på ${along}`, to: `till mitten av ${along}`, from: `från mitten av ${along}` }),
    percent: (p) => {
      const at = `${number((p as { percent: number }).percent)} % av ${genitive(along)} längd`;
      return { at: `vid ${at}`, to: `till ${at}`, from: `från ${at}` };
    },
  };
  const place = (p: Place) => PLACE[p.kind](p);
  const REACH: Record<Reach, string> = {
    "bend-start": `till ${genitive(def("bend"))} början`,
    "over-bend": `över ${def("bend")}`,
    "past-bend-end": `strax förbi ${genitive(def("bend"))} slut`,
    "well-past-bend": `en bra bit förbi ${def("bend")}`,
    "rear-end": `till ${genitive(along)} bakre ände`,
    "well-past-rear-end": `en bra bit förbi ${genitive(along)} bakre ände`,
  };
  /** What is tied in, and the noun its pronoun refers to. */
  const what = (w: What): { text: string; refers: Noun | "plural" } => {
    if (w.kind === "strands") {
      const strand = word("strand");
      return { text: `${count(w.n, strand)} ${mat(w.m, "indefinite")}`, refers: w.n === 1 ? strand : "plural" };
    }
    if (w.kind === "bunch") {
      const bunch = word("bunch");
      return { text: `${article(bunch)} ${bunch.text} ${mat(w.m, "indefinite")}`, refers: bunch };
    }
    return { text: mat(w.m), refers: noun(w.m) };
  };
  const turns = (n: number, open = false) => count(n, word("turn"), open ? "glesa" : "");
  const eights = svNoun(word("figure-of-eight"), "plural");
  const counter = (c: boolean) => (c ? `, åt motsatt håll mot ${svNoun(word("turn"), "plural-definite")} under` : "");
  const angle = (a?: number) => (a ? `, i ungefär ${a}° vinkel upp från ${along}` : "");
  const pick = (w?: Length) => (w ? `Välj en fjäder som är ungefär ${length(w)} bred. ` : "");
  const flare = (f: boolean, refers: Noun | "plural") => (f ? ` Låt ${pronoun(refers).object} spreta ut runt ${genitive(def("body"))} sidor.` : "");
  const thread = def("thread");
  const excess = def("excess");

  return (said: Said): string => {
    switch (said.kind) {
      case "slide-bead":
        return said.mount === "tube"
          ? `Trä ${mat(said.m)} på ${genitive(def("tube"))} främre ände.`
          : `Trä ${mat(said.m)} ${said.mount === "hook" ? `runt ${def("bend")} och ` : ""}upp till ${def("eye")}, med det lilla hålet först.`;
      case "weight":
        return `Linda ${mat(said.m)} i täta ${svNoun(word("turn"), "plural")} ${place(said.from).from} ${place(said.to).to}.`;
      case "attach-thread":
        return `Fäst ${thread} ${place(said.at).at} med några ${svNoun(word("turn"), "plural")} och klipp av ${def("tag-end")}.`;
      case "wrap-thread":
        return said.turns
          ? `Linda ${thread} ${place(said.to).to} i ${turns(said.turns, true)}.`
          : `Linda ${thread} ${place(said.to).to} i täta ${svNoun(word("turn"), "plural")}.`;
      case "tie-in-eyes":
        return `Bind fast ${mat(said.m)} ${said.under ? "under" : "ovanpå"} ${along} med ${eights}.`;
      case "tie-in-extended": {
        const p = pronoun(noun(said.m));
        const tipColour = colour(said.tip);
        const tip = said.tip
          ? ` Färga änden ${tipColour ? tipColour.text : "mörkare"}${said.tip === "black" ? ` (bränn den med ${article(word("lighter"))} ${word("lighter").text})` : ""}.`
          : "";
        return `Bind in ${mat(said.m)} så att ${p.subject} sticker ut ${length(said.length)} ${said.forward ? `framåt över ${def("eye")}` : "bakåt"} i ett stycke.${tip}`;
      }
      case "tie-in-across":
        return `Bind ${count(said.strands, word("strand"))} ${mat(said.m, "indefinite")} tvärs över ${along} på mitten med ${eights}, så att ${length(said.length)} sticker ut på varje sida som ben.`;
      case "tie-in-forward":
        return `Bind in ${mat(said.m)} så att ${pronoun(noun(said.m)).subject} pekar framåt över ${def("eye")} och sticker ut ${length(said.length)}.`;
      case "tie-in-upright": {
        const w = what(said.what);
        const p = pronoun(w.refers);
        return `Bind in ${w.text} upprätt så att ${p.subject} står ${length(said.length)} upp, med ${svNoun(word("turn"), "plural")} framför som reser ${p.object}.${said.divide ? ` Dela ${p.object} i ett V med ${eights}.` : ""}`;
      }
      case "tie-in-wing-under": {
        const w = what(said.what);
        return `Bind in ${w.text} under ${along} som vinge (överst när flugan simmar med krokspetsen uppåt), så att ${pronoun(w.refers).subject} når ${length(said.length)} bakåt.`;
      }
      case "tie-in-beard": {
        const w = what(said.what);
        return `Bind in ${w.text} under ${along} som skägg, så att ${pronoun(w.refers).subject} når ${length(said.length)} bakåt.`;
      }
      case "tie-in-reach": {
        const w = what(said.what);
        return `${pick(said.width)}Bind in ${w.text} så att ${svNoun(word("tip"), "plural-definite")} når ${REACH[said.reach]} (${length(said.length)} från inbindningspunkten)${angle(said.angle)}.${flare(said.flare, w.refers)}`;
      }
      case "tie-in-behind": {
        const w = what(said.what);
        return `${pick(said.width)}Bind in ${w.text} och låt ${length(said.length)} sticka ut bakåt${angle(said.angle)}.${flare(said.flare, w.refers)}`;
      }
      case "tie-in":
        return `Bind in ${what(said.what).text} med några fasta ${svNoun(word("turn"), "plural")} tråd.`;
      case "wind-around":
        return `Linda ${mat(said.m)} runt ${def("base")} av ${mat(said.around)} i ${turns(said.turns)}, vart och ett under det förra.`;
      case "palmer":
        return `Linda ${mat(said.m)} bakåt ${place(said.to).to} i ${turns(said.turns, true)}${counter(said.counter)}.`;
      case "wind-through":
        return `Linda ${mat(said.m)} framåt ${place(said.to).to} i ${turns(said.turns)} genom ${mat(said.through)}${counter(said.counter)}. Det första varvet låser dess ${svNoun(word("tip"), "indefinite")}.`;
      case "wind":
        return `Linda ${mat(said.m)} framåt ${place(said.to).to} i ${turns(said.turns)}${counter(said.counter)}.`;
      case "pull-over":
        return `Dra ${mat(said.m)} framåt över ${genitive(def("body"))} ovansida och bind ner ${pronoun(noun(said.m)).object} ${place(said.to).at}.${said.trimmedLater ? "" : ` Klipp bort ${excess}.`}`;
      case "spin":
        return `Spinn ${svNoun(word("clump"), "plural")} av ${mat(said.m, "indefinite")} runt ${along} och packa var och en bakåt mot den förra, ${place(said.to).to}.`;
      case "dub": {
        const noodle = word("noodle");
        return `Snurra ${article(noodle)} ${noodle.gender === "ett" ? "tunt" : "tunn"} ${noodle.text} av ${mat(said.m, "indefinite")} på ${thread} och linda ${pronoun(noodle).object} ${said.rear ? "bakåt" : "framåt"} ${place(said.to).to}.`;
      }
      case "tie-off":
        return `Fäst ${mat(said.m)} med några ${svNoun(word("turn"), "plural")} tråd och klipp bort ${excess}.`;
      case "trim-keep": {
        const fibres = svNoun(word("fibre"), "plural-definite");
        return said.keep === "top"
          ? `Klipp bort ${fibres} på ${mat(said.m)} undertill, så att flugan sitter lågt i ytfilmen.`
          : said.keep === "under"
            ? `Klipp ${fibres} på ${mat(said.m)} ovanpå tätt intill ${def("body")}, så att det blir en plan bädd för vingen.`
            : `Klipp bort ${fibres} på ${mat(said.m)} upptill och undertill, så att två plana ${svNoun(word("row"), "plural")} sticker ut åt ${svNoun(word("side"), "plural-definite")}.`;
      }
      case "trim-spun":
        return `Klipp ${mat(said.m)} till form, så att ${article(word("head"))} ${word("head").text} på ungefär ${length(said.leave)} blir kvar på varje sida.`;
      case "trim-tip":
        return `Klipp av ${svNoun(word("tip"), "definite")} på ${mat(said.m)} tätt intill ${def("body")}.`;
      case "trim-cover":
        return said.leave
          ? `Klipp bort ${excess} av ${mat(said.m, "indefinite")} men lämna ${article(word("stub"))} ${word("stub").text} på ${length(said.leave)} över ${def("eye")} som ${word("head").text}.`
          : `Klipp bort ${excess} av ${mat(said.m, "indefinite")} jäms med ${def("tie-down")}.`;
      case "trim-butts":
        return said.leave
          ? `Klipp ${svNoun(word("butt"), "plural-definite")} på ${mat(said.m)} och lämna ${article(word("head"))} kort ${word("head").text} på ${length(said.leave)}.`
          : `Klipp ${svNoun(word("butt"), "plural-definite")} på ${mat(said.m)} jäms.`;
      case "whip-finish":
        return `Forma ${article(word("head"))} ${word("head").gender === "ett" ? "litet" : "liten"} ${word("head").text}, gör ${article(word("whip-finish"))} ${word("whip-finish").text} med ${turns(said.turns)} och klipp av ${thread}.`;
    }
  };
}

/** A recipe's part name in the dressing list, from its id ("wing-case" → "Vingsäck"). */
function partName(id: string): string {
  if (hasTerm("sv", "parts", id) && id.includes("-")) return capitalize(term("sv", "parts", id, "noun").text);
  const ids = id.split("-");
  const words = ids.map((w) => (w in NAMED_COLORS ? term("sv", "colours", w, "adjective") : termOf(w)));
  const nouns = words.filter((w): w is Noun => w.kind === "noun");
  const head = nouns[0];
  const adjectives = words.filter((w): w is Adjective => w.kind === "adjective");
  // Only a position ("bakre"): it needs a noun to name a part.
  if (!head && !ids.some((w) => w in NAMED_COLORS)) return capitalize(`${adjectives.map((a) => a.text).join(" ")} del`);
  const compound = adjectives.filter((a) => a.compound);
  const plain = adjectives.filter((a) => !a.compound);
  const adjText = plain.map((a) => (a.invariable || !head ? a.text : head.gender === "ett" ? a.forms.neuter! : a.text));
  const nounText = nouns.map((n, i) => (i === 0 && compound.length ? `${compound.map((a) => a.text).join("-")}-${n.text}` : n.text)).join(", ");
  return capitalize([...adjText, nounText].filter(Boolean).join(" "));
}

/** The noun a part's name is built on ("hackel" in "hackle-grizzly"), for agreement. */
function partHead(id: string): Noun | undefined {
  if (hasTerm("sv", "parts", id) && id.includes("-")) return term("sv", "parts", id, "noun");
  return id
    .split("-")
    .filter((w) => !(w in NAMED_COLORS))
    .map(termOf)
    .find((w): w is Noun => w.kind === "noun");
}

const termOf = (w: string): Noun | Adjective => {
  try {
    return term("sv", "parts", w, "noun");
  } catch {
    return term("sv", "parts", w, "adjective");
  }
};

const DETAIL = {
  size: (n: number | undefined) => `storlek ${n}`,
};

export const sv: Writer = {
  // A label is the translation of the recipe's own (see i18n/prose.ts); otherwise the glossary's name.
  materialName: (m) => m.label ?? capitalize(svPhrase(material(m), colour(m.color), "indefinite", usedInPlural(m))),
  colourWord: (c) => (c ? term("sv", "colours", c, "adjective").text : "naturfärg"),
  // "Hackel rött": the colour agrees with the part's noun.
  partInColour: (id, c) => {
    const colour = term("sv", "colours", c, "adjective");
    const head = id === "thread" ? word("thread") : partHead(id);
    const form = !colour.invariable && head?.gender === "ett" ? colour.forms.neuter! : colour.text;
    return `${id === "thread" ? capitalize(word("thread").text) : partName(id)} ${form}`;
  },
  threadName: (c) => capitalize(svPhrase(word("thread"), colour(c), "indefinite")),
  hookName: (model, english, length) => {
    const name = term("sv", "hooks", model, "phrase").text;
    return isTube(model) ? `${name}, ${length} mm` : name || english;
  },
  role: (id) => capitalize(word(id).text),
  partName,
  detail: (d: Detail) => {
    switch (d.kind) {
      case "size":
        return DETAIL.size(d.size);
      case "strands":
        return count(d.n, word("strand"));
      case "fibre-mm":
        return `${svNoun(word("fibre"), "plural")} ${number(d.mm)} mm`;
      case "fibre-gape":
        return `${svNoun(word("fibre"), "plural")} ${length({ kind: "gape", gapes: d.gapes })}`;
      case "mm":
        return `${number(d.mm)} mm`;
      case "text":
        return d.text;
      case "count":
        return count(d.n, word(d.unit === "strands" ? "strand" : d.unit === "biots" ? "biot" : d.unit === "hairs" ? "hair" : "fibre"));
    }
  },
  text: (said, recipe, note) => {
    const text = writerFor(recipe)(said);
    return note ? `${text} ${note}` : text;
  },
  title: (op, m, id) => {
    const title = term("sv", "steps", op, "phrase").text;
    if (id === undefined) return title;
    const name = m?.label ? m.label.charAt(0).toLowerCase() + m.label.slice(1) : m && svPhrase(material(m), colour(m.color), "indefinite", usedInPlural(m));
    return `${title}: ${name ?? id}`;
  },
};
