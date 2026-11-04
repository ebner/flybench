import { hasTerm, term, type Adjective, type Noun } from "../i18n/glossary";
import { adjectiveList, capitalize, svNoun, svPhrase } from "../i18n/grammar";
import { isTube, NAMED_COLORS, type Material, type Recipe } from "../recipe/schema";
import { hookModel } from "./hook";
import { gapeFraction, namedColours, usedInPlural, type Detail, type Length, type Mount, type Place, type Reach, type Said, type What, type Writer } from "./describe";

/** Swedish: the texts generated from a recipe, with the glossary's words. A draft until reviewed. */

const word = (id: string) => term("sv", "words", id, "noun");
const material = (m: Material) => term("sv", "materials", m.kind, "noun");
const colour = (c: string | undefined): Adjective | undefined => (c && c in NAMED_COLORS ? term("sv", "colours", c, "adjective") : undefined);
/** A material's colour, or the colours of a blended bunch ("orange, gul och svart"). */
/** A blended bunch's own shade, when it is the material's natural colour or a hex colour. */
const NATURAL: Adjective = { kind: "adjective", id: "natural", text: "naturfärgad", invariable: false, compound: false, forms: { neuter: "naturfärgat", plural: "naturfärgade" }, notes: [], sources: [], line: 0 };
const colours = (m: Material): Adjective | undefined => {
  const list = namedColours(m).map((c) => (c ? colour(c)! : NATURAL));
  return list.length ? adjectiveList(list, "och") : undefined;
};
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
    const phrase = svPhrase(material(m), colours(m), form, usedInPlural(m));
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
    "past-rear": (p) => {
      const at = `${length((p as { length: Length }).length)} bakom ${mount === "hook" ? `${genitive(def("bend"))} början` : `${genitive(along)} bakre ände`}`;
      return { at, to: `till ${at}`, from: `från ${at}` };
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
        if (said.shot) return `Kläm fast ${mat(said.m)} på skaftet strax bakom ${def("eye")} och limma den; måla den, med ett öga på varje sida.`;
        return said.mount === "tube"
          ? `Trä ${mat(said.m)} på ${genitive(def("tube"))} främre ände.`
          : `Trä ${mat(said.m)} ${said.mount === "hook" ? `runt ${def("bend")} och ` : ""}upp till ${def("eye")}, med det lilla hålet först.`;
      case "weight":
        return `Linda ${mat(said.m)} i täta ${svNoun(word("turn"), "plural")} ${place(said.from).from} ${place(said.to).to}.`;
      case "attach-thread":
        return `Fäst ${thread}${said.again ? " igen" : ""} ${place(said.at).at} med några ${svNoun(word("turn"), "plural")} och klipp av ${def("tag-end")}.`;
      case "wrap-thread":
        return said.turns
          ? `Linda ${thread} ${place(said.to).to} i ${turns(said.turns, true)}.`
          : `Linda ${thread} ${place(said.to).to} i täta ${svNoun(word("turn"), "plural")}.`;
      case "bind-back": {
        const how = said.turns ? `Linda ${thread} i ${turns(said.turns, true)} bakåt över ${mat(said.m)}` : `Linda ${thread} bakåt över ${mat(said.m)}`;
        const past = said.past ? ` och vidare bakom ${def("bend")}, runt bara ${def("hair")}` : "";
        return `${how} ${place(said.to).to}, så att ${pronoun(noun(said.m)).subject} binds fast längs ${def("body")}${past}. Håll ${def("hair")} bakåt med andra handen medan du lindar, och håll jämn spänning.`;
      }
      case "cross-forward":
        return `Linda ${thread} framåt igen ${place(said.to).to} i ${turns(said.turns, true)}, så att de korsar de första ${svNoun(word("turn"), "plural-definite")}.`;
      case "tie-in-eyes":
        return `Bind fast ${mat(said.m)} ${said.under ? "under" : "ovanpå"} ${along} med ${eights}.`;
      case "tie-in-extended": {
        const p = pronoun(noun(said.m));
        const tipColour = colour(said.tip);
        const tip = said.tip
          ? ` Färga änden ${tipColour ? tipColour.text : "mörkare"}${said.tip === "black" ? ` (bränn den med ${article(word("lighter"))} ${word("lighter").text})` : ""}.`
          : "";
        if (said.segments) {
          const tails = said.tails
            ? `bind in ${mat(said.tails.m)} vid spetsen så att ${pronoun(noun(said.tails.m)).subject} sticker ut ${length(said.tails.length)}, vik en remsa ${mat(said.m, "indefinite")} över ${pronoun(noun(said.tails.m)).object} med fibrerna mellan halvorna,`
            : `vik en remsa ${mat(said.m, "indefinite")} över spetsen`;
          const ends = said.ends ? ", med remsans två ändar pekande framåt för att dras över senare" : "";
          return `Gör först ${def("body")} på en nål med ett tunt underlag av ${word("thread").text}: ${tails} och bind den i ${number(said.segments)} segment framåt, med några fasta ${svNoun(word("turn"), "plural")} tråd vid varje midja. Slå ett halvslag och dra av ${def("body")} från nålen. Bind fast ${pronoun(word("body")).object} ovanpå ${along} med det främre segmentet, så att ${pronoun(word("body")).subject} sticker ut ${length(said.length)} ${said.forward ? `framåt över ${def("eye")}` : "bakåt"}${ends}.${tip}`;
        }
        const tails = said.tails ? ` ${capitalize(mat(said.tails.m))} sticker ut ${length(said.tails.length)} förbi änden, där ${pronoun(noun(said.tails.m)).subject} bands in i förväg.` : "";
        return `Bind in ${mat(said.m)} så att ${p.subject} sticker ut ${length(said.length)} ${said.forward ? `framåt över ${def("eye")}` : "bakåt"} i ett stycke.${tails}${tip}`;
      }
      case "tie-in-across": {
        const lean = said.fan
          ? ` Fördela dem som en solfjäder över ungefär ${said.fan}°, de bakre lutande bakåt och de främre framåt.`
          : said.angle && said.angle >= 10 ? ` Låt dem luta ungefär ${said.angle}° bakåt.` : "";
        return `Bind ${count(said.strands, word("strand"))} ${mat(said.m, "indefinite")} tvärs över ${along} på mitten med ${eights}, så att ${length(said.length)} sticker ut på varje sida som ben.${lean}`;
      }
      case "tie-in-forward":
        return `Bind in ${mat(said.m)} så att ${pronoun(noun(said.m)).subject} pekar framåt över ${def("eye")} och sticker ut ${length(said.length)}.${said.round ? ` Låt ${pronoun(noun(said.m)).object} fördela sig runt hela ${along} när du drar åt.` : ""}`;
      case "tie-in-upright": {
        const w = what(said.what);
        const p = pronoun(w.refers);
        return `Bind in ${w.text} upprätt så att ${p.subject} står ${length(said.length)} upp, med ${svNoun(word("turn"), "plural")} framför som reser ${p.object}.${said.divide ? ` Dela ${p.object} i ett V med ${eights}.` : ""}${said.fan ? ` Låt ${p.object} breda ut sig som en solfjäder framåt och bakåt, smal från sida till sida.` : ""}`;
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
        const fray = said.fray ? ` Dra ut kärnan och repa upp ${pronoun(w.refers).object} till lösa ${svNoun(word("strand"), "plural")}.` : "";
        return `${pick(said.width)}Bind in ${w.text} och låt ${length(said.length)} sticka ut bakåt${angle(said.angle)}.${flare(said.flare, w.refers)}${fray}`;
      }
      case "tie-in":
        if (said.cut) {
          const shape = said.cut.taper ? ", avsmalnande till en spets i ena änden" : "";
          return `Skär en remsa ${mat(said.what.m, "indefinite")} som är ungefär ${length(said.cut.width)} bred${shape}, och bind in den${said.cut.taper ? " med spetsen" : ""} ${said.cut.under ? "under" : "ovanpå"} ${along} med några fasta ${svNoun(word("turn"), "plural")} tråd.`;
        }
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
        if (said.fold) return `Dra ${mat(said.m)} framåt över ${genitive(def("body"))} ovansida och bind ner ${pronoun(noun(said.m)).object} ${place(said.to).at} med fasta ${svNoun(word("turn"), "plural")}; vik sedan änden bakåt över sig själv till ${article(word("head"))} ${word("head").text} på ungefär ${length(said.fold)} framför ${def("tie-down")} och bind ner den igen där.${said.trimmedLater ? "" : ` Klipp bort ${excess}.`}`;
        if (said.around) return `Dra ${mat(said.m)} framåt över ${genitive(def("body"))} ovansida, en ände på var sida om ${mat(said.around)}, och bind ner ${pronoun(noun(said.m)).object} ${place(said.to).at}.${said.trimmedLater ? "" : ` Klipp bort ${excess}.`}`;
        if (said.wing) return `Dra ${mat(said.m)} framåt över ${genitive(def("body"))} ovansida och bind ner ${pronoun(noun(said.m)).object} ${place(said.to).at}; res sedan topparna framför inbindningen som en vinge på ungefär ${length(said.wing)} och dela den.`;
        if (said.under) return `${said.bubble ? "Vik" : "Dra"} ${mat(said.m)} framåt under ${def("body")}${said.bubble ? " som en lös bubbla" : ""} och bind ner ${pronoun(noun(said.m)).object} ${place(said.to).at}.${said.trimmedLater ? "" : ` Klipp bort ${excess}.`}`;
        if (said.bubble) return `Vik ${mat(said.m)} framåt över ${def("body")} som en lös bubbla och bind ner ${pronoun(noun(said.m)).object} ${place(said.to).at}.${said.trimmedLater ? "" : ` Klipp bort ${excess}.`}`;
        return `Dra ${mat(said.m)} framåt över ${genitive(def("body"))} ovansida och bind ner ${pronoun(noun(said.m)).object} ${place(said.to).at}.${said.trimmedLater ? "" : ` Klipp bort ${excess}.`}`;
      case "lay-back":
        if (said.tied && (said.round || said.trailing)) {
          const where = said.round ? `runt hela ${along}` : `över ${genitive(def("body"))} ovansida`;
          const head = said.round ? `, så att ${article(word("head"))} slätt, runt ${word("head").text} blir kvar framför ${def("tie-down")}` : "";
          const tips = said.trailing ? ` Låt ${svNoun(word("tip"), "plural-definite")} ligga kvar bakåt längs ${def("body")}.` : "";
          return `Vik ${mat(said.m)} bakåt ${where} och bind ner ${pronoun(noun(said.m)).object} ${place(said.to).at} med hårda ${svNoun(word("turn"), "plural")}${head}.${tips}`;
        }
        if (said.tied) return `Vik ${mat(said.m)} bakåt över ${genitive(def("body"))} ovansida och bind ner ${pronoun(noun(said.m)).object} ${place(said.to).at}.`;
        return `Lägg ${mat(said.m)} bakåt över ${genitive(def("body"))} ovansida ${place(said.to).to}. Nästa lindning håller ${pronoun(noun(said.m)).object} där.`;
      case "spin": {
        const cut = said.length ? ` Kamma först ur underullen och klipp ${svNoun(word("clump"), "plural-definite")} till ungefär ${length(said.length)}.` : "";
        return `Spinn ${svNoun(word("clump"), "plural")} av ${mat(said.m, "indefinite")} runt ${along} och packa var och en bakåt mot den förra, ${place(said.to).to}.${cut}`;
      }
      case "glue": {
        const cut = said.length ? ` Klipp bitarna så att de sticker ut ungefär ${length(said.length)} på varje sida.` : "";
        return `Lägg en sträng lim längs ovansidan av ${along} ${place(said.from).from} ${place(said.to).to} och tryck ner tillplattade bitar ${mat(said.m, "indefinite")} i limmet, med fibrerna tvärs över ${along}. Vänd kroken och gör likadant undertill, och lägg sedan på mer ovanpå.${cut}`;
      }
      case "sleeve": {
        const fray = said.fray ? ` Repa upp flätan bakom den bakre inbindningen till lösa ${svNoun(word("strand"), "plural")}, ungefär ${length(said.fray)} långa.` : "";
        return `Trä ${mat(said.m)} över ${def("eye")} och längs ${def("body")} så att ${pronoun(noun(said.m)).subject} når ${place(said.from).from} ${place(said.to).to}, och bind ner den ${said.rear ? "bakre" : "främre"} änden ${place(said.from).at} med hårda ${svNoun(word("turn"), "plural")}.${fray}`;
      }
      case "tie-off-sleeve":
        return said.end === "front"
          ? `Sträck ${mat(said.m)} hårt över ${def("body")}, bind ner den främre änden med hårda ${svNoun(word("turn"), "plural")} och klipp bort ${excess}.`
          : `Sträck ${mat(said.m)} hårt över ${def("body")} och bind ner den bakre änden med hårda ${svNoun(word("turn"), "plural")}.`;
      case "weave": {
        const how = `för vid varje korsning ${mat(said.m)} fram och tillbaka bara över ovansidan och ${mat(said.under)} över ${pronoun(noun(said.m)).object} och runt under ${along}, så att ${mat(said.m)} ligger överst och ${mat(said.under)} underst och de möts i en linje längs varje sida. Dra båda lika hårt så att linjen blir rak, och håll ändarna där.`;
        return said.parked
          ? `Slå ett halvslag på ${thread} och låt ${pronoun(word("thread")).object} hänga ${place(said.to).at}, och väv sedan ${mat(said.m)} och ${mat(said.under)} framåt fram till ${pronoun(word("thread")).object}: ${how}`
          : `Väv ${mat(said.m)} och ${mat(said.under)} framåt ${place(said.to).to}, utan ${thread} på ${def("hook")}: ${how}`;
      }
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
        if (said.disc) return `${said.glued ? "När limmet har torkat, klipp" : "Klipp"} ${mat(said.m)} runt till en platt skiva, ungefär ${length(said.leave)} tjock ovanpå och undertill och lika bred som på mitten.`;
        if (said.cone) return `Klipp ${mat(said.m)} till en kon, smal vid stjärten och ungefär ${length(said.leave)} tjock på varje sida framtill, rakt avskuren där.`;
        if (said.cigar) return `Klipp ${mat(said.m)} till en cigarr, ungefär ${length(said.leave)} tjock på varje sida, tjockast på mitten och rundad i båda ändar.`;
        return `Klipp ${mat(said.m)} till form, så att ${article(word("head"))} ${word("head").text} på ungefär ${length(said.leave)} blir kvar på varje sida.`;
      case "trim-flat":
        return said.keep === "top"
          ? `Klipp ${mat(said.m)} plant undertill, ungefär ${length(said.leave)} under ${along}, och låt resten vara långt.`
          : said.keep === "under"
            ? `Klipp ${mat(said.m)} plant upptill, ungefär ${length(said.leave)} över ${along}, och låt resten vara långt.`
            : `Klipp ${mat(said.m)} plant upptill och undertill, ungefär ${length(said.leave)} från ${along}, och låt ${said.glued ? `${svNoun(word("fibre"), "plural-definite")} på sidorna vara långa` : `${def("hair")} på sidorna vara långt`}.`;
      case "trim-tip":
        return `Klipp av ${svNoun(word("tip"), "definite")} på ${mat(said.m)} tätt intill ${def("body")}.`;
      case "trim-cover":
        return said.leave
          ? `Klipp bort ${excess} av ${mat(said.m, "indefinite")} men lämna ${article(word("stub"))} ${word("stub").text} på ${length(said.leave)} över ${def("eye")} som ${word("head").text}.`
          : `Klipp bort ${excess} av ${mat(said.m, "indefinite")} jäms med ${def("tie-down")}.`;
      case "trim-tips": {
        const last = `${word("turn").gender === "ett" ? "det" : "den"} sista ${def("turn")}`;
        return said.leave
          ? `Klipp ${svNoun(word("tip"), "plural-definite")} på ${mat(said.m)} strax bakom ${last} över dem, och lämna ${article(word("stub"))} ${word("stub").text} på ungefär ${length(said.leave)}.`
          : `Klipp ${svNoun(word("tip"), "plural-definite")} på ${mat(said.m)} tätt bakom ${last} över dem.`;
      }
      case "trim-butts":
        return said.leave
          ? `Klipp ${svNoun(word("butt"), "plural-definite")} på ${mat(said.m)} och lämna ${article(word("head"))} kort ${word("head").text} på ${length(said.leave)}.`
          : `Klipp ${svNoun(word("butt"), "plural-definite")} på ${mat(said.m)} jäms.`;
      case "whip-finish":
        if (said.midway) return `Gör ${article(word("whip-finish"))} ${word("whip-finish").text} här med ${turns(said.turns)} och klipp av ${thread}.`;
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
  materialName: (m) => m.label ?? capitalize(svPhrase(material(m), colours(m), "indefinite", usedInPlural(m))),
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
    return isTube(model) && length !== undefined ? `${name}, ${length} mm` : name || english;
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
    const name = m?.label ? m.label.charAt(0).toLowerCase() + m.label.slice(1) : m && svPhrase(material(m), colours(m), "indefinite", usedInPlural(m));
    return `${title}: ${name ?? id}`;
  },
};
