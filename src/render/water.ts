import * as THREE from "three";
import { mulberry32 } from "./random";

/**
 * The water a fly is shown in: an animated surface, the water below it, drifting specks, and
 * a tint for everything under the waterline. Everything is a function of the water's time `t`
 * (seconds), like the rest of the scene.
 */

let fogPatched = false;

/**
 * three's fog becomes a waterline: below `fogNear` (the water's level, world y) a surface is
 * darkened, as wet things are, and tinted towards the water's colour, fully at `fogFar` gapes
 * down. Only scenes given a THREE.Fog use it; nothing else in the app uses fog.
 */
export function patchFogForWater() {
  if (fogPatched) return;
  fogPatched = true;
  const C = THREE.ShaderChunk;
  C.fog_pars_vertex = "#ifdef USE_FOG\n\tvarying float vFogDepth;\n\tvarying float vWaterY;\n#endif";
  C.fog_vertex = "#ifdef USE_FOG\n\tvFogDepth = - mvPosition.z;\n\tvWaterY = ( inverse( viewMatrix ) * mvPosition ).y;\n#endif";
  C.fog_pars_fragment =
    "#ifdef USE_FOG\n\tuniform vec3 fogColor;\n\tvarying float vFogDepth;\n\tvarying float vWaterY;\n\t#ifdef FOG_EXP2\n\t\tuniform float fogDensity;\n\t#else\n\t\tuniform float fogNear;\n\t\tuniform float fogFar;\n\t#endif\n#endif";
  C.fog_fragment = [
    "#ifdef USE_FOG",
    "\t#ifndef FOG_EXP2",
    "\t\tfloat waterDepth = fogNear - vWaterY;",
    "\t\tif ( waterDepth > 0.0 ) {",
    "\t\t\tfloat k = clamp( waterDepth / fogFar, 0.0, 1.0 );",
    "\t\t\tgl_FragColor.rgb = mix( gl_FragColor.rgb * 0.85, fogColor, 0.15 + 0.45 * k );",
    "\t\t}",
    "\t#endif",
    "#endif",
  ].join("\n");
}

export interface WaterLook {
  /** The water's colour, near the surface. */
  water: string;
  /** What shows through Snell's window, and the light on the surface from above. */
  sky: string;
}

/** The light (herbarium) and dark (cyanotype) palettes. */
export const WATER_LOOKS: Record<"light" | "dark", WaterLook> = {
  light: { water: "#8fa8a2", sky: "#f2f0e8" },
  dark: { water: "#0c2442", sky: "#4f7bb0" },
};

const WAVES = [
  { dir: [1, 0.2], k: 2.2, w: 1.3, a: 0.012 },
  { dir: [0.3, 1], k: 3.1, w: 1.7, a: 0.008 },
  { dir: [-0.7, 0.6], k: 5.3, w: 2.6, a: 0.004 },
];

/** Height of the surface at (x, z) at time t, relative to its level. */
export function waveHeight(x: number, z: number, t: number): number {
  let h = 0;
  for (const w of WAVES) {
    const len = Math.hypot(w.dir[0]!, w.dir[1]!);
    h += w.a * Math.sin(((x * w.dir[0]! + z * w.dir[1]!) / len) * w.k + w.w * t);
  }
  return h;
}

const surfaceVertex = /* glsl */ `
varying vec3 vPos;
void main() {
  vPos = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * viewMatrix * vec4(vPos, 1.0);
}`;

const surfaceFragment = /* glsl */ `
uniform float time;
uniform float level;
uniform vec3 waterColor;
uniform vec3 skyColor;
uniform vec3 mirrorColor;
uniform vec4 dimples[24];
uniform int dimpleCount;
varying vec3 vPos;
${WAVES.map((w, i) => `const vec4 W${i} = vec4(normalize(vec2(${w.dir[0]!.toFixed(3)}, ${w.dir[1]!.toFixed(3)})), ${w.k.toFixed(3)}, ${w.w.toFixed(3)});`).join("\n")}
${WAVES.map((w, i) => `const float A${i} = ${w.a.toFixed(4)};`).join("\n")}

void main() {
  vec2 p = vPos.xz;
  vec2 slope = vec2(0.0);
  ${WAVES.map((_, i) => `slope += A${i} * W${i}.z * cos(dot(W${i}.xy, p) * W${i}.z + W${i}.w * time) * W${i}.xy;`).join("\n  ")}
  vec3 toEye = normalize(cameraPosition - vPos);
  bool above = cameraPosition.y >= level;
  // Steeper than the waves are, so the ripples read at this scale; less so from below, where
  // they would break up the edge of Snell's window.
  float steep = above ? 3.0 : 1.6;
  vec3 n = normalize(vec3(-slope.x * steep, 1.0, -slope.y * steep));
  vec3 color;
  float alpha;
  // Where the fly dents the film: a dark ring round a bright point, seen best from below.
  float ring = 0.0;
  float glint = 0.0;
  for (int i = 0; i < 24; i++) {
    if (i >= dimpleCount) break;
    float d = distance(p, dimples[i].xy);
    float r = dimples[i].z;
    ring = max(ring, smoothstep(r * 2.2, r, d) * smoothstep(0.0, r, d));
    glint = max(glint, smoothstep(r * 0.5, 0.0, d));
  }
  if (above) {
    // From above: see-through near straight down, reflecting the sky at a low angle.
    float f = 0.04 + 0.96 * pow(1.0 - max(dot(n, toEye), 0.0), 5.0);
    color = mix(waterColor, skyColor, f);
    alpha = mix(0.32, 0.92, f);
    color = mix(color, waterColor * 0.6, 0.3 * ring);
  } else {
    // From below: the sky through Snell's window (48.6° each side of straight up), and outside
    // it the surface a mirror of the water.
    float c = dot(-toEye, n);
    float window = smoothstep(0.63, 0.69, c);
    color = mix(mirrorColor, mix(skyColor, waterColor, 0.2), window);
    alpha = mix(0.94, 0.35, window);
    color = mix(color, waterColor * 0.5, 0.55 * ring) + 0.35 * glint;
    alpha = max(alpha, 0.5 * ring + glint);
  }
  gl_FragColor = vec4(color, alpha);
}`;

export interface WaterOptions {
  /** World y of the surface. */
  level: number;
  /** Where the fly is, for centring the water (world x, z). */
  centre: THREE.Vector3;
  look: WaterLook;
  /** Points where the fly dents the film (world x, z) with a radius, at most 24. */
  dimples: { x: number; z: number; r: number }[];
  motion: "drift" | "swim" | "swing";
  /**
   * From the side the water is a tank cut away at this z (world), in front of the fly, so its
   * part under the surface shows; null for water all round (the view from below).
   */
  cut: number | null;
}

/** The surface, the water body below it and drifting specks, around a fly. */
export class Water {
  readonly group = new THREE.Group();
  private surface: THREE.ShaderMaterial;
  private specks: THREE.Points;
  private speckBase: Float32Array;

  constructor(private o: WaterOptions) {
    const size = 60;
    this.surface = new THREE.ShaderMaterial({
      vertexShader: surfaceVertex,
      fragmentShader: surfaceFragment,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        time: { value: 0 },
        level: { value: o.level },
        waterColor: { value: new THREE.Color(o.look.water) },
        skyColor: { value: new THREE.Color(o.look.sky) },
        // Inside the water it mirrors the dark depths; through the side of a tank it looks silvery.
        mirrorColor: {
          value: o.cut === null ? new THREE.Color(o.look.water).multiplyScalar(0.65) : new THREE.Color(o.look.water).lerp(new THREE.Color(o.look.sky), 0.45),
        },
        dimples: { value: Array.from({ length: 24 }, (_, i) => {
          const d = o.dimples[i];
          return d ? new THREE.Vector4(d.x, d.z, d.r, 0) : new THREE.Vector4();
        }) },
        dimpleCount: { value: Math.min(24, o.dimples.length) },
      },
    });
    // The surface and the water body below it reach `size` gapes back, and forward to the cut.
    const back = o.centre.z - size / 2;
    const front = o.cut ?? o.centre.z + size / 2;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(size, front - back, 1, 1), this.surface);
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(o.centre.x, o.level, (back + front) / 2);
    plane.renderOrder = 3;
    this.group.add(plane);

    // Its inside faces only: from outside the cut the near wall is not drawn, so the tank is open.
    const depth = 30;
    const wall = new THREE.MeshBasicMaterial({ color: new THREE.Color(o.look.water).multiplyScalar(0.8), side: THREE.BackSide, fog: false });
    // No lid: from below, the surface above is what shows (box faces: +x, -x, +y, -y, +z, -z).
    const lid = new THREE.MeshBasicMaterial({ visible: false });
    const volume = new THREE.Mesh(new THREE.BoxGeometry(size, depth, front - back), [wall, wall, lid, wall, wall, wall]);
    volume.position.set(o.centre.x, o.level - depth / 2 - 0.001, (back + front) / 2);
    this.group.add(volume);

    if (o.cut !== null) {
      // The waterline along the cut, as on a drawing of a section.
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-size / 2, 0, 0), new THREE.Vector3(size / 2, 0, 0)]),
        new THREE.LineBasicMaterial({ color: new THREE.Color(o.look.sky), fog: false }),
      );
      line.position.set(o.centre.x, o.level, o.cut);
      this.group.add(line);
    }

    // Specks drifting in the water, showing the current (or the fly's own speed when stripped).
    const random = mulberry32(7);
    const count = 260;
    // Within the tank: not in front of its cut.
    this.speckBase = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      this.speckBase[i * 3] = (random() - 0.5) * 12;
      this.speckBase[i * 3 + 1] = -0.2 - random() * 6;
      this.speckBase[i * 3 + 2] = -4 + random() * (front - o.centre.z - 0.05 + 4);
    }
    const g = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(this.speckBase), 3));
    this.specks = new THREE.Points(
      g,
      new THREE.PointsMaterial({ color: new THREE.Color(o.look.sky), size: 0.035, transparent: true, opacity: 0.55, depthWrite: false, fog: false }),
    );
    this.specks.position.set(o.centre.x, o.level, o.centre.z);
    this.group.add(this.specks);
    this.setTime(0);
  }

  /** Seconds between strips of a swum fly. */
  static readonly STRIP = 1.4;

  /**
   * How far the water has moved past the fly by time t (gapes), from its eye towards its tail:
   * slowly as it drifts, faster held against the current on the swing, in pulses when stripped.
   */
  static flow(motion: "drift" | "swim" | "swing", t: number): number {
    if (motion === "drift") return 0.35 * t;
    if (motion === "swing") return 1.1 * t;
    // A quick pull, then a glide.
    const n = Math.floor(t / Water.STRIP);
    const f = (t - n * Water.STRIP) / Water.STRIP;
    const pull = f < 0.3 ? Math.sin((f / 0.3) * (Math.PI / 2)) : 1;
    return 1.6 * (n + pull);
  }

  setTime(t: number) {
    this.surface.uniforms.time!.value = t;
    const pos = this.specks.geometry.getAttribute("position") as THREE.BufferAttribute;
    const flow = Water.flow(this.o.motion, t);
    for (let i = 0; i < pos.count; i++) {
      // The eye is towards +x: the water streams past it to the tail.
      const x = this.speckBase[i * 3]! - flow;
      // Wrap within the 12-gape span the specks fill.
      pos.setX(i, ((((x + 6) % 12) + 12) % 12) - 6);
    }
    pos.needsUpdate = true;
  }

  dispose() {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Points || o instanceof THREE.Line) {
        o.geometry.dispose();
        for (const m of [o.material].flat() as THREE.Material[]) m.dispose();
      }
    });
  }
}
