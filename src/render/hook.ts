import * as THREE from "three";
import type { HookModel } from "../tying/hook";
import { hookPath, shankAt } from "../tying/shank";

export function buildHook(hook: HookModel): THREE.Group {
  const group = new THREE.Group();
  const w = hook.wireRadius;

  const points = hookPath(hook).map((p) => new THREE.Vector3(p.x, p.y, 0));
  const curve = new THREE.CatmullRomCurve3(points, false, "centripetal");

  const metal = new THREE.MeshStandardMaterial({ color: 0x3a2e22, metalness: 0.85, roughness: 0.32 });
  group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 320, w, 12, false), metal));

  const tip = points[points.length - 1]!;
  const dir = tip.clone().sub(points[points.length - 2]!).normalize();
  const point = new THREE.Mesh(new THREE.ConeGeometry(w, 0.22, 12), metal);
  point.position.copy(tip).addScaledVector(dir, 0.11);
  point.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  group.add(point);

  // The eye: a ring off the end of the shank, turned down (or up) by eyeAngle from the
  // shank's own direction there.
  const end = shankAt(hook, hook.shankLength);
  const ringRadius = hook.eyeRadius - w;
  const a = Math.atan2(end.t.y, end.t.x) - (hook.eyeAngle * Math.PI) / 180;
  const eye = new THREE.Mesh(new THREE.TorusGeometry(ringRadius, w, 10, 40), metal);
  eye.position.set(end.p.x + ringRadius * Math.cos(a), end.p.y + ringRadius * Math.sin(a), 0);
  group.add(eye);

  return group;
}
