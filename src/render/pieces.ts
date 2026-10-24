import * as THREE from "three";
import {
  wrapPoint,
  type BeadPiece,
  type BundlePiece,
  type CoverPiece,
  type EyesPiece,
  type ExtensionPiece,
  type FeatherPiece,
  type FibreMarks,
  type LegsPiece,
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
    if (f.bendDir) space.direction(x, f.bendDir);
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

/** Rows along a fibre with bands on it, so the band edges stay sharp. */
const MARKED_ROWS = 48;

/**
 * Unit fibre along +Y from the origin: the stretch from t0 to t1 of a whole fibre that tapers
 * to `tipRatio` of its base width. Vertex colours shade it from white at the base to `tipShade`
 * at the tip, darkened where `marks` put a band.
 */
function fibreGeometry(tipRatio: number, tipShade = 1, t0 = 0, t1 = 1, marks?: FibreMarks): THREE.BufferGeometry {
  const width = (t: number) => 1 - (1 - tipRatio) * t;
  const rows = marks ? Math.max(2, Math.round(MARKED_ROWS * (t1 - t0))) : 2;
  const g = new THREE.CylinderGeometry(width(t1), width(t0), 1, 5, rows, false).translate(0, 0.5, 0);
  const pos = g.getAttribute("position");
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const t = t0 + (t1 - t0) * pos.getY(i);
    const band = marks?.find((m) => t >= m.from && t <= m.to);
    const shade = (1 + (tipShade - 1) * t) * (band ? band.shade : 1);
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
  /** How far the tip curves off the straight line, as a fraction of the length. */
  bend?: number;
  /** Which way it curves; perpendicular to `dir`. */
  bendDir?: THREE.Vector3;
}

/** A curved fibre is drawn as this many straight pieces along a parabola. */
const BEND_SEGMENTS = 3;

/** Instanced fibres that appear in order of their `u`. Curved fibres are drawn in segments. */
export function fibreMesh(fibres: Fibre[], material: THREE.Material, tipRatio = 0.25, tipShade = 1, marks?: FibreMarks) {
  fibres.sort((a, b) => a.u - b.u);
  const object = new THREE.Group();
  const parts: { mesh: THREE.InstancedMesh; us: number[] }[] = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const c = new THREE.Color();

  const addPart = (geometry: THREE.BufferGeometry, list: { u: number; base: THREE.Vector3; dir: THREE.Vector3; length: number; radius: number; shade: number }[]) => {
    if (list.length === 0) {
      geometry.dispose();
      return;
    }
    const mesh = new THREE.InstancedMesh(geometry, material, list.length);
    list.forEach((f, i) => {
      q.setFromUnitVectors(Y_AXIS, f.dir);
      m.compose(f.base, q, s.set(f.radius, f.length, f.radius));
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, c.setScalar(f.shade));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    object.add(mesh);
    parts.push({ mesh, us: list.map((f) => f.u) });
  };

  const straight = fibres.filter((f) => !f.bend || !f.bendDir);
  addPart(
    fibreGeometry(tipRatio, tipShade, 0, 1, marks),
    straight.map((f) => ({ ...f, shade: f.shade ?? 1 })),
  );

  // A curved fibre follows base + dir·L·t + bendDir·bend·L·t², from t = 0 to 1.
  const curved = fibres.filter((f) => f.bend && f.bendDir);
  const at = (f: Fibre, t: number) =>
    f.base.clone().addScaledVector(f.dir, f.length * t).addScaledVector(f.bendDir!, f.bend! * f.length * t * t);
  for (let k = 0; k < BEND_SEGMENTS; k++) {
    const t0 = k / BEND_SEGMENTS;
    const t1 = (k + 1) / BEND_SEGMENTS;
    addPart(
      fibreGeometry(tipRatio, tipShade, t0, t1, marks),
      curved.map((f) => {
        const a = at(f, t0);
        const d = at(f, t1).sub(a);
        // A little overlap closes the gaps at the joints.
        const length = d.length() * 1.06;
        return { u: f.u, base: a, dir: d.normalize(), length, radius: f.radius, shade: f.shade ?? 1 };
      }),
    );
  }

  return {
    object,
    setProgress(u: number) {
      for (const { mesh, us } of parts) {
        let n = 0;
        while (n < us.length && us[n]! <= u) n++;
        mesh.count = n;
      }
    },
    dispose() {
      for (const { mesh } of parts) mesh.geometry.dispose();
    },
  };
}

/** A direction perpendicular to `dir`, leaning towards `toward` (random when that is parallel to `dir`). */
function perpendicular(dir: THREE.Vector3, toward: THREE.Vector3, rand: () => number): THREE.Vector3 {
  const p = toward.clone().addScaledVector(dir, -toward.dot(dir));
  if (p.lengthSq() < 1e-6) p.set(rand() - 0.5, rand() - 0.5, rand() - 0.5).addScaledVector(dir, -0.5);
  return p.addScaledVector(dir, -p.dot(dir)).normalize();
}

/** Per-look fibre settings for wound materials. */
const WOUND_FIBRES = {
  hackle: { perTurn: 110, radius: 0.006, tip: 0.25, wave: 0.04 },
  herl: { perTurn: 320, radius: 0.006, tip: 0.25, wave: 0.15 },
  dubbing: { perTurn: 260, radius: 0.005, tip: 0.3, wave: 0.35 },
  chenille: { perTurn: 240, radius: 0.006, tip: 0.6, wave: 0 },
  cdc: { perTurn: 160, radius: 0.003, tip: 0.3, wave: 0.2 },
  fibres: { perTurn: 90, radius: 0.003, tip: 0.4, wave: 0 },
} as const;

const BACK = new THREE.Vector3(-1, 0, 0);
const ZERO = new THREE.Vector3();

function woundFibres(piece: WrapsPiece, rand: () => number): Fibre[] {
  const look = piece.look as keyof typeof WOUND_FIBRES;
  const spec = WOUND_FIBRES[look];
  const list: Fibre[] = [];
  // Rough dubbing is more fur than strand: enough of it to hide the core.
  const n = Math.round(piece.turns * spec.perTurn * (look === "dubbing" ? 1 + (piece.shaggy ?? 0.4) : 1));
  const onPost = piece.path === "post";
  for (let i = 0; i < n; i++) {
    const u = (i + rand()) / n;
    const at = wrapPoint(piece, u);
    const [px, py, pz] = at.point;
    let spin: number, sweep: number, length: number, shade: number;
    /** Lies along the wrapped strand rather than standing out from it (most dubbing fur). */
    let lie = false;

    // Angle round whatever is being wound on, recovered from the point.
    const around = onPost ? Math.atan2(px - piece.post!.x, pz) : Math.atan2(py, pz);
    if (look === "hackle") {
      // Barbs stand out with the hackle's sweep; soft hackles lean well back. A palmered
      // hackle is less orderly than a collar: its barbs are pushed every which way.
      const palmered = piece.path === "travel" && Math.abs(piece.x1 - piece.x0) > 0.3;
      spin = around + (rand() - 0.5) * (palmered ? 1 : 0.5);
      sweep = (piece.sweep ?? 0.12) + (rand() - 0.5) * (palmered ? 0.6 : 0.25);
      length = piece.fibreLength! * (palmered ? 0.65 + 0.45 * rand() : 0.8 + 0.25 * rand());
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
      // Dubbing: short, scruffy, mottled fibres and some long guard hairs. Rough fur (hare's
      // mask, seal's fur) is longer and spikier than fine dry-fly dubbing.
      const shaggy = piece.shaggy ?? 0.4;
      spin = around + (rand() - 0.5) * 3;
      sweep = (rand() - 0.5) * 2.2;
      const guard = rand() < 0.01 + 0.08 * shaggy ** 2;
      lie = !guard && rand() > 0.05 + 0.3 * shaggy ** 2;
      length = piece.fibreLength! * (guard ? (1.6 + 1.4 * rand()) * (0.6 + 0.8 * shaggy) : 0.4 + 0.7 * rand());
      // Fur lying round the body is longer than the tufts standing out of it.
      if (lie) length *= 2.2;
      // Mottled, but never lighter than the dubbing's own colour.
      shade = guard ? 0.45 : 0.6 + 0.4 * rand();
    }
    // A hackle trimmed top and bottom keeps only the fibres pointing out to the sides; one
    // trimmed underneath keeps everything that doesn't point down.
    if (piece.keep === "sides" && Math.abs(Math.sin(spin)) > 0.45) continue;
    if (piece.keep === "top" && Math.sin(spin) < -0.35) continue;
    if (piece.keep === "under" && Math.sin(spin) > 0.35) continue;
    // Under a wing case the fibres on top are pressed flat out of sight.
    if (piece.covered && px > piece.covered[0] && px < piece.covered[1] && Math.sin(spin) > Math.cos(piece.covered[2] + 0.2)) continue;
    let dir: THREE.Vector3;
    if (onPost) {
      // Parachute: barbs stand out flat round the post, drooping a little.
      dir = new THREE.Vector3(Math.sin(spin), -Math.sin(sweep), Math.cos(spin)).normalize();
    } else {
      const radial = new THREE.Vector3(0, Math.sin(spin), Math.cos(spin));
      dir = radial.multiplyScalar(Math.cos(sweep)).addScaledVector(X_AXIS, -Math.sin(sweep)).normalize();
      if (lie) {
        // Either way round the shank, lifting a little off the strand.
        const way = rand() < 0.5 ? 1 : -1;
        dir = new THREE.Vector3((rand() - 0.5) * 0.8, Math.cos(around) * way, -Math.sin(around) * way)
          .addScaledVector(new THREE.Vector3(0, Math.sin(around), Math.cos(around)), 0.25 + 0.25 * rand())
          .normalize();
      }
    }
    const inset = look === "dubbing" ? 0.9 : 1;
    const base = new THREE.Vector3(px, py * inset, pz * inset);
    // Soft barbs curve back towards the bend; herl, dubbing and stiff hackle just wave a little.
    const soft = look === "cdc" || (look === "hackle" && (piece.sweep ?? 0) > 0.4);
    // Fur lying round the body curves to hug it.
    const inward = new THREE.Vector3(0, -py, -pz);
    const bend = lie ? 0.35 + 0.2 * rand() : (soft ? 0.12 + 0.25 * Math.min(1, (piece.sweep ?? 0.8) / 1.2) : spec.wave) * (0.5 + rand());
    const bendDir = bend > 0 ? perpendicular(dir, lie ? inward : soft ? BACK : ZERO, rand) : undefined;
    list.push({ u, base, dir, length, radius: spec.radius, shade, bend, bendDir });
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
  // Dubbing is a felt of mottled fur, not a smooth strand of one colour.
  const mottled = piece.look === "dubbing";
  if (mottled) {
    const rand = mulberry32(piece.id * 31 + 5);
    const count = tube.getAttribute("position").count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) colors.fill(0.62 + 0.38 * rand(), i * 3, i * 3 + 3);
    tube.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  }
  group.add(new THREE.Mesh(tube, surfaces.get(tubeLook, piece.color, mottled)));

  let fibres: ReturnType<typeof fibreMesh> | null = null;
  if (piece.fibreLength && piece.look in WOUND_FIBRES) {
    const spec = WOUND_FIBRES[piece.look as keyof typeof WOUND_FIBRES];
    const color = piece.look === "herl" ? "#26341a" : piece.color;
    const list = placeFibres(woundFibres(piece, mulberry32(piece.id * 7919 + 1)), space);
    fibres = fibreMesh(list, surfaces.get(piece.look, color, true), spec.tip);
    group.add(fibres.object);
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
      fibres?.dispose();
    },
  };
}

/**
 * Per-look settings for bunches: fibre width, taper, tip shade, random spread, how
 * strongly fibres splay away from the body and to the sides, length variation, how much
 * fibres curve (`curve`, tip offset as a fraction of length) and whether they curve down
 * towards the body (`droop` > 0) or away from it (< 0).
 */
const BUNDLE = {
  yarn: { radius: 0.011, tip: 0.7, tipShade: 1, spread: 0.3, flare: 0.1, sideFlare: 0.3, lengthJitter: 0.25, curve: 0.12, droop: 0.2 },
  fibres: { radius: 0.005, tip: 0.3, tipShade: 0.8, spread: 0.18, flare: 0, sideFlare: 0.2, lengthJitter: 0.1, curve: 0.04, droop: 0.4 },
  hair: { radius: 0.0095, tip: 0.35, tipShade: 0.5, spread: 0.08, flare: 0.08, sideFlare: 0.55, lengthJitter: 0.08, curve: 0.05, droop: 0.2 },
  // A biot is a stiff, broad barb: wide at the base, tapering to a point.
  biot: { radius: 0.028, tip: 0.85, tipShade: 0.85, spread: 0.02, flare: 0, sideFlare: 0.6, lengthJitter: 0, curve: 0.12, droop: -0.8 },
  // Marabou is a dense, soft plume: many fine fibres, tapering out.
  marabou: { radius: 0.016, tip: 0.3, tipShade: 0.6, spread: 0.14, flare: 0.04, sideFlare: 0.15, lengthJitter: 0.45, curve: 0.3, droop: 0.5 },
  // CDC is soft and fluffy: many fine, uneven barbs, each with tiny barbules (added below).
  cdc: { radius: 0.003, tip: 0.3, tipShade: 0.85, spread: 0.5, flare: 0.12, sideFlare: 0.5, lengthJitter: 0.45, curve: 0.3, droop: 0.3 },
  flash: { radius: 0.0025, tip: 1, tipShade: 1, spread: 0.2, flare: 0.05, sideFlare: 0.3, lengthJitter: 0.2, curve: 0.08, droop: 0 },
  // Rubber legs as tails and antennae: thick, soft strands that splay and sag.
  legs: { radius: 0.014, tip: 0.85, tipShade: 1, spread: 0.1, flare: 0.15, sideFlare: 0.8, lengthJitter: 0.1, curve: 0.2, droop: 0.3 },
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
    } else if (piece.spread > Math.PI / 2) {
      // A bunch spun most of the way round (a muddler collar) flares away from the body
      // on every side, not just upwards.
      dir = new THREE.Vector3(forward ? 1 : -1, 0, 0)
        .multiplyScalar(Math.cos(piece.angle))
        .addScaledVector(outward, Math.sin(piece.angle) * (0.7 + 0.6 * rand()))
        .add(new THREE.Vector3(0, (rand() - 0.5) * spec.spread, (rand() - 0.5) * spec.spread))
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
    // Free fibres curve a little; spun, clipped and upright hair stays straight.
    const bend = radialHair || piece.cut ? 0 : spec.curve * (0.4 + 0.6 * rand());
    const toward = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5)
      .multiplyScalar(1 - Math.abs(spec.droop))
      .addScaledVector(outward, -spec.droop);
    list.push({
      u: rand(), base, dir, length,
      // Clipped hair shows its thick cut ends.
      // Fibres deep in a bunch are shaded by the rest, so a mass of white hair still has depth.
      radius: (radialHair && piece.cut ? spec.radius * 1.6 : spec.radius) * (piece.fibreWidth ?? 1),
      shade: (0.85 + 0.3 * rand()) * (piece.cut ? 1 : 1 - 0.32 * Math.pow(rand(), 0.6)),
      bend, bendDir: bend > 0 ? perpendicular(dir, toward, rand) : undefined,
    });
  }
  if (piece.look === "cdc" || piece.look === "marabou") {
    // Barbules: short, fine fibres all along each barb, which give CDC and marabou their fluff.
    const barbs = list.slice();
    const perBarb = piece.look === "cdc" ? 6 : 4;
    for (const f of barbs) {
      for (let k = 0; k < perBarb; k++) {
        const t = 0.2 + 0.8 * rand();
        const base = f.base.clone().addScaledVector(f.dir, f.length * t);
        const dir = f.dir
          .clone()
          .add(new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(1.6))
          .normalize();
        // Marabou's barbules are long and soft enough to fill the plume out into a cloud.
        const fluff = piece.look === "marabou";
        list.push({
          u: f.u, base, dir, length: fluff ? 0.1 + 0.2 * rand() : 0.05 + 0.06 * rand(),
          radius: fluff ? 0.004 : 0.0018, shade: f.shade,
        });
      }
    }
  }
  // Hair butts are the pale base of the hair; tips darken towards the end.
  const tipShade = forward || piece.cut ? 1 : spec.tipShade;
  // Trimmed fibres have lost their marked tips.
  const marks = piece.cut ? undefined : piece.marks;
  // Broad, flat barbs (tippet) keep most of their width to the tip.
  const tip = piece.cut ? 0.9 : piece.fibreWidth && piece.look === "fibres" ? Math.max(spec.tip, 0.7) : spec.tip;
  const fibres = fibreMesh(placeFibres(list, space), surfaces.get(piece.look, piece.color, true), tip, tipShade, marks);
  return {
    object: fibres.object,
    setProgress(u) {
      fibres.object.visible = u > 0;
      fibres.setProgress(u);
    },
    dispose() {
      fibres.dispose();
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

/** Barbs per gape along a feather, for its texture. */
const BARBS_PER_GAPE = 14;

/** How far a feather is folded round its spine: breast feathers make a roof, tips and slips are flat. */
const FEATHER_FOLD: Record<FeatherPiece["shape"], number> = { breast: 1.6, tip: 0.2, slip: 0.25 };

/** The vane is solid to this fraction of the feather's width; a fringe of barbs makes the edge. */
const VANE = 0.82;
/** Fringe barbs per gape along each edge of a feather. */
const FRINGE_PER_GAPE = 24;

/** A feather's shape and markings, in its own frame: x along it, y down from the spine, z across. */
function featherForm(piece: FeatherPiece) {
  const L = piece.length;
  const outline = FEATHER_OUTLINE[piece.shape];
  const fold = FEATHER_FOLD[piece.shape];
  // Hackle tips and quill slips curve gently down over the body; a slip's end is ragged.
  const droop = piece.shape === "breast" ? 0 : 0.05;
  const half = (s: number) => Math.max(outline(s) * piece.width, 1e-4);
  /** The point at s along the feather (0 = base, 1 = tip) and t across it (-1 to 1, 0 = quill). */
  const point = (s: number, t: number) => {
    const r = half(s) / fold;
    const phi = t * fold;
    const ragged = piece.shape === "slip" ? 0.05 * s ** 6 * (0.5 + 0.5 * Math.sin(t * 11 + 1.3)) : 0;
    // Local -Y points up once placed: the spine is the top, the sides hang down.
    return new THREE.Vector3(s * L * (1 - ragged), r - r * Math.cos(phi) + droop * L * s * s, r * Math.sin(phi));
  };
  const shade = (s: number, t: number) => {
    // Strongly barred feathers (teal, grizzly) have crisp dark bars; mallard is softly vermiculated.
    const wave = 0.5 + 0.5 * Math.sin(2 * Math.PI * (s * 14 + Math.abs(t) * 0.9));
    const crisp = THREE.MathUtils.smoothstep(wave, 0.35, 0.65);
    const bars = 1 - 0.85 * piece.barring ** 2 * (wave + (crisp - wave) * piece.barring);
    // Fine barbs running out from the quill towards the tip, a pale quill, and slightly
    // darker edges where the barbs thin out: what makes a feather read as a feather.
    const barbs = 1 - 0.14 * (0.5 + 0.5 * Math.sin(2 * Math.PI * BARBS_PER_GAPE * (s * L - Math.abs(t) * half(s) * 1.3)));
    const quill = 1 + 0.1 * Math.exp(-((t * 10) ** 2));
    const edge = 1 - 0.3 * Math.abs(t) ** 6;
    return bars * barbs * quill * edge * (0.8 + 0.2 * s);
  };
  return { L, half, point, shade };
}

function featherGeometry(piece: FeatherPiece): THREE.BufferGeometry {
  const form = featherForm(piece);
  // Enough rows along the feather that bars and barbs don't alias into a checkerboard.
  const segS = Math.min(320, Math.max(piece.barring > 0 ? 128 : 48, Math.round(form.L * BARBS_PER_GAPE * 3)));
  const segT = 24;
  const positions: number[] = [];
  const colors: number[] = [];
  const index: number[] = [];
  for (let i = 0; i <= segS; i++) {
    const s = i / segS;
    for (let j = 0; j <= segT; j++) {
      const t = ((j / segT) * 2 - 1) * VANE;
      const p = form.point(s, t);
      positions.push(p.x, p.y, p.z);
      const shade = form.shade(s, t);
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
 * The barbs along a feather's edges, leaving the vane at an angle towards the tip and
 * ending a little unevenly past it, so the outline is soft rather than cut out.
 */
function featherFringe(piece: FeatherPiece): Fibre[] {
  const form = featherForm(piece);
  const rand = mulberry32(piece.id * 6151 + 7);
  const n = Math.round(form.L * FRINGE_PER_GAPE);
  const list: Fibre[] = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const s = 0.03 + (0.96 * (i + rand())) / n;
      const h = form.half(s);
      if (h < 0.02) continue;
      const from = side * VANE * 0.8;
      const base = form.point(s, from);
      const end = form.point(Math.min(1, s + (h * (0.5 + 0.5 * rand())) / form.L), side * (1 + 0.12 * rand()));
      const d = end.sub(base);
      list.push({ u: 0, base, dir: d.clone().normalize(), length: d.length(), radius: 0.0045, shade: form.shade(s, from) * (0.85 + 0.25 * rand()) });
    }
  }
  return list;
}

/**
 * A feather wing, or a pair. Breast feathers lie over the body like a roof; hackle
 * tips and quill slips stand on edge, in the plane of the shank, and a pair is turned
 * out to either side by `pair`.
 */
function featherView(piece: FeatherPiece, surfaces: Surfaces, space: ShankSpace): PieceView {
  const geometry = featherGeometry(piece);
  const material = surfaces.get("feather", piece.color, true);
  const fringe = fibreMesh(featherFringe(piece), material, 0.4);
  fringe.setProgress(1);
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
    mesh.add(sign > 0 ? fringe.object.clone() : fringe.object);
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
      fringe.dispose();
    },
  };
}

/** A bead slides round the bend and up the shank to the eye. */
function beadView(piece: BeadPiece, surfaces: Surfaces, space: ShankSpace): PieceView {
  // A cone head points its narrow end at the eye: a cylinder along +y turned onto +x.
  const geometry = piece.cone
    ? new THREE.CylinderGeometry(piece.radius * 0.45, piece.radius, piece.cone, 32, 1).rotateZ(-Math.PI / 2)
    : new THREE.SphereGeometry(piece.radius, 28, 20);
  const mesh = new THREE.Mesh(geometry, surfaces.get("bead", piece.color));
  const start = -0.3;
  return {
    object: mesh,
    setProgress(u) {
      mesh.visible = u > 0;
      const x = start + (piece.x - start) * Math.min(1, u * 1.1);
      mesh.position.copy(space.point(new THREE.Vector3(x, 0, 0)));
      mesh.quaternion.copy(space.rotation(x));
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
  // A closed strip: a domed top, an underside lying on the body, and thin side edges.
  const xEnd = piece.x1 + piece.stub;
  const segX = Math.max(48, Math.round((xEnd - piece.x0) * 90));
  const segT = 12;
  const ring = 2 * (segT + 1);
  const positions: number[] = [];
  const index: number[] = [];
  const colors: number[] = [];
  const v = new THREE.Vector3();
  const smooth = THREE.MathUtils.smootherstep;
  // A feather slip shows its barbs running along it and, if mottled (turkey), soft blotches.
  const feather = piece.look === "feather";
  const featherShade = (x: number, across: number) => {
    const barbs = 1 - 0.16 * (0.5 + 0.5 * Math.sin(2 * Math.PI * BARBS_PER_GAPE * across));
    const blotch = (Math.sin(x * 37 + across * 29) + Math.sin(x * 23 - across * 61 + 1.7) + Math.sin(x * 59 + across * 13 + 0.4)) / 3;
    const mottle = 1 - 0.75 * piece.barring * THREE.MathUtils.smoothstep(blotch, -0.3, 0.3);
    // Like a feather wing's base shade: a slip lying on top catches the light full on.
    return 0.75 * barbs * mottle;
  };
  // A strip is stiff enough to bridge the bumps of tie-ins under it: it lies on a smoothed body.
  const reach = piece.look === "foam" ? 0.22 : 0.12;
  /** Where it is tied down it is pressed onto the lowest body nearby; between the ties it bridges the bumps. */
  const bodyRadius = (x: number, pinch: number) => {
    let max = 0;
    let min = Infinity;
    let sum = 0;
    for (let k = -4; k <= 4; k++) {
      const r = piece.base.radiusAt(Math.min(piece.x1, Math.max(piece.x0 - reach, x + (reach * k) / 4)));
      sum += r;
      max = Math.max(max, r);
      min = Math.min(min, r);
    }
    const bridged = 0.5 * (sum / 9) + 0.5 * max;
    return min + (bridged - min) * pinch;
  };
  for (let i = 0; i <= segX; i++) {
    const x = piece.x0 + ((xEnd - piece.x0) * i) / segX;
    // Pinched down by the thread at the rear tie-in and at the tie-down; a trimmed stub
    // springs back up in front of the tie-down, and the far end is cut.
    let pinch = Math.min(smooth(x - piece.x0, 0, 0.14), smooth(piece.x1 - x, -0.02, 0.1));
    if (x > piece.x1) pinch = Math.min(smooth(x - piece.x1, 0, 0.08) * 0.9, i === segX ? 0 : 1);
    let thick = piece.thickness * Math.max(0.12, pinch);
    // Rib turns press it in.
    for (const d of piece.dents) thick *= 1 - 0.45 * Math.exp(-(((x - d) / 0.025) ** 2));
    const under = bodyRadius(Math.min(x, piece.x1), Math.min(1, pinch * 1.4)) + piece.lift * Math.max(0.15, Math.min(1, pinch * 1.4));
    for (let side = 0; side < 2; side++) {
      for (let j = 0; j <= segT; j++) {
        // Top surface from one edge to the other, then the underside back again.
        const t = side === 0 ? -1 + (2 * j) / segT : 1 - (2 * j) / segT;
        const phi = t * piece.halfAngle;
        const dome = 0.55 + 0.45 * Math.cos((t * Math.PI) / 2);
        const r = side === 0 ? under + thick * dome : under + thick * 0.05;
        space.point(v.set(x, r * Math.cos(phi), r * Math.sin(phi)));
        positions.push(v.x, v.y, v.z);
        const shade = feather ? featherShade(x, phi * r) : 1;
        colors.push(shade, shade, shade);
      }
    }
  }
  for (let i = 0; i < segX; i++) {
    for (let j = 0; j < ring; j++) {
      const a = i * ring + j;
      const a1 = i * ring + ((j + 1) % ring);
      const b = a + ring;
      const b1 = a1 + ring;
      index.push(a, a1, b, b, a1, b1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  if (feather) geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  const look = piece.look === "foam" ? "foam" : feather ? "feather" : "fibres";
  const material = surfaces.get(look, piece.color, feather).clone();
  material.side = THREE.DoubleSide;
  const mesh = new THREE.Mesh(geometry, material);
  return {
    object: mesh,
    setProgress(u) {
      mesh.visible = u > 0;
      geometry.setDrawRange(0, Math.ceil(u * segX) * ring * 6);
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
    case "extension":
      return extensionView(piece, surfaces, space);
    case "legs":
      return legsView(piece, surfaces, space);
  }
}

/**
 * An extended body: a solid rope sticking out from the tie-in, drooping a little, rounded
 * off at the end, with a differently coloured tip if it has one and chenille's pile on it.
 */
function extensionView(piece: ExtensionPiece, surfaces: Surfaces, space: ShankSpace): PieceView {
  const flip = piece.side === "under" ? -1 : 1;
  const segL = 48;
  const segR = 16;
  const L = piece.length;
  const R = piece.thickness;
  // Centre line in shank-local coordinates: back (and up by angle) from the tie-in, sagging slightly.
  const towards = piece.forward ? 1 : -1;
  const centre = (t: number) =>
    new THREE.Vector3(
      piece.x + towards * L * t * Math.cos(piece.angle),
      // It is bound along the shank, so its centre sits just above the hook wire.
      flip * (piece.radius * 0.4 + R * 0.55 + L * t * Math.sin(piece.angle) - 0.06 * L * t * t),
      0,
    );
  // Full thickness, rounding off over the last part; the very start tucks under the wraps.
  const radiusAt = (t: number) => R * Math.min(1, 0.6 + t * 8) * (t < 0.85 ? 1 : Math.sqrt(Math.max(0, 1 - ((t - 0.85) / 0.15) ** 2)) * 0.9 + 0.1);
  const body = new THREE.Color(piece.color);
  const tip = piece.tip ? new THREE.Color(piece.tip) : body;
  const positions: number[] = [];
  const colors: number[] = [];
  const index: number[] = [];
  const v = new THREE.Vector3();
  for (let i = 0; i <= segL; i++) {
    const t = i / segL;
    const c = centre(t);
    const ahead = centre(Math.min(1, t + 0.01)).sub(centre(Math.max(0, t - 0.01))).normalize();
    const normal = new THREE.Vector3(0, 0, 1);
    const binormal = new THREE.Vector3().crossVectors(ahead, normal).normalize();
    const r = radiusAt(t);
    const mix = piece.tip ? THREE.MathUtils.smoothstep(t, 0.82, 0.9) : 0;
    const color = body.clone().lerp(tip, mix);
    for (let j = 0; j <= segR; j++) {
      const a = (j / segR) * Math.PI * 2;
      v.copy(c).addScaledVector(binormal, r * Math.cos(a)).addScaledVector(normal, r * Math.sin(a));
      space.point(v);
      positions.push(v.x, v.y, v.z);
      colors.push(color.r, color.g, color.b);
    }
  }
  for (let i = 0; i < segL; i++) {
    for (let j = 0; j < segR; j++) {
      const a = i * (segR + 1) + j;
      const b = a + segR + 1;
      index.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: piece.look === "foam" ? 0.75 : 0.95 });
  const group = new THREE.Group();
  group.add(new THREE.Mesh(geometry, material));

  let fuzz: ReturnType<typeof fibreMesh> | null = null;
  if (piece.fuzz) {
    const rand = mulberry32(piece.id * 4111 + 9);
    const list: Fibre[] = [];
    const n = Math.round(L * 900);
    for (let k = 0; k < n; k++) {
      const t = 0.03 + 0.8 * rand();
      const a = rand() * Math.PI * 2;
      const c = centre(t);
      const out = new THREE.Vector3(0, Math.cos(a), Math.sin(a));
      const base = c.clone().addScaledVector(out, radiusAt(t) * 0.9);
      const dir = out.clone().add(new THREE.Vector3(towards * 0.6, 0, 0)).add(new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5)).normalize();
      list.push({ u: rand(), base, dir, length: piece.fuzz * (0.5 + 0.6 * rand()), radius: 0.005, shade: 0.85 + 0.25 * rand() });
    }
    fuzz = fibreMesh(placeFibres(list, space), surfaces.get(piece.look, piece.color, true), 0.6);
    group.add(fuzz.object);
  }
  return {
    object: group,
    setProgress(u) {
      group.visible = u > 0;
      fuzz?.setProgress(u);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      fuzz?.dispose();
    },
  };
}

/** Legs tied across the shank: each strand sticks out on both sides, leaning back and sagging. */
function legsView(piece: LegsPiece, surfaces: Surfaces, space: ShankSpace): PieceView {
  const list: Fibre[] = [];
  const rand = mulberry32(piece.id * 7177 + 5);
  for (let i = 0; i < piece.count; i++) {
    // Strands a little apart along the shank, as when they are wrapped on one by one.
    const x = piece.x + (i - (piece.count - 1) / 2) * 0.09;
    for (const side of [-1, 1]) {
      const dir = new THREE.Vector3(-Math.sin(piece.sweep), -0.2, side * Math.cos(piece.sweep)).normalize();
      list.push({
        u: (i + rand()) / piece.count,
        base: new THREE.Vector3(x, piece.radius * 0.2, side * piece.radius * 0.8),
        dir,
        length: piece.length * (0.92 + 0.12 * rand()),
        radius: piece.strandRadius,
        shade: 0.9 + 0.15 * rand(),
        // Soft strands sag under their own weight.
        bend: 0.18 + 0.1 * rand(),
        bendDir: perpendicular(dir, new THREE.Vector3(0, -1, 0), rand),
      });
    }
  }
  const look = piece.look === "legs" ? "legs" : piece.look;
  const fibres = fibreMesh(placeFibres(list, space), surfaces.get(look, piece.color, true), piece.look === "legs" ? 0.85 : 0.3);
  return {
    object: fibres.object,
    setProgress(u) {
      fibres.object.visible = u > 0;
      fibres.setProgress(u);
    },
    dispose() {
      fibres.dispose();
    },
  };
}
