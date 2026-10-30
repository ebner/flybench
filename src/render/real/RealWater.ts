import * as THREE from "three";
import type { RealAssets } from "./assets";
import { riverbed } from "./riverbed";
import { mulberry32 } from "../random";
import { CAPILLARY_TILE, capillaryNormals } from "./capillary";
import { MAX_DIMPLES, RIPPLE_GLSL, rippleHeight, type Dimple } from "./waves";

export interface RealWaterOptions {
  assets: RealAssets;
  /** The surface's level (world y) and the point the scene centres on. */
  level: number;
  centre: THREE.Vector3;
  /** Where the riverbed's highest stones reach (world y). */
  bed: number;
  dimples: Dimple[];
  /** The panorama's turn about +y, so its sun lights the subject as wanted. */
  skyRotation: number;
  /** Towards the sun (world), for its glints on the ripples. */
  sun: THREE.Vector3;
  /** A finer riverbed, for the path tracer's stills. */
  detailed?: boolean;
}

/** The surface grid's x (or z) coordinates: fine near the centre, coarser far out. */
function gridCoordinates(fine: number, step: number, far: number): number[] {
  const coords: number[] = [];
  const near = Math.round(fine / step);
  for (let i = -near; i <= near; i++) coords.push(i * step);
  let x = near * step;
  let d = step;
  while (x < far) {
    d *= 1.09;
    x += d;
    coords.push(x);
    coords.unshift(-x);
  }
  return coords;
}

function surfaceGeometry(centre: THREE.Vector3, level: number, height: ((x: number, z: number) => number) | null, step: number, fine: number): THREE.BufferGeometry {
  const coords = gridCoordinates(fine, step, 420);
  const n = coords.length;
  const positions = new Float32Array(n * n * 3);
  // The capillary ripples' normal map repeats every tile (the path tracer's surface uses it).
  const uvs = new Float32Array(n * n * 2);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const x = centre.x + coords[j]!;
      const z = centre.z + coords[i]!;
      positions.set([x, level + (height ? height(x, z) : 0), z], (i * n + j) * 3);
      uvs.set([x / CAPILLARY_TILE, -z / CAPILLARY_TILE], (i * n + j) * 2);
    }
  }
  const indices: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < n - 1; j++) {
      const a = i * n + j;
      indices.push(a, a + n, a + 1, a + 1, a + n, a + n + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

const vertexShader = /* glsl */ `
uniform float time;
uniform float level;
uniform vec4 dimples[${MAX_DIMPLES}];
uniform int dimpleCount;
uniform mat4 textureMatrix;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec4 vMirror;
${RIPPLE_GLSL}
void main() {
  vec3 p = (modelMatrix * vec4(position, 1.0)).xyz;
  float e = 0.04;
  // The ripples' slope here; the dents' slopes are worked out per fragment.
  float h = ripplesOnly(p.xz, time);
  float hx = ripplesOnly(p.xz + vec2(e, 0.0), time);
  float hz = ripplesOnly(p.xz + vec2(0.0, e), time);
  p.y = level + h + dimplesHeight(p.xz);
  vNormal = normalize(vec3(h - hx, e, h - hz));
  vWorld = p;
  vMirror = textureMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;

const fragmentShader = /* glsl */ `
#include <common>
uniform sampler2D reflectionMap;
uniform sampler2D refractionMap;
uniform sampler2D depthMap;
uniform sampler2D sky;
uniform float skyRotation;
uniform vec2 resolution;
uniform float near;
uniform float far;
uniform float above;
uniform vec3 waterColour;
uniform float attenuation;
uniform sampler2D capillary;
uniform float capillaryTile;
uniform float time;
uniform vec3 sun;
uniform vec4 dimples[${MAX_DIMPLES}];
uniform int dimpleCount;
uniform vec3 dimpleBounds;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec4 vMirror;
vec3 skyColour(vec3 d) {
  // three samples a turned background by the inverse turn; the same here, so the water reflects what is behind.
  float c = cos(skyRotation), s = sin(skyRotation);
  d = vec3(c * d.x - s * d.z, d.y, s * d.x + c * d.z);
  vec2 uv = vec2(atan(d.z, d.x) / (2.0 * PI) + 0.5, asin(clamp(d.y, -1.0, 1.0)) / PI + 0.5);
  return texture2D(sky, uv).rgb;
}
float linearDepth(float z) {
  float ndc = z * 2.0 - 1.0;
  return 2.0 * near * far / (far + near - ndc * (far - near));
}
vec3 capillaryTilt(vec2 p) {
  vec3 c = texture2D(capillary, p).xyz * 2.0 - 1.0;
  return vec3(c.x, 0.0, -c.y);
}
void main() {
  vec3 v = normalize(cameraPosition - vWorld);
  // The finest ripples, two layers drifting at different speeds, tilt the surface's normal.
  vec2 q = vWorld.xz / capillaryTile;
  vec3 tilt = capillaryTilt(q + vec2(0.021, 0.013) * time) + capillaryTilt(q * 1.37 + vec2(-0.017, 0.026) * time);
  // The dents round the subject's contacts, too small for the grid: their slopes, here.
  vec2 slope = vec2(0.0);
  // Only near them: outside the circle they lie in, nothing to add.
  for (int i = 0; i < ${MAX_DIMPLES}; i++) {
    if (i >= dimpleCount || distance(vWorld.xz, dimpleBounds.xy) > dimpleBounds.z) break;
    vec4 d = dimples[i];
    vec2 r = vWorld.xz - d.xy;
    float k = length(r) / d.z;
    if (k > 4.0 || k < 1e-4) continue;
    // d/dq of -w exp(-q²) + w/4 exp(-(q-1.8)²), along r.
    float dh = d.w * (2.0 * k * exp(-k * k) - 0.5 * (k - 1.8) * exp(-(k - 1.8) * (k - 1.8))) / d.z;
    slope += dh * r / (k * d.z);
  }
  vec3 n = normalize(normalize(vNormal) + vec3(-slope.x, 0.0, -slope.y) + 0.5 * tilt);
  if (above < 0.5) n = -n;
  vec2 screen = gl_FragCoord.xy / resolution;
  vec2 bend = n.xz * 0.12;
  vec4 mirrored = texture2DProj(reflectionMap, vMirror + vec4(bend * vMirror.w, 0.0, 0.0));
  vec3 colour;
  if (above > 0.5) {
    float fresnel = 0.02 + 0.98 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
    vec3 reflected = mix(skyColour(reflect(-v, n)), mirrored.rgb, mirrored.a);
    // The sun's glints on the ripples, brighter than the panorama's blurred sun can give.
    reflected += vec3(1.0, 0.96, 0.88) * 24.0 * pow(max(dot(reflect(-v, n), sun), 0.0), 1400.0);
    // Bent by the ripples, more so the more water the light crosses.
    float through = max(linearDepth(texture2D(depthMap, screen).x) - linearDepth(gl_FragCoord.z), 0.0);
    vec2 uv = screen + n.xz * min(through, 20.0) * 0.012;
    vec4 below = texture2D(refractionMap, uv);
    float thickness = max(linearDepth(texture2D(depthMap, uv).x) - linearDepth(gl_FragCoord.z), 0.0);
    float k = 1.0 - exp(-thickness / attenuation);
    vec3 refracted = mix(below.rgb * vec3(0.9, 0.95, 0.9), waterColour, k);
    colour = mix(refracted, reflected, fresnel);
  } else {
    // From below: the sky through Snell's window, a mirror of the riverbed beyond it.
    vec3 t = refract(-v, n, 1.333);
    vec3 underside = mix(waterColour * 0.6, mirrored.rgb, mirrored.a);
    if (dot(t, t) < 1e-4) {
      colour = underside;
    } else {
      float fresnel = 0.02 + 0.98 * pow(1.0 - max(dot(-n, t), 0.0), 5.0);
      vec4 over = texture2D(refractionMap, screen + bend * 0.5);
      vec3 through = mix(skyColour(t), over.rgb, over.a);
      colour = mix(through, underside, fresnel);
    }
    float distance = length(cameraPosition - vWorld);
    colour = mix(colour, waterColour * 0.5, 1.0 - exp(-distance / (attenuation * 6.0)));
  }
  gl_FragColor = vec4(colour, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/**
 * The realistic water: a rippled surface with Fresnel reflection (a mirror image of the scene
 * on the camera's side, the panorama beyond it) and refraction (the scene on the other side,
 * bent by the ripples and tinted by the water it crosses), Snell's window and total internal
 * reflection from below, and a photoscanned gravel bed. Like the rest of the scene it is a pure
 * function of its time.
 */
export class RealWater {
  readonly group = new THREE.Group();
  private surface: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private reflection: THREE.WebGLRenderTarget;
  private refraction: THREE.WebGLRenderTarget;
  private mirror = new THREE.PerspectiveCamera();
  private textureMatrix = new THREE.Matrix4();
  private plane = new THREE.Plane();
  private size = new THREE.Vector2();
  private time = 0;
  private capillary = capillaryNormals();
  private specks: Speck[] = [];

  constructor(private o: RealWaterOptions) {
    this.reflection = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    this.refraction = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(1, 1) });
    const dimples = Array.from({ length: MAX_DIMPLES }, (_, i) => {
      const d = o.dimples[i];
      return d ? new THREE.Vector4(d.x, d.z, d.r, d.d) : new THREE.Vector4();
    });
    this.material = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: {
        time: { value: 0 },
        level: { value: o.level },
        dimples: { value: dimples },
        dimpleCount: { value: Math.min(MAX_DIMPLES, o.dimples.length) },
        dimpleBounds: { value: dimpleBounds(o.dimples.slice(0, MAX_DIMPLES)) },
        textureMatrix: { value: this.textureMatrix },
        reflectionMap: { value: this.reflection.texture },
        refractionMap: { value: this.refraction.texture },
        depthMap: { value: this.refraction.depthTexture },
        sky: { value: o.assets.sky },
        skyRotation: { value: o.skyRotation },
        resolution: { value: this.size },
        near: { value: 0.05 },
        far: { value: 500 },
        above: { value: 1 },
        waterColour: { value: new THREE.Color("#4a5648") },
        capillary: { value: this.capillary },
        capillaryTile: { value: CAPILLARY_TILE },
        sun: { value: o.sun.clone().normalize() },
        // Assumption: clear stream water, tinted to its own colour over about 45 gapes (20 cm).
        attenuation: { value: 45 },
      },
      vertexShader,
      fragmentShader,
    });
    this.surface = new THREE.Mesh(surfaceGeometry(o.centre, o.level, null, 0.2, 24), this.material);
    this.surface.frustumCulled = false;
    this.group.add(this.surface);
    this.group.add(riverbed(o.assets, o.centre, o.bed, 120, o.detailed ? 360 : 240));
    this.specks = floatingSpecks(o.centre);
    for (const s of this.specks) this.group.add(s.mesh);
    this.setTime(0);
  }

  /** Height of the surface above its level at (x, z), now. */
  height(x: number, z: number): number {
    return rippleHeight(x, z, this.time, this.o.dimples);
  }

  setTime(t: number) {
    this.time = t;
    this.material.uniforms.time!.value = t;
    // Specks drift downstream on the surface, riding its ripples.
    for (const s of this.specks) {
      let x = s.x - SPECK_DRIFT * t - this.o.centre.x;
      x = ((((x + SPECK_AREA) % (2 * SPECK_AREA)) + 2 * SPECK_AREA) % (2 * SPECK_AREA)) - SPECK_AREA + this.o.centre.x;
      const m = s.mesh.matrix.makeRotationY(s.turn);
      for (const i of [0, 1, 2, 4, 5, 6, 8, 9, 10]) m.elements[i]! *= s.size;
      m.setPosition(x, this.o.level + rippleHeight(x, s.z, t) + s.lift * s.size, s.z);
    }
  }

  /** Renders the scene through the water: the mirror and refraction passes, then the frame. */
  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    renderer.getDrawingBufferSize(this.size);
    if (this.refraction.width !== this.size.x || this.refraction.height !== this.size.y) {
      // Half resolution is plenty for what the ripples smear.
      this.reflection.setSize(Math.ceil(this.size.x / 2), Math.ceil(this.size.y / 2));
      this.refraction.setSize(this.size.x, this.size.y);
    }
    const level = this.o.level;
    const above = camera.position.y > level;
    const u = this.material.uniforms;
    u.above!.value = above ? 1 : 0;
    u.near!.value = camera.near;
    u.far!.value = camera.far;
    const m = this.mirror;
    m.copy(camera);
    m.position.y = 2 * level - camera.position.y;
    const target = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).add(camera.position);
    target.y = 2 * level - target.y;
    m.up.set(0, 1, 0);
    m.lookAt(target);
    m.updateMatrixWorld();
    m.projectionMatrix.copy(camera.projectionMatrix);
    this.textureMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(m.projectionMatrix).multiply(m.matrixWorldInverse);

    const background = scene.background;
    const clear = renderer.getClearAlpha();
    const colour = renderer.getClearColor(new THREE.Color());
    const target0 = renderer.getRenderTarget();
    this.surface.visible = false;
    scene.background = null;
    renderer.setClearColor(0x000000, 0);
    // The mirror shows only what is on the camera's side of the surface; refraction only the other side.
    this.plane.set(new THREE.Vector3(0, above ? 1 : -1, 0), above ? -level : level);
    renderer.clippingPlanes = [this.plane];
    renderer.setRenderTarget(this.reflection);
    renderer.clear();
    renderer.render(scene, m);
    this.plane.negate();
    renderer.setRenderTarget(this.refraction);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.clippingPlanes = [];
    renderer.setRenderTarget(target0);
    renderer.setClearColor(colour, clear);
    scene.background = background;
    this.surface.visible = true;
    renderer.render(scene, camera);
  }

  /** The surface at the current time as plain geometry with a glass-like water material, for the path tracer. */
  traceable(): THREE.Mesh {
    // Fine near the subject, so the menisci round its contacts (a fifth of a gape) take shape.
    const g = surfaceGeometry(this.o.centre, this.o.level, (x, z) => this.height(x, z), 0.05, 9);
    const m = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.02,
      normalMap: this.capillary,
      transmission: 1,
      ior: 1.333,
      thickness: 6,
      attenuationColor: new THREE.Color("#a3ad84"),
      attenuationDistance: 30,
      side: THREE.DoubleSide,
    });
    return new THREE.Mesh(g, m);
  }

  /** Swaps the shader surface for the path tracer's (and back). */
  setTraceable(on: boolean): THREE.Mesh | null {
    this.surface.visible = !on;
    if (!on) return null;
    const mesh = this.traceable();
    this.group.add(mesh);
    return mesh;
  }

  dispose() {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        const m = o.material as THREE.Material & { map?: THREE.Texture | null; normalMap?: THREE.Texture | null };
        // The riverbed's textures are clones sharing the loaded images: dispose the clones.
        if (m !== this.material) {
          m.map?.dispose();
          m.normalMap?.dispose();
        }
        m.dispose();
      }
    });
    this.capillary.dispose();
    this.reflection.dispose();
    this.refraction.depthTexture?.dispose();
    this.refraction.dispose();
  }
}

interface Speck {
  mesh: THREE.Mesh;
  /** Where it starts (x drifts), its turn, its size and how far it sits above the level (in its sizes). */
  x: number;
  z: number;
  turn: number;
  size: number;
  lift: number;
}

/** Half the width of the square the specks drift through, and their speed (gapes a second). */
const SPECK_AREA = 12;
const SPECK_DRIFT = 0.35;

// Assumption: what floats on a summer river, a few dozen bits in a hand's breadth: pollen grains,
// wisps of seed fluff, specks of leaf and bark, tiny air bubbles. Sizes in gapes (0.1–0.6 mm).
const SPECKS = [
  { count: 26, size: [0.025, 0.05], colour: "#d8c070", kind: "disc", lift: 0 },
  { count: 8, size: [0.08, 0.16], colour: "#ece8de", kind: "fluff", lift: 0.1 },
  { count: 12, size: [0.05, 0.12], colour: "#5e4a30", kind: "flake", lift: 0 },
  { count: 14, size: [0.02, 0.05], colour: "#ffffff", kind: "bubble", lift: 0 },
] as const;

/** The specks on the surface round `centre`: each its own small mesh (the path tracer draws them too). */
function floatingSpecks(centre: THREE.Vector3): Speck[] {
  const random = mulberry32(31);
  const shapes = {
    disc: new THREE.CircleGeometry(1, 10).rotateX(-Math.PI / 2),
    flake: new THREE.CircleGeometry(1, 5).rotateX(-Math.PI / 2).scale(1, 1, 0.55),
    fluff: new THREE.CircleGeometry(1, 7).rotateX(-Math.PI / 2).scale(1, 1, 0.3),
    bubble: new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
  };
  const specks: Speck[] = [];
  for (const kind of SPECKS) {
    const material =
      kind.kind === "bubble"
        ? new THREE.MeshPhysicalMaterial({ color: kind.colour, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.35 })
        : new THREE.MeshStandardMaterial({ color: kind.colour, roughness: 0.8, transparent: kind.kind === "fluff", opacity: kind.kind === "fluff" ? 0.7 : 1 });
    for (let i = 0; i < kind.count; i++) {
      const mesh = new THREE.Mesh(shapes[kind.kind], material);
      mesh.matrixAutoUpdate = false;
      specks.push({
        mesh,
        x: centre.x + (random() * 2 - 1) * SPECK_AREA,
        z: centre.z + (random() * 2 - 1) * SPECK_AREA,
        turn: random() * Math.PI * 2,
        size: kind.size[0] + random() * (kind.size[1] - kind.size[0]),
        lift: kind.lift,
      });
    }
  }
  return specks;
}

/** The circle the dents lie in (centre x, z and radius, their reach included), for skipping them elsewhere. */
function dimpleBounds(dimples: Dimple[]): THREE.Vector3 {
  if (dimples.length === 0) return new THREE.Vector3(0, 0, -1);
  const x = dimples.reduce((s, d) => s + d.x, 0) / dimples.length;
  const z = dimples.reduce((s, d) => s + d.z, 0) / dimples.length;
  const r = Math.max(...dimples.map((d) => Math.hypot(d.x - x, d.z - z) + 4 * d.r));
  return new THREE.Vector3(x, z, r);
}
