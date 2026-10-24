import * as THREE from "three";
import type { HookModel } from "../tying/hook";

export function buildHook(hook: HookModel): THREE.Group {
  const group = new THREE.Group();
  const w = hook.wireRadius;
  const L = hook.shankLength;
  // Gape is measured between the inside of the shank and the point.
  const R = (1 + 2 * w) / 2;

  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= 20; i++) points.push(new THREE.Vector3(L * (1 - i / 20), 0, 0));
  for (let i = 1; i <= 32; i++) {
    const a = Math.PI / 2 + (Math.PI * i) / 32;
    points.push(new THREE.Vector3(R * Math.cos(a), -R + R * Math.sin(a), 0));
  }
  const pointRise = 0.12;
  for (let i = 1; i <= 10; i++) {
    const f = i / 10;
    points.push(new THREE.Vector3(hook.pointLength * f, -2 * R + pointRise * f * f, 0));
  }
  const curve = new THREE.CatmullRomCurve3(points, false, "centripetal");

  const metal = new THREE.MeshStandardMaterial({ color: 0x3a2e22, metalness: 0.85, roughness: 0.32 });
  group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 240, w, 12, false), metal));

  const tip = points[points.length - 1]!;
  const dir = tip.clone().sub(points[points.length - 2]!).normalize();
  const point = new THREE.Mesh(new THREE.ConeGeometry(w, 0.22, 12), metal);
  point.position.copy(tip).addScaledVector(dir, 0.11);
  point.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  group.add(point);

  // Down eye: a ring hanging off the end of the shank at eyeAngle below horizontal.
  const ringRadius = hook.eyeRadius - w;
  const a = (-hook.eyeAngle * Math.PI) / 180;
  const eye = new THREE.Mesh(new THREE.TorusGeometry(ringRadius, w, 10, 40), metal);
  eye.position.set(L + ringRadius * Math.cos(a), ringRadius * Math.sin(a), 0);
  group.add(eye);

  return group;
}
