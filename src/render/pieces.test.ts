import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { hookModel } from "../tying/hook";
import { Profile } from "../tying/profile";
import type { BundlePiece, CoverPiece } from "../tying/simulate";
import { Surfaces } from "./materials";
import { pieceView, spreadColours } from "./pieces";
import { mulberry32 } from "./random";
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

describe("glued pads and discs", () => {
  const hook = hookModel({ model: "saltwater-straight", size: 4 });
  const base = {
    type: "bundle" as const, id: 3, material: "body", look: "fibres" as const, color: "#b08a5a", window: [0, 1] as [number, number],
    x: 0.24, span: 1.56, radius: 0.08, length: 0.65, angle: 0, direction: "radial" as const, side: "top" as const,
    spread: Math.PI, bundleRadius: 0.01, count: 1500,
  };
  const bounds = (piece: BundlePiece) => {
    const view = pieceView(piece, new Surfaces(), new ShankSpace(hook));
    view.setProgress(1);
    const box = new THREE.Box3().setFromObject(view.object);
    view.dispose();
    return box;
  };

  it("keeps pads cut flat with keep within the cut", () => {
    const box = bounds({ ...base, across: true, flat: { top: 0.1, under: 0.1 } });
    expect(box.max.y).toBeLessThan(0.14);
    expect(box.min.y).toBeGreaterThan(-0.14);
    expect(box.max.z).toBeGreaterThan(0.55);
  });

  it("clips spun hair to a disc round in plan, as wide near its front as near its rear", () => {
    const piece: BundlePiece = { ...base, angle: 0.17, cut: true, trimShape: "disc", flat: { top: 0.3, under: 0.3 } };
    const view = pieceView(piece, new Surfaces(), new ShankSpace(hook));
    const box = (x0: number, x1: number) => {
      const b = new THREE.Box3();
      view.object.updateMatrixWorld(true);
      const m = new THREE.Matrix4();
      const p = new THREE.Vector3();
      view.object.traverse((o) => {
        if (!(o instanceof THREE.InstancedMesh)) return;
        for (let i = 0; i < o.count; i++) {
          // Each fibre is a unit length along its local y: its tip.
          o.getMatrixAt(i, m);
          p.set(0, 1, 0).applyMatrix4(m).applyMatrix4(o.matrixWorld);
          if (p.x >= x0 && p.x < x1) b.expandByPoint(p);
        }
      });
      return b;
    };
    const mid = base.x + base.span / 2;
    const rear = box(mid - 0.5, mid - 0.4);
    const front = box(mid + 0.4, mid + 0.5);
    expect(Math.abs(front.max.z - rear.max.z)).toBeLessThan(0.12);
    expect(front.max.z).toBeGreaterThan(0.3);
    view.dispose();
  });
});

describe("a blended bunch's colours", () => {
  it("are spread evenly, so a sparse bunch shows each of them", () => {
    for (let seed = 1; seed < 50; seed++) expect(new Set(spreadColours(2, ["red", "white"], mulberry32(seed))).size).toBe(2);
    const many = spreadColours(10, ["a", "b", "c"], mulberry32(7));
    expect(["a", "b", "c"].map((c) => many.filter((x) => x === c).length).sort()).toEqual([3, 3, 4]);
  });
});

describe("a hair wing tied in with a length", () => {
  const hook = hookModel({ model: "salmon-up-eye", size: 6 });
  const wing = (stiffness: number): BundlePiece => ({
    type: "bundle", id: 5, material: "wing", look: "hair", color: "#202020", window: [0, 1],
    x: 2.2, radius: 0.1, length: 3.4, angle: 0.15, direction: "back", side: "top", spread: 0.28,
    bundleRadius: 0.08, count: 400, stiffness,
  });
  /** Each hair's root and tip, from the first and last pieces of the curved fibres. */
  const ends = (piece: BundlePiece) => {
    const view = pieceView(piece, new Surfaces(), new ShankSpace(hook));
    view.setProgress(1);
    const meshes: THREE.InstancedMesh[] = [];
    view.object.traverse((o) => {
      if (o instanceof THREE.InstancedMesh && o.userData.segment !== undefined) meshes[o.userData.segment as number] = o;
    });
    const m = new THREE.Matrix4();
    const at = (mesh: THREE.InstancedMesh, y: number) =>
      Array.from({ length: mesh.count }, (_, i) => new THREE.Vector3(0, y, 0).applyMatrix4(mesh.getMatrixAt(i, m)));
    const result = { roots: at(meshes[0]!, 0), tips: at(meshes[meshes.length - 1]!, 1) };
    view.dispose();
    return result;
  };
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const width = (ps: THREE.Vector3[]) => Math.max(...ps.map((p) => p.z)) - Math.min(...ps.map((p) => p.z));

  it("bends soft hair down towards the body more than stiff hair at the same angle", () => {
    const soft = ends(wing(0.2));
    const stiff = ends(wing(0.9));
    expect(soft.tips.length).toBe(400);
    expect(mean(soft.tips.map((p) => p.y))).toBeLessThan(mean(stiff.tips.map((p) => p.y)) - 0.15);
  });

  it("leaves the tie-in as a tight bundle and fans out towards the tips", () => {
    const { roots, tips } = ends(wing(0.5));
    expect(width(roots)).toBeLessThan(0.12);
    expect(width(tips)).toBeGreaterThan(3 * width(roots));
  });

  it("keeps soft hair over the shank out of the body", () => {
    const view = pieceView({ ...wing(0), angle: 0 }, new Surfaces(), new ShankSpace(hook));
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    view.object.traverse((o) => {
      if (!(o instanceof THREE.InstancedMesh)) return;
      for (let i = 0; i < o.count; i++) {
        p.set(0, 1, 0).applyMatrix4(o.getMatrixAt(i, m));
        if (p.x > 0.05 && p.x < 2.1) expect(Math.hypot(p.y, p.z)).toBeGreaterThan(0.075);
      }
    });
    view.dispose();
  });

  it("gives soft, unstacked hair more uneven tips than stiff, stacked hair", () => {
    const spreadX = (ps: THREE.Vector3[]) => Math.max(...ps.map((p) => p.x)) - Math.min(...ps.map((p) => p.x));
    expect(spreadX(ends(wing(0.2)).tips)).toBeGreaterThan(1.5 * spreadX(ends(wing(0.9)).tips));
  });
});
