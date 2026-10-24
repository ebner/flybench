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

/** The short treble that goes behind a tube or Waddington, drawn at its own scale. */
const TREBLE: HookModel = {
  label: "Treble", shankLength: 0.9, shankCurve: 0, wireRadius: 0.05, eyeRadius: 0.17, eyeAngle: 0,
  pointLength: 0.7, points: 3, example: "",
};

export function buildHook(hook: HookModel): THREE.Group {
  if (hook.tube) return buildTube(hook);
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

/**
 * A tube (or a Waddington's twisted wire shank) along the shank from 0 to its length, with a
 * treble behind it: in a silicone sleeve on the tube, through the rear loop on a Waddington.
 */
function buildTube(hook: HookModel): THREE.Group {
  const group = new THREE.Group();
  const tube = hook.tube!;
  const L = hook.shankLength;
  const R = hook.wireRadius;
  const metallic = tube.color !== "#2a2a2a";
  const body = new THREE.MeshStandardMaterial({ color: tube.color, metalness: metallic ? 0.8 : 0.1, roughness: metallic ? 0.3 : 0.45 });

  if (tube.kind === "tube") {
    group.add(new THREE.Mesh(new THREE.CylinderGeometry(R, R, L, 32, 1, true).rotateZ(-Math.PI / 2).translate(L / 2, 0, 0), body));
    // The open ends show the bore.
    for (const x of [0, L]) {
      const rim = new THREE.Mesh(new THREE.RingGeometry(R * 0.55, R, 32).rotateY(Math.PI / 2).translate(x, 0, 0), body);
      group.add(rim);
    }
    // Silicone junction tubing over the rear end, holding the treble's eye.
    const sleeve = new THREE.MeshStandardMaterial({ color: "#d9d4c8", roughness: 0.4, transparent: true, opacity: 0.6 });
    group.add(new THREE.Mesh(new THREE.CylinderGeometry(R * 1.15, R * 1.15, 0.6, 24, 1, true).rotateZ(-Math.PI / 2).translate(-0.12, 0, 0), sleeve));
  } else {
    // Two wires twisted together, with an up-turned eye at the front and a loop behind.
    const wire = R * 0.45;
    for (const phase of [0, Math.PI]) {
      const points: THREE.Vector3[] = [];
      for (let i = 0; i <= 120; i++) {
        const x = (L * i) / 120;
        const a = phase + (x / 0.35) * Math.PI * 2;
        points.push(new THREE.Vector3(x, Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.5));
      }
      group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 240, wire, 8, false), body));
    }
    const ringRadius = hook.eyeRadius - wire;
    const a = (-hook.eyeAngle * Math.PI) / 180;
    const eye = new THREE.Mesh(new THREE.TorusGeometry(ringRadius, wire, 10, 40), body);
    eye.position.set(L + ringRadius * Math.cos(a), ringRadius * Math.sin(a), 0);
    group.add(eye);
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.12, wire, 10, 32), body);
    loop.position.set(-0.1, 0, 0);
    group.add(loop);
  }

  // The treble, its eye just behind the tube or through the loop, scaled to its real gape.
  const treble = buildHook(TREBLE);
  const s = tube.trebleScale;
  treble.scale.setScalar(s);
  treble.position.set(-0.22 - (TREBLE.shankLength + TREBLE.eyeRadius * 2) * s, 0, 0);
  group.add(treble);
  return group;
}
