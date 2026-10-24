import * as THREE from "three";
import {
  wrapPoint,
  type BeadPiece,
  type BundlePiece,
  type CoverPiece,
  type EyesPiece,
  type FeatherPiece,
  type Piece,
  type WrapsPiece,
} from "../tying/simulate";
import type { Surfaces } from "./materials";
import { mulberry32 } from "./random";
import type { ShankSpace } from "./space";

/**
 * Meshes for the pieces of a fly. Everything is built in shank-local coordinates
 * (x along the shank, y up, z towards the viewer) and placed with a ShankSpace, which
 * bends it onto curved shanks.
 */

/** A piece of the fly that can be drawn partially, from 0 (not there yet) to 1 (complete). */
export interface PieceView {
  object: THREE.Object3D;
  setProgress(u: number): void;
  dispose(): void;
}

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);

class WrapsCurve extends THREE.Curve<THREE.Vector3> {
  constructor(
    private piece: WrapsPiece,
    private space: ShankSpace,
  ) {
    super();
  }
  override getPoint(u: number, target = new THREE.Vector3()) {
    const [x, y, z] = wrapPoint(this.piece, u).point;
    return this.space.point(target.set(x, y, z));
  }
}

/** Moves fibres built in shank-local coordinates onto the real shank. */
function placeFibres(fibres: Fibre[], space: ShankSpace): Fibre[] {
  for (const f of fibres) {
    const x = f.base.x;
    space.point(f.base);
    space.direction(x, f.dir);
  }
  return fibres;
}

/** A group placed at shank-local x on the shank axis, turned with the shank there. */
function anchored(space: ShankSpace, x: number): THREE.Group {
  const g = new THREE.Group();
  g.position.copy(space.point(new THREE.Vector3(x, 0, 0)));
  g.quaternion.copy(space.rotation(x));
  return g;
}

/**
 * Unit fibre along +Y from the origin, tapering to `tipRatio` of its base width.
 * Vertex colours shade it from white at the base to `tipShade` at the tip.
 */
function fibreGeometry(tipRatio: number, tipShade = 1): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(tipRatio, 1, 1, 5, 2, false).translate(0, 0.5, 0);
  const pos = g.getAttribute("position");
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const shade = 1 + (tipShade - 1) * pos.getY(i);
    colors.set([shade, shade, shade], i * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return g;
}

export interface Fibre {
  /** Progress at which this fibre appears. */
  u: number;
  base: THREE.Vector3;
  dir: THREE.Vector3;
  length: number;
  radius: number;
  /** Multiplies the material colour, for natural variation. */
  shade?: number;
}

/** Instanced fibres that appear in order of their `u`. */
export function fibreMesh(fibres: Fibre[], material: THREE.Material, tipRatio = 0.25, tipShade = 1) {
  fibres.sort((a, b) => a.u - b.u);
  const mesh = new THREE.InstancedMesh(fibreGeometry(tipRatio, tipShade), material, Math.max(1, fibres.length));
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const c = new THREE.Color();
  fibres.forEach((f, i) => {
    q.setFromUnitVectors(Y_AXIS, f.dir);
    m.compose(f.base, q, s.set(f.radius, f.length, f.radius));
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, c.setScalar(f.shade ?? 1));
  });
  mesh.count = fibres.length;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  const us = fibres.map((f) => f.u);
  return {
    mesh,
    setProgress(u: number) {
      let n = 0;
      while (n < us.length && us[n]! <= u) n++;
      mesh.count = n;
    },
  };
}

/** Per-look fibre settings for wound materials. */
const WOUND_FIBRES = {
  hackle: { perTurn: 110, radius: 0.006, tip: 0.25 },
  herl: { perTurn: 320, radius: 0.006, tip: 0.25 },
  dubbing: { perTurn: 260, radius: 0.005, tip: 0.3 },
  chenille: { perTurn: 240, radius: 0.006, tip: 0.6 },
  cdc: { perTurn: 160, radius: 0.003, tip: 0.3 },
  fibres: { perTurn: 90, radius: 0.003, tip: 0.4 },
} as const;

function woundFibres(piece: WrapsPiece, rand: () => number): Fibre[] {
  const look = piece.look as keyof typeof WOUND_FIBRES;
  const spec = WOUND_FIBRES[look];
  const list: Fibre[] = [];
  const n = Math.round(piece.turns * spec.perTurn);
  const onPost = piece.path === "post";
  for (let i = 0; i < n; i++) {
    const u = (i + rand()) / n;
    const at = wrapPoint(piece, u);
    const [px, py, pz] = at.point;
    let spin: number, sweep: number, length: number, shade: number;

    // Angle round whatever is being wound on, recovered from the point.
    const around = onPost ? Math.atan2(px - piece.post!.x, pz) : Math.atan2(py, pz);
    if (look === "hackle") {
      // Barbs stand out with the hackle's sweep; soft hackles lean well back.
      spin = around + (rand() - 0.5) * 0.5;
      sweep = (piece.sweep ?? 0.12) + (rand() - 0.5) * 0.25;
      length = piece.fibreLength! * (0.8 + 0.25 * rand());
      shade = piece.barred ? (rand() < 0.5 ? 0.35 : 1.05) : 0.85 + 0.3 * rand();
    } else if (look === "herl") {
      // Flue sticks out every which way, filling the gaps between turns.
      spin = around + (rand() - 0.5) * 2.4;
      sweep = (rand() - 0.5) * 1.8;
      length = piece.fibreLength! * (0.5 + 0.6 * rand());
      shade = 1;
    } else if (look === "cdc") {
      // Barbs grow from short (the tip, wound first) to long near the butt, sweeping back.
      spin = around + (rand() - 0.5) * 1.2;
      sweep = (piece.sweep ?? 0.8) + (rand() - 0.5) * 0.5;
      length = piece.fibreLength! * (0.2 + 0.8 * Math.pow(u, 1.5)) * (0.7 + 0.5 * rand());
      shade = 0.85 + 0.3 * rand();
    } else if (look === "fibres") {
      // Wound pheasant tail and the like: a short fringe of flue, leaning back.
      spin = around + (rand() - 0.5) * 2.2;
      sweep = 0.7 + (rand() - 0.5) * 0.8;
      length = piece.fibreLength! * (0.4 + 0.8 * rand());
      shade = 0.6 + 0.3 * rand();
    } else if (look === "chenille") {
      spin = around + (rand() - 0.5) * 3;
      sweep = (rand() - 0.5) * 1.6;
      length = piece.fibreLength! * (0.7 + 0.5 * rand());
      shade = 0.85 + 0.25 * rand();
    } else {
      // Dubbing: short, scruffy, mottled fibres; a few long guard hairs.
      spin = around + (rand() - 0.5) * 3;
      sweep = (rand() - 0.5) * 2.2;
      const guard = rand() < 0.08;
      length = piece.fibreLength! * (guard ? 1.6 + rand() : 0.4 + 0.7 * rand());
      // Mottled, but never lighter than the dubbing's own colour.
      shade = guard ? 0.45 : 0.6 + 0.4 * rand();
    }
    // A hackle trimmed top and bottom keeps only the fibres pointing out to the sides; one
    // trimmed underneath keeps everything that doesn't point down.
    if (piece.keep === "sides" && Math.abs(Math.sin(spin)) > 0.45) continue;
    if (piece.keep === "top" && Math.sin(spin) < -0.35) continue;
    // Under a wing case the fibres on top are pressed flat out of sight.
    if (piece.covered && px > piece.covered[0] && px < piece.covered[1] && Math.sin(spin) > 0.2) continue;
    let dir: THREE.Vector3;
    if (onPost) {
      // Parachute: barbs stand out flat round the post, drooping a little.
      dir = new THREE.Vector3(Math.sin(spin), -Math.sin(sweep), Math.cos(spin)).normalize();
    } else {
      const radial = new THREE.Vector3(0, Math.sin(spin), Math.cos(spin));
      dir = radial.multiplyScalar(Math.cos(sweep)).addScaledVector(X_AXIS, -Math.sin(sweep)).normalize();
    }
    const inset = look === "dubbing" ? 0.9 : 1;
    const base = new THREE.Vector3(px, py * inset, pz * inset);
    list.push({ u, base, dir, length, radius: spec.radius, shade });
  }
  return list;
}

/**
 * Strands that lie flat when wound, as a band: thread, floss, flat tinsel, wound fibres.
 * The value is the widest the band can spread, as a multiple of the strand radius.
 */
const BANDS: Partial<Record<WrapsPiece["look"], number>> = { thread: 1.4, floss: 3, tinsel: 2.6, fibres: 2.6 };

/** Thread always lies flat; other materials say so (silk floss, flat tinsel, wound fibres). */
const isBand = (piece: WrapsPiece) => piece.look === "thread" || piece.band === true;

/**
 * A flat band following a wraps piece: an elliptical section, wide along the shank and
 * thin outwards from it, so touching turns close up into a smooth layer.
 */
function bandGeometry(piece: WrapsPiece, space: ShankSpace, halfWidth: number, halfThickness: number, segments: number) {
  const radial = 8;
  const positions: number[] = [];
  const index: number[] = [];
  const v = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    const at = wrapPoint(piece, i / segments);
    const [px, py, pz] = at.point;
    const len = Math.hypot(py, pz) || 1;
    // Outwards from the shank axis, and along it.
    const ny = py / len;
    const nz = pz / len;
    for (let j = 0; j <= radial; j++) {
      const t = (j / radial) * Math.PI * 2;
      const out = halfThickness * Math.cos(t);
      const along = halfWidth * Math.sin(t);
      space.point(v.set(px + along, py + ny * out, pz + nz * out));
      positions.push(v.x, v.y, v.z);
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b = a + radial + 1;
      index.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return { geometry, perSegment: radial * 6 };
}

function wrapsView(piece: WrapsPiece, surfaces: Surfaces, space: ShankSpace): PieceView {
  const group = new THREE.Group();
  const segmentsPerTurn = piece.look === "thread" ? 20 : 28;
  const tubular = Math.max(8, Math.min(4000, Math.round(piece.turns * segmentsPerTurn)));
  const radial = piece.look === "thread" ? 5 : 8;
  // Hackles and wound CDC show only their stem; the barbs make the bulk.
  const stemOnly = piece.look === "hackle" || piece.look === "cdc";
  const tubeLook = stemOnly ? "stem" : piece.look;
  // The dubbing and chenille cores sit inside their fuzz. Bands spread as wide as the
  // spacing of the turns allows, so touching turns close into a smooth layer.
  const pitch = piece.path === "travel" ? Math.abs(piece.x1 - piece.x0) / piece.turns : 0;
  const band = piece.path !== "post" && isBand(piece) ? BANDS[piece.look] : undefined;
  let tube: THREE.BufferGeometry;
  let perSegment: number;
  if (band) {
    const halfWidth = Math.min(piece.strandRadius * band, Math.max(piece.strandRadius, pitch * 0.55));
    // Wound fibres are one fibre thick however many lie side by side.
    const halfThickness = piece.look === "fibres" ? 0.014 : piece.strandRadius * 0.6;
    ({ geometry: tube, perSegment } = bandGeometry(piece, space, halfWidth, halfThickness, tubular));
  } else {
    const tubeRadius =
      piece.look === "dubbing" || piece.look === "chenille"
        ? piece.strandRadius * 0.9
        : piece.look === "cdc"
          ? 0.012
          : piece.strandRadius;
    tube = new THREE.TubeGeometry(new WrapsCurve(piece, space), tubular, tubeRadius, radial, false);
    perSegment = radial * 6;
  }
  group.add(new THREE.Mesh(tube, surfaces.get(tubeLook, piece.color)));

  let fibres: ReturnType<typeof fibreMesh> | null = null;
  if (piece.fibreLength && piece.look in WOUND_FIBRES) {
    const spec = WOUND_FIBRES[piece.look as keyof typeof WOUND_FIBRES];
    const color = piece.look === "herl" ? "#26341a" : piece.color;
    const list = placeFibres(woundFibres(piece, mulberry32(piece.id * 7919 + 1)), space);
    fibres = fibreMesh(list, surfaces.get(piece.look, color, true), spec.tip);
    group.add(fibres.mesh);
  }

  return {
    object: group,
    setProgress(u) {
      group.visible = u > 0;
      tube.setDrawRange(0, Math.floor(u * tubular) * perSegment);
      fibres?.setProgress(u);
    },
    dispose() {
      tube.dispose();
      fibres?.mesh.geometry.dispose();
    },
  };
}

/**
 * Per-look settings for bunches: fibre width, taper, tip shade, random spread, how
 * strongly fibres splay away from the body and to the sides, and length variation.
 */
const BUNDLE = {
  yarn: { radius: 0.011, tip: 0.7, tipShade: 1, spread: 0.3, flare: 0.1, sideFlare: 0.3, lengthJitter: 0.25 },
  fibres: { radius: 0.005, tip: 0.3, tipShade: 0.8, spread: 0.18, flare: 0, sideFlare: 0.2, lengthJitter: 0.1 },
  hair: { radius: 0.0095, tip: 0.35, tipShade: 0.5, spread: 0.08, flare: 0.08, sideFlare: 0.55, lengthJitter: 0.08 },
  biot: { radius: 0.011, tip: 0.15, tipShade: 0.8, spread: 0.02, flare: 0, sideFlare: 0.6, lengthJitter: 0 },
  // Marabou is a dense, soft plume: many fine fibres, tapering out.
  marabou: { radius: 0.005, tip: 0.2, tipShade: 0.9, spread: 0.3, flare: 0.06, sideFlare: 0.25, lengthJitter: 0.45 },
  // CDC is soft and fluffy: many fine, uneven barbs, each with tiny barbules (added below).
  cdc: { radius: 0.003, tip: 0.3, tipShade: 0.85, spread: 0.5, flare: 0.12, sideFlare: 0.5, lengthJitter: 0.45 },
  flash: { radius: 0.0025, tip: 1, tipShade: 1, spread: 0.2, flare: 0.05, sideFlare: 0.3, lengthJitter: 0.2 },
} as const;

function bundleView(piece: BundlePiece, surfaces: Surfaces, space: ShankSpace): PieceView {
  const spec = BUNDLE[piece.look as keyof typeof BUNDLE] ?? BUNDLE.yarn;
  const rand = mulberry32(piece.id * 104729 + 3);
  const forward = piece.direction === "forward";
  const radialHair = piece.direction === "radial";
  // Under the shank, everything is mirrored top to bottom.
  const flip = piece.side === "under" ? -1 : 1;
  const along = new THREE.Vector3(forward ? 1 : -1, 0, 0)
    .multiplyScalar(Math.cos(piece.angle))
    .addScaledVector(Y_AXIS, Math.sin(piece.angle) * flip);
  const list: Fibre[] = [];
  const evenlySpaced = piece.look === "biot";
  // An upright post roots in a small disc on top of the shank and fans out at the top.
  const upright = piece.direction === "back" && piece.angle >= Math.PI / 3;
  for (let i = 0; i < piece.count; i++) {
    if (upright) {
      const a = rand() * 2 * Math.PI;
      const d = Math.sqrt(rand()) * piece.bundleRadius * 0.7;
      const base = new THREE.Vector3(piece.x + d * Math.cos(a), piece.radius * flip, d * Math.sin(a));
      const fan = 0.08 + spec.sideFlare * 0.45 * rand();
      const dir = along
        .clone()
        .add(new THREE.Vector3(Math.cos(a) * fan, 0, Math.sin(a) * fan))
        .normalize();
      if (piece.pair) {
        // Divided wings: half the hair leans out to each side.
        const side = i % 2 === 0 ? 1 : -1;
        dir.applyAxisAngle(X_AXIS, side * piece.pair);
        base.z += side * piece.bundleRadius * 0.25;
      }
      list.push({ u: rand(), base, dir, length: piece.length * (1 - spec.lengthJitter / 2 + spec.lengthJitter * rand()), radius: spec.radius, shade: 0.85 + 0.3 * rand() });
      continue;
    }
    // Bases spread over the top (or bottom), up to `spread` either side; spun hair all round.
    const theta = radialHair
      ? rand() * 2 * Math.PI
      : evenlySpaced && piece.count > 1
        ? -piece.spread + (2 * piece.spread * i) / (piece.count - 1)
        : (rand() * 2 - 1) * piece.spread;
    const r = piece.radius + piece.bundleRadius * (radialHair ? 0.2 : 0.3 + 0.5 * rand()) * rand();
    const x = piece.x + (piece.span ? rand() * piece.span : rand() * 0.04);
    const base = new THREE.Vector3(x, r * Math.cos(theta) * flip, r * Math.sin(theta));
    const outward = new THREE.Vector3(0, Math.cos(theta) * flip, Math.sin(theta));
    const splay = 0.6 + 0.6 * rand();
    let dir: THREE.Vector3;
    if (radialHair) {
      // Spun hair flares straight out all round, leaning back by `angle`.
      dir = outward
        .clone()
        .multiplyScalar(Math.cos(piece.angle))
        .addScaledVector(X_AXIS, -Math.sin(piece.angle) * (0.6 + 0.8 * rand()))
        .normalize();
    } else {
      // Fibres splay away from the body a little, and fibres at the sides of the bunch
      // splay sideways (not upwards) as well.
      dir = along
        .clone()
        .addScaledVector(outward, spec.flare * splay)
        .add(new THREE.Vector3(0, 0, spec.sideFlare * Math.sin(theta) * splay))
        .add(new THREE.Vector3(0, (rand() - 0.5) * spec.spread, (rand() - 0.5) * spec.spread))
        .normalize();
    }
    const jitter = piece.cut ? 0 : spec.lengthJitter;
    let length = piece.length * (1 - jitter / 2 + jitter * rand());
    if (radialHair && piece.cut && piece.span) {
      const f = (x - piece.x) / piece.span;
      if (piece.trimShape === "wedge") {
        // Deepest at the back, low at the front, and cut flat underneath close to the hook.
        length *= 0.3 + 0.7 * (1 - f);
        if (dir.y < -0.05) length = Math.min(length, 0.1 / -dir.y);
        if (Math.abs(dir.z) > 0.6) length *= 0.75;
      } else {
        // A round head, shaped like a bullet: fullest at the back, tapering to the eye.
        length *= 1 - 0.75 * Math.pow(f, 1.2);
      }
    }
    list.push({
      u: rand(), base, dir, length,
      // Clipped hair shows its thick cut ends.
      radius: radialHair && piece.cut ? spec.radius * 1.6 : spec.radius, shade: 0.85 + 0.3 * rand(),
    });
  }
  if (piece.look === "cdc") {
    // Barbules: short, fine fibres all along each barb, which give CDC its fluff.
    const barbs = list.slice();
    for (const f of barbs) {
      for (let k = 0; k < 6; k++) {
        const t = 0.2 + 0.8 * rand();
        const base = f.base.clone().addScaledVector(f.dir, f.length * t);
        const dir = f.dir
          .clone()
          .add(new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(1.6))
          .normalize();
        list.push({ u: f.u, base, dir, length: 0.05 + 0.06 * rand(), radius: 0.0018, shade: f.shade });
      }
    }
  }
  // Hair butts are the pale base of the hair; tips darken towards the end.
  const tipShade = forward || piece.cut ? 1 : spec.tipShade;
  const fibres = fibreMesh(placeFibres(list, space), surfaces.get(piece.look, piece.color, true), piece.cut ? 0.9 : spec.tip, tipShade);
  return {
    object: fibres.mesh,
    setProgress(u) {
      fibres.mesh.visible = u > 0;
      fibres.setProgress(u);
    },
    dispose() {
      fibres.mesh.geometry.dispose();
    },
  };
}

/** Outline half-width of a feather at s (0 = tied-in base, 1 = tip), as a fraction of its width. */
const FEATHER_OUTLINE: Record<FeatherPiece["shape"], (s: number) => number> = {
  // Broad and rounded, narrow where it is tied in.
  breast: (s) => 0.5 * Math.pow(Math.sin(Math.PI * Math.min(1, 0.08 + s * 0.92)), 0.7) * (0.35 + 0.65 * Math.min(1, s * 3)),
  // Lanceolate hackle tip: widest below the middle, coming to a point.
  tip: (s) => 0.5 * Math.pow(Math.sin(Math.PI * Math.min(1, 0.05 + s)), 0.9) * (1 - 0.25 * s),
  // A quill slip: an even strip with a rounded end.
  slip: (s) => 0.5 * (s < 0.82 ? 1 : Math.cos(((s - 0.82) / 0.18) * (Math.PI / 2))) * (0.75 + 0.25 * Math.min(1, s * 4)),
};

/** How far a feather is folded round its spine: breast feathers make a roof, tips and slips are flat. */
const FEATHER_FOLD: Record<FeatherPiece["shape"], number> = { breast: 1.6, tip: 0.2, slip: 0.25 };

function featherGeometry(piece: FeatherPiece): THREE.BufferGeometry {
  const L = piece.length;
  const outline = FEATHER_OUTLINE[piece.shape];
  const fold = FEATHER_FOLD[piece.shape];
  // Enough rows along the feather that the bars don't alias into a checkerboard.
  const segS = piece.barring > 0 ? 128 : 32;
  const segT = 16;
  const positions: number[] = [];
  const colors: number[] = [];
  const index: number[] = [];
  for (let i = 0; i <= segS; i++) {
    const s = i / segS;
    const half = Math.max(outline(s) * piece.width, 1e-4);
    const r = half / fold;
    for (let j = 0; j <= segT; j++) {
      const t = (j / segT) * 2 - 1;
      const phi = t * fold;
      // Local -Y points up once placed: the spine is the top, the sides hang down.
      positions.push(s * L, r - r * Math.cos(phi), r * Math.sin(phi));
      // Strongly barred feathers (teal, grizzly) have crisp dark bars; mallard is softly vermiculated.
      const wave = 0.5 + 0.5 * Math.sin(2 * Math.PI * (s * 14 + Math.abs(t) * 0.9));
      const crisp = THREE.MathUtils.smoothstep(wave, 0.35, 0.65);
      const bars = 1 - 0.85 * piece.barring ** 2 * (wave + (crisp - wave) * piece.barring);
      const shade = bars * (0.8 + 0.2 * s);
      colors.push(shade, shade, shade);
    }
  }
  for (let i = 0; i < segS; i++) {
    for (let j = 0; j < segT; j++) {
      const a = i * (segT + 1) + j;
      const b = a + segT + 1;
      index.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * A feather wing, or a pair. Breast feathers lie over the body like a roof; hackle
 * tips and quill slips stand on edge, in the plane of the shank, and a pair is turned
 * out to either side by `pair`.
 */
function featherView(piece: FeatherPiece, surfaces: Surfaces, space: ShankSpace): PieceView {
  const geometry = featherGeometry(piece);
  const material = surfaces.get("feather", piece.color, true);
  const root = anchored(space, piece.x);
  const growers: THREE.Object3D[] = [];
  const sides = piece.pair > 0 ? [-1, 1] : [0];
  for (const sign of sides) {
    // Turned round the shank axis: out to one side for pairs, underneath for beards.
    const turn = new THREE.Group();
    turn.rotation.x = sign * piece.pair + (piece.side === "under" ? Math.PI : 0);
    const orient = new THREE.Group();
    orient.position.y = piece.radius;
    // Local +X runs back along the body, `angle` above the shank.
    orient.rotation.z = Math.PI - piece.angle;
    const mesh = new THREE.Mesh(geometry, material);
    if (piece.shape !== "breast") mesh.rotation.x = Math.PI / 2;
    orient.add(mesh);
    turn.add(orient);
    root.add(turn);
    growers.push(orient);
  }
  return {
    object: root,
    setProgress(u) {
      root.visible = u > 0;
      for (const g of growers) g.scale.set(Math.max(u, 0.01), 1, 1);
    },
    dispose() {
      geometry.dispose();
    },
  };
}

/** A bead slides round the bend and up the shank to the eye. */
function beadView(piece: BeadPiece, surfaces: Surfaces, space: ShankSpace): PieceView {
  const geometry = new THREE.SphereGeometry(piece.radius, 28, 20);
  const mesh = new THREE.Mesh(geometry, surfaces.get("bead", piece.color));
  const start = -0.3;
  return {
    object: mesh,
    setProgress(u) {
      mesh.visible = u > 0;
      const x = start + (piece.x - start) * Math.min(1, u * 1.1);
      mesh.position.copy(space.point(new THREE.Vector3(x, 0, 0)));
    },
    dispose() {
      geometry.dispose();
    },
  };
}

/** Dumbbell or bead-chain eyes tied across the shank. */
function eyesView(piece: EyesPiece, surfaces: Surfaces, space: ShankSpace): PieceView {
  const root = anchored(space, piece.x);
  const material = surfaces.get("eyes", piece.color);
  const flip = piece.side === "under" ? -1 : 1;
  const s = piece.size;
  const y = (piece.shankRadius + s * 0.6) * flip;
  const offset = s * (piece.chain ? 1.15 : 1.35);
  const ball = new THREE.SphereGeometry(s, 20, 14);
  const bar = new THREE.CylinderGeometry(s * (piece.chain ? 0.15 : 0.4), s * (piece.chain ? 0.15 : 0.4), offset * 2, 12);
  for (const z of [-offset, offset]) {
    const m = new THREE.Mesh(ball, material);
    m.position.set(0, y, z);
    root.add(m);
  }
  const link = new THREE.Mesh(bar, material);
  link.rotation.x = Math.PI / 2;
  link.position.set(0, y, 0);
  root.add(link);
  return {
    object: root,
    setProgress(u) {
      root.visible = u > 0;
    },
    dispose() {
      ball.dispose();
      bar.dispose();
    },
  };
}

/** A strip over the top of the body (wing case, foam back), drawn from the back forwards. */
function coverView(piece: CoverPiece, surfaces: Surfaces, space: ShankSpace): PieceView {
  const segX = 48;
  const segT = 14;
  const positions: number[] = [];
  const index: number[] = [];
  const v = new THREE.Vector3();
  for (let i = 0; i <= segX; i++) {
    const x = piece.x0 + ((piece.x1 - piece.x0) * i) / segX;
    // Pinched down by the thread at both ends.
    const ends = Math.min(1, (x - piece.x0) / 0.08, (piece.x1 - x) / 0.06);
    const r = piece.base.radiusAt(x) + (piece.lift + piece.thickness) * Math.max(0.15, ends);
    for (let j = 0; j <= segT; j++) {
      const phi = -piece.halfAngle + (2 * piece.halfAngle * j) / segT;
      space.point(v.set(x, r * Math.cos(phi), r * Math.sin(phi)));
      positions.push(v.x, v.y, v.z);
    }
  }
  for (let i = 0; i < segX; i++) {
    for (let j = 0; j < segT; j++) {
      const a = i * (segT + 1) + j;
      const b = a + segT + 1;
      index.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  const look = piece.look === "foam" ? "foam" : piece.look === "feather" ? "feather" : "fibres";
  const material = surfaces.get(look, piece.color).clone();
  material.side = THREE.DoubleSide;
  const mesh = new THREE.Mesh(geometry, material);
  return {
    object: mesh,
    setProgress(u) {
      mesh.visible = u > 0;
      geometry.setDrawRange(0, Math.ceil(u * segX) * segT * 6);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

export function pieceView(piece: Piece, surfaces: Surfaces, space: ShankSpace): PieceView {
  switch (piece.type) {
    case "wraps":
      return wrapsView(piece, surfaces, space);
    case "bundle":
      return bundleView(piece, surfaces, space);
    case "feather":
      return featherView(piece, surfaces, space);
    case "bead":
      return beadView(piece, surfaces, space);
    case "eyes":
      return eyesView(piece, surfaces, space);
    case "cover":
      return coverView(piece, surfaces, space);
  }
}
