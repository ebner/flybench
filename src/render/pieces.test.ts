import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { hookModel } from "../tying/hook";
import { Profile } from "../tying/profile";
import type { CoverPiece } from "../tying/simulate";
import { Surfaces } from "./materials";
import { pieceView } from "./pieces";
import { ShankSpace } from "./space";

describe("a strip parted round a post", () => {
  it("grows its fur on both halves, none between them at the post", () => {
    const hook = hookModel({ model: "dry-standard", size: 12 });
    const post = { x: 1.2, angle: 0.8, reach: 0.4 };
    const piece: CoverPiece = {
      type: "cover", id: 1, material: "back", look: "strip", color: "#8a6a4a", window: [0, 1],
      x0: 0.4, x1: 1.8, base: Profile.bare(-0.3, 2.2, 0.05), thickness: 0.03, lift: 0, halfAngle: 0.6, dents: [], stub: 0, fur: 0.5, barring: 0, split: post,
    };
    const view = pieceView(piece, new Surfaces(), new ShankSpace(hook));
    const roots: THREE.Vector3[] = [];
    const m = new THREE.Matrix4();
    view.object.traverse((o) => {
      if (!(o instanceof THREE.InstancedMesh) || (o.userData.segment !== undefined && o.userData.segment !== 0)) return;
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m);
        roots.push(new THREE.Vector3().setFromMatrixPosition(m));
      }
    });
    const atPost = roots.filter((r) => Math.abs(r.x - post.x) < 0.1);
    expect(atPost.length).toBeGreaterThan(20);
    expect(atPost.filter((r) => Math.abs(r.z) < 0.02)).toEqual([]);
    expect(atPost.some((r) => r.z > 0) && atPost.some((r) => r.z < 0)).toBe(true);
    view.dispose();
  });
});

describe("a strip cut to a width, parted round a post", () => {
  it("draws two halves turned out to either side, nothing over the post", () => {
    const hook = hookModel({ model: "dry-standard", size: 12 });
    const post = { x: 1.2, angle: 0.8, reach: 0.4 };
    const piece: CoverPiece = {
      type: "cover", id: 1, material: "back", look: "foam", color: "#202020", window: [0, 1],
      x0: 0.4, x1: 1.8, base: Profile.bare(-0.3, 2.2, 0.05), thickness: 0.1, lift: 0, halfAngle: 1.4, dents: [], stub: 0, barring: 0, split: post, width: 0.8,
    };
    const view = pieceView(piece, new Surfaces(), new ShankSpace(hook));
    const mesh = view.object as THREE.Mesh;
    const pos = mesh.geometry.getAttribute("position");
    const zs: number[] = [];
    // (Shank-local x is near world x on a straight shank.)
    for (let i = 0; i < pos.count; i++) if (Math.abs(pos.getX(i) - post.x) < 0.03) zs.push(pos.getZ(i));
    expect(zs.length).toBeGreaterThan(0);
    expect(zs.filter((z) => Math.abs(z) < 0.03)).toEqual([]);
    expect(zs.some((z) => z > 0) && zs.some((z) => z < 0)).toBe(true);
    // Each half as wide as half the strip.
    expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThan(0.8);
    view.dispose();
  });
});
