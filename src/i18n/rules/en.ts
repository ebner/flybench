import type { MaterialKind } from "../../recipe/materials";
import { kindName } from "../../tying/describe";
import { inLang } from "../lang";
import type { RuleCatalog } from ".";

/**
 * The tying rules' messages for visitors, in English: whole sentences without the recipe's
 * keywords (src/recipe/rules.ts has the authors' wording, which the tests and the studio show).
 */

const PERCENT = new Intl.NumberFormat("en-GB", { style: "percent", maximumFractionDigits: 1 });

/** A position on the shank (0 the bend, 1 behind the eye): "40% along the shank". */
const at = (x: number) => `${PERCENT.format(x)} along the shank`;

const kind = (k: MaterialKind) => inLang("en", () => kindName(k));

export const RULES_EN: RuleCatalog = {
  duplicateMaterial: (p) => `The material “${p.m}” is listed more than once.`,
  afterWhipFinish: () => "After the whip finish you can only trim.",
  unknownMaterial: (p) => `There is no material called “${p.m}”.`,
  tieOffNext: (p) => `You have just wound “${p.m}”. Tie it off before anything else.`,
  securePalmer: (p) => `You wound “${p.m}” back towards the bend. Secure it by winding another material forward over its tip.`,
  notABead: (p) => `“${p.m}” is not a bead.`,
  beadBeforeThread: () => "Slide the bead on before you attach the thread.",
  beadBeforeWeight: () => "Slide the bead on before you weight the shank.",
  alreadyOnHook: (p) => `“${p.m}” is already on the hook.`,
  weightWithWire: (p) => `Weighting is done with wire, not with “${p.m}”.`,
  weightForward: () => "The weighting runs forward: it must end further forward on the shank than it starts.",
  threadAttached: () => "The thread is already attached.",
  threadFirst: () => "Attach the thread first.",
  threadThere: () => "The thread is already there.",
  onlyDubbing: (p) => `Only dubbing can be dubbed. Tie in “${p.m}” instead.`,
  onlyHairSpun: (p) => `Only hair can be spun, not “${p.m}”.`,
  spinForward: () => "Spin the hair forward from the thread.",
  dubNotTie: () => "Dubbing isn't tied in: dub it onto the thread instead.",
  beadSlides: () => "A bead isn't tied in: slide it on before you attach the thread.",
  featherBack: () => "Feathers are tied in pointing back, not forward.",
  needsLength: (p) => `${kind(p.kind)} sticks out from where it is tied in, so give it a length.`,
  eyesNoLength: () => "Eyes are tied in without a length.",
  angleNeedsLength: () => "An angle can only be given to material tied in with a length.",
  spreadOnly: () => "A spread can only be given to tags, tails and wings tied in with a length.",
  widthOnly: () => "A width can only be given to feather wings.",
  sideOnly: () => "The side can only be chosen for tails, beards, wings and eyes.",
  acrossOnly: () => "Only legs and strands of hair, fibres, biots or flash can be tied across the shank.",
  forwardNeedsLength: () => "Only material tied in with a length can point forward.",
  forwardUpright: () => "A material pointing forward can't also stand upright.",
  extendedOnly: () => "Only chenille, yarn or foam tied in with a length can stick out in one piece.",
  tipOnly: () => "Only material that sticks out in one piece can have a coloured end.",
  alreadyTiedIn: (p) => `“${p.m}” is already tied in.`,
  tieInBeforeWind: (p) => `Tie in “${p.m}” before you wind it.`,
  alreadyWound: (p) => `“${p.m}” has already been wound.`,
  cantWind: (p) => `${kind(p.kind)} can't be wound.`,
  toOrAround: () => "Say either where on the shank the winding ends, or which post the hackle is wound round (parachute).",
  counterAlong: () => "Counter-winding is only along the shank, not round a post.",
  hackleAroundPost: () => "Only hackle is wound round a post.",
  notAPost: (p) => `“${p.post}” must be a bunch tied in upright (at 60° or more) to be a post.`,
  windFromTieIn: (p) => `“${p.m}” is tied in at ${at(p.at)}. Wind it forward or back from there.`,
  threadElsewhere: (p) => `The thread is at ${at(p.thread)}. Move it to ${at(p.to)} before you wind there.`,
  windToThread: (p) => `The thread is at ${at(p.thread)}. Wind forward to it, or first move the thread back to ${at(p.to)}.`,
  tieInBeforePull: (p) => `“${p.m}” must be tied in (and not yet used) before it is pulled over.`,
  pullForward: (p) => `Pull “${p.m}” forward from where it is tied in, or lay it back over the body.`,
  secureLaidBack: (p) => `You laid “${p.m}” back over the body. Hold its end by winding another material forward over it.`,
  threadForPull: (p) => `The thread is at ${at(p.thread)}. Move it to ${at(p.to)} to tie the material down there.`,
  windBeforeTieOff: (p) => `Wind “${p.m}” forward before you tie it off.`,
  keepOnly: () => "Part of a hackle can only be cut away once it is wound and tied off.",
  alreadyKept: (p) => `Part of “${p.m}” has already been cut away.`,
  nothingToTrim: (p) => `There is nothing of “${p.m}” to trim.`,
  leaveOnly: () => "A length can only be left standing on hair butts, spun hair and foam backs.",
  shapeOnly: () => "Only spun hair or hair butts can be trimmed to a shape.",
  neverTiedOff: (p) => `“${p.m}” is wound but never ${p.rear ? "secured" : "tied off"}.`,
  trimTip: (p) => `The tip of “${p.m}” still hangs at the bend. Trim it.`,
  neverUsedAfterTieIn: (p) => `“${p.m}” is tied in but never wound or pulled over.`,
  neverUsed: (p) => `“${p.m}” is listed but never used.`,
  endWithWhipFinish: () => "The fly ends with a whip finish.",
  sitsFloats: () => "How a fly sits on the water only applies to a fly that floats.",
  tooMuchToDraw: () => "From this step on there are more turns than the 3D view can draw: use fewer turns or fewer steps.",
};
