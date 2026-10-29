import * as THREE from "three";
import type { RealAssets } from "./assets";

// Assumption: the scan's 2 m square shown at a quarter scale, as fine gravel with stones of
// 1–1.5 cm, about 100 gapes to a repeat; its relief about 2 cm at full size, so 1 gape here.
const TILE = 100;
const RELIEF = 1;

/**
 * A gravel riverbed whose top is at `y` give or take its relief, centred under (x, z): the
 * photoscan's colours and normals, with its heights built into the geometry so refraction (and
 * the path tracer) see real stones. `size` gapes across, in `segments` squares a side.
 */
export function riverbed(assets: RealAssets, centre: THREE.Vector3, y: number, size = 120, segments = 360): THREE.Group {
  const g = new THREE.PlaneGeometry(size, size, segments, segments).rotateX(-Math.PI / 2);
  const pos = g.getAttribute("position");
  const uv = g.getAttribute("uv");
  const scale = size / TILE;
  for (let i = 0; i < pos.count; i++) {
    const h = assets.gravel.height(uv.getX(i) * scale, uv.getY(i) * scale);
    pos.setXYZ(i, pos.getX(i) + centre.x, y - RELIEF + RELIEF * h, pos.getZ(i) + centre.z);
  }
  g.computeVertexNormals();
  const color = assets.gravel.color.clone();
  const normal = assets.gravel.normal.clone();
  for (const t of [color, normal]) {
    t.repeat.set(scale, scale);
    t.needsUpdate = true;
  }
  const group = new THREE.Group();
  group.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: color, normalMap: normal, roughness: 0.9 })));
  // Beyond the gravel, plain silt far out under deep enough water not to show its edge.
  const silt = new THREE.Mesh(
    new THREE.RingGeometry(size / 2 - 2, 400, 48, 1).rotateX(-Math.PI / 2).translate(centre.x, y - 0.4 * RELIEF, centre.z),
    new THREE.MeshStandardMaterial({ color: "#6e6450", roughness: 1 }),
  );
  group.add(silt);
  return group;
}

/** The height of the bed's top above `y - RELIEF`, as a fraction of its relief, is 0–1: the gravel's highest stones reach `y`. */
export const BED_RELIEF = RELIEF;
