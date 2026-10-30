import * as THREE from "three";
import type { RealAssets } from "./assets";
import { bedHeight, BED_RELIEF } from "./riverbed";
import type { Dimple } from "./waves";

/**
 * What a floating fly shows on the riverbed in sunlight: its shadow, soft from the water it
 * crosses, and under each dent in the film a dark spot ringed with light, where the curved
 * meniscus bends the sun's rays aside. The path tracer can't find these through the clear
 * surface on its own (the sun's light would have to pass a mirror-like surface to reach the
 * stones), so they are drawn onto a thin layer over the bed, for the live view and the stills alike.
 */

/** The layer's size in gapes, and its picture's size in pixels. */
const SIZE = 18;
const PIXELS = 512;
// Assumption: the sky and the water's scattering fill shadows in: about half the light remains.
// The meniscus spots are much darker than that, crisp and round, with a thin bright rim (photos of
// insects and floating clips over shallow bottoms, scripts/water-references.json "contact-macro").
const SHADOW = 0.5;
const SPOT = 0.85;
const RIM = 0.45;

export interface ShadowOptions {
  assets: RealAssets;
  /** What casts shadows (the fly and its knot, the tippet; or a natural). */
  casters: THREE.Object3D[];
  dimples: Dimple[];
  level: number;
  /** The bed's top, centre and squares a side, as the riverbed was built with. */
  bed: number;
  centre: THREE.Vector3;
  bedSegments: number;
  /** Towards the sun (world). */
  sun: THREE.Vector3;
}

/** The layer over the bed with the shadows and meniscus spots, or null when the sun is too low to cast them through the water. */
export function bedShadows(o: ShadowOptions): THREE.Mesh | null {
  const light = o.sun.clone().normalize().negate();
  if (light.y > -0.1) return null;
  // Into the water, bent towards the vertical.
  const under = refract(light);
  const floor = o.bed - BED_RELIEF / 2;
  // A point's shadow on the bed: along the light to the surface, then along the refracted ray.
  const shadowOf = (p: THREE.Vector3, out: THREE.Vector3) => {
    let q = p;
    if (p.y > o.level) q = p.clone().addScaledVector(light, (o.level - p.y) / light.y);
    return out.copy(q).addScaledVector(under, (floor - q.y) / under.y);
  };
  const middle = shadowOf(o.centre, new THREE.Vector3());
  const toPixel = (p: THREE.Vector3) => [((p.x - middle.x) / SIZE + 0.5) * PIXELS, ((p.z - middle.z) / SIZE + 0.5) * PIXELS] as const;
  const perGape = PIXELS / SIZE;

  const shade = document.createElement("canvas");
  shade.width = shade.height = PIXELS;
  const ctx = shade.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.strokeStyle = "#000";
  ctx.lineCap = "round";
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const m = new THREE.Matrix4();
  for (const caster of o.casters) caster.updateMatrixWorld(true);
  for (const caster of o.casters) caster.traverseVisible((x) => {
    if (!(x instanceof THREE.Mesh)) return;
    const g = x.geometry as THREE.BufferGeometry;
    if (x instanceof THREE.InstancedMesh) {
      // A fibre: a line from its root to its tip, as wide as it is (at least a pixel). Its
      // geometry is a unit cylinder; the instance's scale makes it a fibre.
      g.computeBoundingBox();
      const { min, max } = g.boundingBox!;
      if (x.count === 0) return;
      x.getMatrixAt(0, m).premultiply(x.matrixWorld);
      const scale = new THREE.Vector3().setFromMatrixColumn(m, 0).length();
      ctx.lineWidth = Math.max(1, (max.x - min.x) * scale * perGape);
      ctx.beginPath();
      for (let i = 0; i < x.count; i++) {
        x.getMatrixAt(i, m).premultiply(x.matrixWorld);
        const [x0, y0] = toPixel(shadowOf(a.set(0, min.y, 0).applyMatrix4(m), b));
        const [x1, y1] = toPixel(shadowOf(a.set(0, max.y, 0).applyMatrix4(m), c));
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
      }
      ctx.stroke();
      return;
    }
    // Solid parts: their triangles, some of them for a large mesh.
    const pos = g.getAttribute("position");
    const index = g.getIndex();
    const triangles = (index ? index.count : pos.count) / 3;
    const stride = Math.max(1, Math.floor(triangles / 20000));
    const corner = (k: number, out: THREE.Vector3) => shadowOf(out.fromBufferAttribute(pos, index ? index.getX(k) : k).applyMatrix4(x.matrixWorld), out);
    ctx.beginPath();
    for (let t = 0; t < triangles; t += stride) {
      const [px, py] = toPixel(corner(3 * t, a));
      const [qx, qy] = toPixel(corner(3 * t + 1, b));
      const [rx, ry] = toPixel(corner(3 * t + 2, c));
      ctx.moveTo(px, py);
      ctx.lineTo(qx, qy);
      ctx.lineTo(rx, ry);
      ctx.closePath();
    }
    ctx.fill();
  });

  // Softened by the water it crosses: the sun's disc and the light scattered on the way.
  const depth = o.level - floor;
  const soft = document.createElement("canvas");
  soft.width = soft.height = PIXELS;
  const s = soft.getContext("2d")!;
  // Assumption: about a gape of blur over six gapes of water (2 mm over 3 cm).
  s.filter = `blur(${Math.max(1, (depth / 6) * 0.5 * perGape)}px)`;
  s.drawImage(shade, 0, 0);
  s.filter = "none";

  // The meniscus spots: dark where the dent spreads the rays aside, a thin bright rim where they
  // gather. Not softened like the shadow: the dent itself is the lens that draws them.
  const spots = document.createElement("canvas");
  spots.width = spots.height = PIXELS;
  const sp = spots.getContext("2d")!;
  const rims = document.createElement("canvas");
  rims.width = rims.height = PIXELS;
  const r = rims.getContext("2d")!;
  for (const d of o.dimples) {
    const [x, y] = toPixel(shadowOf(a.set(d.x, o.level, d.z), b));
    // Assumption: a spot about one and a half times the dent's radius (several times the foot or fibre).
    const radius = d.r * 1.5 * perGape * Math.min(1, d.d / 0.02);
    const dark = sp.createRadialGradient(x, y, 0, x, y, radius);
    dark.addColorStop(0, "rgba(0,0,0,1)");
    dark.addColorStop(0.75, "rgba(0,0,0,0.95)");
    dark.addColorStop(1, "rgba(0,0,0,0)");
    sp.fillStyle = dark;
    sp.beginPath();
    sp.arc(x, y, radius, 0, Math.PI * 2);
    sp.fill();
    const glow = r.createRadialGradient(x, y, radius * 0.9, x, y, radius * 1.2);
    glow.addColorStop(0, "rgba(255,255,255,0)");
    glow.addColorStop(0.35, "rgba(255,255,255,1)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    r.fillStyle = glow;
    r.beginPath();
    r.arc(x, y, radius * 1.2, 0, Math.PI * 2);
    r.fill();
  }

  // One picture: black where it is darker, white where lighter, by how much in the alpha. Its
  // rows from the near edge (v = 0, +z) on: a data texture, which both renderers read alike.
  const dark = s.getImageData(0, 0, PIXELS, PIXELS).data;
  const spot = sp.getImageData(0, 0, PIXELS, PIXELS).data;
  const bright = r.getImageData(0, 0, PIXELS, PIXELS).data;
  const out = new Uint8Array(PIXELS * PIXELS * 4);
  for (let row = 0; row < PIXELS; row++) {
    for (let col = 0; col < PIXELS; col++) {
      const i = (PIXELS - 1 - row) * PIXELS + col;
      const v = (bright[i * 4 + 3]! / 255) * RIM - Math.max((dark[i * 4 + 3]! / 255) * SHADOW, (spot[i * 4 + 3]! / 255) * SPOT);
      const k = v > 0 ? 255 : 0;
      out.set([k, k, k, Math.round(Math.min(1, Math.abs(v)) * 255)], (row * PIXELS + col) * 4);
    }
  }
  const texture = new THREE.DataTexture(out, PIXELS, PIXELS, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  // The path tracer reads a data texture's rows the other way up (see trace.ts).
  texture.userData.rowsReversedForTracer = true;

  // A layer following the stones just above them, as the bed's own triangles lie between its points.
  const g = new THREE.PlaneGeometry(SIZE, SIZE, 120, 120).rotateX(-Math.PI / 2);
  const pos = g.getAttribute("position");
  const step = 120 / o.bedSegments;
  const at = (x: number, z: number) => bedHeight(o.assets, o.centre, o.bed, x, z);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + middle.x;
    const z = pos.getZ(i) + middle.z;
    const gx = Math.floor((x - o.centre.x) / step) * step + o.centre.x;
    const gz = Math.floor((z - o.centre.z) / step) * step + o.centre.z;
    const fx = (x - gx) / step;
    const fz = (z - gz) / step;
    // On the bed's own triangles: PlaneGeometry splits each square from its far-left to its
    // near-right corner (a, b, d and b, c, d, with b and c a step further along +z).
    const ha = at(gx, gz);
    const hb = at(gx, gz + step);
    const hc = at(gx + step, gz + step);
    const hd = at(gx + step, gz);
    const y = fx + fz <= 1 ? ha + (hd - ha) * fx + (hb - ha) * fz : hc + (hb - hc) * (1 - fx) + (hd - hc) * (1 - fz);
    pos.setXYZ(i, x, y + 0.03, z);
  }
  g.computeVertexNormals();
  return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: texture, transparent: true, depthWrite: false, roughness: 1 }));
}

/** A ray going down through the surface, bent by it (air to water). */
function refract(d: THREE.Vector3): THREE.Vector3 {
  const eta = 1 / 1.333;
  const n = new THREE.Vector3(0, 1, 0);
  const cos = -n.dot(d);
  const k = 1 - eta * eta * (1 - cos * cos);
  return d.clone().multiplyScalar(eta).addScaledVector(n, eta * cos - Math.sqrt(k)).normalize();
}
