import type { MaterialKind } from "../../recipe/materials";
import { kindName } from "../../tying/describe";
import { inLang } from "../lang";
import type { RuleCatalog } from ".";

/**
 * The tying rules' messages in German (src/recipe/rules.ts has them in English).
 * Draft: awaits review by a native speaker who ties flies, like the glossary.
 */

const PERCENT = new Intl.NumberFormat("de-DE", { style: "percent", maximumFractionDigits: 1 });

/** A position on the shank (0 the bend, 1 behind the eye): "40 % des Hakenschenkels". */
const at = (x: number) => `${PERCENT.format(x)} des Hakenschenkels`;

/**
 * The kind's German name. Some are plural ("Gummibeine"), so the sentences that use it avoid a
 * verb agreeing with it and put it where nominative and accusative look alike.
 */
const kind = (k: MaterialKind) => inLang("de", () => kindName(k));

export const RULES_DE: RuleCatalog = {
  duplicateMaterial: (p) => `Das Material „${p.m}“ ist mehr als einmal angegeben.`,
  afterWhipFinish: () => "Nach dem Kopfknoten kann nur noch geschnitten werden.",
  unknownMaterial: (p) => `Es gibt kein Material namens „${p.m}“.`,
  tieOffNext: (p) => `„${p.m}“ wurde gerade gewunden und muss abgebunden werden, bevor es weitergeht.`,
  securePalmer: (p) => `„${p.m}“ wurde in offenen Windungen nach hinten gewunden. Sichere die Spitze, indem du ein anderes Material darüber nach vorn windest.`,
  notABead: (p) => `„${p.m}“ ist keine Perle.`,
  beadBeforeThread: () => "Schiebe die Perle auf, bevor du den Bindefaden anlegst.",
  beadBeforeWeight: () => "Schiebe die Perle auf, bevor du den Hakenschenkel beschwerst.",
  alreadyOnHook: (p) => `„${p.m}“ ist schon auf dem Haken.`,
  weightWithWire: (p) => `Beschwert wird mit Draht, nicht mit „${p.m}“.`,
  weightForward: () => "Die Beschwerung läuft nach vorn: Sie muss weiter vorn am Hakenschenkel enden, als sie beginnt.",
  threadAttached: () => "Der Bindefaden ist schon angelegt.",
  threadFirst: () => "Lege zuerst den Bindefaden an.",
  threadThere: () => "Der Bindefaden ist schon dort.",
  onlyDubbing: (p) => `Nur Dubbing lässt sich dubben. Binde „${p.m}“ stattdessen ein.`,
  onlyHairSpun: (p) => `Nur Haar lässt sich aufspinnen, nicht „${p.m}“.`,
  spinForward: () => "Spinne das Haar vom Bindefaden aus nach vorn auf.",
  dubNotTie: () => "Dubbing wird nicht eingebunden, sondern auf den Bindefaden gedubbt.",
  beadSlides: () => "Eine Perle wird nicht eingebunden: Schiebe sie auf, bevor du den Bindefaden anlegst.",
  featherBack: () => "Federn werden nach hinten zeigend eingebunden, nicht nach vorn.",
  needsLength: (p) => `Für ${kind(p.kind)} braucht es eine Länge, denn das Material steht von der Einbindestelle ab.`,
  eyesNoLength: () => "Augen werden ohne Länge eingebunden.",
  angleNeedsLength: () => "Ein Winkel lässt sich nur für Material angeben, das mit einer Länge eingebunden wird.",
  spreadOnly: () => "Eine Spreizung lässt sich nur für Tags, Schwänze und Flügel angeben, die mit einer Länge eingebunden werden.",
  widthOnly: () => "Eine Breite lässt sich nur für Federflügel angeben.",
  sideOnly: () => "Die Seite lässt sich nur für Schwänze, Bärte, Flügel und Augen wählen.",
  acrossOnly: () => "Nur Beine und einzelne Stränge aus Haar, Fibern, Biots oder Flash lassen sich quer über den Hakenschenkel einbinden.",
  forwardNeedsLength: () => "Nur Material, das mit einer Länge eingebunden wird, kann nach vorn zeigen.",
  forwardUpright: () => "Ein Material, das nach vorn zeigt, kann nicht zugleich aufrecht stehen.",
  extendedOnly: () => "Nur Chenille, Garn oder Foam, mit einer Länge eingebunden, kann in einem Stück überstehen.",
  tipOnly: () => "Ein gefärbtes Ende gibt es nur bei Material, das in einem Stück übersteht.",
  alreadyTiedIn: (p) => `„${p.m}“ ist schon eingebunden.`,
  tieInBeforeWind: (p) => `Binde „${p.m}“ ein, bevor du es windest.`,
  alreadyWound: (p) => `„${p.m}“ ist schon gewunden.`,
  cantWind: (p) => `${kind(p.kind)} kann man nicht winden.`,
  toOrAround: () => "Gib entweder an, wo am Hakenschenkel die Windungen enden, oder um welchen Post die Hechel gewunden wird (Parachute).",
  counterAlong: () => "Gegenläufig winden geht nur entlang des Hakenschenkels, nicht um einen Post.",
  hackleAroundPost: () => "Nur Hechel wird um einen Post gewunden.",
  notAPost: (p) => `„${p.post}“ muss ein aufrecht eingebundenes Büschel sein (Winkel 60° oder mehr), um als Post zu dienen.`,
  windFromTieIn: (p) => `„${p.m}“ ist bei ${at(p.at)} eingebunden. Winde es von dort nach vorn oder nach hinten.`,
  threadElsewhere: (p) => `Der Bindefaden ist bei ${at(p.thread)}. Führe ihn bis ${at(p.to)}, bevor du bis dorthin windest.`,
  windToThread: (p) => `Der Bindefaden ist bei ${at(p.thread)}. Winde bis zu ihm nach vorn, oder führe den Faden zuerst zurück bis ${at(p.to)}.`,
  tieInBeforePull: (p) => `„${p.m}“ muss eingebunden (und noch nicht verarbeitet) sein, bevor es nach vorn geklappt wird.`,
  pullForward: (p) => `Klappe „${p.m}“ von der Einbindestelle aus nach vorn, oder lege es nach hinten über den Körper.`,
  secureLaidBack: (p) => `Du hast „${p.m}“ nach hinten über den Körper gelegt. Halte das Ende fest, indem du ein anderes Material darüber nach vorn windest.`,
  threadForPull: (p) => `Der Bindefaden ist bei ${at(p.thread)}. Führe ihn bis ${at(p.to)}, um das Material dort abzubinden.`,
  windBeforeTieOff: (p) => `„${p.m}“ muss nach vorn gewunden werden, bevor es abgebunden wird.`,
  keepOnly: () => "Einen Teil der Hechel wegschneiden geht nur, wenn sie gewunden und abgebunden ist.",
  alreadyKept: (p) => `Von „${p.m}“ ist schon ein Teil weggeschnitten.`,
  nothingToTrim: (p) => `Von „${p.m}“ gibt es nichts zu schneiden.`,
  leaveOnly: () => "Eine Länge stehen lassen geht nur bei Haarenden, aufgesponnenem Haar und Rücken aus Foam.",
  shapeOnly: () => "In Form schneiden lässt sich nur aufgesponnenes Haar oder Haarenden.",
  neverTiedOff: (p) => `„${p.m}“ ist gewunden, wird aber nie ${p.rear ? "gesichert" : "abgebunden"}.`,
  trimTip: (p) => `Die Spitze von „${p.m}“ hängt noch am Hakenbogen. Schneide sie ab.`,
  neverUsedAfterTieIn: (p) => `„${p.m}“ ist eingebunden, wird aber nie gewunden oder nach vorn geklappt.`,
  neverUsed: (p) => `„${p.m}“ steht in der Liste, wird aber nie verwendet.`,
  endWithWhipFinish: () => "Die Fliege muss mit einem Kopfknoten enden.",
  sitsFloats: () => "Wie eine Fliege auf dem Wasser liegt, gilt nur für eine Fliege, die schwimmt.",
  tooMuchToDraw: () => "Ab diesem Schritt gibt es mehr Windungen, als die 3D-Ansicht zeichnen kann: Nimm weniger Windungen oder weniger Schritte.",
};
