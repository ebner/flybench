import * as THREE from "three";
import type { Look } from "../tying/simulate";

/** Surface materials per look, shared between meshes of the same look and colour. */
export class Surfaces {
  private cache = new Map<string, THREE.Material>();

  /** `fibres`: for fibre meshes, which carry vertex colours (tip shading). */
  get(look: Look | "stem" | "metal", color: string, fibres = false): THREE.Material {
    const key = `${look}:${color}:${fibres}`;
    let m = this.cache.get(key);
    if (!m) {
      m = create(look, color, fibres);
      this.cache.set(key, m);
    }
    return m;
  }

  dispose() {
    for (const m of this.cache.values()) m.dispose();
    this.cache.clear();
  }
}

function create(look: Look | "stem" | "metal", color: string, vertexColors: boolean): THREE.Material {
  const fibres = { vertexColors };
  switch (look) {
    case "thread":
    case "floss":
      return new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.05 });
    case "yarn":
      return new THREE.MeshStandardMaterial({ color, roughness: 0.95, ...fibres });
    case "herl":
      // Peacock herl: dark bronze-green with a strong iridescent sheen.
      return new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.4,
        metalness: 0.2,
        iridescence: 1,
        iridescenceIOR: 1.6,
        iridescenceThicknessRange: [250, 520],
        ...fibres,
      });
    case "hackle":
      return new THREE.MeshStandardMaterial({ color, roughness: 0.55, side: THREE.DoubleSide, ...fibres });
    case "dubbing":
      return new THREE.MeshStandardMaterial({ color, roughness: 1, ...fibres });
    case "hair":
      return new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...fibres });
    case "fibres":
      return new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...fibres });
    case "feather":
      return new THREE.MeshStandardMaterial({ color, roughness: 0.8, side: THREE.DoubleSide, ...fibres });
    case "stem":
      return new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
    case "wire":
    case "metal":
      return new THREE.MeshStandardMaterial({ color, roughness: 0.25, metalness: 0.9 });
  }
}
