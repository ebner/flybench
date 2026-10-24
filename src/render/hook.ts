import * as THREE from "three";
import type { HookModel } from "../tying/hook";
import { bendPath, eyeBase, shankPath } from "../tying/shank";

/** How far each bend of a double or treble is turned round the shank, in degrees. */
const BEND_ANGLES: Record<1 | 2 | 3, number[]> = {
  1: [0],
  // Assumption: the bends of a double splay about 30° either side of straight down.
  2: [-30, 30],
  // A treble's three bends are spaced evenly; one hangs straight down.
  3: [0, 120, -120],
};

export function buildHook(hook: HookModel): THREE.Group {
  const group = new THREE.Group();
  const w = hook.wireRadius;
  const metal = new THREE.MeshStandardMaterial({ color: 0x3a2e22, metalness: 0.85, roughness: 0.32 });
  const tube = (points: THREE.Vector3[], segments: number) =>
    new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, false, "centripetal"), segments, w, 12, false), metal);

  // The shank, with the jig hook's bent eye section in front of it. A double's shank is two
  // wires side by side.
  const eye = eyeBase(hook);
  const shank = shankPath(hook).map((p) => new THREE.Vector3(p.x, p.y, 0));
  if (hook.jig) shank.unshift(new THREE.Vector3(eye.p.x, eye.p.y, 0));
  shank.push(new THREE.Vector3(0, 0, 0));
  const count = hook.points ?? 1;
  const wires = count === 2 ? [-0.9 * w, 0.9 * w] : [0];
  for (const z of wires) group.add(tube(shank.map((p) => p.clone().setZ(z)), 160));

  // Each bend and point, turned round the shank's axis at the start of the bend.
  const bend = bendPath(hook);
  BEND_ANGLES[count].forEach((deg, i) => {
    const a = (deg * Math.PI) / 180;
    const z0 = wires[Math.min(i, wires.length - 1)]!;
    const points = [new THREE.Vector3(0, 0, z0), ...bend.map((p) => new THREE.Vector3(p.x, p.y * Math.cos(a), z0 + p.y * Math.sin(a)))];
    group.add(tube(points, 200));
    const tip = points[points.length - 1]!;
    const dir = tip.clone().sub(points[points.length - 2]!).normalize();
    const point = new THREE.Mesh(new THREE.ConeGeometry(w, 0.22, 12), metal);
    point.position.copy(tip).addScaledVector(dir, 0.11);
    point.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    group.add(point);
  });

  // The eye: a ring off the end of the shank (or the jig section), turned down or up by eyeAngle.
  const ringRadius = hook.eyeRadius - w;
  const a = Math.atan2(eye.t.y, eye.t.x) - (hook.eyeAngle * Math.PI) / 180;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(ringRadius, w, 10, 40), metal);
  ring.position.set(eye.p.x + ringRadius * Math.cos(a), eye.p.y + ringRadius * Math.sin(a), 0);
  group.add(ring);

  return group;
}
