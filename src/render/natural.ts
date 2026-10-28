import * as THREE from "three";
import type { Natural, NaturalPart } from "../recipe/natural";
import { resolveColor } from "../recipe/schema";
import { mulberry32 } from "./random";

/**
 * Builds a natural (an insect, shrimp or fish) from its recipe, for the same scene as the flies.
 * Units: the body length is 1, the head points to +x, the back to +y; the rear end is at x = 0.
 * The caller scales it (to gapes, to show it beside a fly at its real size).
 */
export function buildNatural(n: Natural): THREE.Group {
  const group = new THREE.Group();
  group.name = n.id;
  const spine = new Spine(n);
  group.add(bodyMesh(n, spine));
  const random = mulberry32(hash(n.id));
  for (const part of n.parts) {
    const object = partObject(part, n, spine, random);
    if (object) group.add(object);
  }
  return group;
}

/** Frees the geometries, materials and textures of a natural built by buildNatural. */
export function disposeNatural(group: THREE.Object3D) {
  group.traverse((o) => {
    if (o instanceof THREE.Mesh || o instanceof THREE.Line) {
      o.geometry.dispose();
      const materials = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of materials as (THREE.Material & { map?: THREE.Texture | null })[]) {
        m.map?.dispose();
        m.dispose();
      }
    }
  });
}

const color = (c: string) => new THREE.Color(resolveColor(c));

/** The centre line of the body: an arc through `curve` degrees, the body bent down at both ends for a positive curve. */
class Spine {
  readonly sections: { start: number; end: number; s: Natural["body"][number] }[] = [];

  constructor(private n: Natural) {
    let u = 0;
    for (const s of n.body) {
      this.sections.push({ start: u, end: u + s.length, s });
      u += s.length;
    }
  }

  /** Heading of the spine at u, in radians above +x. */
  heading(u: number): number {
    return THREE.MathUtils.degToRad(this.n.curve) * (0.5 - u);
  }

  point(u: number): THREE.Vector3 {
    const k = THREE.MathUtils.degToRad(this.n.curve);
    if (Math.abs(k) < 1e-4) return new THREE.Vector3(u, 0, 0);
    // An arc of length 1 and total turn k, centred so the middle is at (0.5, 0).
    const R = 1 / k;
    const a = this.heading(u);
    const a0 = this.heading(0.5);
    return new THREE.Vector3(0.5 + R * (Math.sin(a0) - Math.sin(a)), R * (Math.cos(a) - Math.cos(a0)), 0);
  }

  tangent(u: number): THREE.Vector3 {
    const a = this.heading(u);
    return new THREE.Vector3(Math.cos(a), Math.sin(a), 0);
  }

  /** "Up" across the spine at u (towards the back). */
  up(u: number): THREE.Vector3 {
    const a = this.heading(u);
    return new THREE.Vector3(-Math.sin(a), Math.cos(a), 0);
  }

  section(u: number) {
    return this.sections.find((s) => u <= s.end + 1e-9) ?? this.sections[this.sections.length - 1]!;
  }

  /** Half height and width of the section holding u, before smoothing.  */
  private raw(u: number): { h: number; w: number } {
    const { start, end, s } = this.section(u);
    const t = (u - start) / Math.max(1e-6, end - start);
    const egg = Math.sqrt(Math.max(0.12, 1 - (2 * t - 1) ** 2));
    const r = s.radius * THREE.MathUtils.lerp(1, s.taper, t) * THREE.MathUtils.lerp(1, egg, s.round);
    const f = Math.sqrt(s.flatten);
    return { h: r * f, w: r / f };
  }

  /** The body's outline, sampled along it and smoothed: see `size`. */
  private outline: { h: number; w: number }[] | null = null;

  /**
   * Half height and half width of the body at u, rounded off at both ends. The sections' own
   * outlines are averaged over a window, so they flow into each other: a short one keeps an
   * insect's waists, a long one gives a fish its smooth shape.
   */
  size(u: number): { h: number; w: number } {
    if (!this.outline) {
      const n = 400;
      const raw = Array.from({ length: n + 1 }, (_, i) => this.raw(i / n));
      const half = Math.round((this.n.group === "baitfish" ? 0.09 : 0.012) * n);
      this.outline = raw.map((_, i) => {
        let h = 0;
        let w = 0;
        let weight = 0;
        for (let j = Math.max(0, i - half); j <= Math.min(n, i + half); j++) {
          const k = 1 - Math.abs(j - i) / (half + 1);
          h += raw[j]!.h * k;
          w += raw[j]!.w * k;
          weight += k;
        }
        return { h: h / weight, w: w / weight };
      });
    }
    const n = this.outline.length - 1;
    const x = Math.min(n, Math.max(0, u * n));
    const a = this.outline[Math.floor(x)]!;
    const b = this.outline[Math.min(n, Math.floor(x) + 1)]!;
    const f = x - Math.floor(x);
    const { start, end, s } = this.section(u);
    const t = (u - start) / Math.max(1e-6, end - start);
    // Segment rings: a slight swelling in each.
    let k = s.segments > 1 ? 1 + 0.05 * Math.sin(Math.PI * ((t * s.segments) % 1)) : 1;
    // Rounded ends, over a length that grows with the radius there.
    const edge = Math.min(u, 1 - u);
    const tip = this.outline[u < 0.5 ? 0 : n]!;
    const cap = Math.max(0.03, Math.max(tip.h, tip.w) * 0.9);
    if (edge < cap) k *= Math.sqrt(Math.max(0, 1 - ((cap - edge) / cap) ** 2));
    return { h: THREE.MathUtils.lerp(a.h, b.h, f) * k, w: THREE.MathUtils.lerp(a.w, b.w, f) * k };
  }

  /** The section named `name`, or the one that holds `fallback` of the body length. */
  named(name: string | undefined, fallback: number) {
    return this.sections.find((s) => s.s.section === name) ?? this.section(fallback);
  }
}

function bodyMesh(n: Natural, spine: Spine): THREE.Mesh {
  const rings = 160;
  const around = 28;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const c = new THREE.Color();
  for (let i = 0; i <= rings; i++) {
    const u = i / rings;
    const p = spine.point(u);
    const up = spine.up(u);
    const side = new THREE.Vector3(0, 0, 1);
    const { h, w } = spine.size(u);
    const { start, end, s } = spine.section(u);
    const top = color(s.color);
    const belly = color(s.belly ?? s.color);
    // Darker where one segment meets the next.
    const t = (u - start) / Math.max(1e-6, end - start);
    const ring = s.segments > 1 ? Math.abs(((t * s.segments) % 1) - 0.5) * 2 : 0;
    const shade = s.segments > 1 ? 1 - 0.28 * Math.max(0, ring - 0.7) / 0.3 : 1;
    for (let j = 0; j <= around; j++) {
      const a = (j / around) * Math.PI * 2;
      const y = Math.cos(a);
      positions.push(...p.clone().addScaledVector(up, y * h).addScaledVector(side, Math.sin(a) * w).toArray());
      c.copy(top).lerp(belly, THREE.MathUtils.smoothstep(-y, 0.15, 0.85)).multiplyScalar(shade);
      colors.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < around; j++) {
      const a = i * (around + 1) + j;
      const b = a + around + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  const glass = Math.max(...n.body.map((s) => s.translucency));
  const m = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.45,
    metalness: 0.02,
    transparent: glass > 0,
    opacity: 1 - 0.45 * glass,
  });
  return new THREE.Mesh(g, m);
}

/** A thin tapered strand along `points` (legs, tails, antennae). */
function strand(points: THREE.Vector3[], radius: number, c: string, tip = 0.35): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points);
  const g = new THREE.TubeGeometry(curve, Math.max(8, points.length * 6), radius, 6, false);
  // Taper towards the end.
  const pos = g.getAttribute("position");
  const segs = g.parameters.tubularSegments;
  const ring = g.parameters.radialSegments + 1;
  for (let i = 0; i <= segs; i++) {
    const centre = curve.getPointAt(i / segs);
    const k = THREE.MathUtils.lerp(1, tip, i / segs);
    for (let j = 0; j < ring; j++) {
      const v = new THREE.Vector3().fromBufferAttribute(pos, i * ring + j).sub(centre).multiplyScalar(k).add(centre);
      pos.setXYZ(i * ring + j, v.x, v.y, v.z);
    }
  }
  g.computeVertexNormals();
  return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: color(c), roughness: 0.5 }));
}

/** A flat leaf shape (wing, gill, fin) of length `l` along +x and width `w`, as a double-sided mesh. */
function blade(l: number, w: number, c: string, opacity: number, kind: "wing" | "leaf" | "fork" = "leaf", veins = false): THREE.Mesh {
  const s = new THREE.Shape();
  if (kind === "fork") {
    s.moveTo(0, -w * 0.15);
    s.quadraticCurveTo(l * 0.6, -w * 0.25, l, -w * 0.5);
    s.lineTo(l * 0.75, 0);
    s.lineTo(l, w * 0.5);
    s.quadraticCurveTo(l * 0.6, w * 0.25, 0, w * 0.15);
  } else if (kind === "wing") {
    s.moveTo(0, 0);
    s.bezierCurveTo(l * 0.25, w * 0.9, l * 0.85, w * 1.05, l, w * 0.35);
    s.bezierCurveTo(l * 1.02, w * 0.05, l * 0.6, -w * 0.05, 0, 0);
  } else {
    s.moveTo(0, 0);
    s.bezierCurveTo(l * 0.3, w * 0.6, l * 0.75, w * 0.6, l, 0);
    s.bezierCurveTo(l * 0.75, -w * 0.6, l * 0.3, -w * 0.6, 0, 0);
  }
  const g = new THREE.ShapeGeometry(s, 16);
  const m = new THREE.MeshStandardMaterial({
    color: color(c),
    roughness: 0.6,
    side: THREE.DoubleSide,
    transparent: opacity < 1,
    opacity,
    depthWrite: opacity >= 1,
  });
  const mesh = new THREE.Mesh(g, m);
  if (veins) {
    // From the root out to points on the edge, stopping just inside it.
    const edge = s.getSpacedPoints(24);
    const lines: number[] = [];
    for (let i = 3; i <= 15; i += 2) {
      const p = edge[i]!;
      lines.push(0, 0, 0, p.x * 0.94, p.y * 0.94, 0);
    }
    const vg = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(lines, 3));
    const vm = new THREE.LineBasicMaterial({ color: color(c).multiplyScalar(0.45), transparent: true, opacity: Math.min(1, opacity + 0.3) });
    mesh.add(new THREE.LineSegments(vg, vm));
  }
  return mesh;
}

function partObject(part: NaturalPart, n: Natural, spine: Spine, random: () => number): THREE.Object3D | null {
  const thorax = spine.named("thorax", 0.7);
  const head = spine.named("head", 0.95);
  const abdomen = spine.named("abdomen", 0.3);
  const top = (u: number, lift = 1) => spine.point(u).addScaledVector(spine.up(u), spine.size(u).h * lift);
  switch (part.part) {
    case "tails": {
      const g = new THREE.Group();
      const base = spine.point(0.01);
      for (let i = 0; i < part.count; i++) {
        const spread = part.count === 1 ? 0 : THREE.MathUtils.degToRad(part.spread) * (i / (part.count - 1) - 0.5);
        const dir = spine.tangent(0).negate().applyAxisAngle(new THREE.Vector3(0, 1, 0), spread);
        if (part.leaf) {
          const leaf = blade(part.length, part.length * 0.3, part.color, 0.8);
          leaf.position.copy(base);
          leaf.rotation.set(Math.PI / 2, 0, Math.PI + spine.heading(0) - spread);
          g.add(leaf);
          continue;
        }
        const pts = [0, 0.33, 0.66, 1].map((f) =>
          base.clone().addScaledVector(dir, part.length * f).add(new THREE.Vector3(0, 0.08 * part.length * f * f, 0)),
        );
        g.add(strand(pts, 0.006, part.color, 0.3));
      }
      return g;
    }
    case "antennae": {
      const g = new THREE.Group();
      const base = top((head.start + head.end) / 2 + 0.02, 0.6);
      for (const side of [-1, 1]) {
        const pts = [0, 0.33, 0.66, 1].map((f) =>
          part.swept
            ? base.clone().add(new THREE.Vector3(-part.length * f * 0.95, part.length * 0.06 * Math.sin(Math.PI * f), side * (0.03 + 0.05 * f)))
            : base.clone().add(new THREE.Vector3(part.length * f * 0.9, part.length * f * (0.35 - 0.25 * f), side * part.length * f * 0.25)),
        );
        g.add(strand(pts, 0.004, part.color, 0.3));
      }
      return g;
    }
    case "legs": {
      const g = new THREE.Group();
      const where = part.at ? spine.named(part.at, 0.7) : thorax;
      const pairs = Math.max(1, Math.round(part.count / 2));
      for (let i = 0; i < pairs; i++) {
        const u = THREE.MathUtils.lerp(where.start + 0.15 * (where.end - where.start), where.end - 0.1 * (where.end - where.start), pairs === 1 ? 0.5 : i / (pairs - 1));
        const L = part.length * (i === 0 && pairs >= 3 ? (part.hind ?? 1) : 1);
        // Front legs reach forward, the rest back.
        const lean = pairs === 1 ? 0 : THREE.MathUtils.lerp(-0.5, 0.5, i / (pairs - 1));
        for (const side of [-1, 1]) {
          const base = spine.point(u).addScaledVector(spine.up(u), -spine.size(u).h * 0.4);
          const knee = base.clone().add(new THREE.Vector3(lean * L * 0.4, L * 0.15, side * L * 0.45));
          const foot = base.clone().add(new THREE.Vector3(lean * L * 0.8, -L * 0.35, side * L * 0.75));
          g.add(strand([base, knee, foot], 0.007, part.color, 0.5));
        }
      }
      return g;
    }
    case "wings": {
      const g = new THREE.Group();
      const opacity = 1 - 0.75 * part.clarity;
      const u = (thorax.start + thorax.end) / 2;
      const root = top(u, 0.85);
      const pairs = part.count / 2;
      for (let pair = 0; pair < pairs; pair++) {
        const scale = pair === 0 ? 1 : 0.55;
        for (const side of [-1, 1]) {
          const w = blade(part.length * scale, part.width * scale, part.color, opacity, "wing", part.veins);
          w.position.copy(root);
          switch (part.shape) {
            case "upright":
              // Standing up from the thorax, leaning back a little, the pair just apart.
              w.rotation.set(0, side * 0.08, Math.PI / 2 + 0.25);
              break;
            case "tent":
              // A roof over the abdomen, reaching past it.
              w.rotation.set(side * 0.55, 0, Math.PI);
              w.rotation.order = "YXZ";
              w.rotation.y = side * 0.05;
              break;
            case "flat":
              w.rotation.set(Math.PI / 2, side * 0.05, Math.PI);
              break;
            case "back":
              w.rotation.set(side * 0.25, side * 0.15, Math.PI - 0.05);
              break;
            case "spent":
              w.rotation.set(Math.PI / 2, 0, (Math.PI / 2) * side * -1);
              break;
          }
          if (pair === 1) w.position.y -= 0.005;
          g.add(w);
        }
      }
      return g;
    }
    case "gills": {
      const g = new THREE.Group();
      for (let i = 0; i < part.count; i++) {
        const u = THREE.MathUtils.lerp(abdomen.start + 0.1 * (abdomen.end - abdomen.start), abdomen.end - 0.1 * (abdomen.end - abdomen.start), part.count === 1 ? 0.5 : i / (part.count - 1));
        for (const side of [-1, 1]) {
          const leaf = blade(part.length, part.length * 0.6, part.color, 0.75);
          leaf.position.copy(spine.point(u).add(new THREE.Vector3(0, spine.size(u).h * 0.3, side * spine.size(u).w * 0.9)));
          leaf.rotation.set(Math.PI / 2, 0, side * (Math.PI / 2 + 0.6));
          g.add(leaf);
        }
      }
      return g;
    }
    case "wingpads": {
      const u = thorax.end - part.length / 2;
      const s = spine.size(u);
      const pad = new THREE.Mesh(
        new THREE.SphereGeometry(1, 20, 12),
        new THREE.MeshStandardMaterial({ color: color(part.color), roughness: 0.35 }),
      );
      pad.scale.set(part.length / 2, s.h * 0.45, s.w * 0.85);
      pad.position.copy(top(u, 0.75));
      pad.rotation.z = spine.heading(u) - 0.12;
      return pad;
    }
    case "case": {
      // A rough tube over the abdomen, open at the front where the head and legs come out.
      const rings = 40;
      const around = 20;
      const positions: number[] = [];
      const colors: number[] = [];
      const indices: number[] = [];
      const base = color(part.color);
      const c = new THREE.Color();
      for (let i = 0; i <= rings; i++) {
        const u = (i / rings) * part.length;
        const p = spine.point(Math.min(1, u));
        const r = part.radius * (0.75 + 0.25 * Math.min(1, (i / rings) * 2.5));
        for (let j = 0; j <= around; j++) {
          const a = (j / around) * Math.PI * 2;
          const grain = part.material === "plant" ? 0.06 * Math.sin(i * 1.7) : 0.12 * (random() - 0.5);
          const rr = r * (1 + grain);
          positions.push(p.x, p.y + Math.cos(a) * rr, Math.sin(a) * rr);
          c.copy(base).multiplyScalar(0.75 + 0.5 * random());
          colors.push(c.r, c.g, c.b);
        }
      }
      for (let i = 0; i < rings; i++) {
        for (let j = 0; j < around; j++) {
          const a = i * (around + 1) + j;
          const b = a + around + 1;
          indices.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
      g.setIndex(indices);
      g.computeVertexNormals();
      return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: part.material !== "plant", side: THREE.DoubleSide }));
    }
    case "shuck": {
      const pts = [0, 0.5, 1].map((f) => spine.point(0).addScaledVector(spine.tangent(0), -part.length * f).add(new THREE.Vector3(0, -0.05 * part.length * f, 0)));
      const m = strand(pts, spine.size(0.08).h * 0.8, part.color, 0.5);
      (m.material as THREE.MeshStandardMaterial).transparent = true;
      (m.material as THREE.MeshStandardMaterial).opacity = 0.55;
      return m;
    }
    case "eyes": {
      const g = new THREE.Group();
      const u = head.start + 0.6 * (head.end - head.start);
      const s = spine.size(u);
      for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(
          new THREE.SphereGeometry(part.size, 16, 12),
          new THREE.MeshStandardMaterial({ color: color(part.color), roughness: 0.15 }),
        );
        eye.position.copy(spine.point(u).add(new THREE.Vector3(0, s.h * 0.25, side * s.w * 0.85)));
        g.add(eye);
      }
      return g;
    }
    case "fin": {
      const u = part.at;
      const s = spine.size(u);
      const opacity = 0.7;
      switch (part.kind) {
        case "caudal": {
          const f = blade(part.size, part.size * 1.1, part.color, opacity, "fork");
          f.position.copy(spine.point(0.005));
          f.rotation.z = Math.PI + spine.heading(0);
          return f;
        }
        case "dorsal":
        case "adipose": {
          const f = blade(part.size, part.size * 0.9, part.color, opacity);
          f.position.copy(top(u, 0.95));
          f.rotation.z = Math.PI - 0.5 + spine.heading(u);
          return f;
        }
        case "anal":
        case "pelvic": {
          const f = blade(part.size, part.size * 0.7, part.color, opacity);
          f.position.copy(spine.point(u).addScaledVector(spine.up(u), -s.h * 0.9));
          f.rotation.z = Math.PI + 0.45 + spine.heading(u);
          return f;
        }
        case "pectoral": {
          const g = new THREE.Group();
          for (const side of [-1, 1]) {
            const f = blade(part.size, part.size * 0.55, part.color, opacity);
            f.position.copy(spine.point(u).add(new THREE.Vector3(0, -s.h * 0.3, side * s.w * 0.9)));
            f.rotation.set(side * 0.9, side * -0.6, Math.PI);
            g.add(f);
          }
          return g;
        }
      }
    }
  }
  return null;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
