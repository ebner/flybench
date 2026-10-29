import * as THREE from "three";
import type { RealAssets } from "./assets";
import { riverbed } from "./riverbed";
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
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const x = centre.x + coords[j]!;
      const z = centre.z + coords[i]!;
      positions.set([x, level + (height ? height(x, z) : 0), z], (i * n + j) * 3);
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
  float h = rippleHeight(p.xz, time);
  float hx = rippleHeight(p.xz + vec2(e, 0.0), time);
  float hz = rippleHeight(p.xz + vec2(0.0, e), time);
  p.y = level + h;
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
void main() {
  vec3 v = normalize(cameraPosition - vWorld);
  vec3 n = normalize(vNormal);
  if (above < 0.5) n = -n;
  vec2 screen = gl_FragCoord.xy / resolution;
  vec2 bend = n.xz * 0.12;
  vec4 mirrored = texture2DProj(reflectionMap, vMirror + vec4(bend * vMirror.w, 0.0, 0.0));
  vec3 colour;
  if (above > 0.5) {
    float fresnel = 0.02 + 0.98 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
    vec3 reflected = mix(skyColour(reflect(-v, n)), mirrored.rgb, mirrored.a);
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
  }

  /** Height of the surface above its level at (x, z), now. */
  height(x: number, z: number): number {
    return rippleHeight(x, z, this.time, this.o.dimples);
  }

  setTime(t: number) {
    this.time = t;
    this.material.uniforms.time!.value = t;
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
    const g = surfaceGeometry(this.o.centre, this.o.level, (x, z) => this.height(x, z), 0.12, 26);
    const m = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.02,
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
    this.reflection.dispose();
    this.refraction.depthTexture?.dispose();
    this.refraction.dispose();
  }
}
