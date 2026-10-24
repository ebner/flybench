import * as THREE from "three";
import type { FreeEndPose } from "../tying/simulate";
import type { Surfaces } from "./materials";
import { fibreMesh, type Fibre } from "./pieces";
import { mulberry32 } from "./random";

/**
 * Things that move freely rather than being wound on: the thread running to
 * the bobbin, and loose material ends before they are wound or trimmed.
 * Both are posed every frame from a contact point and a direction.
 */

const Y_AXIS = new THREE.Vector3(0, 1, 0);

/** Distance from the shank to the bobbin holder tube. */
const BOBBIN_DISTANCE = 1.0;

export class BobbinView {
  readonly object = new THREE.Group();
  private thread: THREE.Mesh;
  private holder = new THREE.Group();

  constructor(threadRadius: number, threadColor: string, surfaces: Surfaces) {
    this.thread = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 1, 5).translate(0, 0.5, 0),
      surfaces.get("thread", threadColor),
    );
    this.thread.scale.set(threadRadius, BOBBIN_DISTANCE, threadRadius);

    const metal = surfaces.get("metal", "#b8bcc2");
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.45, 12).translate(0, 0.225, 0), metal);
    const spool = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.32, 24), surfaces.get("thread", threadColor));
    spool.rotation.z = Math.PI / 2;
    spool.position.y = 0.7;
    const flanges = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.36, 24, 1, true), metal);
    flanges.rotation.z = Math.PI / 2;
    flanges.position.y = 0.7;
    this.holder.add(tube, spool, flanges);
    this.holder.position.y = BOBBIN_DISTANCE;

    const arm = new THREE.Group();
    arm.add(this.thread, this.holder);
    this.object.add(arm);
  }

  /** Thread leaves the shank at `contact` and runs along `dir` to the bobbin. */
  setPose(contact: THREE.Vector3 | null, dir?: THREE.Vector3) {
    this.object.visible = contact !== null;
    if (!contact || !dir) return;
    this.object.position.copy(contact);
    this.object.quaternion.setFromUnitVectors(Y_AXIS, dir);
  }

  dispose() {
    this.object.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
  }
}

/** A loose material end, built along +Y; scale.y shortens it as it is used up. */
export class LooseEndView {
  readonly object = new THREE.Group();
  private geometries: THREE.BufferGeometry[] = [];
  private disposers: (() => void)[] = [];

  constructor(end: FreeEndPose, surfaces: Surfaces) {
    const len = end.length;
    const stem = new THREE.CylinderGeometry(end.strandRadius * 0.6, end.strandRadius, len, 8).translate(0, len / 2, 0);
    this.geometries.push(stem);
    this.object.add(new THREE.Mesh(stem, surfaces.get(end.look === "hackle" ? "stem" : end.look, end.color)));

    if (end.fibreLength && (end.look === "hackle" || end.look === "herl")) {
      const rand = mulberry32(end.material.length * 31 + 17);
      const hackle = end.look === "hackle";
      const fibres: Fibre[] = [];
      const n = hackle ? 140 : 160;
      for (let i = 0; i < n; i++) {
        const y = (i / n) * len;
        // Hackle barbs grow in two rows, angled towards the tip and shorter near it.
        const side = i % 2 === 0 ? 1 : -1;
        const dir = hackle
          ? new THREE.Vector3(side, 0.55, (rand() - 0.5) * 0.3).normalize()
          : new THREE.Vector3(side * (0.6 + rand() * 0.4), 0.8, (rand() - 0.5) * 1.2).normalize();
        const taper = hackle ? 1 - 0.55 * (y / len) : 1;
        fibres.push({
          u: 0,
          base: new THREE.Vector3(0, y, 0),
          dir,
          length: end.fibreLength * taper * (hackle ? 0.75 + 0.2 * rand() : 0.6 + 0.6 * rand()),
          radius: hackle ? 0.0045 : 0.0035,
        });
      }
      const mesh = fibreMesh(fibres, surfaces.get(end.look, hackle ? end.color : "#26341a", true));
      this.disposers.push(() => mesh.dispose());
      this.object.add(mesh.object);
    }
  }

  setPose(base: THREE.Vector3, dir: THREE.Vector3, remaining: number) {
    this.object.position.copy(base);
    this.object.quaternion.setFromUnitVectors(Y_AXIS, dir);
    this.object.scale.set(1, Math.max(remaining, 0.02), 1);
  }

  dispose() {
    for (const g of this.geometries) g.dispose();
    for (const d of this.disposers) d();
  }
}
