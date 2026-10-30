import * as THREE from "three";
import type { Look } from "../../tying/simulate";

/**
 * A fished fly in the realistic water: wet all over from being cast and drawn through the water,
 * soaked where it is under it. Wet material is darker, more saturated and glossy; fibres cling
 * together in small clumps; under water, fur and CDC hold a film of air that shines silver.
 */

/** How wet a piece is: damp (a floating fly's parts above the film) or soaked (under it). */
export type Wetness = "damp" | "soaked";

/** Fibres that cling together when wet (rubber legs, springy, keep their spread). */
const CLINGS = new Set<Look>(["hackle", "fibres", "hair", "marabou", "cdc", "herl", "flash", "biot"]);
/** Fur, CDC and herl trap air under water (marabou and chenille soak through at once). */
const HOLDS_AIR = new Set<Look>(["dubbing", "cdc", "herl"]);

// Assumption: wet fibres and fur look about a fifth darker (soaked, a third), a little more
// saturated, and glossy; a floating fly treated with floatant still clumps a little.
const LOOK: Record<Wetness, { darken: number; saturate: number; roughness: number; clearcoat: number; clump: number }> = {
  damp: { darken: 0.8, saturate: 1.1, roughness: 0.6, clearcoat: 0.2, clump: 0.3 },
  soaked: { darken: 0.62, saturate: 1.2, roughness: 0.4, clearcoat: 0.5, clump: 0.7 },
};

function wetMaterial(s: THREE.MeshStandardMaterial, wet: Wetness, look: Look): THREE.MeshPhysicalMaterial {
  const p = new THREE.MeshPhysicalMaterial();
  if (s instanceof THREE.MeshPhysicalMaterial) {
    // Keeping what makes it physical: herl's and flash's iridescence shows best wet.
    p.copy(s);
  } else {
    THREE.MeshStandardMaterial.prototype.copy.call(p, s);
    // The standard copy leaves only the standard shader's defines.
    p.defines = { STANDARD: "", PHYSICAL: "" };
  }
  const w = LOOK[wet];
  if (s.metalness < 0.5) {
    const hsl = { h: 0, s: 0, l: 0 };
    p.color.getHSL(hsl);
    p.color.setHSL(hsl.h, Math.min(1, hsl.s * w.saturate), hsl.l * w.darken);
    p.roughness = Math.min(s.roughness, w.roughness);
  }
  p.clearcoat = w.clearcoat;
  p.clearcoatRoughness = 0.3;
  if (wet === "soaked" && HOLDS_AIR.has(look)) {
    // Assumption: the trapped air shows as a faint silvery sheen at grazing angles.
    p.sheen = 0.45;
    p.sheenRoughness = 0.3;
    p.sheenColor = new THREE.Color(0.85, 0.88, 0.9);
  }
  return p;
}

/**
 * Turns each fibre a little towards its neighbours', in clumps of four, about its root. A fibre
 * is one instance of each mesh in `pieces` (a straight fibre one mesh; a curved one its segments,
 * root first, sharing the index), so its pieces turn together and stay joined. Returns the undo.
 */
function clump(pieces: THREE.InstancedMesh[], strength: number): () => void {
  const befores = pieces.map((p) => Float32Array.from(p.instanceMatrix.array));
  const count = Math.min(...pieces.map((p) => p.count));
  const m = new THREE.Matrix4();
  const first = pieces[0]!;
  const last = pieces.at(-1)!;
  const roots: THREE.Vector3[] = [];
  const axes: THREE.Vector3[] = [];
  for (let i = 0; i < count; i++) {
    const root = new THREE.Vector3().setFromMatrixPosition(first.getMatrixAt(i, m));
    // The tip: the last piece's base plus its length along its own axis.
    last.getMatrixAt(i, m);
    const tip = new THREE.Vector3().setFromMatrixPosition(m).add(new THREE.Vector3().setFromMatrixColumn(m, 1));
    roots.push(root);
    axes.push(tip.sub(root).normalize());
  }
  const q = new THREE.Quaternion();
  const turn = new THREE.Matrix4();
  for (let start = 0; start < count; start += 4) {
    const group = axes.slice(start, start + 4);
    const mean = group.reduce((a, v) => a.clone().add(v), new THREE.Vector3()).normalize();
    group.forEach((axis, k) => {
      const i = start + k;
      // Only neighbours that lie alike cling: not fibres on opposite sides of the body.
      if (axis.dot(mean) < 0.5) return;
      const r = roots[i]!;
      q.setFromUnitVectors(axis, axis.clone().lerp(mean, strength).normalize());
      turn.makeTranslation(r.x, r.y, r.z).multiply(new THREE.Matrix4().makeRotationFromQuaternion(q)).multiply(new THREE.Matrix4().makeTranslation(-r.x, -r.y, -r.z));
      for (const p of pieces) p.setMatrixAt(i, p.getMatrixAt(i, m).premultiply(turn));
    });
  }
  for (const p of pieces) p.instanceMatrix.needsUpdate = true;
  return () =>
    pieces.forEach((p, k) => {
      p.instanceMatrix.array.set(befores[k]!);
      p.instanceMatrix.needsUpdate = true;
    });
}

/** A piece's fibres, each as its meshes: straight ones alone, a curved one's segments in order. */
function fibreSets(object: THREE.Object3D): THREE.InstancedMesh[][] {
  const sets: THREE.InstancedMesh[][] = [];
  const curved = new Map<THREE.Object3D, THREE.InstancedMesh[]>();
  object.traverse((o) => {
    if (!(o instanceof THREE.InstancedMesh)) return;
    const segment = o.userData.segment as number | undefined;
    if (segment === undefined) sets.push([o]);
    else {
      const list = curved.get(o.parent!) ?? [];
      list[segment] = o;
      curved.set(o.parent!, list);
    }
  });
  for (const list of curved.values()) sets.push(list.filter(Boolean));
  return sets;
}

/** Wets the pieces of a fly (each with its look and how wet). Returns what puts them back. */
export function wetFly(pieces: { object: THREE.Object3D; look: Look; wet: Wetness }[]): () => void {
  const undo: (() => void)[] = [];
  const made = new Map<string, THREE.MeshPhysicalMaterial>();
  const ids = new Map<THREE.Material, number>();
  for (const { object, look, wet } of pieces) {
    object.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || Array.isArray(o.material)) return;
      const s = o.material;
      if (!(s instanceof THREE.MeshStandardMaterial)) return;
      if (!ids.has(s)) ids.set(s, ids.size);
      const key = `${ids.get(s)}:${wet}:${look}`;
      let p = made.get(key);
      if (!p) made.set(key, (p = wetMaterial(s, wet, look)));
      o.material = p;
      undo.push(() => (o.material = s));
    });
    if (CLINGS.has(look)) for (const set of fibreSets(object)) if (set.length) undo.push(clump(set, LOOK[wet].clump));
  }
  return () => {
    for (const u of undo.reverse()) u();
    for (const m of made.values()) m.dispose();
  };
}
