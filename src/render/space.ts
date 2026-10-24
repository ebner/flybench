import * as THREE from "three";
import type { HookModel } from "../tying/hook";
import { shankAt } from "../tying/shank";

const Z_AXIS = new THREE.Vector3(0, 0, 1);

/**
 * Maps "shank-local" coordinates, in which the shank is a straight line along +x
 * (x = arc length from the bend, y = up from the shank, z = towards the viewer), onto
 * the real, possibly curved, shank. All fly geometry is built in local coordinates and
 * placed with this, so a curved hook needs no special cases. For a straight shank the
 * mapping is the identity.
 */
export class ShankSpace {
  readonly straight: boolean;

  constructor(readonly hook: HookModel) {
    this.straight = hook.shankCurve === 0;
  }

  /** Shank heading at arc length x, in radians (0 = along +x). */
  heading(x: number): number {
    const { t } = shankAt(this.hook, x);
    return Math.atan2(t.y, t.x);
  }

  /** A local point to world, in place. */
  point(v: THREE.Vector3): THREE.Vector3 {
    if (this.straight) return v;
    const { p, t } = shankAt(this.hook, v.x);
    const y = v.y;
    return v.set(p.x - t.y * y, p.y + t.x * y, v.z);
  }

  /** A local direction at arc length x to world, in place. */
  direction(x: number, d: THREE.Vector3): THREE.Vector3 {
    return this.straight ? d : d.applyAxisAngle(Z_AXIS, this.heading(x));
  }

  /** The rotation from local to world at arc length x. */
  rotation(x: number): THREE.Quaternion {
    return new THREE.Quaternion().setFromAxisAngle(Z_AXIS, this.straight ? 0 : this.heading(x));
  }

  /** Point on the surface of whatever is wound on the shank at arc length x, radius r, wrap angle a. */
  around(x: number, r: number, a: number, target = new THREE.Vector3()): THREE.Vector3 {
    return this.point(target.set(x, r * Math.sin(a), r * Math.cos(a)));
  }
}
