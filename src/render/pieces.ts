import * as THREE from "three";
import { wrapAt, type BundlePiece, type FeatherPiece, type Piece, type WrapsPiece } from "../tying/simulate";
import type { Surfaces } from "./materials";
import { mulberry32 } from "./random";

/** A piece of the fly that can be drawn partially, from 0 (not there yet) to 1 (complete). */
export interface PieceView {
  object: THREE.Object3D;
  setProgress(u: number): void;
  dispose(): void;
}

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);

/** Point on the shank surface at angle a (0 = near side, increasing over the top). */
export function aroundShank(x: number, radius: number, angle: number, target = new THREE.Vector3()) {
  return target.set(x, radius * Math.sin(angle), radius * Math.cos(angle));
}

class WrapsCurve extends THREE.Curve<THREE.Vector3> {
  constructor(private piece: WrapsPiece) {
    super();
  }
  override getPoint(u: number, target = new THREE.Vector3()) {
    const w = wrapAt(this.piece, u);
    return aroundShank(w.x, w.radius, w.angle, target);
  }
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
  const mesh = new THREE.InstancedMesh(fibreGeometry(tipRatio, tipShade), material, fibres.length);
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
} as const;

function woundFibres(piece: WrapsPiece, rand: () => number): Fibre[] {
  const look = piece.look as keyof typeof WOUND_FIBRES;
  const spec = WOUND_FIBRES[look];
  const list: Fibre[] = [];
  const n = Math.round(piece.turns * spec.perTurn);
  for (let i = 0; i < n; i++) {
    const u = (i + rand()) / n;
    const w = wrapAt(piece, u);
    let spin: number, sweep: number, length: number, shade: number;
    if (look === "hackle") {
      // Barbs stand almost straight out with a slight rearward sweep.
      spin = w.angle + (rand() - 0.5) * 0.5;
      sweep = 0.12 + (rand() - 0.5) * 0.25;
      length = piece.fibreLength! * (0.8 + 0.25 * rand());
      shade = 0.85 + 0.3 * rand();
    } else if (look === "herl") {
      // Flue sticks out every which way, filling the gaps between turns.
      spin = w.angle + (rand() - 0.5) * 2.4;
      sweep = (rand() - 0.5) * 1.8;
      length = piece.fibreLength! * (0.5 + 0.6 * rand());
      shade = 1;
    } else {
      // Dubbing: short, scruffy, mottled fibres; a few long guard hairs.
      spin = w.angle + (rand() - 0.5) * 3;
      sweep = (rand() - 0.5) * 2.2;
      const guard = rand() < 0.08;
      length = piece.fibreLength! * (guard ? 1.6 + rand() : 0.4 + 0.7 * rand());
      shade = guard ? 0.45 : 0.7 + 0.6 * rand();
    }
    const base = aroundShank(w.x, w.radius * (look === "dubbing" ? 0.9 : 1), w.angle);
    const radial = new THREE.Vector3(0, Math.sin(spin), Math.cos(spin));
    const dir = radial.multiplyScalar(Math.cos(sweep)).addScaledVector(X_AXIS, -Math.sin(sweep)).normalize();
    list.push({ u, base, dir, length, radius: spec.radius, shade });
  }
  return list;
}

function wrapsView(piece: WrapsPiece, surfaces: Surfaces): PieceView {
  const group = new THREE.Group();
  const segmentsPerTurn = piece.look === "thread" ? 20 : 28;
  const tubular = Math.max(8, Math.min(4000, Math.round(piece.turns * segmentsPerTurn)));
  const radial = piece.look === "thread" ? 5 : 8;
  const tubeLook = piece.look === "hackle" ? "stem" : piece.look;
  // The dubbing core sits inside its fuzz.
  const tubeRadius = piece.strandRadius * (piece.look === "dubbing" ? 0.9 : 1);
  const tube = new THREE.TubeGeometry(new WrapsCurve(piece), tubular, tubeRadius, radial, false);
  group.add(new THREE.Mesh(tube, surfaces.get(tubeLook, piece.color)));

  let fibres: ReturnType<typeof fibreMesh> | null = null;
  if (piece.fibreLength && piece.look in WOUND_FIBRES) {
    const spec = WOUND_FIBRES[piece.look as keyof typeof WOUND_FIBRES];
    const color = piece.look === "herl" ? "#26341a" : piece.color;
    fibres = fibreMesh(woundFibres(piece, mulberry32(piece.id * 7919 + 1)), surfaces.get(piece.look, color, true), spec.tip);
    group.add(fibres.mesh);
  }

  return {
    object: group,
    setProgress(u) {
      group.visible = u > 0;
      tube.setDrawRange(0, Math.floor(u * tubular) * radial * 6);
      fibres?.setProgress(u);
    },
    dispose() {
      tube.dispose();
      fibres?.mesh.geometry.dispose();
    },
  };
}

/**
 * Per-look settings for bundles: fibre width, taper, tip shade, random spread, and how
 * strongly fibres splay outwards (more at the sides of the bunch than on top).
 */
const BUNDLE = {
  yarn: { radius: 0.011, tip: 0.7, tipShade: 1, spread: 0.3, flare: 0.1, sideFlare: 0.3, lengthJitter: 0.25 },
  fibres: { radius: 0.005, tip: 0.3, tipShade: 0.8, spread: 0.18, flare: 0, sideFlare: 0.2, lengthJitter: 0.1 },
  hair: { radius: 0.0095, tip: 0.35, tipShade: 0.5, spread: 0.08, flare: 0.08, sideFlare: 0.55, lengthJitter: 0.08 },
} as const;

function bundleView(piece: BundlePiece, surfaces: Surfaces): PieceView {
  const spec = BUNDLE[piece.look as keyof typeof BUNDLE] ?? BUNDLE.yarn;
  const rand = mulberry32(piece.id * 104729 + 3);
  const forward = piece.direction === "forward";
  const cut = forward && piece.length < 0.5;
  const along = new THREE.Vector3(forward ? 1 : -1, 0, 0)
    .multiplyScalar(Math.cos(piece.angle))
    .addScaledVector(Y_AXIS, Math.sin(piece.angle));
  const list: Fibre[] = [];
  for (let i = 0; i < piece.count; i++) {
    // Spread the bases over the top of the body, up to `spread` either side of the top.
    const theta = (rand() * 2 - 1) * piece.spread;
    const r = piece.radius + piece.bundleRadius * (0.3 + 0.5 * rand());
    const base = new THREE.Vector3(piece.x + rand() * 0.04, r * Math.cos(theta), r * Math.sin(theta));
    const outward = new THREE.Vector3(0, Math.cos(theta), Math.sin(theta));
    const splay = 0.6 + 0.6 * rand();
    // Fibres splay away from the body a little, and fibres at the sides of the bunch
    // splay sideways (not upwards) as well.
    const dir = along
      .clone()
      .addScaledVector(outward, spec.flare * splay)
      .add(new THREE.Vector3(0, 0, spec.sideFlare * Math.sin(theta) * splay))
      .add(new THREE.Vector3(0, (rand() - 0.5) * spec.spread, (rand() - 0.5) * spec.spread))
      .normalize();
    // Trimmed butts are cut square, so all the same length.
    const jitter = cut ? 0 : spec.lengthJitter;
    list.push({
      u: rand(), base, dir, length: piece.length * (1 - jitter / 2 + jitter * rand()),
      radius: spec.radius, shade: 0.85 + 0.3 * rand(),
    });
  }
  // Hair butts are the pale base of the hair; tips darken towards the end.
  const tipShade = forward ? 1 : spec.tipShade;
  const fibres = fibreMesh(list, surfaces.get(piece.look, piece.color, true), cut ? 0.9 : spec.tip, tipShade);
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

/**
 * A whole feather tied as a sedge wing: folded like a roof over the body, so the side
 * view shows the feather's outline. Fine dark barring is baked into vertex colours.
 */
function featherView(piece: FeatherPiece, surfaces: Surfaces): PieceView {
  const L = piece.length;
  const width = piece.width;
  // How far the roof wraps around the body on each side of the spine.
  const fold = 1.6;
  const segS = 32;
  const segT = 16;
  const positions: number[] = [];
  const colors: number[] = [];
  const index: number[] = [];
  for (let i = 0; i <= segS; i++) {
    const s = i / segS;
    // Narrow at the tied-in base, widest past the middle, rounded at the tip.
    const half =
      (width / 2) *
      Math.pow(Math.sin(Math.PI * Math.min(1, 0.08 + s * 0.92)), 0.7) *
      (0.35 + 0.65 * Math.min(1, s * 3));
    const r = Math.max(half / fold, 1e-4);
    for (let j = 0; j <= segT; j++) {
      const t = (j / segT) * 2 - 1;
      const phi = t * fold;
      // Local -Y points up once rotated: the spine is the top, the sides hang down.
      positions.push(s * L, r - r * Math.cos(phi), r * Math.sin(phi));
      const bar = 0.62 + 0.38 * Math.sin(2 * Math.PI * (s * 14 + Math.abs(t) * 2.2));
      const shade = bar * (0.8 + 0.2 * s);
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

  const group = new THREE.Group();
  group.add(new THREE.Mesh(geometry, surfaces.get("feather", piece.color, true)));
  group.position.set(piece.x, piece.radius, 0);
  // Local +X runs back along the body, `angle` above the shank.
  group.rotation.z = Math.PI - piece.angle;
  return {
    object: group,
    setProgress(u) {
      group.visible = u > 0;
      group.scale.set(Math.max(u, 0.01), 1, 1);
    },
    dispose() {
      geometry.dispose();
    },
  };
}

export function pieceView(piece: Piece, surfaces: Surfaces): PieceView {
  switch (piece.type) {
    case "wraps":
      return wrapsView(piece, surfaces);
    case "bundle":
      return bundleView(piece, surfaces);
    case "feather":
      return featherView(piece, surfaces);
  }
}
