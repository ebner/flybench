import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { PhysicalCamera, WebGLPathTracer } from "three-gpu-pathtracer";
import type { RealWater } from "./RealWater";

/**
 * Path traces a realistic water scene for the build-time stills (render-page.ts, driven by
 * scripts/render-water.ts; never in the site's bundle). The scene is changed for the tracer and
 * not put back: the page renders one picture and closes.
 */
export async function pathTrace(
  o: { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; water: RealWater | null; target: THREE.Vector3 },
  samples: number,
  onFrame: () => Promise<void>,
): Promise<{ seconds: number; image: string }> {
  o.water?.setTraceable(true);
  expandInstances(o.scene);
  sameAttributes(o.scene);
  // The tracer can't draw shader materials (the drawn water's) or lines.
  o.scene.traverse((x) => {
    if (x instanceof THREE.Mesh && x.material instanceof THREE.ShaderMaterial) x.visible = false;
  });
  const camera = new PhysicalCamera(o.camera.fov, o.camera.aspect, o.camera.near, o.camera.far);
  camera.position.copy(o.camera.position);
  camera.quaternion.copy(o.camera.quaternion);
  camera.updateMatrixWorld();
  camera.focusDistance = camera.position.distanceTo(o.target);
  // Assumption: a macro lens stopped down, its aperture about 0.3 gapes (1.5 mm) across; the
  // tracer's unit is the millimetre-per-metre of its bokeh size.
  camera.bokehSize = 300;
  const tracer = new WebGLPathTracer(o.renderer);
  tracer.bounces = 10;
  tracer.transmissiveBounces = 12;
  tracer.filterGlossyFactor = 0.5;
  tracer.minSamples = 1;
  tracer.renderDelay = 0;
  tracer.fadeDuration = 0;
  tracer.tiles.set(2, 2);
  tracer.setScene(o.scene, camera);
  const started = performance.now();
  while (tracer.samples < samples) {
    tracer.renderSample();
    if (Math.floor(tracer.samples) % 16 === 0) await onFrame();
  }
  // One more sample, read back in the same task: the canvas keeps no picture once it is shown.
  tracer.renderSample();
  const image = o.renderer.domElement.toDataURL("image/png");
  return { seconds: (performance.now() - started) / 1000, image };
}

/** Instanced meshes (fibres) become plain merged meshes: the tracer draws only the first instance. */
function expandInstances(scene: THREE.Scene) {
  const instanced: THREE.InstancedMesh[] = [];
  scene.traverseVisible((x) => {
    if (x instanceof THREE.InstancedMesh) instanced.push(x);
  });
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  for (const mesh of instanced) {
    if (mesh.count === 0 || !mesh.parent) {
      mesh.visible = false;
      continue;
    }
    mesh.updateWorldMatrix(true, false);
    const parts: THREE.BufferGeometry[] = [];
    const base = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    for (const name of Object.keys(base.attributes)) if (!["position", "normal", "color"].includes(name)) base.deleteAttribute(name);
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, m);
      const g = base.clone().applyMatrix4(m);
      const n = g.getAttribute("position").count;
      const own = g.getAttribute("color");
      const colours = new Float32Array(n * 3);
      if (mesh.instanceColor) mesh.getColorAt(i, c);
      else c.set(1, 1, 1);
      for (let k = 0; k < n; k++) {
        const v = own ? [own.getX(k), own.getY(k), own.getZ(k)] : [1, 1, 1];
        colours.set([v[0]! * c.r, v[1]! * c.g, v[2]! * c.b], k * 3);
      }
      g.setAttribute("color", new THREE.BufferAttribute(colours, 3));
      parts.push(g);
    }
    const merged = mergeGeometries(parts);
    if (!merged) continue;
    const material = (mesh.material as THREE.Material).clone() as THREE.MeshStandardMaterial;
    material.vertexColors = true;
    const plain = new THREE.Mesh(merged, material);
    plain.matrixAutoUpdate = false;
    plain.matrix.copy(mesh.matrix);
    mesh.parent.add(plain);
    mesh.visible = false;
  }
}

/** The tracer merges all geometry into one: every mesh gets the same attributes. */
function sameAttributes(scene: THREE.Scene) {
  scene.traverse((x) => {
    if (!(x instanceof THREE.Mesh)) return;
    let g = x.geometry as THREE.BufferGeometry;
    if (x.geometry instanceof THREE.InstancedBufferGeometry) return;
    g = g.clone();
    const n = g.getAttribute("position").count;
    if (!g.getAttribute("normal")) g.computeVertexNormals();
    if (!g.getAttribute("uv")) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    if (!g.getAttribute("color")) g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
    for (const name of Object.keys(g.attributes)) if (!["position", "normal", "uv", "color"].includes(name)) g.deleteAttribute(name);
    x.geometry = g;
  });
}
