/**
 * The river surface's small wind ripples: a few travelling sine waves, the same in JavaScript
 * (the fly riding them, the path tracer's geometry) and in the water shader. Lengths in gapes,
 * time in seconds.
 */
export interface Ripple {
  dx: number;
  dz: number;
  k: number;
  a: number;
  w: number;
  phase: number;
}

// Assumption: ripples 3–15 gapes long (1.5–7.5 cm on a #12), a few tenths of a millimetre to a
// millimetre high, drifting slowly: a calm glide, not a riffle.
export const RIPPLES: Ripple[] = [
  { angle: 0.3, length: 14, a: 0.06, phase: 0.4 },
  { angle: 1.9, length: 9.5, a: 0.045, phase: 2.1 },
  { angle: -0.8, length: 6.2, a: 0.03, phase: 4.0 },
  { angle: 2.7, length: 4.4, a: 0.018, phase: 1.3 },
  { angle: -2.2, length: 3.6, a: 0.014, phase: 5.2 },
  { angle: 0.9, length: 2.9, a: 0.01, phase: 3.3 },
  { angle: -1.5, length: 11, a: 0.04, phase: 0.9 },
].map(({ angle, length, a, phase }) => {
  const k = (2 * Math.PI) / length;
  return { dx: Math.cos(angle), dz: Math.sin(angle), k, a, w: 0.9 + 0.35 * k, phase };
});

/** A dent in the surface film where something presses on it: centre, radius and depth in gapes. */
export interface Dimple {
  x: number;
  z: number;
  r: number;
  d: number;
}

/** Up to this many dimples; the shader's array has this size. */
export const MAX_DIMPLES = 64;

/** Height of the surface at (x, z) and time t, relative to its level. */
export function rippleHeight(x: number, z: number, t: number, dimples: Dimple[] = []): number {
  let h = 0;
  for (const r of RIPPLES) h += r.a * Math.sin(r.k * (x * r.dx + z * r.dz) - r.w * t + r.phase);
  for (const d of dimples) h += dimpleHeight(x - d.x, z - d.z, d);
  return h;
}

/** A dent with a soft raised rim, the meniscus a trout sees as a bright ring. */
export function dimpleHeight(dx: number, dz: number, d: Dimple): number {
  const q = Math.sqrt(dx * dx + dz * dz) / d.r;
  if (q > 4) return 0;
  return -d.d * Math.exp(-q * q) + 0.25 * d.d * Math.exp(-((q - 1.8) ** 2));
}

/** The same in GLSL, for the water shader (expects `uniform vec4 dimples[MAX_DIMPLES]` and `uniform int dimpleCount`). */
export const RIPPLE_GLSL = /* glsl */ `
float dimplesHeight(vec2 p) {
  float h = 0.0;
  for (int i = 0; i < ${MAX_DIMPLES}; i++) {
    if (i >= dimpleCount) break;
    vec4 d = dimples[i];
    float q = length(p - d.xy) / d.z;
    if (q < 4.0) h += -d.w * exp(-q * q) + 0.25 * d.w * exp(-(q - 1.8) * (q - 1.8));
  }
  return h;
}
float ripplesOnly(vec2 p, float t) {
  float h = 0.0;
  ${RIPPLES.map((r) => `h += ${r.a.toFixed(4)} * sin(${r.k.toFixed(4)} * dot(p, vec2(${r.dx.toFixed(4)}, ${r.dz.toFixed(4)})) - ${r.w.toFixed(4)} * t + ${r.phase.toFixed(4)});`).join("\n  ")}
  return h;
}
float rippleHeight(vec2 p, float t) {
  return ripplesOnly(p, t) + dimplesHeight(p);
}
`;
