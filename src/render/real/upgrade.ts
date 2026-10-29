import * as THREE from "three";

/**
 * Physical materials for the realistic view: a soft sheen on fur, hair and other matt fibres.
 * The tying view keeps the plain materials; `restore` puts them back.
 */
export function realMaterials(root: THREE.Object3D): () => void {
  const swapped: [THREE.Mesh, THREE.Material | THREE.Material[]][] = [];
  const made = new Map<THREE.Material, THREE.Material>();
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || Array.isArray(o.material)) return;
    const s = o.material;
    if (!(s instanceof THREE.MeshStandardMaterial) || s instanceof THREE.MeshPhysicalMaterial) return;
    let p = made.get(s);
    if (!p) {
      const physical = new THREE.MeshPhysicalMaterial();
      THREE.MeshStandardMaterial.prototype.copy.call(physical, s);
      // The standard copy leaves only the standard shader's defines.
      physical.defines = { STANDARD: "", PHYSICAL: "" };
      if (s.metalness < 0.5 && s.roughness >= 0.9) {
        // Assumption: matt fibres (fur, wool, hair) catch a soft sheen at grazing angles.
        physical.sheen = 0.6;
        physical.sheenRoughness = 0.5;
        physical.sheenColor = s.color.clone().lerp(new THREE.Color(1, 0.96, 0.9), 0.3);
        physical.roughness = 0.85;
      }
      made.set(s, (p = physical));
    }
    swapped.push([o, s]);
    o.material = p;
  });
  return () => {
    for (const [mesh, material] of swapped) mesh.material = material;
    for (const m of made.values()) m.dispose();
  };
}
