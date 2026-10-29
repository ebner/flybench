import type { MaterialKind } from "../../recipe/materials";
import { kindName } from "../../tying/describe";
import { inLang } from "../lang";
import type { RuleCatalog } from ".";

/**
 * The tying rules' messages in Swedish (src/recipe/rules.ts has them in English).
 * Draft: awaits review by a native speaker who ties flies, like the glossary.
 */

const PERCENT = new Intl.NumberFormat("sv-SE", { style: "percent", maximumFractionDigits: 1 });

/** A position on the shank (0 the bend, 1 behind the eye): "40 % av krokskaftet". */
const at = (x: number) => `${PERCENT.format(x)} av krokskaftet`;

/** The kind's Swedish name; it starts a sentence, so its capital stays. */
const kind = (k: MaterialKind) => inLang("sv", () => kindName(k));

export const RULES_SV: RuleCatalog = {
  duplicateMaterial: (p) => `Materialet ”${p.m}” finns med mer än en gång.`,
  afterWhipFinish: () => "Efter whipfinishknuten kan du bara klippa.",
  unknownMaterial: (p) => `Det finns inget material som heter ”${p.m}”.`,
  tieOffNext: (p) => `Du har just lindat ”${p.m}”. Fäst och klipp det innan du gör något annat.`,
  securePalmer: (p) => `Du lindade ”${p.m}” bakåt. Lås det genom att linda ett annat material framåt över dess spets.`,
  notABead: (p) => `”${p.m}” är ingen skalle.`,
  beadBeforeThread: () => "Trä på skallen innan du fäster bindtråden.",
  beadBeforeWeight: () => "Trä på skallen innan du förtynger krokskaftet.",
  alreadyOnHook: (p) => `”${p.m}” sitter redan på kroken.`,
  weightWithWire: (p) => `Förtyngning görs med metalltråd, inte med ”${p.m}”.`,
  weightForward: () => "Förtyngningen går framåt: den ska sluta längre fram på krokskaftet än den börjar.",
  threadAttached: () => "Bindtråden är redan fäst.",
  threadFirst: () => "Fäst bindtråden först.",
  threadThere: () => "Bindtråden är redan där.",
  onlyDubbing: (p) => `Bara dubbing kan dubbas. Bind in ”${p.m}” i stället.`,
  onlyHairSpun: (p) => `Bara hår kan spinnas, inte ”${p.m}”.`,
  spinForward: () => "Spinn håret framåt från bindtråden.",
  dubNotTie: () => "Dubbing binds inte in: dubba den på bindtråden i stället.",
  beadSlides: () => "En skalle binds inte in: trä på den innan du fäster bindtråden.",
  featherBack: () => "Fjädrar binds in så att de pekar bakåt, inte framåt.",
  needsLength: (p) => `${kind(p.kind)} sticker ut där materialet binds in, så ange en längd.`,
  eyesNoLength: () => "Ögon binds in utan längd.",
  angleNeedsLength: () => "En vinkel går bara att ange för material som binds in med en längd.",
  spreadOnly: () => "Spridning går bara att ange för tagar, stjärtar och vingar som binds in med en längd.",
  widthOnly: () => "Bredd går bara att ange för fjädervingar.",
  sideOnly: () => "Sidan går bara att välja för stjärtar, skägg, vingar och ögon.",
  acrossOnly: () => "Bara ben och strån av hår, fibrer, biots eller flash kan bindas in tvärs över krokskaftet.",
  forwardNeedsLength: () => "Bara material som binds in med en längd kan peka framåt.",
  forwardUpright: () => "Ett material som pekar framåt kan inte samtidigt stå upprätt.",
  extendedOnly: () => "Bara chenille, garn eller foam som binds in med en längd kan sticka ut i ett stycke.",
  tipOnly: () => "En färgad ände går bara att ge material som sticker ut i ett stycke.",
  alreadyTiedIn: (p) => `”${p.m}” är redan inbundet.`,
  tieInBeforeWind: (p) => `Bind in ”${p.m}” innan du lindar det.`,
  alreadyWound: (p) => `”${p.m}” är redan lindat.`,
  cantWind: (p) => `${kind(p.kind)} går inte att linda.`,
  toOrAround: () => "Ange antingen var på krokskaftet lindningen ska sluta, eller vilken post hacklet ska lindas runt (parachute).",
  counterAlong: () => "Att linda åt motsatt håll går bara längs krokskaftet, inte runt en post.",
  hackleAroundPost: () => "Bara hackel lindas runt en post.",
  notAPost: (p) => `”${p.post}” måste vara en bunt som är inbunden upprätt (i 60° vinkel eller mer) för att kunna vara post.`,
  windFromTieIn: (p) => `”${p.m}” är inbundet vid ${at(p.at)}. Linda det framåt eller bakåt därifrån.`,
  threadElsewhere: (p) => `Bindtråden är vid ${at(p.thread)}. Flytta den till ${at(p.to)} innan du lindar dit.`,
  windToThread: (p) => `Bindtråden är vid ${at(p.thread)}. Linda fram till den, eller flytta först tillbaka tråden till ${at(p.to)}.`,
  tieInBeforePull: (p) => `”${p.m}” måste vara inbundet (och inte redan använt) innan det kan dras över.`,
  pullForward: (p) => `Dra ”${p.m}” framåt från där det är inbundet, eller lägg det bakåt över kroppen.`,
  secureLaidBack: (p) => `Du lade ”${p.m}” bakåt över kroppen. Håll fast änden genom att linda ett annat material framåt över den.`,
  threadForPull: (p) => `Bindtråden är vid ${at(p.thread)}. Flytta den till ${at(p.to)} för att fästa materialet där.`,
  windBeforeTieOff: (p) => `Linda ”${p.m}” framåt innan du fäster och klipper det.`,
  keepOnly: () => "Att klippa bort en del av hacklet går bara när det är lindat och fäst.",
  alreadyKept: (p) => `En del av ”${p.m}” är redan bortklippt.`,
  nothingToTrim: (p) => `Det finns inget av ”${p.m}” att klippa.`,
  leaveOnly: () => "Att lämna en längd kvar går bara för rotändar av hår, spunnet hår och ryggar av foam.",
  shapeOnly: () => "Att klippa till en form går bara för spunnet hår eller rotändar av hår.",
  neverTiedOff: (p) => `”${p.m}” är lindat men blir aldrig ${p.rear ? "låst" : "fäst"}.`,
  trimTip: (p) => `Spetsen av ”${p.m}” hänger fortfarande vid krokböjen. Klipp bort den.`,
  neverUsedAfterTieIn: (p) => `”${p.m}” är inbundet men lindas aldrig och dras aldrig över.`,
  neverUsed: (p) => `”${p.m}” finns i listan men används aldrig.`,
  endWithWhipFinish: () => "Flugan ska avslutas med en whipfinishknut.",
  tooMuchToDraw: () => "Från det här steget finns det fler varv än 3D-vyn kan rita: använd färre varv eller färre steg.",
};
