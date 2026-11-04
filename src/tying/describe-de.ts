import { hasTerm, term, type Adjective, type Noun } from "../i18n/glossary";
import { adjectiveList, capitalize, deAdjective, deContract, deNoun, dePhrase, type Case, type Gender } from "../i18n/grammar";
import { isTube, NAMED_COLORS, type Material, type Recipe } from "../recipe/schema";
import { hookModel } from "./hook";
import { gapeFraction, namedColours, usedInPlural, type Detail, type Length, type Mount, type Place, type Reach, type Said, type What, type Writer } from "./describe";

/** German: the texts generated from a recipe, with the glossary's words. A draft until reviewed. */

const word = (id: string) => term("de", "words", id, "noun");
const material = (m: Material) => term("de", "materials", m.kind, "noun");
const colour = (c: string | undefined): Adjective | undefined => (c && c in NAMED_COLORS ? term("de", "colours", c, "adjective") : undefined);
/** A material's colour, or the colours of a blended bunch ("orangefarbener, gelber und schwarzer"). */
/** A blended bunch's own shade, when it is the material's natural colour or a hex colour. */
const NATURAL: Adjective = { kind: "adjective", id: "natural", text: "naturfarben", invariable: false, compound: false, forms: {}, notes: [], sources: [], line: 0 };
const colours = (m: Material): Adjective | undefined => {
  const list = namedColours(m).map((c) => (c ? colour(c)! : NATURAL));
  return list.length ? adjectiveList(list, "und") : undefined;
};
const number = (n: number) => n.toLocaleString("de-DE");
/** An adjective the sentences use, declined like a colour. */
const adjective = (text: string): Adjective => ({ kind: "adjective", id: text, text, invariable: false, compound: false, forms: {}, notes: [], sources: [], line: 0 });

const the = (id: string, c: Case, plural = false) => dePhrase(word(id), { case: c, article: "definite", plural });
const a = (id: string, c: Case, adj?: string) => dePhrase(word(id), { case: c, article: "indefinite", ...(adj ? { colour: adjective(adj) } : {}) });
/** Plural without article: "Windungen" (dative "Windungen"), "Fibern". */
const many = (id: string, c: Case, adj?: string) => dePhrase(word(id), { case: c, article: "none", plural: true, ...(adj ? { colour: adjective(adj) } : {}) });

/** Pronouns for a noun's gender, or for several. */
function pronoun(n: Noun | "plural") {
  if (n === "plural") return { nom: "sie", acc: "sie", rel: "die" };
  return { m: { nom: "er", acc: "ihn", rel: "der" }, f: { nom: "sie", acc: "sie", rel: "die" }, n: { nom: "es", acc: "es", rel: "das" } }[n.gender as Gender];
}

/** The verb for a pronoun's number: "steht" for one, "stehen" for several. */
const verb = (refers: Noun | "plural", one: string, several: string) => (refers === "plural" ? several : one);

/** "drei Windungen", "einer Windung" (dative), with an adjective if given. */
function count(n: number, id: string, c: Case, adj?: string): string {
  if (n === 1) return a(id, c, adj);
  return `${n} ${many(id, c, adj)}`;
}

/** Whether a length is said in the plural ("zwei Bogenweiten", "38 mm"), for the verb that goes with it. */
function lengthPlural(l: Length): boolean {
  if (l.kind === "mm") return l.mm !== 1;
  const f = gapeFraction(l.gapes);
  return f === 1.5 || f === 2 || f === undefined;
}

/** A length measured in gapes ("eine halbe Bogenweite", "zwei Bogenweiten") or millimetres, as a measure (accusative). */
function length(l: Length): string {
  if (l.kind === "mm") return `${number(l.mm)} mm`;
  const gape = word("gape");
  switch (gapeFraction(l.gapes)) {
    case 0.25:
      return `ein Viertel ${dePhrase(gape, { case: "gen", article: "definite" })}`;
    case 0.5:
      return dePhrase(gape, { case: "acc", article: "indefinite", colour: adjective("halb") });
    case 0.75:
      return `drei Viertel ${dePhrase(gape, { case: "gen", article: "definite" })}`;
    case 1:
      return dePhrase(gape, { case: "acc", article: "indefinite" });
    case 1.5:
      return `anderthalb ${deNoun(gape, "acc", true)}`;
    case 2:
      return `zwei ${deNoun(gape, "acc", true)}`;
    default:
      return `${number(l.gapes)} ${deNoun(gape, "acc", true)}`;
  }
}

function writerFor(recipe: Recipe) {
  const mount: Mount = hookModel(recipe.hook).tube?.kind ?? "hook";
  const find = (id: string) => recipe.materials.find((m) => m.id === id);
  /** The material in a sentence, in a case: "die rote Wolle", "der roten Wolle"; without article "rote Wolle". */
  const mat = (id: string, c: Case, article: "definite" | "none" = "definite") => {
    const m = find(id);
    if (!m) return id;
    const phrase = dePhrase(material(m), { case: c, article, colour: colours(m), plural: usedInPlural(m) });
    // A translated label says more than the glossary's name ("Weiße Hechelstiele"): it follows
    // in quotation marks, as it can't be declined.
    return m.label ? `${phrase} („${m.label}“)` : phrase;
  };
  /** What a pronoun for the material refers to: its noun, or several. */
  const noun = (id: string): Noun | "plural" => {
    const m = find(id);
    return !m ? word("body") : usedInPlural(m) && !material(m).mass ? "plural" : material(m);
  };
  const alongId = mount === "tube" ? "tube" : "shank";
  const along = the(alongId, "gen");
  const PLACE: Record<Place["kind"], (p: Place) => { at: string; to: string; from: string }> = {
    "bend-start": () => {
      const bend = `Beginn ${the("bend", "gen")}`;
      return { at: `an dem ${bend}`, to: `bis zu dem ${bend}`, from: `von dem ${bend}` };
    },
    "rear-end": () => {
      const end = `hinteren Ende ${along}`;
      return { at: `an dem ${end}`, to: `bis zu dem ${end}`, from: `von dem ${end}` };
    },
    "behind-eye": () => ({ at: `knapp hinter ${the("eye", "dat")}`, to: `bis knapp hinter ${the("eye", "acc")}`, from: `von knapp hinter ${the("eye", "dat")}` }),
    "behind-head": (p) => {
      const head = (p as { head: "bead" | "cone" }).head;
      return { at: `knapp hinter ${the(head, "dat")}`, to: `bis knapp hinter ${the(head, "acc")}`, from: `von knapp hinter ${the(head, "dat")}` };
    },
    "behind-tube-front": () => {
      const front = the("tube", "gen");
      return { at: `knapp hinter dem vorderen Ende ${front}`, to: `bis knapp hinter das vordere Ende ${front}`, from: `von knapp hinter dem vorderen Ende ${front}` };
    },
    halfway: () => ({ at: `in der Mitte ${along}`, to: `bis zu der Mitte ${along}`, from: `von der Mitte ${along}` }),
    percent: (p) => {
      const at = `${number((p as { percent: number }).percent)} % der Länge ${along}`;
      return { at: `bei ${at}`, to: `bis ${at}`, from: `von ${at}` };
    },
    "past-rear": (p) => {
      const l = length((p as { length: Length }).length);
      const [dat, acc] = mount === "hook" ? [`dem Beginn ${the("bend", "gen")}`, `den Beginn ${the("bend", "gen")}`] : [`dem hinteren Ende ${along}`, `das hintere Ende ${along}`];
      return { at: `${l} hinter ${dat}`, to: `bis ${l} hinter ${acc}`, from: `von ${l} hinter ${dat}` };
    },
  };
  const place = (p: Place) => PLACE[p.kind](p);
  const REACH: Record<Reach, string> = {
    "bend-start": `bis zu dem Beginn ${the("bend", "gen")}`,
    "over-bend": `über ${the("bend", "acc")}`,
    "past-bend-end": `knapp über das Ende ${the("bend", "gen")} hinaus`,
    "well-past-bend": `deutlich über ${the("bend", "acc")} hinaus`,
    "rear-end": `bis zu dem hinteren Ende ${along}`,
    "well-past-rear-end": `deutlich über das hintere Ende ${along} hinaus`,
  };
  /** What is tied in (accusative), and the noun its pronoun refers to. */
  const what = (w: What): { text: string; refers: Noun | "plural" } => {
    // A coloured material after a measure word reads best with "aus": "ein Büschel aus weißem Bucktail".
    const after = (id: string) => (colour(find(id)?.color) ? `aus ${mat(id, "dat", "none")}` : mat(id, "nom", "none"));
    if (w.kind === "strands") return { text: `${count(w.n, "strand", "acc")} ${after(w.m)}`, refers: w.n === 1 ? word("strand") : "plural" };
    if (w.kind === "bunch") return { text: `${a("bunch", "acc")} ${after(w.m)}`, refers: word("bunch") };
    return { text: mat(w.m, "acc"), refers: noun(w.m) };
  };
  const turns = (n: number, open = false) => count(n, "turn", "dat", open ? "offen" : undefined);
  const eights = many("figure-of-eight", "dat");
  const counter = (c: boolean) => (c ? `, entgegen ${the("turn", "dat", true)} darunter` : "");
  const angle = (deg?: number) => (deg ? `, etwa ${deg}° von ${the(alongId, "dat")} nach oben angewinkelt` : "");
  const pick = (w?: Length) => (w ? `Wähle eine Feder, die etwa ${length(w)} breit ist. ` : "");
  const flare = (f: boolean, refers: Noun | "plural") => (f ? ` Lass ${pronoun(refers).acc} um die Seiten ${the("body", "gen")} abspreizen.` : "");
  const thread = the("thread", "acc");
  const excess = the("excess", "acc");

  return (said: Said): string => {
    switch (said.kind) {
      case "slide-bead":
        if (said.shot) return `Klemme ${mat(said.m, "acc")} direkt hinter ${the("eye", "dat")} auf den Schenkel und klebe ${pronoun(noun(said.m)).acc} fest; bemale ${pronoun(noun(said.m)).acc}, mit einem Auge auf jeder Seite.`;
        return said.mount === "tube"
          ? `Schiebe ${mat(said.m, "acc")} auf das vordere Ende ${the("tube", "gen")}.`
          : `Schiebe ${mat(said.m, "acc")} ${said.mount === "hook" ? `um ${the("bend", "acc")} ` : ""}bis zu ${the("eye", "dat")}, das kleine Loch zuerst.`;
      case "weight":
        return `Wickle ${mat(said.m, "acc")} in dichten ${many("turn", "dat")} ${place(said.from).from} ${place(said.to).to}.`;
      case "attach-thread":
        return `Lege ${thread} ${place(said.at).at}${said.again ? " erneut" : ""} mit ein paar ${many("turn", "dat")} an und schneide ${the("tag-end", "acc")} ab.`;
      case "bind-back": {
        const how = said.turns ? `Führe ${thread} in ${turns(said.turns, true)} über ${mat(said.m, "acc")} zurück` : `Führe ${thread} über ${mat(said.m, "acc")} zurück`;
        const past = said.past ? ` und weiter hinter ${the("bend", "dat")}, nur um ${the("hair", "acc")} herum,` : "";
        return `${how} ${place(said.to).to}, sodass ${pronoun(noun(said.m)).nom} entlang ${the("body", "gen")}${past} festgebunden ${verb(noun(said.m), "wird", "werden")}. Halte ${the("hair", "acc")} dabei mit der anderen Hand nach hinten und die Spannung gleichmäßig.`;
      }
      case "cross-forward":
        return `Führe ${thread} in ${turns(said.turns, true)} wieder nach vorn ${place(said.to).to}, sodass sie die ersten ${many("turn", "acc")} kreuzen.`;
      case "wrap-thread":
        return said.turns
          ? `Führe ${thread} in ${turns(said.turns, true)} ${place(said.to).to}.`
          : `Führe ${thread} in dichten ${many("turn", "dat")} ${place(said.to).to}.`;
      case "tie-in-eyes":
        return `Binde ${mat(said.m, "acc")} mit ${eights} ${said.under ? "unter" : "auf"} ${the(alongId, "acc")}.`;
      case "tie-in-extended": {
        const refers = noun(said.m);
        const p = pronoun(refers);
        const tipColour = colour(said.tip);
        const tip = said.tip
          ? ` Färbe das Ende ${tipColour ? deAdjective(tipColour, "") : "dunkler"}${said.tip === "black" ? ` (mit ${a("lighter", "dat")} ansengen)` : ""}.`
          : "";
        if (said.segments) {
          const t = said.tails ? noun(said.tails.m) : null;
          const tails = said.tails && t
            ? `Binde ${mat(said.tails.m, "acc")} an ihrer Spitze ein, so dass ${pronoun(t).nom} ${length(said.tails.length)} ${verb(t, "übersteht", "überstehen")}, lege einen Streifen aus ${mat(said.m, "dat", "none")} darüber, die Fibern zwischen den Hälften,`
            : `Lege einen Streifen aus ${mat(said.m, "dat", "none")} über ihre Spitze`;
          const ends = said.ends ? ", die beiden Enden des Streifens nach vorn, um sie später nach vorn zu ziehen" : "";
          return `Mache zuerst ${the("body", "acc")} auf einer Nadel mit einer dünnen Fadenunterlage: ${tails} und binde ihn nach vorn arbeitend in ${number(said.segments)} Segmente ab, mit ein paar festen ${many("turn", "dat")} an jeder Taille. Mache einen halben Schlag und ziehe ${the("body", "acc")} von der Nadel. Binde ${pronoun(word("body")).acc} mit dem vordersten Segment oben auf ${the(alongId, "acc")}, so dass ${pronoun(word("body")).nom} ${length(said.length)} ${said.forward ? `nach vorn über ${the("eye", "acc")}` : "nach hinten"} übersteht${ends}.${tip}`;
        }
        const t = said.tails ? noun(said.tails.m) : null;
        const tails = said.tails && t ? ` ${capitalize(mat(said.tails.m, "nom"))} ${verb(t, "steht", "stehen")} ${length(said.tails.length)} über das Ende hinaus, wo ${pronoun(t).nom} vorher eingebunden ${verb(t, "wurde", "wurden")}.` : "";
        return `Binde ${mat(said.m, "acc")} so ein, dass ${p.nom} ${length(said.length)} ${said.forward ? `nach vorn über ${the("eye", "acc")}` : "nach hinten"} in einem Stück ${verb(refers, "übersteht", "überstehen")}.${tails}${tip}`;
      }
      case "tie-in-across": {
        const lean = said.fan
          ? ` Fächere sie über etwa ${said.fan}° auf, die hinteren nach hinten und die vorderen nach vorn geneigt.`
          : said.angle && said.angle >= 10 ? ` Lass sie etwa ${said.angle}° nach hinten geneigt stehen.` : "";
        return `Binde ${what({ kind: "strands", n: said.strands, m: said.m }).text} mittig mit ${eights} quer über ${the(alongId, "acc")}, so dass auf jeder Seite ${length(said.length)} als Beine ${lengthPlural(said.length) ? "überstehen" : "übersteht"}.${lean}`;
      }
      case "tie-in-forward":
        return `Binde ${mat(said.m, "acc")} so ein, dass ${pronoun(noun(said.m)).nom} nach vorn über ${the("eye", "acc")} ${verb(noun(said.m), "zeigt und", "zeigen und")} ${length(said.length)} ${verb(noun(said.m), "übersteht", "überstehen")}.${said.round ? ` Lass ${pronoun(noun(said.m)).acc} sich beim Festziehen rund um ${the(alongId, "acc")} verteilen.` : ""}`;
      case "tie-in-upright": {
        const w = what(said.what);
        const p = pronoun(w.refers);
        return `Binde ${w.text} aufrecht ein, so dass ${p.nom} ${length(said.length)} hoch ${verb(w.refers, "steht", "stehen")}, und richte ${p.acc} mit ${many("turn", "dat")} davor auf.${said.divide ? ` Teile ${p.acc} mit ${eights} zu einem V.` : ""}${said.fan ? ` Lass ${p.acc} sich nach vorn und hinten auffächern, schmal von Seite zu Seite.` : ""}`;
      }
      case "tie-in-wing-under": {
        const w = what(said.what);
        return `Binde ${w.text} unter ${the(alongId, "dat")} als Flügel ein (oben, wenn die Fliege mit der Hakenspitze nach oben schwimmt), so dass ${pronoun(w.refers).nom} ${length(said.length)} nach hinten ${verb(w.refers, "reicht", "reichen")}.`;
      }
      case "tie-in-beard": {
        const w = what(said.what);
        return `Binde ${w.text} unter ${the(alongId, "dat")} als Bart ein, so dass ${pronoun(w.refers).nom} ${length(said.length)} nach hinten ${verb(w.refers, "reicht", "reichen")}.`;
      }
      case "tie-in-reach": {
        const w = what(said.what);
        return `${pick(said.width)}Binde ${w.text} so ein, dass ${the("tip", "nom", true)} ${REACH[said.reach]} reichen (${length(said.length)} von der Einbindestelle)${angle(said.angle)}.${flare(said.flare, w.refers)}`;
      }
      case "tie-in-behind": {
        const w = what(said.what);
        return `${pick(said.width)}Binde ${w.text} ein und lass ${length(said.length)} nach hinten überstehen${angle(said.angle)}.${flare(said.flare, w.refers)}`;
      }
      case "tie-in":
        if (said.cut) {
          const shape = said.cut.taper ? ", an einem Ende spitz zulaufend" : "";
          return `Schneide einen Streifen aus ${mat(said.what.m, "dat", "none")} zu, etwa ${length(said.cut.width)} breit${shape}, und binde ihn ${said.cut.taper ? "mit der Spitze " : ""}${said.cut.under ? `unter ${the(alongId, "dat")}` : `oben auf ${the(alongId, "acc")}`} mit ein paar festen ${many("turn", "dat")} ein.`;
        }
        return `Binde ${what(said.what).text} mit ein paar festen ${many("turn", "dat")} ein.`;
      case "wind-around":
        return `Winde ${mat(said.m, "acc")} in ${turns(said.turns)} um ${the("base", "acc")} ${mat(said.around, "gen")}, jede unter die vorige.`;
      case "palmer":
        return `Winde ${mat(said.m, "acc")} in ${turns(said.turns, true)} über den Körper zurück ${place(said.to).to}${counter(said.counter)}.`;
      case "wind-through":
        return `Winde ${mat(said.m, "acc")} in ${turns(said.turns)} durch ${mat(said.through, "acc")} nach vorn ${place(said.to).to}${counter(said.counter)}. Die erste Windung hält ${the("tip", "acc")} fest.`;
      case "wind":
        return `Winde ${mat(said.m, "acc")} in ${turns(said.turns)} nach vorn ${place(said.to).to}${counter(said.counter)}.`;
      case "pull-over":
        if (said.fold) return `Ziehe ${mat(said.m, "acc")} über die Oberseite ${the("body", "gen")} nach vorn und binde ${pronoun(noun(said.m)).acc} ${place(said.to).at} mit festen ${many("turn", "dat")} ab; falte dann das Ende über sich selbst zurück zu ${a("head", "dat")}, etwa ${length(said.fold)} lang vor ${the("tie-down", "dat")}, und binde es dort noch einmal ab.${said.trimmedLater ? "" : ` Schneide ${excess} ab.`}`;
        if (said.around) return `Ziehe ${mat(said.m, "acc")} über die Oberseite ${the("body", "gen")} nach vorn, je ein Ende auf jeder Seite ${mat(said.around, "gen")}, und binde ${pronoun(noun(said.m)).acc} ${place(said.to).at} ab.${said.trimmedLater ? "" : ` Schneide ${excess} ab.`}`;
        if (said.wing) return `Ziehe ${mat(said.m, "acc")} über die Oberseite ${the("body", "gen")} nach vorn und binde ${pronoun(noun(said.m)).acc} ${place(said.to).at} ab; richte dann die Spitzen vor der Abbindung als etwa ${length(said.wing)} hohen Flügel auf und teile ihn.`;
        if (said.under) return `${said.bubble ? "Klappe" : "Ziehe"} ${mat(said.m, "acc")} ${said.bubble ? "als lockere Blase " : ""}unter ${the("body", "dat")} nach vorn und binde ${pronoun(noun(said.m)).acc} ${place(said.to).at} ab.${said.trimmedLater ? "" : ` Schneide ${excess} ab.`}`;
        if (said.bubble) return `Klappe ${mat(said.m, "acc")} als lockere Blase über ${the("body", "acc")} nach vorn und binde ${pronoun(noun(said.m)).acc} ${place(said.to).at} ab.${said.trimmedLater ? "" : ` Schneide ${excess} ab.`}`;
        return `Ziehe ${mat(said.m, "acc")} über die Oberseite ${the("body", "gen")} nach vorn und binde ${pronoun(noun(said.m)).acc} ${place(said.to).at} ab.${said.trimmedLater ? "" : ` Schneide ${excess} ab.`}`;
      case "lay-back":
        if (said.tied && (said.round || said.trailing)) {
          const where = said.round ? `rund um ${the(alongId, "acc")}` : `über die Oberseite ${the("body", "gen")}`;
          const head = said.round ? `, sodass davor ${a("head", "nom", "glatt")} bleibt` : "";
          const tips = said.trailing ? ` Lass ${the("tip", "acc", true)} nach hinten entlang ${the("body", "gen")} liegen.` : "";
          return `Klappe ${mat(said.m, "acc")} ${where} nach hinten und binde ${pronoun(noun(said.m)).acc} ${place(said.to).at} mit festen ${many("turn", "dat")} ab${head}.${tips}`;
        }
        if (said.tied) return `Klappe ${mat(said.m, "acc")} über die Oberseite ${the("body", "gen")} nach hinten und binde ${pronoun(noun(said.m)).acc} ${place(said.to).at} ab.`;
        return `Lege ${mat(said.m, "acc")} über die Oberseite ${the("body", "gen")} nach hinten ${place(said.to).to}. Die nächsten Windungen halten ${pronoun(noun(said.m)).acc} dort fest.`;
      case "spin": {
        const clump = word("clump");
        const each = { m: "jeden gegen den vorigen", f: "jede gegen die vorige", n: "jedes gegen das vorige" }[clump.gender as Gender];
        const cut = said.length ? ` Kämme vorher die Unterwolle aus und schneide ${the("clump", "acc", true)} auf etwa ${length(said.length)} zu.` : "";
        return `Spinne ${many("clump", "acc")} aus ${mat(said.m, "dat", "none")} um ${the(alongId, "acc")} und drücke ${each} zurück, ${place(said.to).to}.${cut}`;
      }
      case "glue": {
        const cut = said.length ? ` Schneide die Stücke so zu, dass sie auf jeder Seite etwa ${length(said.length)} überstehen.` : "";
        return `Gib ${place(said.from).from} ${place(said.to).to} eine Linie Kleber oben auf ${the(alongId, "acc")} und drücke flach gedrückte Stücke aus ${mat(said.m, "dat", "none")} hinein, die Fasern quer zu ${the(alongId, "dat")}. Dreh den Haken um und mach unten dasselbe, dann leg oben noch mehr auf.${cut}`;
      }
      case "sleeve": {
        const fray = said.fray ? ` Zupfe das Geflecht hinter der hinteren Abbindung zu losen ${many("strand", "dat")} auf, etwa ${length(said.fray)} lang.` : "";
        return `Ziehe ${mat(said.m, "acc")} über ${the("eye", "acc")} und am Körper entlang, so dass ${pronoun(noun(said.m)).nom} ${place(said.from).from} ${place(said.to).to} ${verb(noun(said.m), "reicht", "reichen")}, und binde das ${said.rear ? "hintere" : "vordere"} Ende ${place(said.from).at} mit festen ${many("turn", "dat")} ab.${fray}`;
      }
      case "tie-off-sleeve":
        return said.end === "front"
          ? `Ziehe ${mat(said.m, "acc")} straff über ${the("body", "acc")}, binde das vordere Ende mit festen ${many("turn", "dat")} ab und schneide ${excess} ab.`
          : `Ziehe ${mat(said.m, "acc")} straff über ${the("body", "acc")} und binde das hintere Ende mit festen ${many("turn", "dat")} ab.`;
      case "weave": {
        const how = `Führe bei jeder Kreuzung ${mat(said.m, "acc")} nur über die Oberseite hin und her und ${mat(said.under, "acc")} darüber und ganz um die Unterseite ${along} herum, sodass ${mat(said.m, "nom")} oben und ${mat(said.under, "nom")} unten liegt und sich beide an jeder Seite in einer Linie treffen. Ziehe beide gleich fest an, damit die Linie gerade bleibt, und halte die Enden dort fest.`;
        return said.parked
          ? `Sichere ${thread} mit einem halben Schlag und lass ${pronoun(word("thread")).acc} ${place(said.to).at} hängen; webe dann ${mat(said.m, "acc")} und ${mat(said.under, "acc")} bis dorthin nach vorn. ${how}`
          : `Webe ${mat(said.m, "acc")} und ${mat(said.under, "acc")} ohne ${thread} am ${word("hook").text} ${place(said.to).to} nach vorn. ${how}`;
      }
      case "dub": {
        const noodle = word("noodle");
        return `Zwirble ${a("noodle", "acc", "dünn")} aus ${mat(said.m, "dat", "none")} auf ${thread} und wickle ${pronoun(noodle).acc} ${said.rear ? "zurück" : "nach vorn"} ${place(said.to).to}.`;
      }
      case "tie-off":
        return `Binde ${mat(said.m, "acc")} mit ein paar ${many("turn", "dat")} ab und schneide ${excess} ab.`;
      case "trim-keep": {
        const fibres = the("fibre", "acc", true);
        return said.keep === "top"
          ? `Schneide ${fibres} ${mat(said.m, "gen")} unten weg, so dass die Fliege tief im Oberflächenfilm sitzt.`
          : said.keep === "under"
            ? `Schneide ${fibres} ${mat(said.m, "gen")} oben dicht an ${the("body", "dat")} ab, so dass eine flache Auflage für den Flügel bleibt.`
            : `Schneide ${fibres} ${mat(said.m, "gen")} oben und unten weg, so dass zwei flache ${many("row", "nom")} seitlich abstehen.`;
      }
      case "trim-spun":
        if (said.disc) return `${said.glued ? "Wenn der Kleber fest ist, schneide" : "Schneide"} ${mat(said.m, "acc")} rund zu einer flachen Scheibe, oben und unten etwa ${length(said.leave)} dick und in der Mitte so breit wie zuvor.`;
        if (said.cone) return `Schneide ${mat(said.m, "acc")} zu einem Kegel, am Schwanz schlank und vorn auf jeder Seite etwa ${length(said.leave)} dick, dort gerade abgeschnitten.`;
        if (said.cigar) return `Schneide ${mat(said.m, "acc")} zu einer Zigarre, auf jeder Seite etwa ${length(said.leave)} dick, in der Mitte am dicksten und an beiden Enden gerundet.`;
        return `Schneide ${mat(said.m, "acc")} in Form, so dass auf jeder Seite ${a("head", "nom")} bleibt, ${pronoun(word("head")).rel} etwa ${length(said.leave)} dick ist.`;
      case "trim-flat":
        return said.keep === "top"
          ? `Schneide ${mat(said.m, "acc")} unten flach, etwa ${length(said.leave)} unter ${the(alongId, "dat")}, und lass den Rest lang.`
          : said.keep === "under"
            ? `Schneide ${mat(said.m, "acc")} oben flach, etwa ${length(said.leave)} über ${the(alongId, "dat")}, und lass den Rest lang.`
            : `Schneide ${mat(said.m, "acc")} oben und unten flach, etwa ${length(said.leave)} von ${the(alongId, "dat")} entfernt, und lass ${said.glued ? the("fibre", "acc", true) : the("hair", "acc")} an den Seiten lang.`;
      case "trim-tip":
        return `Schneide ${the("tip", "acc")} ${mat(said.m, "gen")} dicht an ${the("body", "dat")} ab.`;
      case "trim-cover":
        return said.leave
          ? `Schneide ${excess} ab, lass aber über ${the("eye", "dat")} ${a("stub", "acc")} als Kopf stehen, ${pronoun(word("stub")).rel} ${length(said.leave)} lang ist.`
          : `Schneide ${excess} bündig an ${the("tie-down", "dat")} ab.`;
      case "trim-tips": {
        const last = dePhrase(word("turn"), { case: "dat", article: "definite", colour: adjective("letzt") });
        return said.leave
          ? `Schneide ${the("tip", "acc", true)} ${mat(said.m, "gen")} knapp hinter ${last} darüber ab und lass ${a("stub", "acc")} stehen, ${pronoun(word("stub")).rel} etwa ${length(said.leave)} lang ist.`
          : `Schneide ${the("tip", "acc", true)} ${mat(said.m, "gen")} dicht hinter ${last} darüber ab.`;
      }
      case "trim-butts":
        return said.leave
          ? `Schneide ${the("butt", "acc", true)} ${mat(said.m, "gen")} ab und lass ${a("head", "acc", "kurz")} stehen, ${pronoun(word("head")).rel} ${length(said.leave)} lang ist.`
          : `Schneide ${the("butt", "acc", true)} ${mat(said.m, "gen")} bündig ab.`;
      case "whip-finish":
        if (said.midway) return `Mache hier ${a("whip-finish", "acc")} mit ${turns(said.turns)} und schneide ${thread} ab.`;
        return `Forme ${a("head", "acc", "klein")}, mache ${a("whip-finish", "acc")} mit ${turns(said.turns)} und schneide ${thread} ab.`;
    }
  };
}

/** Part words named in the plural in English (legs, eyes, antennae): their German names are plural too. */
const pluralPart = (w: string) => /s$/.test(w) || w === "antennae";

/** A recipe's part name in the dressing list, from its id ("tail-brown" → "Brauner Schwanz"). */
function partName(id: string): string {
  if (hasTerm("de", "parts", id) && id.includes("-")) return term("de", "parts", id, "noun").text;
  const ids = id.split("-");
  const words = ids.map((w): Noun | Adjective => {
    if (w in NAMED_COLORS) return term("de", "colours", w, "adjective");
    try {
      return term("de", "parts", w, "noun");
    } catch {
      return term("de", "parts", w, "adjective");
    }
  });
  const nouns = words.filter((w): w is Noun => w.kind === "noun");
  const adjectives = words.filter((w): w is Adjective => w.kind === "adjective");
  const head = nouns[0];
  if (!head) {
    // Only adjectives: a colour names a part on its own ("Gelb"); a position needs a noun ("Hinterer Teil").
    const a = adjectives[0]!;
    return ids.some((w) => w in NAMED_COLORS) ? capitalize(a.text) : `${capitalize(deAdjective(a, "er"))} Teil`;
  }
  const plural = pluralPart(ids[words.indexOf(head)]!);
  const ending = plural ? "e" : { m: "er", f: "e", n: "es" }[head.gender as Gender];
  const adjective = adjectives[0];
  const first = !adjective
    ? head.text
    : adjective.compound
      ? `${capitalize(adjective.text)}-${head.text}`
      : `${capitalize(deAdjective(adjective, ending))} ${head.text}`;
  const rest = adjectives.slice(1).map((x) => x.text);
  return [first, ...nouns.slice(1).map((n) => n.text)].join(", ") + (rest.length ? ` (${rest.join(", ")})` : "");
}

const phrase = (n: Noun, c: Colour, plural = false) => dePhrase(n, { case: "nom", article: "none", plural, ...(c ? { colour: c } : {}) });
type Colour = Adjective | undefined;

export const de: Writer = {
  // A label is the translation of the recipe's own (see i18n/prose.ts); otherwise the glossary's name.
  materialName: (m) => m.label ?? capitalize(phrase(material(m), colours(m), usedInPlural(m))),
  colourWord: (c) => (c ? term("de", "colours", c, "adjective").text : "naturfarben"),
  // After the noun the colour stays as it is: "Hechel rot".
  partInColour: (id, c) => `${id === "thread" ? word("thread").text : partName(id)} ${term("de", "colours", c, "adjective").text}`,
  threadName: (c) => capitalize(phrase(word("thread"), colour(c))),
  hookName: (model, english, length) => {
    const name = term("de", "hooks", model, "phrase").text;
    return isTube(model) && length !== undefined ? `${name}, ${length} mm` : name || english;
  },
  role: (id) => word(id).text,
  partName,
  detail: (d: Detail) => {
    switch (d.kind) {
      case "size":
        return `Größe ${d.size}`;
      case "strands":
        return count(d.n, "strand", "nom");
      case "fibre-mm":
        return `${deNoun(word("fibre"), "nom", true)} ${number(d.mm)} mm`;
      case "fibre-gape":
        return `${deNoun(word("fibre"), "nom", true)} ${length({ kind: "gape", gapes: d.gapes })}`;
      case "mm":
        return `${number(d.mm)} mm`;
      case "text":
        return d.text;
      case "count":
        return count(d.n, d.unit === "strands" ? "strand" : d.unit === "biots" ? "biot" : d.unit === "hairs" ? "hair" : "fibre", "nom");
    }
  },
  text: (said, recipe, note) => {
    const text = deContract(writerFor(recipe)(said));
    return note ? `${text} ${note}` : text;
  },
  title: (op, m, id) => {
    const title = term("de", "steps", op, "phrase").text;
    if (id === undefined) return title;
    return `${title}: ${m ? (m.label ?? phrase(material(m), colours(m), usedInPlural(m))) : id}`;
  },
};
