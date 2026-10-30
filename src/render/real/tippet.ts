import * as THREE from "three";
import type { Dimple } from "./waves";

/**
 * The tippet a fly is fished on, for the realistic water: tied to the eye with an improved
 * clinch knot (the line through the eye, five turns of the tag round the standing part, the tag
 * trimmed short), then lying in the surface film from a floating fly, or rising to it from a
 * sunk one. Lengths in gapes.
 */

// Assumption: 5X tippet (0.15 mm) on a #12 is about 0.03 gape across; heavier flies are fished on
// heavier tippet, about as thick against their bigger gape.
export const TIPPET_RADIUS = 0.016;
// Assumption: a tightened improved clinch's five turns make a barrel about 0.3 gape long (1.5 mm).
const TURNS = 5;
const BARREL = 0.3;

const nylon = () =>
  // Clear nylon: mostly seen by its glints and the light it bends.
  new THREE.MeshPhysicalMaterial({ color: "#9aa49a", roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.1, transparent: true, opacity: 0.45 });

const tube = (points: THREE.Vector3[], radius: number, material: THREE.Material, segments = points.length * 6) =>
  new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, false, "centripetal"), segments, radius, 6, false), material);

export interface Knot {
  object: THREE.Group;
  /** Where the standing line leaves the knot, and its way (world). */
  start: THREE.Vector3;
  direction: THREE.Vector3;
}

/**
 * An improved clinch knot at a hook's eye (the mesh named "eye", in world space): the line
 * round the front of the eye ring, the barrel of turns along the line ahead of it, the tag's
 * trimmed end beside the eye.
 */
export function clinchKnot(eye: THREE.Object3D, r = TIPPET_RADIUS): Knot {
  eye.updateWorldMatrix(true, false);
  const { ringRadius, wire, outward } = eye.userData as { ringRadius: number; wire: number; outward: THREE.Vector3 };
  const centre = new THREE.Vector3().setFromMatrixPosition(eye.matrixWorld);
  const d = outward.clone().transformDirection(eye.parent!.matrixWorld).normalize();
  const n = new THREE.Vector3(0, 0, 1).transformDirection(eye.matrixWorld).normalize();
  const u = new THREE.Vector3().crossVectors(d, n).normalize();
  // The front of the ring, where the line goes round it.
  const front = centre.clone().addScaledVector(d, ringRadius);
  const at = (s: number, side = 0, up = 0) => front.clone().addScaledVector(d, s).addScaledVector(n, side).addScaledVector(u, up);
  const material = nylon();
  const group = new THREE.Group();
  // Round the ring: in on one side of it, through the eye behind the wire, out on the other.
  const round = wire + r;
  group.add(tube([at(0.1, -1.4 * r), at(0.02, -round), at(-round, 0), at(0.02, round), at(0.1, 1.4 * r)], r, material, 40));
  // The standing part through the middle of the barrel.
  const start = at(0.12 + BARREL + 0.1);
  group.add(tube([at(0.08), at(0.12 + BARREL / 2), start], r, material, 20));
  // The tag's turns round it, snug.
  const coil: THREE.Vector3[] = [];
  const radius = 2.1 * r;
  for (let i = 0; i <= TURNS * 16; i++) {
    const f = i / (TURNS * 16);
    const a = f * TURNS * 2 * Math.PI;
    coil.push(at(0.12 + f * BARREL, radius * Math.sin(a), radius * Math.cos(a)));
  }
  group.add(tube(coil, r, material, TURNS * 40));
  // The tag back through the loop by the eye, trimmed short, standing off at an angle.
  const tag = at(0.1, 0, radius);
  group.add(tube([tag, tag.clone().addScaledVector(u, 0.08).addScaledVector(d, -0.05), tag.clone().addScaledVector(u, 0.16).addScaledVector(d, -0.12)], r, material, 12));
  return { object: group, start, direction: d };
}

/**
 * The tippet from the knot: down to the surface and along it, in the film, from a floating fly;
 * up to the surface from a sunk one, and along it beyond. `level` is the surface; world space.
 */
export function tippetPath(
  start: THREE.Vector3,
  direction: THREE.Vector3,
  level: number,
  floating: boolean,
  /** The surface's height above its level at (x, z), now: the tippet lies on its ripples. */
  height: (x: number, z: number) => number = () => 0,
): THREE.Vector3[] {
  const ahead = new THREE.Vector3(direction.x, 0, direction.z);
  if (ahead.lengthSq() < 1e-6) ahead.set(1, 0, 0);
  ahead.normalize();
  const across = new THREE.Vector3(-ahead.z, 0, ahead.x);
  // In the film: a little under the surface, held by its meniscus, riding the ripples.
  const below = level - TIPPET_RADIUS * 0.6;
  const onFilm = (p: THREE.Vector3) => p.setY(below + height(p.x, p.z));
  // Assumption: from a sunk fly the tippet rises to the surface at about 25 degrees.
  const rise = floating ? 1.2 : Math.max(1.2, (level - start.y) / Math.tan(THREE.MathUtils.degToRad(25)));
  const meet = onFilm(start.clone().addScaledVector(ahead, rise));
  // From the knot to the film: a curve leaving the knot along the line and meeting the film
  // level with it, which never crosses the film on the way (its middle point lies at the film).
  const leave = start.clone().addScaledVector(direction, 0.3);
  const bend = meet.clone().addScaledVector(ahead, -0.45 * rise);
  bend.y = meet.y;
  const points: THREE.Vector3[] = [start.clone()];
  for (let i = 1; i <= 10; i++) {
    const t = i / 10;
    const a = leave.clone().lerp(bend, t);
    const b = bend.clone().lerp(meet, t);
    points.push(a.lerp(b, t));
  }
  // Then along the surface in a gentle curve, as a tippet lies when the fly drifts.
  points.push(onFilm(meet.clone().addScaledVector(ahead, 0.4)), onFilm(meet.clone().addScaledVector(ahead, 1.2)));
  // Close together near the fly, so the line follows the ripples; further apart far out.
  for (let s = 2; s <= 90; s += s < 20 ? 0.6 : s * 0.3) {
    points.push(onFilm(meet.clone().addScaledVector(ahead, s).addScaledVector(across, 0.6 * Math.sin(s / 9))));
  }
  return points;
}

/** The tippet as a mesh along its path. */
export function tippetMesh(path: THREE.Vector3[], r = TIPPET_RADIUS): THREE.Mesh {
  return new THREE.Mesh(tippetGeometry(path, r), nylon());
}

/** The tippet's tube along a path (for redrawing it as the fly moves). */
export function tippetGeometry(path: THREE.Vector3[], r = TIPPET_RADIUS): THREE.TubeGeometry {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(path, false, "centripetal"), 600, r, 6, false);
}

/** The tippet's meniscus: a row of shallow dents along it where it lies in the film near the fly. */
export function tippetDimples(path: THREE.Vector3[], level: number, count: number): Dimple[] {
  const curve = new THREE.CatmullRomCurve3(path, false, "centripetal");
  const dimples: Dimple[] = [];
  const length = curve.getLength();
  for (let i = 0; i <= 400 && dimples.length < count; i++) {
    const p = curve.getPointAt(Math.min(1, (i * 0.3) / length));
    if (Math.abs(p.y - level) > 0.05) continue;
    // Assumption: a thin line's meniscus is a shallow trough about a third of a gape wide.
    dimples.push({ x: p.x, z: p.z, r: 0.16, d: 0.012 });
  }
  return dimples;
}
