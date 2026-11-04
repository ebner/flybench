import * as THREE from "three";
import {
  belowReach,
  extensionCentre,
  shapeFactor,
  wrapAt,
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
  type SleevePiece,
  type WrapsPiece,
} from "../tying/simulate";
import { natural, type Surfaces } from "./materials";
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
const Z_AXIS = new THREE.Vector3(0, 0, 1);

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
  /** Multiplies the material colour too: a fibre of another colour in a blended bunch. */
  tint?: THREE.Color;
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

  const addPart = (geometry: THREE.BufferGeometry, list: { u: number; base: THREE.Vector3; dir: THREE.Vector3; length: number; radius: number; shade: number; tint?: THREE.Color }[], segment?: number) => {
    if (list.length === 0) {
      geometry.dispose();
      return;
    }
    const mesh = new THREE.InstancedMesh(geometry, material, list.length);
    list.forEach((f, i) => {
      q.setFromUnitVectors(Y_AXIS, f.dir);
      m.compose(f.base, q, s.set(f.radius, f.length, f.radius));
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, f.tint ? c.copy(f.tint).multiplyScalar(f.shade) : c.setScalar(f.shade));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    // A curved fibre's pieces share its index across the segment meshes (the wet view clumps them together).
    if (segment !== undefined) mesh.userData.segment = segment;
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
        return { u: f.u, base: a, dir: d.normalize(), length, radius: f.radius, shade: f.shade ?? 1, tint: f.tint };
      }),
      k,
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
      // The instanced mesh holds its own GPU buffers (matrices, colours) besides the geometry.
      for (const { mesh } of parts) {
        mesh.geometry.dispose();
        mesh.dispose();
      }
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
  // Assumption: a CDC feather has few, wispy barbs: about 45 to a turn (photos of the CDC & Elk).
  cdc: { perTurn: 45, radius: 0.003, tip: 0.3, wave: 0.2 },
  fibres: { perTurn: 90, radius: 0.003, tip: 0.4, wave: 0 },
} as const;

const BACK = new THREE.Vector3(-1, 0, 0);
const ZERO = new THREE.Vector3();

/**
 * Colours for `n` fibres of a blended bunch: each colour as often as the others, shuffled through
 * the bunch, so even a sparse one shows them all.
 */
export function spreadColours<T>(n: number, colours: readonly T[], rand: () => number): T[] {
  const out = Array.from({ length: n }, (_, i) => colours[i % colours.length]!);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

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

    // Angle round whatever is being wound on.
    const around = onPost ? Math.atan2(px - piece.post!.x, pz) : wrapAt(piece, u).angle;
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
    // trimmed underneath keeps everything that doesn't point down. Under a wing case the
    // fibres on top are pressed flat out of sight. Hidden fibres still draw their random
    // numbers below, so the ones left stay exactly where they were before.
    const hidden =
      (piece.keep === "sides" && Math.abs(Math.sin(spin)) > 0.45) ||
      (piece.keep === "top" && Math.sin(spin) < -0.35) ||
      (piece.keep === "under" && Math.sin(spin) > 0.35) ||
      (piece.covered?.some(([from, to, half]) => px > from && px < to && Math.sin(spin) > Math.cos(half + 0.2)) ?? false);
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
    if (!hidden) list.push({ u, base, dir, length, radius: spec.radius, shade, bend, bendDir });
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

// Assumption, read from photos of the Bitch Creek (Fish4Flies, John Kreft): the colours of a woven
// body meet along the side, and at each crossing the top colour reaches about half of the way
// down to the belly in a tooth that leans back.
const WOVEN_SEAM = 0;
const WOVEN_TOOTH = 1.0;

/** Whether a shank-local point on a woven body shows the top strand's colour. */
function wovenTop(piece: WrapsPiece, x: number, y: number, z: number): boolean {
  const el = Math.atan2(y - piece.base.ringAt(x).centre, Math.abs(z));
  const below = WOVEN_SEAM - el;
  if (below <= 0) return true;
  if (below >= WOVEN_TOOTH) return false;
  const period = Math.abs(piece.x1 - piece.x0) / Math.max(1, piece.turns);
  const depth = below / WOVEN_TOOTH;
  // One tooth a crossing, where the crossing passes the side (the near side half a turn before
  // the far side), at the seam most of a crossing wide and narrowing to its point.
  const phase = ((((x - Math.min(piece.x0, piece.x1)) / period + (z < 0 ? 0.5 : 0) + 0.2 * depth) % 1) + 1) % 1;
  return Math.min(phase, 1 - phase) < 0.4 * (1 - depth);
}

/**
 * A woven body's strands: a round tube along the turns, its faces split between the top colour
 * and the belly's by where they lie. Each geometry draws up to `counts[i]` indices for i segments.
 */
function wovenTubes(piece: WrapsPiece, space: ShankSpace, radius: number, segments: number) {
  // Finely divided round, so the teeth along the seam show.
  const radial = 24;
  const positions: number[] = [];
  const local: [number, number, number][] = [];
  const v = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    const [px, py, pz] = wrapPoint(piece, i / segments).point;
    const len = Math.hypot(py, pz) || 1;
    for (let j = 0; j <= radial; j++) {
      const t = (j / radial) * Math.PI * 2;
      const out = radius * Math.cos(t);
      const p: [number, number, number] = [px + radius * Math.sin(t), py + (py / len) * out, pz + (pz / len) * out];
      local.push(p);
      space.point(v.set(...p));
      positions.push(v.x, v.y, v.z);
    }
  }
  const index = { top: [] as number[], under: [] as number[] };
  const counts = { top: [0], under: [0] };
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b = a + radial + 1;
      const c = [a, b, a + 1, b + 1].map((k) => local[k]!);
      const mid = [0, 1, 2].map((d) => c.reduce((s, p) => s + p[d]!, 0) / 4) as [number, number, number];
      // In this order the faces turn outward.
      (wovenTop(piece, ...mid) ? index.top : index.under).push(a, a + 1, b, b, a + 1, b + 1);
    }
    counts.top.push(index.top.length);
    counts.under.push(index.under.length);
  }
  const geometry = (idx: number[]) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };
  return { top: geometry(index.top), under: geometry(index.under), counts };
}

function wrapsView(piece: WrapsPiece, surfaces: Surfaces, space: ShankSpace): PieceView {
  if (piece.woven) return wovenView(piece, { ...piece, ...piece.woven.under }, surfaces, space);
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
      piece.look === "dubbing" || piece.look === "chenille" ? piece.strandRadius * 0.9 : piece.strandRadius;
    tube = new THREE.TubeGeometry(new WrapsCurve(piece, space), tubular, tubeRadius, radial, false);
    perSegment = radial * 6;
  }
  // Dubbing is a felt of mottled fur, not a smooth strand of one colour.
  const mottled = piece.look === "dubbing";
  if (mottled) {
    const rand = mulberry32((piece.seed ?? piece.id) * 31 + 5);
    const count = tube.getAttribute("position").count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) colors.fill(0.62 + 0.38 * rand(), i * 3, i * 3 + 3);
    tube.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  }
  group.add(new THREE.Mesh(tube, surfaces.get(tubeLook, piece.color, mottled)));

  // Thread lies flat and tight: on the bare shank or over what is bound under it (trimmed butts,
  // tie-in bumps), a core along that layer, so no air shows between the turns and the shank.
  // Not under open turns, where the shank or body shows between them.
  const core = piece.look === "thread" && piece.path !== "post" ? threadCore(piece, space) : null;
  if (core) group.add(new THREE.Mesh(core.geometry, surfaces.get("thread", piece.color)));

  let fibres: ReturnType<typeof fibreMesh> | null = null;
  if (piece.fibreLength && piece.look in WOUND_FIBRES) {
    const spec = WOUND_FIBRES[piece.look as keyof typeof WOUND_FIBRES];
    const list = placeFibres(woundFibres(piece, mulberry32((piece.seed ?? piece.id) * 7919 + 1)), space);
    fibres = fibreMesh(list, surfaces.get(piece.look, piece.color, true), spec.tip);
    group.add(fibres.object);
  }

  return {
    object: group,
    setProgress(u) {
      group.visible = u > 0;
      tube.setDrawRange(0, Math.floor(u * tubular) * perSegment);
      core?.setProgress(u);
      fibres?.setProgress(u);
    },
    dispose() {
      tube.dispose();
      core?.geometry.dispose();
      fibres?.dispose();
    },
  };
}

/** Two strands woven: the top strand over the back, the other round the belly, toothed where they meet. */
function wovenView(piece: WrapsPiece, under: WrapsPiece, surfaces: Surfaces, space: ShankSpace): PieceView {
  const group = new THREE.Group();
  const tubular = Math.max(8, Math.min(4000, Math.round(piece.turns * 28)));
  // The crossings are pulled snug against each other: no gaps between them.
  const pitch = Math.abs(piece.x1 - piece.x0) / Math.max(1, piece.turns);
  const tubes = wovenTubes(piece, space, Math.max(piece.strandRadius * 0.9, pitch * 0.6), tubular);
  group.add(new THREE.Mesh(tubes.top, surfaces.get(piece.look, piece.color)));
  group.add(new THREE.Mesh(tubes.under, surfaces.get(under.look, under.color)));
  const meshes: ReturnType<typeof fibreMesh>[] = [];
  // Each strand's fibres where that strand shows, by where a fibre's middle is.
  const onTop = (f: Fibre) => {
    const m = f.base.clone().addScaledVector(f.dir, f.length * 0.5);
    return wovenTop(piece, m.x, m.y, m.z);
  };
  for (const [strand, top, salt] of [[piece, true, 1], [under, false, 2]] as const) {
    if (!strand.fibreLength || !(strand.look in WOUND_FIBRES)) continue;
    const spec = WOUND_FIBRES[strand.look as keyof typeof WOUND_FIBRES];
    const list = woundFibres(strand, mulberry32((piece.seed ?? piece.id) * 7919 + salt)).filter((f) => onTop(f) === top);
    const mesh = fibreMesh(placeFibres(list, space), surfaces.get(strand.look, strand.color, true), spec.tip);
    group.add(mesh.object);
    meshes.push(mesh);
  }
  return {
    object: group,
    setProgress(u) {
      group.visible = u > 0;
      const n = Math.floor(u * tubular);
      tubes.top.setDrawRange(0, tubes.counts.top[n]!);
      tubes.under.setDrawRange(0, tubes.counts.under[n]!);
      for (const m of meshes) m.setProgress(u);
    },
    dispose() {
      tubes.top.dispose();
      tubes.under.dispose();
      for (const m of meshes) m.dispose();
    },
  };
}

/**
 * The solid layer under thread turns: a tube following the profile they are wound on, just
 * inside the turns, growing with them along the shank.
 */
function threadCore(piece: WrapsPiece, space: ShankSpace): { geometry: THREE.BufferGeometry; setProgress: (u: number) => void } | null {
  const travel = piece.path === "travel";
  const from = Math.min(piece.x0, piece.x1);
  const to = Math.max(piece.x0, piece.x1);
  const along = 24;
  const round = 16;
  const rings = Array.from({ length: along + 1 }, (_, i) => {
    const x = from + ((to - from) * i) / along;
    return piece.base.ringAt(piece.bindsTo !== undefined ? Math.max(x, piece.bindsTo) : x);
  });
  const span = travel ? to - from : 2 * piece.width;
  if (to - from < 1e-3 || span / Math.max(1, piece.turns) > 4 * piece.strandRadius) return null;
  const positions: number[] = [];
  const index: number[] = [];
  const v = new THREE.Vector3();
  for (let i = 0; i <= along; i++) {
    const x = from + ((to - from) * i) / along;
    // Just inside the turns' centres, so the core shows only between them.
    const r = rings[i]!.radius + piece.strandRadius * 0.4;
    for (let j = 0; j <= round; j++) {
      space.around(x, r, (j / round) * Math.PI * 2, v, rings[i]!.centre);
      positions.push(v.x, v.y, v.z);
    }
  }
  for (let i = 0; i < along; i++) {
    for (let j = 0; j < round; j++) {
      const a = i * (round + 1) + j;
      const b = a + round + 1;
      // Facing outwards (the shank's surface is seen from outside).
      index.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  if (!travel) {
    // A head's ends are closed down to the shank, so it can't be looked into from the eye. The
    // caps have their own copy of the rim, so they are shaded flat.
    for (const [i, facing] of [[0, -1], [along, 1]] as const) {
      const x = from + ((to - from) * i) / along;
      const axis = positions.length / 3;
      space.point(v.set(x, 0, 0));
      positions.push(v.x, v.y, v.z);
      const rim = i * (round + 1);
      for (let j = 0; j <= round; j++) positions.push(positions[(rim + j) * 3]!, positions[(rim + j) * 3 + 1]!, positions[(rim + j) * 3 + 2]!);
      for (let j = 0; j < round; j++) {
        const a = axis + 1 + j;
        if (facing < 0) index.push(axis, a, a + 1);
        else index.push(axis, a + 1, a);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  const perRing = round * 6;
  // Wound along, it grows from where the thread starts; wound in place (a head), it is there
  // once the first turns are.
  const forward = !travel || piece.x1 >= piece.x0;
  return {
    geometry,
    setProgress(u) {
      if (!travel) return geometry.setDrawRange(0, u > 0.15 ? index.length : 0);
      const n = Math.floor(u * along);
      if (forward) geometry.setDrawRange(0, n * perRing);
      else geometry.setDrawRange((along - n) * perRing, n * perRing);
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
  // Tubing tied in as a tail, picked apart: fine metallic strands, kinked from the braid, uneven.
  tubing: { radius: 0.004, tip: 1, tipShade: 1, spread: 0.16, flare: 0.03, sideFlare: 0.3, lengthJitter: 0.35, curve: 0.14, droop: 0.05 },
} as const;

/**
 * How far a fibre from `base` along `dir` reaches inside a disc trimmed from hair spanning the
 * piece: a flat, round-edged shape as long as the hair spans, as wide as it stands out, and as
 * thick as it is cut top and bottom (a crab's body). At most `length`.
 */
function discReach(piece: BundlePiece, base: THREE.Vector3, dir: THREE.Vector3, length: number): number {
  const a = piece.span! / 2;
  const mid = piece.x + a;
  const c = piece.length;
  const inside = (t: number) => {
    const px = (base.x + dir.x * t - mid) / a;
    const pz = (base.z + dir.z * t) / c;
    const py = base.y + dir.y * t;
    const h = py >= 0 ? (piece.flat?.top ?? c) : (piece.flat?.under ?? c);
    return px * px + pz * pz + (py / h) ** 4 <= 1;
  };
  if (inside(length)) return length;
  if (!inside(0)) return 0.01;
  let lo = 0;
  let hi = length;
  for (let k = 0; k < 18; k++) {
    const t = (lo + hi) / 2;
    if (inside(t)) lo = t;
    else hi = t;
  }
  return Math.max(0.01, lo);
}

/** The surface colour a blended bunch is drawn on; each fibre's tint makes it its own colour. */
const BLEND_BASE = "#ffffff";

/** Tints that turn a blended bunch's white surface into each of its colours, as its look draws them. */
function blendTints(look: BundlePiece["look"], colours: string[]): THREE.Color[] {
  // (Flash and rubber are drawn in their own colour; fibres of fur and feather never paper-white.)
  const shown = (c: string) => (look === "flash" || look === "legs" ? new THREE.Color(c) : natural(c));
  const base = shown(BLEND_BASE);
  return colours.map((c) => {
    const t = shown(c);
    return new THREE.Color(t.r / base.r, t.g / base.g, t.b / base.b);
  });
}

function bundleView(piece: BundlePiece, surfaces: Surfaces, space: ShankSpace): PieceView {
  const spec = BUNDLE[piece.look as keyof typeof BUNDLE] ?? BUNDLE.yarn;
  const rand = mulberry32((piece.seed ?? piece.id) * 104729 + 3);
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
    if (piece.across && piece.span) {
      // Pads laid across the shank, stacked on top and underneath: each fibre half lies out to one
      // side, askew and wavy as soft fibre lies, a few more near the outside of the stack, where
      // they show. Trimmed to a disc, the stack thins towards its ends.
      const side = i % 2 === 0 ? 1 : -1;
      const top = piece.flat?.top ?? piece.length;
      const under = piece.flat?.under ?? piece.length;
      const up = rand() < top / (top + under);
      const x = piece.x + rand() * piece.span;
      const px = (x - piece.x) / piece.span * 2 - 1;
      const thins = piece.cut && piece.trimShape === "disc" ? Math.pow(Math.max(0, 1 - px * px), 0.25) : 1;
      const y = (up ? top : -under) * 0.97 * thins * Math.pow(rand(), 0.7);
      // (Each starts a little past the middle, as a fibre crossing the shank does.)
      const base = new THREE.Vector3(x, y, -side * 0.05 * rand());
      const dir = new THREE.Vector3((rand() - 0.5) * 0.9, (rand() - 0.5) * 0.6, side).normalize();
      const jitter = piece.cut ? 0 : spec.lengthJitter;
      let length = piece.length * (1 - jitter / 2 + jitter * rand());
      if (piece.cut && piece.trimShape === "disc") length = discReach(piece, base, dir, length);
      // No fibre reaches past the cut on top or underneath (pads cut flat with keep).
      if (dir.y > 0.001) length = Math.min(length, Math.max(0.01, (top - y) / dir.y));
      if (dir.y < -0.001) length = Math.min(length, Math.max(0.01, (under + y) / -dir.y));
      list.push({
        // (Thickened, so the stack reads as the dense mat it is rather than a few strands.)
        u: rand(), base, dir, length, radius: spec.radius * 1.6 * (piece.fibreWidth ?? 1),
        shade: (0.85 + 0.3 * rand()) * (1 - 0.25 * (1 - Math.abs(y) / Math.max(0.01, up ? top : under))),
      });
      continue;
    }
    if (upright) {
      const a = rand() * 2 * Math.PI;
      const d = Math.sqrt(rand()) * piece.bundleRadius * 0.7;
      const base = new THREE.Vector3(piece.x + d * Math.cos(a), piece.radius * flip, d * Math.sin(a));
      const fan = 0.08 + spec.sideFlare * 0.45 * rand();
      const dir = along
        .clone()
        .add(new THREE.Vector3(Math.cos(a) * fan, 0, Math.sin(a) * fan))
        .normalize();
      if (piece.fan) {
        // Fanned fore and aft, narrow across: each hair turned along the shank, the bunch's
        // bases strung out a little along it as the hair is bound flat.
        const along = rand() * 2 - 1;
        dir.z *= 0.25;
        dir.normalize().applyAxisAngle(Z_AXIS, -along * piece.fan / 2);
        base.x = piece.x + along * piece.bundleRadius * 0.9;
        base.z *= 0.45;
      }
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
    // Round the circle through the top (or bottom) that is `centre` off the axis.
    const centre = piece.centre ?? 0;
    const r = piece.radius - centre + piece.bundleRadius * (radialHair ? 0.2 : 0.3 + 0.5 * rand()) * rand();
    const x = piece.x + (piece.span ? rand() * piece.span : rand() * 0.04);
    const base = new THREE.Vector3(x, (centre + r * Math.cos(theta)) * flip, r * Math.sin(theta));
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
      if (piece.trimShape === "disc") {
        // Round in plan, flat top and bottom.
        length = discReach(piece, base, dir, length);
      } else {
        length *= shapeFactor(piece.trimShape ?? "round", f);
        if (piece.trimShape === "wedge") {
          // Cut flat underneath close to the hook.
          if (dir.y < -0.05) length = Math.min(length, 0.1 / -dir.y);
          if (Math.abs(dir.z) > 0.6) length *= 0.75;
        }
        // Cut closer underneath: round about a line above the shank.
        if (piece.below !== undefined) length *= belowReach(outward.y, outward.z, piece.below);
      }
    }
    // Cut flat on top or underneath: no hair reaches past the cut; the sides keep their length.
    if (radialHair && piece.flat) {
      if (piece.flat.top !== undefined && dir.y > 0.02) length = Math.min(length, Math.max(0.01, (piece.flat.top - base.y) / dir.y));
      if (piece.flat.under !== undefined && dir.y < -0.02) length = Math.min(length, Math.max(0.01, (piece.flat.under + base.y) / -dir.y));
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
      // Rubber and silicone strands keep their real thickness, as they do tied across.
      radius: piece.look === "legs" ? piece.bundleRadius : (radialHair && piece.cut ? spec.radius * 1.6 : spec.radius) * (piece.fibreWidth ?? 1),
      shade: (0.85 + 0.3 * rand()) * (piece.cut ? 1 : 1 - 0.32 * Math.pow(rand(), 0.6)),
      bend, bendDir: bend > 0 ? perpendicular(dir, toward, rand) : undefined,
    });
  }
  // A blended bunch: each fibre one of its colours, drawn on a white surface so they can differ.
  // (Its own generator, so blending a bunch doesn't move its fibres.)
  const colours = piece.mix ? blendTints(piece.look, piece.mix) : undefined;
  if (colours) {
    const tints = spreadColours(list.length, colours, mulberry32((piece.seed ?? piece.id) * 7919 + 11));
    list.forEach((f, i) => (f.tint = tints[i]));
  }
  if (piece.look === "cdc" || piece.look === "marabou" || piece.flue) {
    // Barbules: short, fine fibres all along each barb, which give CDC and marabou their fluff
    // and peacock sword its herl-like flue.
    const barbs = list.slice();
    const perBarb = piece.look === "cdc" ? 6 : piece.flue ? 16 : 4;
    for (const f of barbs) {
      for (let k = 0; k < perBarb; k++) {
        const t = 0.2 + 0.8 * rand();
        const base = f.base.clone().addScaledVector(f.dir, f.length * t);
        const dir = f.dir
          .clone()
          .add(new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(1.6))
          .normalize();
        // Marabou's barbules are long and soft enough to fill the plume out into a cloud; a
        // peacock sword fibre's flue makes it a broad, glittering frond.
        const fluff = piece.look === "marabou";
        list.push({
          u: f.u, base, dir, length: fluff ? 0.1 + 0.2 * rand() : piece.flue ? 0.08 + 0.1 * rand() : 0.05 + 0.06 * rand(),
          radius: fluff ? 0.004 : piece.flue ? 0.0035 : 0.0018, shade: f.shade, tint: f.tint,
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
  const fibres = fibreMesh(placeFibres(list, space), surfaces.get(piece.look, colours ? BLEND_BASE : piece.color, true), tip, tipShade, marks);
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
  // A jungle cock eye: narrow at the stem, widening to a broad, round end.
  eye: (s) => 0.5 * (s < 0.6 ? 0.45 + 0.55 * Math.sin((s / 0.6) * (Math.PI / 2)) : Math.sqrt(Math.max(0, 1 - ((s - 0.6) / 0.4) ** 2))),
};

// Assumption: a jungle cock eye's enamel spots, read from photos of the feathers: three cream
// drops down the quill, growing towards the end, each with a buff tip, on a near-black feather.
const EYE_SPOTS = [
  { at: 0.3, half: 0.08, width: 0.42 },
  { at: 0.54, half: 0.1, width: 0.55 },
  { at: 0.81, half: 0.15, width: 0.7 },
];
const ENAMEL = new THREE.Color("#efe3c0");
const ENAMEL_TIP = new THREE.Color("#c98d45");

/** The colour of a jungle cock eye at s along it and t across it (-1 to 1), before shading. */
function eyeColour(base: THREE.Color, s: number, t: number): THREE.Color {
  for (const spot of EYE_SPOTS) {
    const along = (s - spot.at) / spot.half;
    // A drop, pointed towards the stem and round towards the end.
    const across = Math.abs(t) / (spot.width * Math.sqrt(Math.max(0, 1 - along * along)) * (along < 0 ? 1 + along * 0.6 : 1));
    if (Math.abs(along) <= 1 && across <= 1) return along > 0.55 ? ENAMEL_TIP : ENAMEL;
  }
  return base;
}

/** Barbs per gape along a feather, for its texture. */
const BARBS_PER_GAPE = 14;

/** How far a feather is folded round its spine: breast feathers make a roof, tips and slips are flat. */
const FEATHER_FOLD: Record<FeatherPiece["shape"], number> = { breast: 1.6, tip: 0.2, slip: 0.25, eye: 0.15 };

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

/** A feather drawn in more than one colour (a jungle cock eye) is drawn white, its colours in its vertices. */
const painted = (piece: FeatherPiece) => piece.shape === "eye";

/** What turns a painted feather's white surface into `color`, as feathers are drawn. */
function paint(color: THREE.Color | string): THREE.Color {
  const base = natural("#ffffff");
  const c = natural(typeof color === "string" ? color : `#${color.getHexString()}`);
  return new THREE.Color(c.r / base.r, c.g / base.g, c.b / base.b);
}

function featherGeometry(piece: FeatherPiece): THREE.BufferGeometry {
  const form = featherForm(piece);
  const base = painted(piece) ? new THREE.Color(piece.color) : null;
  const tints = base && { base: paint(base), enamel: paint(ENAMEL), tip: paint(ENAMEL_TIP) };
  // Enough rows along the feather that bars and barbs don't alias into a checkerboard.
  const segS = Math.min(320, Math.max(piece.barring > 0 || painted(piece) ? 128 : 48, Math.round(form.L * BARBS_PER_GAPE * 3)));
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
      if (base && tints) {
        const c = eyeColour(base, s, t / VANE);
        const tint = c === ENAMEL ? tints.enamel : c === ENAMEL_TIP ? tints.tip : tints.base;
        colors.push(tint.r * shade, tint.g * shade, tint.b * shade);
      } else colors.push(shade, shade, shade);
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
  const tint = painted(piece) ? paint(piece.color) : undefined;
  const rand = mulberry32((piece.seed ?? piece.id) * 6151 + 7);
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
      list.push({ u: 0, base, dir: d.clone().normalize(), length: d.length(), radius: 0.0045, shade: form.shade(s, from) * (0.85 + 0.25 * rand()), ...(tint && { tint }) });
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
  const material = surfaces.get("feather", painted(piece) ? "#ffffff" : piece.color, true);
  const fringe = fibreMesh(featherFringe(piece), material, 0.4);
  fringe.setProgress(1);
  const root = anchored(space, piece.x);
  const growers: THREE.Object3D[] = [];
  // The second feather of a pair shares the fringe's geometry, but its instanced meshes have
  // buffers of their own to release.
  const copies: THREE.Object3D[] = [];
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
    const edge = sign > 0 ? fringe.object.clone() : fringe.object;
    if (edge !== fringe.object) copies.push(edge);
    mesh.add(edge);
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
      for (const copy of copies) copy.traverse((o) => o instanceof THREE.InstancedMesh && o.dispose());
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
  // A painted split shot: a yellow eye with a black pupil on each side.
  const eyeParts: THREE.BufferGeometry[] = [];
  if (piece.painted) {
    for (const side of [-1, 1]) {
      for (const [scale, color, out] of [[0.5, "#f2d23c", 0.9], [0.24, "#111111", 0.97]] as const) {
        const g = new THREE.SphereGeometry(piece.radius * scale, 20, 12).scale(1, 1, 0.25);
        eyeParts.push(g);
        const eye = new THREE.Mesh(g, surfaces.get("bead", color));
        eye.position.set(piece.radius * 0.18, piece.radius * 0.12, side * piece.radius * out);
        mesh.add(eye);
      }
    }
  }
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
      for (const g of eyeParts) g.dispose();
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
  // Hair folded or bound over the body shows its hairs lying along it, light and dark.
  const hair = piece.look === "hair";
  const hairShade = (x: number, across: number) =>
    0.86 + 0.07 * Math.sin(across * 190 + 1.5 * Math.sin(x * 9)) + 0.05 * Math.sin(across * 83 + 3 * x + 2.1);
  const shaded = feather || hair;
  // A strip is stiff enough to bridge the bumps of tie-ins under it: it lies on a smoothed body.
  const reach = piece.look === "foam" ? 0.22 : 0.12;
  /** Where it is tied down it is pressed onto the lowest body nearby; between the ties it bridges the bumps. */
  const bodyRadius = (x: number, pinch: number) => {
    let max = 0;
    let min = Infinity;
    let sum = 0;
    for (let k = -4; k <= 4; k++) {
      const at = Math.min(piece.x1, Math.max(piece.x0 - reach, x + (reach * k) / 4));
    const r = piece.side === "under" ? piece.base.underAt(at) : piece.base.radiusAt(at);
      sum += r;
      max = Math.max(max, r);
      min = Math.min(min, r);
    }
    const bridged = 0.5 * (sum / 9) + 0.5 * max;
    return min + (bridged - min) * pinch;
  };
  // Pulled over the belly, the same shape mirrored below the ring's centre.
  const flip = piece.side === "under" ? -1 : 1;
  // A strip cut to a width lies flat over the body, its edges dropping a little past the body's
  // sides; cut tapered, it widens from a point where it is tied in to its width at the tie-down.
  const flatStrip = piece.width !== undefined;
  const halfWidth = (x: number, pinch: number) => {
    // From the point, where it is tied in: its rear end, or its front when it was laid back.
    const fromRear = Math.min(1, Math.max(0, (x - piece.x0) / Math.max(0.05, piece.x1 - piece.x0)));
    const along = piece.taper === "front" ? 1 - fromRear : fromRear;
    // Cinched by the thread at the tie-downs.
    return ((piece.width ?? 0) / 2) * (piece.taper ? 0.12 + 0.88 * along : 1) * (0.35 + 0.65 * Math.min(1, pinch * 1.2));
  };
  /** The strip's cross-section at x: how high its underside lies, how thick it is, how tightly it is pinched. */
  const section = (x: number, last = false) => {
    // Pinched down by the thread at the rear tie-in and at the tie-down; a trimmed stub
    // springs back up in front of the tie-down, and the far end is cut.
    let pinch = Math.min(smooth(x - piece.x0, 0, 0.14), smooth(piece.x1 - x, -0.02, 0.1));
    if (x > piece.x1) pinch = Math.min(smooth(x - piece.x1, 0, 0.08) * 0.9, last && !piece.fold ? 0 : 1);
    let thick = piece.thickness * Math.max(0.12, pinch);
    // Rib turns press it in.
    for (const d of piece.dents) thick *= 1 - 0.45 * Math.exp(-(((x - d) / 0.025) ** 2));
    // A loose bubble arches up between its tie-downs, highest in the middle.
    const arch = piece.bubble ? piece.bubble * Math.sin(Math.PI * Math.min(1, Math.max(0, (x - piece.x0) / (piece.x1 - piece.x0)))) : 0;
    let under = bodyRadius(Math.min(x, piece.x1), Math.min(1, pinch * 1.4)) + piece.lift * Math.max(0.15, Math.min(1, pinch * 1.4)) + arch;
    if (piece.fold && x > piece.x1) {
      // Folded back over itself: two layers (and a little air) in front of the tie-down, rounded
      // where it turns back at the front.
      const r = Math.min(piece.thickness * 1.2, (xEnd - piece.x1) / 2);
      const e = Math.min(1, Math.max(0, (x - (xEnd - r)) / r));
      const full = thick * 2.15;
      thick = full * Math.max(0.04, Math.sqrt(1 - e * e));
      // Level with where it is tied down, not sprung up off the body behind.
      under = bodyRadius(piece.x1, 0) + piece.lift * 0.15 + (full - thick) / 2;
    }
    // It drapes round the circle turns lie on there, raised over what is tied on top.
    const centre = piece.base.ringAt(Math.min(x, piece.x1)).centre;
    return { under, thick, centre, pinch, hw: halfWidth(x, pinch) };
  };
  /** A point on its top (or underside) at x, `t` from one edge (-1) to the other (1), in shank-local coordinates. */
  // All round the body (hair folded back round it), as thick underneath as on top.
  const domed = (t: number) => (piece.round ? 1 : 0.55 + 0.45 * Math.cos((t * Math.PI) / 2));
  // Parted round a post: two halves, each half as wide, turned out from the top most at the post
  // and coming together again towards both ends.
  const split = piece.split;
  const halves = split ? [-1, 1] : [0];
  /** How far round from the top a point `t` across (one half's, when parted) lies at x. */
  const phiAt = (x: number, t: number, half: number) => {
    if (!split) return t * piece.halfAngle;
    const gap = split.angle * Math.exp(-(((x - split.x) / split.reach) ** 2) * 2.2);
    return half * (gap + ((t + 1) / 2) * piece.halfAngle * 0.6);
  };
  const surface = (out: THREE.Vector3, x: number, s: ReturnType<typeof section>, t: number, top: boolean, half = 0) => {
    if (flatStrip) {
      // Parted round a post, each half is half the width, turned out to its side most at the post.
      const z = split
        ? half * (split.angle * Math.exp(-(((x - split.x) / split.reach) ** 2) * 2.2) * s.under + ((t + 1) / 2) * s.hw)
        : t * s.hw;
      // Assumption: past the body's sides a cut strip of foam bends down about a third as far as it reaches out.
      const drop = Math.max(0, Math.abs(z) - piece.base.sideAt(Math.min(x, piece.x1))) * 0.3;
      const y = (top ? s.under + s.thick * (0.85 + 0.15 * Math.cos((t * Math.PI) / 2)) : s.under + s.thick * 0.05) - drop;
      return out.set(x, flip * y, z);
    }
    const phi = phiAt(x, t, half);
    const dome = domed(t);
    const r = (top ? s.under + s.thick * dome : s.under + s.thick * 0.05) - flip * s.centre;
    return out.set(x, s.centre + flip * r * Math.cos(phi), r * Math.sin(phi));
  };
  for (const half of halves) {
    for (let i = 0; i <= segX; i++) {
      const x = piece.x0 + ((xEnd - piece.x0) * i) / segX;
      const s = section(x, i === segX);
      for (let side = 0; side < 2; side++) {
        for (let j = 0; j <= segT; j++) {
          // Top surface from one edge to the other, then the underside back again.
          const t = side === 0 ? -1 + (2 * j) / segT : 1 - (2 * j) / segT;
          space.point(surface(v, x, s, t, side === 0, half));
          positions.push(v.x, v.y, v.z);
          const r = (side === 0 ? s.under + s.thick * domed(t) : s.under + s.thick * 0.05) - flip * s.centre;
          const shade = feather ? featherShade(x, phiAt(x, t, half) * r) : hair ? hairShade(x, phiAt(x, t, half) * r) : 1;
          colors.push(shade, shade, shade);
        }
      }
    }
  }
  // A fur strip's fur stands on its hide, leaning back, thick enough to hide it from the side.
  let fur: ReturnType<typeof fibreMesh> | null = null;
  if (piece.fur) {
    const list: Fibre[] = [];
    // The fur between the tie-downs and on the excess past the front one are drawn from random
    // numbers of their own, so trimming the excess leaves the rest of the coat where it was.
    const coat = (a: number, b: number, salt: number) => {
      const rand = mulberry32((piece.seed ?? piece.id) * 5039 + salt);
      const n = Math.round((b - a) * FUR_PER_GAPE);
      for (let k = 0; k < n; k++) {
        const x = a + (b - a) * rand();
        const s = section(x);
        // Under the thread at the tie-downs the fur is bound flat.
        if (s.pinch < 0.35) continue;
        const t = (rand() * 2 - 1) * 0.9;
        // On either half of a strip parted round a post, standing out from it.
        const half = split ? (rand() < 0.5 ? -1 : 1) : 0;
        const base = surface(new THREE.Vector3(), x, s, t, true, half);
        const phi = phiAt(x, t, half);
        const outward = new THREE.Vector3(0, flip * Math.cos(phi), Math.sin(phi));
        list.push(furFibre(rand, (x - piece.x0) / (xEnd - piece.x0), base, BACK, outward, piece.fur!));
      }
    };
    coat(piece.x0, piece.x1, 11);
    if (xEnd > piece.x1) coat(piece.x1, xEnd, 13);
    fur = fibreMesh(placeFibres(list, space), surfaces.get("strip", piece.color, true), 0.3, 0.7);
  }
  // Row by row, both halves of a parted strip, so it is drawn on from the back as one.
  for (let i = 0; i < segX; i++) {
    for (let h = 0; h < halves.length; h++) {
      const o = h * (segX + 1) * ring;
      for (let j = 0; j < ring; j++) {
        const a = o + i * ring + j;
        const a1 = o + i * ring + ((j + 1) % ring);
        const b = a + ring;
        const b1 = a1 + ring;
        index.push(a, a1, b, b, a1, b1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  if (shaded) geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  // A CDC bubble is matte down, not a smooth slip.
  const look = piece.look === "foam" ? "foam" : feather ? "feather" : piece.look === "cdc" || piece.look === "marabou" ? "cdc" : "fibres";
  const material = surfaces.get(look, piece.color, shaded).clone();
  material.side = THREE.DoubleSide;
  if (piece.veil) {
    // Sparse sparkle yarn: the body shows through, the fibres glint.
    material.transparent = true;
    material.opacity = 0.45;
    material.depthWrite = false;
    if ("roughness" in material) (material as THREE.MeshStandardMaterial).roughness = 0.35;
  }
  const mesh = new THREE.Mesh(geometry, material);
  const object = fur ? new THREE.Group().add(mesh, fur.object) : mesh;
  return {
    object,
    setProgress(u) {
      object.visible = u > 0;
      geometry.setDrawRange(0, Math.ceil(u * segX) * ring * 6 * halves.length);
      fur?.setProgress(u);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      fur?.dispose();
    },
  };
}

// Assumption: rabbit fur is dense: about 700 hairs drawn per gape of strip.
const FUR_PER_GAPE = 700;

/**
 * One hair of a fur strip at progress `u`: from `base` on the hide, leaning towards `back` (the
 * strip's end) and up off the hide along `outward`, curving a little as fur does.
 */
function furFibre(rand: () => number, u: number, base: THREE.Vector3, back: THREE.Vector3, outward: THREE.Vector3, fur: number): Fibre {
  // Assumption: rabbit fur lies back at 15–55° off the hide (photos of Zonkers).
  const lean = (15 + 40 * rand()) * (Math.PI / 180);
  const dir = back
    .clone()
    .multiplyScalar(Math.cos(lean))
    .addScaledVector(outward, Math.sin(lean))
    .add(new THREE.Vector3(0, (rand() - 0.5) * 0.25, (rand() - 0.5) * 0.25))
    .normalize();
  const bend = 0.08 + 0.22 * rand();
  return {
    u, base, dir, length: fur * (0.55 + 0.55 * rand()), radius: 0.0042, shade: 0.6 + 0.5 * rand(),
    bend, bendDir: perpendicular(dir, outward.clone().negate(), rand),
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
    case "sleeve":
      return sleeveView(piece, surfaces, space);
  }
}

// Assumption: medium Mylar tubing's braid crosses about every 0.12 gape along a #4, in 16
// strands each way round.
const BRAID = { pitch: 0.12, strands: 16 };

/**
 * Braided tubing over the body: a tube stretched over what is under it, in a diamond weave of
 * metallic strands, its open end a little loose, its frayed rear end a tuft of loose strands.
 */
function sleeveView(piece: SleevePiece, surfaces: Surfaces, space: ShankSpace): PieceView {
  const segX = Math.max(60, Math.round((piece.x1 - piece.x0) * 120));
  const segR = 96;
  const positions: number[] = [];
  const colors: number[] = [];
  const index: number[] = [];
  const v = new THREE.Vector3();
  const smooth = THREE.MathUtils.smoothstep;
  const len = piece.x1 - piece.x0;
  // Drawn from the eye back, as it is slid on.
  for (let i = 0; i <= segX; i++) {
    const x = piece.x1 - (len * i) / segX;
    const ring = piece.base.ringAt(x);
    // A loose end stands off what is under it until it is tied down.
    const fromOpen = piece.open === "front" ? piece.x1 - x : piece.open === "rear" ? x - piece.x0 : Infinity;
    const loose = 0.035 * (1 - smooth(fromOpen, 0, 0.2));
    for (let j = 0; j <= segR; j++) {
      const a = (j / segR) * 2 * Math.PI;
      const u1 = x / BRAID.pitch + (BRAID.strands * a) / (2 * Math.PI);
      const u2 = x / BRAID.pitch - (BRAID.strands * a) / (2 * Math.PI);
      // The grooves between the strands of the two crossing helices.
      const g = Math.min(Math.abs(Math.sin(Math.PI * u1)), Math.abs(Math.sin(Math.PI * u2)));
      const ridge = smooth(g, 0, 0.4);
      const r = ring.radius + piece.thickness * (0.5 + 0.5 * ridge) + loose;
      space.point(v.set(x, ring.centre + r * Math.cos(a), r * Math.sin(a)));
      positions.push(v.x, v.y, v.z);
      const shade = 0.5 + 0.5 * ridge;
      colors.push(shade, shade, shade);
    }
  }
  for (let i = 0; i < segX; i++) {
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
  const material = surfaces.get("tubing", piece.color, true);
  const mesh = new THREE.Mesh(geometry, material);
  const object = new THREE.Group().add(mesh);
  let fray: ReturnType<typeof fibreMesh> | null = null;
  if (piece.fray) {
    const rand = mulberry32((piece.seed ?? piece.id) * 6131 + 7);
    const ring = piece.base.ringAt(piece.x0);
    const list: Fibre[] = [];
    for (let k = 0; k < 80; k++) {
      const a = rand() * 2 * Math.PI;
      const outward = new THREE.Vector3(0, Math.cos(a), Math.sin(a));
      const r = ring.radius + piece.thickness;
      const base = new THREE.Vector3(piece.x0 + 0.01, ring.centre + r * Math.cos(a), r * Math.sin(a));
      const dir = BACK.clone().addScaledVector(outward, 0.15 + 0.35 * rand()).add(new THREE.Vector3(0, (rand() - 0.5) * 0.2, (rand() - 0.5) * 0.2)).normalize();
      const bend = 0.05 + 0.15 * rand();
      list.push({ u: 0.95, base, dir, length: piece.fray * (0.55 + 0.5 * rand()), radius: 0.005, shade: 0.8 + 0.3 * rand(), bend, bendDir: perpendicular(dir, outward, rand) });
    }
    fray = fibreMesh(placeFibres(list, space), material, 0.9, 1);
    object.add(fray.object);
  }
  return {
    object,
    setProgress(u) {
      object.visible = u > 0;
      geometry.setDrawRange(0, Math.ceil(u * segX) * segR * 6);
      fray?.setProgress(u);
    },
    dispose() {
      geometry.dispose();
      fray?.dispose();
    },
  };
}

/**
 * An extended body: a solid rope sticking out from the tie-in, drooping a little, rounded
 * off at the end, with a differently coloured tip if it has one and chenille's pile on it.
 */
function extensionView(piece: ExtensionPiece, surfaces: Surfaces, space: ShankSpace): PieceView {
  const flip = piece.side === "under" ? -1 : 1;
  const n = piece.segments ?? 0;
  const segL = n ? Math.max(48, n * 24) : 48;
  const segR = 16;
  const L = piece.length;
  const R = piece.thickness;
  // Centre line in shank-local coordinates: back (and up by angle) from the tie-in, sagging slightly.
  const towards = piece.forward ? 1 : -1;
  const flat = piece.width !== undefined;
  const centre = (t: number) => {
    const c = extensionCentre(piece, t);
    return new THREE.Vector3(c.x, c.y, 0);
  };
  // A body made on a needle: round segments, each waist pinched by a few turns of thread.
  // Assumption: the waists are pinched to about half the segments' thickness (photos of the Mohican).
  const segment = (t: number) => {
    if (!n) return { r: 1, band: false };
    const s = (t * n) % 1;
    const waist = Math.min(s, 1 - s);
    return { r: 0.5 + 0.5 * Math.sin((Math.PI / 2) * Math.min(1, waist / 0.42)) ** 0.7, band: t > 0.02 && t < 0.98 && waist < 0.05 };
  };
  // Full thickness (tapering to the end if it does), rounding off over the last part; the very
  // start tucks under the wraps.
  const radiusAt = (t: number) => {
    const end = n ? 1 - 0.5 / n : 0.85;
    const rounded = t < end ? 1 : Math.sqrt(Math.max(0, 1 - ((t - end) / (1 - end)) ** 2)) * 0.9 + 0.1;
    return R * (1 - (1 - (piece.taper ?? 1)) * t) * Math.min(1, 0.6 + t * 8) * (n ? (t < end ? segment(t).r : 1) : 1) * rounded;
  };
  const bands = piece.bands ? new THREE.Color(piece.bands) : null;
  // Assumption: a strip's end is cut to a point over its last fifth.
  const halfWidth = (t: number) => (piece.width ?? 0) / 2 * Math.max(0.12, Math.min(1, (1 - t) / 0.2));
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
    const color = bands && segment(t).band ? bands : body.clone().lerp(tip, mix);
    for (let j = 0; j <= segR; j++) {
      const a = (j / segR) * Math.PI * 2;
      // Flat: as thick as it is up and down, as wide as the strip across.
      v.copy(c).addScaledVector(binormal, (flat ? R : r) * Math.cos(a)).addScaledVector(normal, (flat ? halfWidth(t) : r) * Math.sin(a));
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
  if (piece.fur) {
    // The fur on a strip's top face, leaning back towards its end; hairs at the edges fall to the
    // sides and below, so from the side the tail is a plume.
    const rand = mulberry32((piece.seed ?? piece.id) * 4127 + 3);
    const list: Fibre[] = [];
    // Clipped but for a tuft at its end: fur only on that last part of the strip.
    const from = piece.tuft !== undefined ? Math.max(0.02, 1 - piece.tuft / Math.max(0.05, L)) : 0.02;
    const n = Math.round(L * (piece.tuft !== undefined ? (0.98 - from) / 0.96 : 1) * FUR_PER_GAPE);
    for (let k = 0; k < n; k++) {
      const t = from + (0.98 - from) * rand();
      const c = centre(t);
      const ahead = centre(Math.min(1, t + 0.01)).sub(centre(Math.max(0, t - 0.01))).normalize();
      const up = Y_AXIS.clone().addScaledVector(ahead, -ahead.y).normalize();
      const s = rand() * 2 - 1;
      const phi = s * (Math.PI / 180) * 110;
      const outward = up.clone().multiplyScalar(Math.cos(phi) * flip).add(new THREE.Vector3(0, 0, Math.sin(phi)));
      const base = c.clone().addScaledVector(up, R * flip).add(new THREE.Vector3(0, 0, s * halfWidth(t)));
      // Shorter towards the end, so the tail tapers to a point.
      list.push(furFibre(rand, t, base, ahead, outward, piece.fur * (1 - 0.5 * t)));
    }
    fuzz = fibreMesh(placeFibres(list, space), surfaces.get("strip", piece.color, true), 0.3, 0.7);
    group.add(fuzz.object);
  } else if (piece.fuzz) {
    const rand = mulberry32((piece.seed ?? piece.id) * 4111 + 9);
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
  const rand = mulberry32((piece.seed ?? piece.id) * 7177 + 5);
  for (let i = 0; i < piece.count; i++) {
    // Strands a little apart along the shank, as when they are wrapped on one by one.
    const x = piece.x + (i - (piece.count - 1) / 2) * 0.09;
    // Fanned: the rear strand leans back most, the front one forward.
    const sweep = piece.sweep + (piece.fan && piece.count > 1 ? piece.fan * (0.5 - i / (piece.count - 1)) : 0);
    for (const side of [-1, 1]) {
      const dir = new THREE.Vector3(-Math.sin(sweep), -0.2, side * Math.cos(sweep)).normalize();
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
