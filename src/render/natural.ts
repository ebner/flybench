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
  // Where the body ends, front and rear, for laying it over a fly's hook.
  group.userData.head = spine.point(1);
  group.userData.rear = spine.point(0);
  const random = mulberry32(hash(n.id));
  const body = bodyMesh(n, spine, random);
  // Named, so the water can rest a body on the film.
  body.name = "body";
  group.add(body);
  const hairs = bodyHairs(n, spine, random);
  if (hairs) group.add(hairs);
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
      // Fibres' instance buffers go with the mesh's own dispose.
      if (o instanceof THREE.InstancedMesh) o.dispose();
      o.geometry.dispose();
      const materials = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of materials as (THREE.Material & { map?: THREE.Texture | null })[]) {
        m.map?.dispose();
        (m as THREE.Material & { normalMap?: THREE.Texture | null }).normalMap?.dispose();
        m.dispose();
      }
    }
  });
}

const color = (c: string) => new THREE.Color(resolveColor(c));

/** How the legs are held, from where the natural is found and its stage (or as a legs part says). */
type Pose = "stand" | "crawl" | "spread" | "drift" | "fold" | "forward" | "raised" | "rowing" | "jumping";

const POSES: Record<NonNullable<Extract<NaturalPart, { part: "legs" }>["pose"]>, Pose> = {
  stand: "stand",
  forward: "forward",
  raised: "raised",
  sprawl: "crawl",
  folded: "fold",
  rowing: "rowing",
  trailing: "drift",
  jumping: "jumping",
};

function poseOf(n: Natural): Pose {
  if (n.stage === "pupa") return "fold";
  // On its feet it stands; resting its body on the film, or spent, its legs lie spread on it.
  if (n.rides === "on-surface") return n.sits === "body" || n.sits === "spent" ? "spread" : "stand";
  if (n.rides === "in-film") return n.stage === "emerger" ? "drift" : "stand";
  if (n.rides === "crawling") return "crawl";
  return "drift";
}

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

  /** Where u falls in its section (0 rear end – 1 front end), and in the section's segment rings. */
  local(u: number) {
    const { start, end, s } = this.section(u);
    const t = (u - start) / Math.max(1e-6, end - start);
    return { t, ring: s.segments > 1 ? (t * s.segments) % 1 : -1, s };
  }

  /** Half heights (back `h`, belly `b`) and half width of the section holding u, before smoothing. */
  private raw(u: number): { h: number; b: number; w: number } {
    const { start, end, s } = this.section(u);
    const t = (u - start) / Math.max(1e-6, end - start);
    const egg = Math.sqrt(Math.max(0.12, 1 - (2 * t - 1) ** 2));
    const k = THREE.MathUtils.lerp(1, s.taper, t) * THREE.MathUtils.lerp(1, egg, s.round);
    const r = s.radius * k;
    const f = Math.sqrt(s.flatten);
    return { h: s.top !== undefined ? s.top * k : r * f, b: s.bottom !== undefined ? s.bottom * k : r * f, w: r / f };
  }

  /** The body's outline, sampled along it and smoothed: see `size`. */
  private outline: { h: number; b: number; w: number }[] | null = null;

  /**
   * Half height and half width of the body at u, rounded off at both ends. The sections' own
   * outlines are averaged over a window, so they flow into each other: a short one keeps an
   * insect's waists, a long one gives a fish its smooth shape.
   */
  size(u: number): { h: number; b: number; w: number } {
    if (!this.outline) {
      const n = 400;
      const raw = Array.from({ length: n + 1 }, (_, i) => this.raw(i / n));
      const half = Math.round((this.n.group === "baitfish" ? 0.09 : 0.012) * n);
      this.outline = raw.map((_, i) => {
        let h = 0;
        let b = 0;
        let w = 0;
        let weight = 0;
        for (let j = Math.max(0, i - half); j <= Math.min(n, i + half); j++) {
          const k = 1 - Math.abs(j - i) / (half + 1);
          h += raw[j]!.h * k;
          b += raw[j]!.b * k;
          w += raw[j]!.w * k;
          weight += k;
        }
        return { h: h / weight, b: b / weight, w: w / weight };
      });
    }
    const n = this.outline.length - 1;
    const x = Math.min(n, Math.max(0, u * n));
    const a = this.outline[Math.floor(x)]!;
    const b = this.outline[Math.min(n, Math.floor(x) + 1)]!;
    const f = x - Math.floor(x);
    const { ring } = this.local(u);
    // Segment plates: each ring's rear edge overlaps the next one behind it, as the plates
    // (tergites) of an insect's abdomen or a shrimp's shell do. A fish's segments only place marks.
    let k = ring >= 0 && this.n.group !== "baitfish" ? 0.95 + 0.07 * Math.min(1, (1 - ring) * 1.6) - 0.05 * Math.exp(-((ring - 0.02) ** 2) / 0.0015) : 1;
    // Rounded ends, over a length that grows with the radius there.
    const edge = Math.min(u, 1 - u);
    const tip = this.outline[u < 0.5 ? 0 : n]!;
    const cap = Math.max(0.03, Math.max(tip.h, tip.b, tip.w) * 0.9);
    if (edge < cap) k *= Math.sqrt(Math.max(0, 1 - ((cap - edge) / cap) ** 2));
    return { h: THREE.MathUtils.lerp(a.h, b.h, f) * k, b: THREE.MathUtils.lerp(a.b, b.b, f) * k, w: THREE.MathUtils.lerp(a.w, b.w, f) * k };
  }

  /** A point on the body's surface at u, `a` radians round from the back (π/2 towards +z). */
  surface(u: number, a: number, lift = 1): THREE.Vector3 {
    const { h, b, w } = this.size(u);
    const c = Math.cos(a);
    return this.point(u)
      .addScaledVector(this.up(u), c * (c >= 0 ? h : b) * lift)
      .add(new THREE.Vector3(0, 0, Math.sin(a) * w * lift));
  }

  /** The section named `name`, or the one that holds `fallback` of the body length. */
  named(name: string | undefined, fallback: number) {
    return this.sections.find((s) => s.s.section === name) ?? this.section(fallback);
  }
}

/** 0 at `from`, 1 at `to` (either way round), smooth in between: GLSL's smoothstep. */
function ramp(from: number, to: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

/** Smooth value noise in 3D, from a seeded lattice (mottling, wing flecks). */
function noise3(seed: number) {
  const lattice = (x: number, y: number, z: number) => {
    let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647) ^ seed;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const fade = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number, z: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const zi = Math.floor(z);
    const fx = fade(x - xi);
    const fy = fade(y - yi);
    const fz = fade(z - zi);
    let v = 0;
    for (let dx = 0; dx <= 1; dx++)
      for (let dy = 0; dy <= 1; dy++)
        for (let dz = 0; dz <= 1; dz++)
          v += lattice(xi + dx, yi + dy, zi + dz) * (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy) * (dz ? fz : 1 - fz);
    return v;
  };
}

type Mark = Extract<NaturalPart, { part: "mark" }>;

/** How strongly a mark of `kind` covers a point: `rs` 0–1 along its segment, `up`/`side` round the body. */
function markAt(kind: Mark["kind"], rs: number, u: number, up: number, side: number, noise: (x: number, y: number, z: number) => number): number {
  switch (kind) {
    case "bands":
      return ramp(0.55, 0.45, Math.abs(rs - 0.65)) * (up > -0.2 ? 1 : 0.3);
    case "spots":
      return ramp(0.75, 0.45, Math.hypot((rs - 0.5) * 2.2, (Math.abs(side) - 0.35) * 3.2) * (up > 0 ? 1 : 3));
    case "streaks":
      // A pair of dark streaks along each segment's back (Ephemera's).
      return Math.exp(-((Math.abs(side) - 0.38) ** 2) / 0.006) * ramp(0.05, 0.2, rs) * ramp(0.95, 0.8, rs) * (up > 0 ? 1 : 0);
    case "rows": {
      // Rows of small dots along the back (a beetle's wing cases): six rows each side.
      const row = Math.abs(side) * 6.8;
      const near = Math.abs(row - Math.round(row)) < 0.18 && Math.round(row) >= 1 && Math.round(row) <= 6;
      return near && up > 0 ? ramp(0.32, 0.18, Math.abs(((u * 70) % 1) - 0.5)) : 0;
    }
    case "ring":
      return ramp(0.35, 0.2, Math.abs(rs - 0.5));
    case "stripe":
      // Along the back's middle; with side=sides along the middle of each flank.
      return Math.exp(-(side * side) / 0.012) * (up > 0 ? 1 : 0);
    case "mottle":
      return ramp(0.48, 0.62, noise(u * 22, up * 3.5, side * 3.5) * 0.7 + noise(u * 60, up * 9, side * 9) * 0.3);
    case "patch":
      return ramp(0.6, 0.3, Math.hypot((rs - 0.5) * 2, side * 2.2)) * (up > 0 ? 1 : 0);
    case "bars":
      // Upright oval blotches along the flanks (a parr's marks), one to a segment.
      return ramp(0.62, 0.42, Math.hypot((rs - 0.5) * 2.2, up * 1.4)) * ramp(0.2, 0.45, Math.abs(side));
  }
}

/** Which side of the body a mark is on: 1 where it shows, 0 elsewhere (soft edges). */
function sideWeight(side: Mark["side"], up: number, across: number): number {
  switch (side) {
    case "top":
      return ramp(-0.25, 0.1, up);
    case "under":
      return ramp(0.25, -0.1, up);
    case "sides":
      return ramp(0.35, 0.6, Math.abs(across));
    case "all":
      return 1;
  }
}

/**
 * The body's colours and relief as textures over (u along the body, angle round it): back and
 * belly, the dark seams between segment plates, a pale line along the sides where they meet,
 * the markings (the sections' own and `mark` parts on chosen segments), and on a fish its
 * scales, lateral line, gill cover and mouth. The relief goes into a normal map.
 */
function bodyTextures(n: Natural, spine: Spine, random: () => number): { map: THREE.CanvasTexture; normal: THREE.CanvasTexture | null } | null {
  if (typeof document === "undefined") return null;
  const W = 1024;
  const H = 256;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const image = ctx.createImageData(W, H);
  const noise = noise3(Math.floor(random() * 1e9));
  const fish = n.group === "baitfish";
  const scales = n.parts.find((p): p is Extract<NaturalPart, { part: "scales" }> => p.part === "scales");
  const line = n.parts.find((p): p is Extract<NaturalPart, { part: "lateral-line" }> => p.part === "lateral-line");
  const gill = n.parts.find((p): p is Extract<NaturalPart, { part: "gill-cover" }> => p.part === "gill-cover");
  const mouth = n.parts.find((p): p is Extract<NaturalPart, { part: "mouth" }> => p.part === "mouth");
  const marks = n.parts.filter((p): p is Mark => p.part === "mark");
  // Scales and the lateral line only where the recipe gives them (a sculpin has neither scales nor, on a herring's body, a line).
  const scaleSize = scales?.size ?? 0;
  const heights = scaleSize > 0 ? new Float32Array(W * H) : null;
  const c = new THREE.Color();
  const cache = new Map<string, THREE.Color>();
  const cached = (s: string) => {
    let v = cache.get(s);
    if (!v) cache.set(s, (v = color(s)));
    return v;
  };
  // Where each mark part applies: its section's span of the body, its segments counted from the front.
  const spans = marks.flatMap((m) => {
    const sec = spine.sections.find((x) => x.s.section === m.section);
    if (!sec) return [];
    const count = Math.max(1, sec.s.segments);
    const r = m.segments.match(/^(\d+)(?:-(\d+))?$/);
    const [first, last] = r ? [Number(r[1]), Number(r[2] ?? r[1])] : [1, count];
    const length = sec.end - sec.start;
    if (m.at !== undefined) {
      // One mark, a segment's length (or a tenth of the section) round its centre.
      const w = length / Math.max(count, m.count ?? 10);
      const centre = sec.start + m.at * length;
      return [{ m, from: centre - w / 2, to: centre + w / 2, segment: w, ink: cached(m.color) }];
    }
    const from = sec.end - (last / count) * length;
    const to = sec.end - ((first - 1) / count) * length;
    return [{ m, from, to, segment: (to - from) / (m.count ?? last - first + 1), ink: cached(m.color) }];
  });
  for (let x = 0; x < W; x++) {
    const u = (x + 0.5) / W;
    const { ring, s } = spine.local(u);
    const top = cached(s.color);
    const belly = cached(s.belly ?? s.color);
    const ink = s.ink ? cached(s.ink) : null;
    const seam = ring >= 0 && !fish ? Math.exp(-((ring - 0.03) ** 2) / 0.0012) : 0;
    const segment = ring >= 0 ? Math.floor(((u - spine.section(u).start) / s.length) * s.segments) : 0;
    const { h, b, w } = spine.size(u);
    const girth = Math.PI * (Math.max(h, b) + w);
    for (let y = 0; y < H; y++) {
      const a = ((y + 0.5) / H) * Math.PI * 2;
      const up = Math.cos(a);
      const side = Math.sin(a);
      c.copy(top).lerp(belly, THREE.MathUtils.smoothstep(-up, 0.05, 0.75));
      // Plates darker towards their seams; the soft side membrane paler.
      if (ring >= 0 && !fish) c.multiplyScalar(1 - 0.35 * seam - 0.1 * (1 - ring));
      if (!fish && ring >= 0) c.lerp(belly, 0.25 * Math.exp(-(up * up) / 0.01));
      if (ink && s.marks !== "none") {
        let m = 0;
        switch (s.marks) {
          case "bands":
            m = ring >= 0 ? ramp(0.55, 0.45, Math.abs(ring - 0.65)) * (up > -0.2 ? 1 : 0.3) : (Math.sin(u * 60) > 0.3 ? 1 : 0) * 0.8;
            break;
          case "spots":
            // A pair of spots on each segment's back, or scattered spots on a fish.
            m = ring >= 0 ? markAt("spots", ring, u, up, side, noise) : ramp(0.72, 0.8, noise(u * 70, up * 8, side * 8 + segment)) * (up > -0.3 ? 1 : 0);
            break;
          case "mottle":
            m = markAt("mottle", 0, u, up, side, noise) * (up > -0.4 ? 1 : 0.2);
            break;
          case "stripe":
            m = fish ? Math.exp(-(up * up) / 0.012) : markAt("stripe", 0, u, up, side, noise);
            break;
        }
        c.lerp(ink, Math.min(1, m) * 0.85);
      }
      for (const span of spans) {
        if (u < span.from || u > span.to) continue;
        const rs = ((u - span.from) / span.segment + (span.m.offset ?? 0)) % 1;
        const m =
          span.m.kind === "stripe" && span.m.side !== "top"
            ? Math.exp(-((span.m.side === "under" ? up + 0.9 : up) ** 2) / 0.006) * (span.m.side === "under" ? 1 : ramp(0.3, 0.6, Math.abs(side)))
            : span.m.kind === "spots" && span.m.side === "sides"
              ? // A row of spots along the middle of each flank (a parr's red spots).
                ramp(0.7, 0.4, Math.hypot((rs - 0.5) * 2.2, up * 4)) * ramp(0.3, 0.6, Math.abs(side))
              : markAt(span.m.kind, rs, u, up, side, noise) * sideWeight(span.m.side, up, side);
        if (m > 0) c.lerp(span.ink, Math.min(1, m) * 0.9);
      }
      if (line) {
        // The lateral line along each flank.
        const near = Math.exp(-((up - line.height) ** 2) / 0.0008) * ramp(0.2, 0.5, Math.abs(side)) * ramp(0.95, 0.85, u);
        c.lerp(cached(line.color), near * 0.7);
      }
      if (gill && Math.abs(side) > 0.15) {
        // The gill cover's rear edge: a curved seam, the cover a little paler in front of it.
        const edge = gill.at + 0.03 * (1 - up * up);
        const d = u - edge;
        c.multiplyScalar(1 - 0.45 * Math.exp(-(d * d) / 0.00002));
        if (d > 0 && u < gill.at + 0.12 && up > -0.7) c.lerp(gill.color ? cached(gill.color) : c.clone().multiplyScalar(1.1), 0.08 * ramp(0, 0.03, d));
      }
      if (mouth && u > 1 - mouth.size) {
        // The mouth's line from the snout back along the head.
        const f = (1 - u) / mouth.size;
        const level = mouth.position === "superior" ? 0.35 - 0.3 * f : mouth.position === "inferior" ? -0.6 + 0.15 * f : 0.05 - 0.1 * f;
        c.multiplyScalar(1 - 0.7 * Math.exp(-((up - level) ** 2) / 0.003) * ramp(0.1, 0.3, Math.abs(side) + (mouth.position === "inferior" ? 0.3 : 0)));
      }
      const i = (y * W + x) * 4;
      if (heights) {
        // Scales: overlapping rows, each a little dome with a darker rear edge, finer round the girth.
        const su = u / scaleSize;
        const sv = ((a / (Math.PI * 2)) * girth) / scaleSize + (Math.floor(su) % 2) * 0.5;
        const fu = su % 1;
        const fv = sv % 1;
        const dome = Math.max(0, 1 - Math.hypot(fu - 0.6, (fv - 0.5) * 0.9) * 1.6);
        heights[y * W + x] = dome;
        c.multiplyScalar(0.96 + 0.07 * dome);
      }
      // Tiny grain, so plates don't read as plastic.
      const grain = 0.94 + 0.12 * random();
      image.data[i] = Math.min(255, c.r ** (1 / 2.2) * 255 * grain);
      image.data[i + 1] = Math.min(255, c.g ** (1 / 2.2) * 255 * grain);
      image.data[i + 2] = Math.min(255, c.b ** (1 / 2.2) * 255 * grain);
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  let normal: THREE.CanvasTexture | null = null;
  if (heights) {
    const nc = document.createElement("canvas");
    nc.width = W;
    nc.height = H;
    const nctx = nc.getContext("2d")!;
    const out = nctx.createImageData(W, H);
    const at = (x: number, y: number) => heights[((y + H) % H) * W + Math.min(W - 1, Math.max(0, x))]!;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const dx = (at(x + 1, y) - at(x - 1, y)) * 1.5;
        const dy = (at(x, y + 1) - at(x, y - 1)) * 1.5;
        const len = Math.hypot(dx, dy, 1);
        const i = (y * W + x) * 4;
        out.data[i] = (0.5 - (0.5 * dx) / len) * 255;
        out.data[i + 1] = (0.5 + (0.5 * dy) / len) * 255;
        out.data[i + 2] = (0.5 + 0.5 / len) * 255;
        out.data[i + 3] = 255;
      }
    }
    nctx.putImageData(out, 0, 0);
    normal = new THREE.CanvasTexture(nc);
    normal.anisotropy = 4;
  }
  return { map, normal };
}

function bodyMesh(n: Natural, spine: Spine, random: () => number): THREE.Mesh {
  const rings = 240;
  const around = 36;
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const c = new THREE.Color();
  for (let i = 0; i <= rings; i++) {
    const u = i / rings;
    const { s } = spine.local(u);
    const top = color(s.color);
    const belly = color(s.belly ?? s.color);
    for (let j = 0; j <= around; j++) {
      const a = (j / around) * Math.PI * 2;
      positions.push(...spine.surface(u, a).toArray());
      uvs.push(u, 1 - j / around);
      // Colours for when no texture can be made (outside a browser).
      c.copy(top).lerp(belly, THREE.MathUtils.smoothstep(-Math.cos(a), 0.15, 0.85));
      colors.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < around; j++) {
      const a = i * (around + 1) + j;
      const b = a + around + 1;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  const textures = bodyTextures(n, spine, random);
  if (!textures) g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const glass = Math.max(...n.body.map((s) => s.translucency));
  const fish = n.group === "baitfish";
  // Without scales a fish's skin is matte and slimy, not silvery.
  const shine = n.parts.find((p): p is Extract<NaturalPart, { part: "scales" }> => p.part === "scales")?.shine ?? 0;
  // Assumption: chitin has a waxy gloss; fish and leeches are wet and slick, fish more or less silvery.
  const m = new THREE.MeshPhysicalMaterial({
    map: textures?.map ?? null,
    normalMap: textures?.normal ?? null,
    normalScale: new THREE.Vector2(0.25, 0.25),
    vertexColors: !textures,
    roughness: fish ? 0.45 - 0.25 * shine : 0.5,
    metalness: fish ? 0.05 + 0.6 * shine : 0.02,
    clearcoat: fish ? 0.45 + 0.45 * shine : n.group === "leech" ? 0.9 : n.group === "crustacean" ? 0.7 : 0.45,
    clearcoatRoughness: 0.3,
    transparent: glass > 0,
    opacity: 1 - 0.45 * glass,
  });
  return new THREE.Mesh(g, m);
}

/** One instance per fibre: a thin cylinder from `from` along `dir` (unit length = `length`). */
type Fibre = { from: THREE.Vector3; dir: THREE.Vector3; length: number; radius: number; color: THREE.Color };

const fibreGeometry = () => new THREE.CylinderGeometry(0.5, 0.15, 1, 4, 1).translate(0, 0.5, 0);

function fibres(list: Fibre[], roughness = 0.8): THREE.InstancedMesh | null {
  if (list.length === 0) return null;
  const mesh = new THREE.InstancedMesh(fibreGeometry(), new THREE.MeshStandardMaterial({ roughness }), list.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const yAxis = new THREE.Vector3(0, 1, 0);
  list.forEach((f, i) => {
    q.setFromUnitVectors(yAxis, f.dir.clone().normalize());
    m.compose(f.from, q, new THREE.Vector3(f.radius * 2, f.length, f.radius * 2));
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, f.color);
  });
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

/** Fine hairs over the hairy sections, lying back along the body. */
function bodyHairs(n: Natural, spine: Spine, random: () => number): THREE.InstancedMesh | null {
  const list: Fibre[] = [];
  for (const { start, end, s } of spine.sections) {
    if (s.hairs <= 0) continue;
    const count = Math.round(900 * s.hairs * (end - start));
    const base = color(s.color).lerp(new THREE.Color(1, 0.95, 0.85), 0.15);
    for (let i = 0; i < count; i++) {
      const u = THREE.MathUtils.lerp(start, end, random());
      const a = random() * Math.PI * 2;
      const from = spine.surface(u, a, 0.97);
      const normal = spine.up(u).multiplyScalar(Math.cos(a)).add(new THREE.Vector3(0, 0, Math.sin(a))).normalize();
      // Assumption: setae lean back at about 50° from the surface.
      const dir = normal.multiplyScalar(0.65).addScaledVector(spine.tangent(u), -0.75).normalize();
      const r = spine.size(u);
      list.push({ from, dir, length: (0.25 + 0.5 * random()) * Math.max(r.h, r.w) * (0.6 + s.hairs), radius: 0.0016, color: base.clone().multiplyScalar(0.85 + 0.3 * random()) });
    }
  }
  return fibres(list);
}

/** A tube along a dense path with a radius and colour along it (legs, tails, antennae, tusks). */
function tube(path: THREE.Vector3[], radius: (t: number) => number, colour: (t: number) => THREE.Color, radial = 6): THREE.Mesh {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const count = path.length;
  let normal = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const prev = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    tangent.subVectors(path[Math.min(count - 1, i + 1)]!, path[Math.max(0, i - 1)]!).normalize();
    if (i === 0) {
      normal = Math.abs(tangent.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
      normal.addScaledVector(tangent, -normal.dot(tangent)).normalize();
    } else {
      // Parallel transport: turn the last normal by the change in direction.
      const q = new THREE.Quaternion().setFromUnitVectors(prev, tangent);
      normal.applyQuaternion(q);
    }
    prev.copy(tangent);
    const binormal = new THREE.Vector3().crossVectors(tangent, normal);
    const r = radius(t);
    const c = colour(t);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const p = path[i]!.clone().addScaledVector(normal, Math.cos(a) * r).addScaledVector(binormal, Math.sin(a) * r);
      positions.push(p.x, p.y, p.z);
      colors.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < count - 1; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b = a + radial + 1;
      // Wound so the faces point outwards (the ring runs from the normal towards tangent × normal).
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.45, clearcoat: 0.4, clearcoatRoughness: 0.4 }));
}

/** Points along a smooth curve through `points`. */
function smooth(points: THREE.Vector3[], samples = 24): THREE.Vector3[] {
  return new THREE.CatmullRomCurve3(points).getSpacedPoints(samples);
}

/** Points along straight segments between joints: an insect's leg bends at its joints. */
function jointed(points: THREE.Vector3[], perSegment = 8): { path: THREE.Vector3[]; at: number[] } {
  const path: THREE.Vector3[] = [];
  const at: number[] = [];
  const lengths = points.slice(1).map((p, i) => p.distanceTo(points[i]!));
  const total = lengths.reduce((a, b) => a + b, 0);
  let run = 0;
  for (let i = 0; i < points.length - 1; i++) {
    for (let k = i === 0 ? 0 : 1; k <= perSegment; k++) {
      const f = k / perSegment;
      path.push(points[i]!.clone().lerp(points[i + 1]!, f));
      at.push((run + lengths[i]! * f) / total);
    }
    run += lengths[i]!;
  }
  return { path, at };
}

/**
 * A strand that tapers to `tip` of its radius (tails, antennae). `rings`: as many darker joints
 * along it (banded tails, segmented antennae); `club`: the last part thickened (a beetle's antenna).
 */
function strand(points: THREE.Vector3[], radius: number, c: string, tip = 0.35, rings = 0, club = 0): THREE.Mesh {
  const base = color(c);
  const dark = base.clone().multiplyScalar(0.35);
  return tube(
    smooth(points, Math.max(24, rings * 4)),
    (t) => radius * THREE.MathUtils.lerp(1, tip, t) * (club > 0 && t > 1 - club ? 2.6 : 1),
    (t) => (rings > 0 && (t * rings) % 1 > 0.78 ? dark : base),
  );
}

/** Fine hairs along both sides of a path (fringed tails, swimming legs). */
function fringe(path: THREE.Vector3[], density: number, length: number, c: THREE.Color, random: () => number, side = new THREE.Vector3(0, 0, 1)): Fibre[] {
  const list: Fibre[] = [];
  const count = Math.round(40 * density);
  for (let i = 0; i < count; i++) {
    const f = 0.1 + 0.85 * (i / Math.max(1, count - 1));
    const k = Math.min(path.length - 2, Math.floor(f * (path.length - 1)));
    const along = path[k + 1]!.clone().sub(path[k]!).normalize();
    for (const s of [-1, 1]) {
      const out = side.clone().multiplyScalar(s).addScaledVector(along, -side.dot(along) * s);
      const dir = out.normalize().multiplyScalar(0.8).addScaledVector(along, 0.6).normalize();
      list.push({ from: path[k]!.clone(), dir, length: length * (0.7 + 0.5 * random()) * (1 - 0.4 * f), radius: 0.0012, color: c.clone().multiplyScalar(0.9 + 0.2 * random()) });
    }
  }
  return list;
}

type WingKind = "mayfly" | "caddis" | "stonefly" | "narrow";

function wingKind(n: Natural): WingKind {
  if (n.group === "mayfly") return "mayfly";
  if (n.group === "caddis") return "caddis";
  if (n.group === "stonefly" || n.group === "terrestrial") return "stonefly";
  return "narrow";
}

/** A wing's outline, length `l` along +x from the root and width `w`. */
function wingShape(kind: WingKind, l: number, w: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  switch (kind) {
    case "mayfly":
      // Triangular: a straight leading edge, a broad rounded trailing edge.
      s.bezierCurveTo(l * 0.25, w * 0.9, l * 0.85, w * 1.05, l, w * 0.35);
      s.bezierCurveTo(l * 1.02, w * 0.05, l * 0.6, -w * 0.05, 0, 0);
      break;
    case "caddis":
      // Long and narrow, broadening a little towards a rounded tip.
      s.bezierCurveTo(l * 0.3, w * 0.55, l * 0.75, w * 0.8, l * 0.97, w * 0.55);
      s.bezierCurveTo(l * 1.03, w * 0.3, l * 0.95, w * 0.02, l * 0.7, 0);
      s.lineTo(0, 0);
      break;
    case "stonefly":
      s.bezierCurveTo(l * 0.2, w * 0.45, l * 0.8, w * 0.6, l, w * 0.35);
      s.bezierCurveTo(l * 1.02, w * 0.1, l * 0.8, -w * 0.02, 0, 0);
      break;
    case "narrow":
      s.bezierCurveTo(l * 0.3, w * 0.5, l * 0.8, w * 0.6, l, w * 0.3);
      s.bezierCurveTo(l * 1.01, w * 0.05, l * 0.6, -w * 0.05, 0, 0);
      break;
  }
  return s;
}

/**
 * A wing's membrane as a texture: the family's venation (a mayfly's dense net of cross veins,
 * a stonefly's ladder, a caddis's few veins under a coat of hairs), darker flecks, and the
 * colour. Coordinates are the wing's own, normalised to its bounding box.
 */
function wingTexture(kind: WingKind, shape: THREE.Shape, l: number, w: number, base: THREE.Color, part: Extract<NaturalPart, { part: "wings" }>, random: () => number): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const px = (x: number, y: number): [number, number] => [(x / l) * size, (1 - (y + 0.1 * w) / (1.2 * w)) * size];
  ctx.fillStyle = `#${base.getHexString()}`;
  ctx.fillRect(0, 0, size, size);
  const edge = shape.getSpacedPoints(60);
  const vein = base.clone().multiplyScalar(0.35);
  ctx.strokeStyle = `#${vein.getHexString()}`;
  ctx.lineCap = "round";
  // Longitudinal veins: from the root fanning out to the edge.
  const ends = kind === "caddis" ? [8, 13, 18, 23, 28, 33] : kind === "mayfly" ? [4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34] : [6, 10, 14, 18, 22, 26, 30];
  const veins = ends.map((i) => edge[Math.min(edge.length - 1, i)]!);
  ctx.lineWidth = kind === "caddis" ? 2.2 : 2.8;
  for (const p of veins) {
    ctx.beginPath();
    ctx.moveTo(...px(0, 0));
    ctx.quadraticCurveTo(...px(p.x * 0.45, p.y * 0.25), ...px(p.x * 0.97, p.y * 0.97));
    ctx.stroke();
  }
  // Cross veins between neighbouring longitudinal veins.
  const cross = kind === "mayfly" ? 22 : kind === "stonefly" ? 9 : kind === "caddis" ? 2 : 1;
  ctx.lineWidth = 1.1;
  for (let v = 0; v + 1 < veins.length; v++) {
    for (let k = 0; k < cross; k++) {
      const t = 0.2 + 0.75 * random();
      const along = (p: THREE.Vector2, f: number): [number, number] => {
        // On the quadratic from the root through (0.45, 0.25) of the end point.
        const mx = p.x * 0.45;
        const my = p.y * 0.25;
        const x = 2 * (1 - f) * f * mx + f * f * p.x * 0.97;
        const y = 2 * (1 - f) * f * my + f * f * p.y * 0.97;
        return px(x, y);
      };
      ctx.beginPath();
      ctx.moveTo(...along(veins[v]!, t));
      ctx.lineTo(...along(veins[v + 1]!, t + (random() - 0.5) * 0.06));
      ctx.stroke();
    }
  }
  if (part.mottle) {
    const fleck = color(part.mottle);
    ctx.fillStyle = `#${fleck.getHexString()}`;
    for (let i = 0; i < 70; i++) {
      ctx.globalAlpha = 0.25 + 0.35 * random();
      ctx.beginPath();
      ctx.ellipse(random() * size, random() * size, 4 + 12 * random(), 3 + 8 * random(), random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  if (part.hairs > 0) {
    // A coat of fine hairs: short strokes lying towards the tip, lighter and darker.
    for (let i = 0; i < 5000 * part.hairs; i++) {
      const x = random() * size;
      const y = random() * size;
      const shade = base.clone().multiplyScalar(0.7 + 0.6 * random());
      ctx.strokeStyle = `#${shade.getHexString()}`;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 3 + 3 * random(), y + (random() - 0.5) * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** A wing: the family's outline, its venation as a texture, translucent as its clarity says. */
function wing(n: Natural, part: Extract<NaturalPart, { part: "wings" }>, l: number, w: number, random: () => number): THREE.Mesh {
  const kind = wingKind(n);
  const shape = wingShape(kind, l, w);
  const g = new THREE.ShapeGeometry(shape, 24);
  // Texture coordinates from the wing's own frame (ShapeGeometry's are raw coordinates).
  const pos = g.getAttribute("position");
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[2 * i] = pos.getX(i) / l;
    uv[2 * i + 1] = (pos.getY(i) + 0.1 * w) / (1.2 * w);
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  const base = color(part.color);
  const map = wingTexture(kind, shape, l, w, base, part, random);
  // Haired wings let little light through.
  const opacity = Math.min(1, 1 - 0.75 * part.clarity + 0.35 * part.hairs);
  const m = new THREE.MeshPhysicalMaterial({
    map,
    color: map ? 0xffffff : base,
    roughness: 0.35 + 0.5 * part.hairs,
    side: THREE.DoubleSide,
    transparent: opacity < 1,
    opacity,
    depthWrite: opacity >= 1,
    // Assumption: bare membranes show a faint thin-film shimmer; haired ones don't.
    iridescence: part.hairs > 0.3 ? 0 : 0.5,
    iridescenceIOR: 1.35,
    iridescenceThicknessRange: [250, 600],
  });
  return new THREE.Mesh(g, m);
}

/** A flat leaf shape (gill, fin, leaf-like tail) of length `l` along +x and width `w`, as a double-sided mesh. */
function blade(l: number, w: number, c: string, opacity: number, kind: "leaf" | "fork" = "leaf", banded = false): THREE.Mesh {
  const s = new THREE.Shape();
  if (kind === "fork") {
    s.moveTo(0, -w * 0.15);
    s.quadraticCurveTo(l * 0.6, -w * 0.25, l, -w * 0.5);
    s.lineTo(l * 0.75, 0);
    s.lineTo(l, w * 0.5);
    s.quadraticCurveTo(l * 0.6, w * 0.25, 0, w * 0.15);
  } else {
    s.moveTo(0, 0);
    s.bezierCurveTo(l * 0.3, w * 0.6, l * 0.75, w * 0.6, l, 0);
    s.bezierCurveTo(l * 0.75, -w * 0.6, l * 0.3, -w * 0.6, 0, 0);
  }
  const g = new THREE.ShapeGeometry(s, 16);
  if (banded) {
    // Dark bands across it, a third of the way along and near the tip.
    const pos = g.getAttribute("position");
    const cols = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const f = pos.getX(i) / l;
      const k = Math.abs(f - 0.35) < 0.08 || Math.abs(f - 0.75) < 0.08 ? 0.35 : 1;
      cols.set([k, k, k], i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  }
  const m = new THREE.MeshPhysicalMaterial({
    color: color(c),
    vertexColors: banded,
    roughness: 0.5,
    side: THREE.DoubleSide,
    transparent: opacity < 1,
    opacity,
    depthWrite: opacity >= 1,
  });
  return new THREE.Mesh(g, m);
}

/**
 * One leg from its base: thigh (femur), shin (tibia) and foot (tarsus), held as the pose says.
 * `lean` runs from −1 (the hind pair, reaching back) to 1 (the front pair, reaching forward).
 */
function leg(part: Extract<NaturalPart, { part: "legs" }>, n: Natural, pose: Pose, base: THREE.Vector3, side: number, L: number, lean: number, front: boolean, hind: boolean, random: () => number): THREE.Object3D {
  const lf = L * part.femur;
  const lt = L * part.tibia;
  const ls = L * Math.max(0.1, 1 - part.femur - part.tibia);
  const jumping = pose === "jumping" || (hind && !part.pose && (part.hind ?? 1) > 1.4);
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z * side).normalize();
  let df: THREE.Vector3;
  let dt: THREE.Vector3;
  let ds: THREE.Vector3;
  if (pose === "forward" || (pose === "stand" && !part.pair && front && (n.group === "mayfly" || n.group === "chironomid"))) {
    // Held forward, off the water (a mayfly's or a midge's front legs).
    df = v(0.6, 0.55, 0.45);
    dt = v(0.9, 0.25, 0.2);
    ds = v(0.95, -0.15, 0.1);
  } else if (pose === "raised") {
    // Raised high in front, like feelers (a midge's front legs at rest).
    df = v(0.45, 0.85, 0.35);
    dt = v(0.75, 0.6, 0.15);
    ds = v(0.8, 0.45, 0.05);
  } else if (pose === "rowing") {
    // Rowing legs held out to the sides (a caddis pupa's middle legs).
    df = v(-0.1, -0.15, 1);
    dt = v(-0.35, -0.2, 0.9);
    ds = v(-0.6, -0.1, 0.5);
  } else if (jumping) {
    // A grasshopper's hind leg: the thick thigh along the body, its knee near the tip of the
    // abdomen, the shin folded forward under it, the foot back on the ground.
    df = v(-0.95, 0.22, 0.25);
    dt = v(0.8, -0.55, 0.08);
    ds = v(-0.85, -0.25, 0.3);
  } else if (pose === "stand") {
    // Standing on the film: thighs out to the sides, shins angled down, feet flat on it, so the
    // body stays low over the water.
    // Assumption: from photos of duns and midges on the water.
    df = v(lean * 0.45, 0.15, 0.95);
    dt = v(lean * 0.45, -0.7, 0.65);
    ds = v(lean * 0.8, -0.08, 0.6);
  } else if (pose === "spread") {
    // Its body on the film, the legs lie spread out on it, the feet about level with the belly.
    // Assumption: from photos of caddis, stoneflies and spent spinners on the water.
    df = v(lean * 0.5, 0.05, 1);
    dt = v(lean * 0.6, -0.15, 0.95);
    ds = v(lean * 0.8, -0.04, 0.6);
  } else if (pose === "crawl") {
    df = v(lean * 0.55, 0.12, 1);
    dt = v(lean * 0.6, -0.45, 0.75);
    ds = v(lean * 0.8, -0.08, 0.35);
  } else if (pose === "fold") {
    if (part.hairs > 0) {
      // Rowing legs held out to the sides (a caddis pupa's middle legs).
      df = v(-0.1, -0.15, 1);
      dt = v(-0.35, -0.2, 0.9);
      ds = v(-0.6, -0.1, 0.5);
    } else {
      df = v(-0.35, -0.6, 0.45);
      dt = v(-1, -0.12, 0.12);
      ds = v(-1, -0.02, 0.05);
    }
  } else {
    // Drifting: relaxed, the shins trailing back.
    df = v(lean * 0.35 - 0.15, -0.15, 0.85);
    dt = v(lean * 0.2 - 0.55, -0.5, 0.45);
    ds = v(-0.75, -0.25, 0.2);
  }
  // A little variety between legs, from the seeded random.
  const jitter = () => (random() - 0.5) * 0.12;
  df.add(new THREE.Vector3(jitter(), jitter(), jitter())).normalize();
  dt.add(new THREE.Vector3(jitter(), jitter(), jitter())).normalize();
  const knee = base.clone().addScaledVector(df, lf);
  const ankle = knee.clone().addScaledVector(dt, lt);
  const foot = ankle.clone().addScaledVector(ds, ls);
  const { path, at } = jointed([base, knee, ankle, foot]);
  const kf = part.femur;
  const kt = part.femur + part.tibia;
  // Assumption: thigh about a twelfth of the leg's length across (a grasshopper's jumping thigh twice that).
  // A long leg is no stouter than a short one: capped at a usual leg's length.
  const thick = Math.min(part.length, 0.6) * 0.04 * (jumping ? 2 : 1) * part.thick;
  const light = color(part.color);
  const dark = light.clone().multiplyScalar(0.22);
  const mesh = tube(
    path,
    (t) => {
      const u = at[Math.round(t * (at.length - 1))]!;
      if (u < kf) return thick * (0.75 + 0.45 * Math.sin(Math.PI * Math.min(1, u / kf)));
      if (u < kt) return thick * 0.62;
      return thick * THREE.MathUtils.lerp(0.45, 0.25, (u - kt) / (1 - kt));
    },
    (t) => {
      const u = at[Math.round(t * (at.length - 1))]!;
      if (!part.banded) return u > kt ? light.clone().multiplyScalar(0.8) : light;
      // Dark bands at the far end of each segment.
      const local = u < kf ? u / kf : u < kt ? (u - kf) / part.tibia : (u - kt) / (1 - kt);
      return local > 0.62 && local < 0.9 ? dark : light;
    },
  );
  const g = new THREE.Group();
  g.add(mesh);
  // Knees: small rounded joints.
  for (const [p, r] of [[knee, thick * 0.66], [ankle, thick * 0.47]] as const) {
    const j = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), (mesh.material as THREE.Material).clone());
    (j.material as THREE.MeshPhysicalMaterial).vertexColors = false;
    (j.material as THREE.MeshPhysicalMaterial).color = part.banded ? dark : light;
    j.position.copy(p);
    g.add(j);
  }
  // The foot's joints, and its pair of claws.
  for (let k = 1; k < part.tarsi; k++) {
    const j = new THREE.Mesh(new THREE.SphereGeometry(thick * 0.3, 6, 4), new THREE.MeshPhysicalMaterial({ color: light.clone().multiplyScalar(0.6), roughness: 0.4 }));
    j.position.copy(ankle).lerp(foot, k / part.tarsi);
    g.add(j);
  }
  if (part.claws) {
    for (const turn of [-0.5, 0.5]) {
      const out = ds.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), turn).multiplyScalar(ls * 0.12);
      const pts = [foot, foot.clone().add(out), foot.clone().add(out).add(new THREE.Vector3(0, -ls * 0.06, 0))];
      g.add(tube(smooth(pts, 6), (t) => thick * 0.22 * (1 - 0.7 * t), () => dark));
    }
  }
  if (part.hairs > 0) {
    const shin = jointed([knee, ankle, foot]).path;
    const hairs = fibres(fringe(shin, part.hairs, L * 0.18, light.clone().lerp(new THREE.Color(1, 1, 1), 0.2), random, new THREE.Vector3(0, 1, 0)));
    if (hairs) g.add(hairs);
  }
  return g;
}

type Fin = Extract<NaturalPart, { part: "fin" }>;

/**
 * A fin as a flat shape in its own plane: x along the body (negative towards the tail), y away
 * from the body; `base` along the body, `height` out from it. Its rays and spines are painted on
 * a texture whose clear parts let the water through.
 */
function finMesh(part: Fin, kind: "median" | "tail" | "paddle"): THREE.Object3D {
  const base = part.base ?? part.size ?? 0.1;
  const height = part.height ?? part.size ?? 0.1;
  const shape = part.shape ?? (kind === "tail" ? "forked" : kind === "paddle" ? "rounded" : "pointed");
  const s = new THREE.Shape();
  let rays: { from: [number, number]; to: [number, number] }[] = [];
  // Assumption: without a count, about 8 rays, more on a longer fin. None: a fleshy fin (an adipose).
  const count = part.rays ?? Math.round(8 + 20 * Math.min(1, base / 0.2));
  if (kind === "tail") {
    // From the root (base deep) back to the trailing edge, spread wider.
    const spread = Math.max(base * 1.6, height * 1.1);
    const notch = shape === "forked" ? 0.55 : shape === "emarginate" ? 0.85 : 1;
    s.moveTo(0, -base / 2);
    s.quadraticCurveTo(-height * 0.5, -spread * 0.35, -height, -spread / 2);
    if (shape === "rounded") s.quadraticCurveTo(-height * 1.25, 0, -height, spread / 2);
    else s.lineTo(-height * notch, 0), s.lineTo(-height, spread / 2);
    s.quadraticCurveTo(-height * 0.5, spread * 0.35, 0, base / 2);
    s.lineTo(0, -base / 2);
    rays = Array.from({ length: count }, (_, i) => {
      const f = count === 1 ? 0 : i / (count - 1) - 0.5;
      const end = shape === "rounded" ? -height * (1.0 + 0.2 * Math.cos(Math.PI * f)) : -height * (notch + (1 - notch) * Math.abs(f) * 2);
      return { from: [0, f * base * 0.9], to: [end, f * spread * 0.98] };
    });
  } else if (kind === "paddle") {
    // A paired fin, from a short root out and back: rounded (a fan), pointed (a blade) or square-ended.
    s.moveTo(0, 0);
    if (shape === "pointed") {
      s.bezierCurveTo(-height * 0.3, base * 0.55, -height * 0.75, base * 0.35, -height, base * 0.05);
      s.bezierCurveTo(-height * 0.7, -base * 0.12, -height * 0.4, -base * 0.22, 0, -base * 0.2);
    } else if (shape === "truncate" || shape === "emarginate") {
      s.lineTo(-height * 0.15, base * 0.55);
      s.lineTo(-height, base * 0.5);
      s.lineTo(-height, -base * 0.05);
      s.lineTo(0, -base * 0.2);
    } else {
      s.bezierCurveTo(-height * 0.2, base * 0.7, -height * 0.85, base * 0.75, -height, base * 0.25);
      s.bezierCurveTo(-height * 1.02, 0, -height * 0.6, -base * 0.25, 0, -base * 0.2);
    }
    s.lineTo(0, 0);
    rays = Array.from({ length: count }, (_, i) => {
      const f = count === 1 ? 0.5 : i / (count - 1);
      return { from: [0, -base * 0.15 + base * 0.15 * f], to: [-height * (0.75 + 0.25 * Math.sin(Math.PI * f)), -base * 0.2 + base * 0.7 * f] };
    });
  } else {
    // Along the back or the belly: the front rays tallest (pointed), even (truncate) or arched (rounded).
    const front = shape === "rounded" ? 0.7 : 1;
    const rear = shape === "truncate" ? 0.85 : shape === "rounded" ? 0.6 : 0.35;
    s.moveTo(0, 0);
    s.lineTo(-base * 0.05, height * front);
    if (shape === "rounded") s.quadraticCurveTo(-base * 0.5, height * 1.25, -base, height * rear);
    else s.quadraticCurveTo(-base * 0.45, height * (front + rear) * 0.48, -base, height * rear);
    s.lineTo(-base * 1.08, 0);
    s.lineTo(0, 0);
    rays = Array.from({ length: count }, (_, i) => {
      const f = count === 1 ? 0 : i / (count - 1);
      const tip = shape === "rounded" ? front + (1.1 - front) * Math.sin(Math.PI * f) - (front - rear) * f * f : front + (rear - front) * f;
      return { from: [-base * 1.04 * f, 0], to: [-base * (0.05 + 0.95 * f), height * tip * 0.98] };
    });
  }
  const g = new THREE.ShapeGeometry(s, 24);
  g.computeBoundingBox();
  const box = g.boundingBox!;
  const span = box.getSize(new THREE.Vector3());
  // Spines stand a little proud of the membrane.
  const spined = rays.map((r, i) => (i < part.spines ? { from: r.from, to: [r.to[0], r.to[1] * 1.12] as [number, number] } : r));
  const pos = g.getAttribute("position");
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[2 * i] = (pos.getX(i) - box.min.x) / span.x;
    uv[2 * i + 1] = (pos.getY(i) - box.min.y) / span.y;
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  const base3 = color(part.color);
  let map: THREE.CanvasTexture | null = null;
  if (typeof document !== "undefined") {
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const px = (x: number, y: number): [number, number] => [((x - box.min.x) / span.x) * size, (1 - (y - box.min.y) / span.y) * size];
      const css = (c: THREE.Color, a: number) => `rgba(${Math.round(c.r ** (1 / 2.2) * 255)},${Math.round(c.g ** (1 / 2.2) * 255)},${Math.round(c.b ** (1 / 2.2) * 255)},${a})`;
      // Fully clear: free spines with next to no membrane between them (a stickleback's).
      ctx.fillStyle = css(base3, 1 - 0.7 * part.clarity - 0.28 * part.clarity ** 4);
      ctx.fillRect(0, 0, size, size);
      ctx.lineCap = "round";
      spined.forEach((r, i) => {
        const spine = i < part.spines;
        ctx.strokeStyle = css(base3.clone().multiplyScalar(spine ? 0.45 : 0.6), 1);
        ctx.lineWidth = spine ? 5 : 2.2;
        ctx.beginPath();
        ctx.moveTo(...px(...r.from));
        ctx.lineTo(...px(...r.to));
        ctx.stroke();
        // Soft rays branch near their tips.
        if (!spine && kind !== "paddle") {
          const mid: [number, number] = [r.from[0] + (r.to[0] - r.from[0]) * 0.7, r.from[1] + (r.to[1] - r.from[1]) * 0.7];
          ctx.lineWidth = 1.2;
          for (const d of [-0.012, 0.012]) {
            ctx.beginPath();
            ctx.moveTo(...px(...mid));
            ctx.lineTo(...px(r.to[0] + d * span.x, r.to[1] + d * span.y));
            ctx.stroke();
          }
        }
      });
      map = new THREE.CanvasTexture(canvas);
      map.colorSpace = THREE.SRGBColorSpace;
    }
  }
  const m = new THREE.MeshPhysicalMaterial({
    map,
    color: map ? 0xffffff : base3,
    roughness: 0.4,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: map ? 1 : 1 - 0.6 * part.clarity,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(g, m);
  if (part.spines === 0) return mesh;
  // Spines as stiff rods of their own, standing proud of the membrane (a stickleback's are free).
  const fin = new THREE.Group();
  fin.add(mesh);
  const dark = base3.clone().multiplyScalar(0.5);
  for (const r of spined.slice(0, part.spines)) {
    const from = new THREE.Vector3(r.from[0], r.from[1], 0);
    const to = new THREE.Vector3(r.to[0], r.to[1], 0);
    const thick = Math.max(0.002, height * 0.035);
    fin.add(tube([from, from.clone().lerp(to, 0.5), to], (t) => thick * (1 - 0.85 * t), () => dark, 5));
  }
  return fin;
}

/** Shifts a fin's points up or down by `rise(x)` for their place along the body, so a long fin's base follows a tapering body. */
function conform(fin: THREE.Object3D, rise: (x: number) => number) {
  fin.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const pos = o.geometry.getAttribute("position");
    for (let i = 0; i < pos.count; i++) pos.setY(i, pos.getY(i) + rise(pos.getX(i)));
    pos.needsUpdate = true;
    o.geometry.computeVertexNormals();
    o.geometry.computeBoundingBox();
    o.geometry.computeBoundingSphere();
  });
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
      const list: Fibre[] = [];
      for (let i = 0; i < part.count; i++) {
        const spread = part.count === 1 ? 0 : THREE.MathUtils.degToRad(part.spread) * (i / (part.count - 1) - 0.5);
        const dir = spine.tangent(0).negate().applyAxisAngle(new THREE.Vector3(0, 1, 0), spread);
        const length = part.length * (part.count === 3 && i === 1 ? part.middle : 1);
        if (part.leaf) {
          const leaf = blade(length, length * 0.3, part.color, 0.8, "leaf", part.banded);
          leaf.position.copy(base);
          leaf.rotation.set(Math.PI / 2, 0, Math.PI + spine.heading(0) - spread);
          g.add(leaf);
          // A fringe of long hairs round the leaf (a midge pupa's swimming fan).
          if (part.hairs > 0) list.push(...fringe(smooth([base, base.clone().addScaledVector(dir, length)], 12), part.hairs, length * 0.35, color(part.color), random, new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), spread)));
          continue;
        }
        const pts = [0, 0.33, 0.66, 1].map((f) =>
          base.clone().addScaledVector(dir, length * f).add(new THREE.Vector3(0, 0.08 * length * f * f, 0)),
        );
        g.add(strand(pts, 0.006, part.color, 0.3, part.banded ? 9 : 0));
        if (part.hairs > 0) list.push(...fringe(smooth(pts, 30), part.hairs, length * 0.12, color(part.color), random, new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), spread)));
      }
      const hairs = fibres(list);
      if (hairs) g.add(hairs);
      return g;
    }
    case "antennae": {
      const g = new THREE.Group();
      // A second pair (a shrimp's) below the first and spreading lower.
      const second = n.parts.filter((p) => p.part === "antennae").indexOf(part) > 0;
      const base = second ? spine.point((head.start + head.end) / 2 + 0.03).addScaledVector(spine.up(head.end), -spine.size(head.end).b * 0.4) : top((head.start + head.end) / 2 + 0.02, 0.6);
      const rings = part.segments ?? (part.banded ? 12 : 0);
      const list: Fibre[] = [];
      for (const side of [-1, 1]) {
        let pts: THREE.Vector3[];
        if (part.shape === "elbowed") {
          // A long first segment (the scape) up and out, then the rest bent forward.
          const elbow = base.clone().add(new THREE.Vector3(part.length * 0.12, part.length * 0.28, side * part.length * 0.12));
          pts = [base, elbow, elbow.clone().add(new THREE.Vector3(part.length * 0.35, part.length * 0.02, side * part.length * 0.15)), elbow.clone().add(new THREE.Vector3(part.length * 0.62, -part.length * 0.06, side * part.length * 0.22))];
        } else {
          pts = [0, 0.33, 0.66, 1].map((f) =>
            part.swept
              ? base.clone().add(new THREE.Vector3(-part.length * f * 0.95, part.length * 0.06 * Math.sin(Math.PI * f), side * (0.03 + 0.05 * f)))
              : base.clone().add(new THREE.Vector3(part.length * f * 0.9, part.length * f * (second ? -0.1 : 0.35 - 0.25 * f), side * part.length * f * (second ? 0.4 : 0.25))),
          );
        }
        // Assumption: a club the last quarter, three times as thick.
        g.add(strand(pts, 0.004, part.color, 0.3, rings, part.shape === "clubbed" ? 0.25 : 0));
        // A male midge's feathery plumes: whorls of long hairs all along.
        if (part.shape === "plumed") list.push(...fringe(smooth(pts, 40), 1, part.length * 0.3, color(part.color), random, new THREE.Vector3(0, 1, 0)), ...fringe(smooth(pts, 40), 1, part.length * 0.3, color(part.color), random, new THREE.Vector3(0, 0, 1)));
      }
      const plumes = fibres(list);
      if (plumes) g.add(plumes);
      return g;
    }
    case "legs": {
      const g = new THREE.Group();
      const where = part.at ? spine.named(part.at, 0.7) : thorax;
      // One pair of an insect's three (hind, mid, fore from the rear), or all of them; a pair
      // with an entry of its own is left out of an all-pairs entry.
      const pairs = part.pair ? 3 : Math.max(1, Math.round((part.count ?? 6) / 2));
      const own = new Set(n.parts.flatMap((p) => (p.part === "legs" && p.pair && (p.at ?? "thorax") === (part.at ?? "thorax") ? [p.pair] : [])));
      const names = ["hind", "mid", "fore"] as const;
      const pose = part.pose ? POSES[part.pose] : poseOf(n);
      for (let i = 0; i < pairs; i++) {
        if (part.pair ? names[i] !== part.pair : pairs === 3 && own.has(names[i]!)) continue;
        const u = THREE.MathUtils.lerp(where.start + 0.15 * (where.end - where.start), where.end - 0.1 * (where.end - where.start), pairs === 1 ? 0.5 : i / (pairs - 1));
        const hind = i === 0 && pairs >= 3;
        const L = part.length * (hind && !part.pair ? (part.hind ?? 1) : 1);
        // Front legs reach forward, the rest back.
        const lean = pairs === 1 ? 0 : THREE.MathUtils.lerp(-1, 1, i / (pairs - 1));
        for (const side of [-1, 1]) {
          const base = spine.surface(u, side * Math.PI * 0.62, 0.92);
          g.add(leg(part, n, pose, base, side, L, lean, i === pairs - 1 && pairs >= 3, hind, random));
        }
      }
      return g;
    }
    case "wings": {
      const g = new THREE.Group();
      const u = (thorax.start + thorax.end) / 2;
      const root = top(u, 0.85);
      const pairs = part.count === 4 || part.hind > 0 ? 2 : 1;
      for (let pair = 0; pair < pairs; pair++) {
        const scale = pair === 0 ? 1 : part.hind > 0 ? part.hind : 0.55;
        for (const side of [-1, 1]) {
          const w = wing(n, part, part.length * scale, part.width * scale, random);
          w.position.copy(root);
          switch (part.shape) {
            case "upright":
              // Standing up from the thorax, leaning back a little (`angle`), the pair just apart.
              w.rotation.set(0, side * 0.08, Math.PI / 2 + THREE.MathUtils.degToRad(part.angle ?? 14) + (pair === 1 ? 0.45 : 0));
              if (pair === 1) w.position.x -= 0.02;
              break;
            case "tent":
            case "flat": {
              // A roof over the abdomen from the ridge down each side (`angle` its slope; a
              // stonefly's flat wings nearly level, curving round the body), reaching past it.
              const slope = THREE.MathUtils.degToRad(part.angle ?? (part.shape === "tent" ? 31 : 12));
              w.rotation.set(-side * (Math.PI / 2 - slope), 0, Math.PI + spine.heading(u));
              break;
            }
            case "back":
              w.rotation.set(side * 0.25, side * 0.15, Math.PI - 0.05);
              break;
            case "spent":
              w.rotation.set(Math.PI / 2, 0, (Math.PI / 2) * side * -1 + (pair === 1 ? side * 0.35 : 0));
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
      const c = color(part.color);
      const list: Fibre[] = [];
      for (let i = 0; i < part.count; i++) {
        const f = part.count === 1 ? 0.5 : i / (part.count - 1);
        if (part.shape === "tuft" && n.group === "stonefly") {
          // Tufts at the bases of the legs, under the thorax.
          const u = THREE.MathUtils.lerp(thorax.start + 0.15 * (thorax.end - thorax.start), thorax.end - 0.1 * (thorax.end - thorax.start), f);
          for (const side of [-1, 1]) {
            const from = spine.surface(u, side * Math.PI * 0.75, 0.95);
            for (let k = 0; k < 14; k++) {
              const dir = new THREE.Vector3((random() - 0.5) * 0.6, -0.6 - 0.4 * random(), side * (0.5 + 0.5 * random()));
              list.push({ from, dir, length: part.length * (0.6 + 0.6 * random()), radius: 0.0018, color: c.clone().multiplyScalar(0.9 + 0.25 * random()) });
            }
          }
          continue;
        }
        const u = THREE.MathUtils.lerp(abdomen.start + 0.1 * (abdomen.end - abdomen.start), abdomen.end - 0.1 * (abdomen.end - abdomen.start), f);
        for (const side of [-1, 1]) {
          if (part.shape === "plate") {
            const leaf = blade(part.length, part.length * 0.6, part.color, 0.75, "leaf", part.banded);
            leaf.position.copy(spine.point(u).add(new THREE.Vector3(0, spine.size(u).h * 0.3, side * spine.size(u).w * 0.9)));
            leaf.rotation.set(Math.PI / 2, 0, side * (Math.PI / 2 + 0.6));
            g.add(leaf);
          } else if (part.shape === "feather") {
            // A feathery plume held up over the back and curving back (a burrowing nymph's).
            const from = spine.surface(u, side * Math.PI * 0.3, 0.95);
            const pts = [0, 0.5, 1].map((k) => from.clone().add(new THREE.Vector3(-part.length * 0.55 * k, part.length * (0.75 * k - 0.25 * k * k), side * part.length * 0.25 * k)));
            const path = smooth(pts, 16);
            g.add(tube(path, (t) => 0.003 * (1 - 0.6 * t), () => c));
            list.push(...fringe(path, 0.9, part.length * 0.28, c, random, new THREE.Vector3(0, 0, side).normalize()));
          } else {
            // Tufts of filaments along the sides (a free-living caddis larva's).
            const from = spine.surface(u, side * Math.PI * 0.55, 0.95);
            for (let k = 0; k < 8; k++) {
              const dir = new THREE.Vector3((random() - 0.5) * 0.8, (random() - 0.4) * 0.6, side * (0.6 + 0.4 * random()));
              list.push({ from, dir, length: part.length * (0.6 + 0.6 * random()), radius: 0.0016, color: c.clone().multiplyScalar(0.9 + 0.25 * random()) });
            }
          }
        }
      }
      const tufts = fibres(list, 0.7);
      if (tufts) g.add(tufts);
      return g;
    }
    case "tusks": {
      // Curving forward and out from the front of the head, tips turned up.
      const g = new THREE.Group();
      const c = color(part.color);
      const u = head.end - 0.02;
      for (const side of [-1, 1]) {
        const from = spine.surface(u, side * Math.PI * 0.4, 0.8);
        const pts = [0, 0.5, 1].map((k) => from.clone().add(new THREE.Vector3(part.length * k, part.length * 0.25 * k * k, side * part.length * (0.3 * k - 0.15 * k * k))));
        g.add(tube(smooth(pts, 16), (t) => 0.008 * (1 - 0.7 * t), () => c));
      }
      return g;
    }
    case "wingpads": {
      if (n.stage === "pupa") {
        // A pupa's wing sheaths lie along its sides and underneath, from the thorax back.
        const g = new THREE.Group();
        const u = thorax.start + 0.02 - part.length / 2;
        const s = spine.size(Math.max(0, u));
        for (const side of [-1, 1]) {
          const sheath = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), new THREE.MeshPhysicalMaterial({ color: color(part.color), roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.25 }));
          sheath.scale.set(part.length / 2, s.b * 0.55, s.w * 0.3);
          sheath.position.copy(spine.surface(Math.max(0, u), side * Math.PI * 0.7, 0.9));
          sheath.rotation.z = spine.heading(Math.max(0, u)) + 0.18;
          g.add(sheath);
        }
        return g;
      }
      const u = thorax.end - part.length / 2;
      const s = spine.size(u);
      const pad = new THREE.Mesh(
        new THREE.SphereGeometry(1, 20, 12),
        new THREE.MeshPhysicalMaterial({ color: color(part.color), roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.25 }),
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
      // Open at the front of the abdomen; a case longer than that reaches back past the body.
      const front = Math.max(part.length, abdomen.end);
      for (let i = 0; i <= rings; i++) {
        const u = front - part.length + (i / rings) * part.length;
        const p = u < 0 ? spine.point(0).addScaledVector(spine.tangent(0), u) : spine.point(Math.min(1, u));
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
          indices.push(a, a + 1, b, b, a + 1, b + 1);
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
      (m.material as THREE.MeshPhysicalMaterial).transparent = true;
      (m.material as THREE.MeshPhysicalMaterial).opacity = 0.55;
      return m;
    }
    case "eyes": {
      const g = new THREE.Group();
      const u = head.start + 0.6 * (head.end - head.start);
      const s = spine.size(u);
      for (const side of [-1, 1]) {
        const at = spine.point(u).add(new THREE.Vector3(0, s.h * 0.25, side * s.w * 0.85));
        if (part.iris) {
          // A fish's eye: a glossy iris with the dark pupil looking out to the side.
          const eye = new THREE.Mesh(new THREE.SphereGeometry(part.size, 24, 16), new THREE.MeshPhysicalMaterial({ color: color(part.iris), roughness: 0.25, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05 }));
          // Set into the head, not bulging from it.
          eye.scale.z = 0.4;
          eye.position.copy(spine.point(u).add(new THREE.Vector3(0, s.h * 0.3, side * s.w * 0.72)));
          const pupil = new THREE.Mesh(new THREE.SphereGeometry(part.size * 0.55, 16, 12), new THREE.MeshPhysicalMaterial({ color: color(part.pupil ?? part.color), roughness: 0.1, clearcoat: 1 }));
          pupil.scale.z = 0.35;
          pupil.position.copy(eye.position).add(new THREE.Vector3(0, 0, side * part.size * 0.3));
          g.add(eye, pupil);
          continue;
        }
        // Compound eyes: a glossy dome with a faint sheen of facets.
        const eye = new THREE.Mesh(
          new THREE.SphereGeometry(part.size, 20, 14),
          new THREE.MeshPhysicalMaterial({ color: color(part.color), roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 0.4, sheenRoughness: 0.3, sheenColor: new THREE.Color(0.5, 0.45, 0.4) }),
        );
        eye.position.copy(at);
        g.add(eye);
        if (part.turbinate) {
          // A male Baetis's upper eyes, raised on stalks like turbans.
          const stalk = new THREE.Mesh(new THREE.CylinderGeometry(part.size * 0.75, part.size * 0.6, part.size * 1.6, 16), new THREE.MeshPhysicalMaterial({ color: color(part.turbinate), roughness: 0.35, clearcoat: 1 }));
          stalk.position.copy(at).add(new THREE.Vector3(0, part.size * 1.1, -side * part.size * 0.35));
          const cap = new THREE.Mesh(new THREE.SphereGeometry(part.size * 0.78, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), (stalk.material as THREE.Material).clone());
          cap.position.copy(stalk.position).add(new THREE.Vector3(0, part.size * 0.8, 0));
          g.add(stalk, cap);
        }
      }
      if (part.ocelli) {
        // Three small simple eyes in a triangle between the compound eyes.
        for (const [dx, dz] of [[0.6, 0], [-0.4, 0.55], [-0.4, -0.55]] as const) {
          const o = new THREE.Mesh(new THREE.SphereGeometry(part.size * 0.25, 8, 6), new THREE.MeshPhysicalMaterial({ color: 0x1a1410, roughness: 0.1, clearcoat: 1 }));
          o.position.copy(top(u, 0.95)).add(new THREE.Vector3(dx * part.size, 0, dz * part.size));
          g.add(o);
        }
      }
      return g;
    }
    case "fin": {
      const u = part.at;
      const s = spine.size(u);
      switch (part.kind) {
        case "caudal": {
          const f = finMesh(part, "tail");
          f.position.copy(spine.point(0.004));
          f.rotation.z = spine.heading(0);
          return f;
        }
        case "dorsal":
        case "adipose": {
          // Its front at `at`, along the back towards the tail, its base following the back down.
          const f = finMesh(part, "median");
          const edge = (v: number) => spine.point(v).y + spine.size(v).h * 0.92;
          conform(f, (x) => edge(Math.max(0, u + x)) - edge(u));
          f.position.copy(top(u, 0.92));
          f.rotation.z = spine.heading(u);
          return f;
        }
        case "anal": {
          const f = finMesh(part, "median");
          // Flipped below the belly: its base follows the belly up towards the tail.
          const edge = (v: number) => spine.point(v).y - spine.size(v).b * 0.92;
          conform(f, (x) => -(edge(Math.max(0, u + x)) - edge(u)));
          f.position.copy(spine.point(u).addScaledVector(spine.up(u), -s.b * 0.92));
          f.rotation.z = spine.heading(u);
          f.scale.y = -1;
          return f;
        }
        case "pelvic":
        case "pectoral": {
          // A pair, out from the lower flanks and back along the body.
          const g = new THREE.Group();
          const low = part.kind === "pelvic" ? -0.8 : -0.35;
          for (const side of [-1, 1]) {
            const f = finMesh(part, "paddle");
            // Rooted on the flank (the pelvics low on the belly's edge), its face tilted out from the
            // body, lying back along it or spread out to the side by `spread` degrees.
            f.position.copy(spine.point(u).addScaledVector(spine.up(u), low * s.b).add(new THREE.Vector3(0, 0, side * s.w * (part.kind === "pelvic" ? 0.8 : 0.95))));
            const spread = THREE.MathUtils.degToRad(part.spread ?? (part.kind === "pelvic" ? 15 : 25));
            f.rotation.set(side * (part.kind === "pelvic" ? 1.2 : 0.75), side * spread, spine.heading(u));
            g.add(f);
          }
          return g;
        }
      }
      return null;
    }
    case "horns": {
      // Tufts of fine white filaments standing up from the thorax.
      const list: Fibre[] = [];
      const u = thorax.end - 0.25 * (thorax.end - thorax.start);
      const c = color(part.color);
      for (const side of [-1, 1]) {
        const from = spine.surface(u, side * 0.45, 0.95);
        for (let k = 0; k < 40; k++) {
          const dir = new THREE.Vector3(0.3 + 0.5 * (random() - 0.5), 0.8 + 0.3 * random(), side * (0.15 + 0.5 * random()));
          list.push({ from, dir, length: part.length * (0.6 + 0.5 * random()), radius: 0.0015, color: c.clone().multiplyScalar(0.9 + 0.2 * random()) });
        }
      }
      return fibres(list, 0.6);
    }
    case "pronotum": {
      // A shield over the front of the thorax.
      const u = thorax.end - part.length / 2;
      const s = spine.size(u);
      const plate = new THREE.Mesh(
        new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshPhysicalMaterial({ color: color(part.color), roughness: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.3, side: THREE.DoubleSide }),
      );
      // Close over the thorax, as its surface rather than a cap on it.
      plate.scale.set(part.length / 2, s.h * 0.2, part.width / 2);
      plate.position.copy(top(u, 0.93));
      plate.rotation.z = spine.heading(u);
      return plate;
    }
    case "prolegs": {
      // Stubby false legs under the body, or a pair at its rear end with hooked claws.
      const g = new THREE.Group();
      const sec = part.at ? spine.named(part.at, 0.3) : abdomen;
      const c = color(part.color);
      for (let i = 0; i < part.count; i++) {
        const f = part.count === 1 ? 0.5 : i / (part.count - 1);
        const u = part.where === "rear" ? sec.start + 0.02 : part.where === "front" ? sec.end - 0.05 - 0.04 * i : THREE.MathUtils.lerp(sec.start + 0.1 * (sec.end - sec.start), sec.end - 0.1 * (sec.end - sec.start), f);
        for (const side of [-1, 1]) {
          const from = spine.surface(u, side * Math.PI * 0.82, 0.9);
          const out = part.where === "rear" ? new THREE.Vector3(-0.8, -0.5, side * 0.35).normalize() : new THREE.Vector3(0, -1, side * 0.25).normalize();
          const tip = from.clone().addScaledVector(out, part.length);
          g.add(tube(smooth([from, from.clone().lerp(tip, 0.5), tip], 8), (t) => part.length * 0.28 * (1 - 0.55 * t), () => c));
          if (part.hooks) {
            const hook = [tip, tip.clone().add(new THREE.Vector3(-part.length * 0.25, -part.length * 0.1, 0)), tip.clone().add(new THREE.Vector3(-part.length * 0.3, part.length * 0.12, 0))];
            g.add(tube(smooth(hook, 8), (t) => part.length * 0.07 * (1 - 0.7 * t), () => c.clone().multiplyScalar(0.3)));
          }
        }
      }
      return g;
    }
  }
  return null;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
