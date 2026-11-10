import * as THREE from "three";
import type { Look } from "../tying/simulate";

/** Surface materials per look, shared between meshes of the same look and colour. */
export class Surfaces {
  private cache = new Map<string, THREE.Material>();

  /** `fibres`: for fibre meshes, which carry vertex colours (tip shading). */
  /** `finish`: a kind's own finish, where it differs from its look's (matt ostrich herl, dull lead wire). */
  get(look: Look | "stem" | "metal" | "varnish", color: string, fibres = false, finish?: "matt" | "dull"): THREE.Material {
    const key = `${look}:${color}:${fibres}:${finish ?? ""}`;
    let m = this.cache.get(key);
    if (!m) {
      m = create(look, color, fibres, finish);
      this.cache.set(key, m);
    }
    return m;
  }

  dispose() {
    for (const m of this.cache.values()) m.dispose();
    this.cache.clear();
  }
}

/**
 * Feathers, fur and hair are never paper-white: a mass of fibres shades itself. Capping their
 * lightness keeps white wings, tails and posts visible against the light plates.
 */
export function natural(color: string): THREE.Color {
  const c = new THREE.Color(color);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  return hsl.l > 0.74 ? c.setHSL(hsl.h, hsl.s, 0.74) : c;
}

function create(look: Look | "stem" | "metal" | "varnish", color: string, vertexColors: boolean, finish?: "matt" | "dull"): THREE.Material {
  const fibres = { vertexColors };
  if (finish === "matt" && look === "herl") return new THREE.MeshStandardMaterial({ color: natural(color), roughness: 1, ...fibres });
  if (finish === "dull" && look === "wire") return new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.55, ...fibres });
  switch (look) {
    case "thread":
    case "floss":
      return new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.05 });
    case "varnish":
      // Thread under head varnish: a hard, clear coat over the turns.
      return new THREE.MeshPhysicalMaterial({ color, roughness: 0.45, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.08 });
    case "yarn":
      return new THREE.MeshStandardMaterial({ color: natural(color), roughness: 0.95, ...fibres });
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
      return new THREE.MeshStandardMaterial({ color: natural(color), roughness: 0.55, ...fibres });
    case "dubbing":
      return new THREE.MeshStandardMaterial({ color: natural(color), roughness: 1, ...fibres });
    case "hair":
      return new THREE.MeshStandardMaterial({ color: natural(color), roughness: 0.7, ...fibres });
    case "fibres":
      return new THREE.MeshStandardMaterial({ color: natural(color), roughness: 0.6, ...fibres });
    case "feather":
      return new THREE.MeshStandardMaterial({ color: natural(color), roughness: 0.8, side: THREE.DoubleSide, ...fibres });
    case "stem":
      return new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
    case "wire":
    case "tinsel":
    case "bead":
    case "metal":
      return new THREE.MeshStandardMaterial({ color, roughness: 0.22, metalness: 0.95, ...fibres });
    case "eyes":
      // Painted or plated: shiny but not mirror-like.
      return new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.6 });
    case "chenille":
      return new THREE.MeshStandardMaterial({ color: natural(color), roughness: 1, ...fibres });
    case "biot":
      return new THREE.MeshStandardMaterial({ color: natural(color), roughness: 0.45, ...fibres });
    case "marabou":
    case "cdc":
      return new THREE.MeshStandardMaterial({ color: natural(color), roughness: 1, ...fibres });
    case "flash":
      return new THREE.MeshPhysicalMaterial({
        color, roughness: 0.15, metalness: 0.7, iridescence: 0.8, iridescenceIOR: 1.5, ...fibres,
      });
    case "foam":
      return new THREE.MeshStandardMaterial({ color, roughness: 0.75 });
    case "legs":
      // Rubber and silicone: a soft sheen.
      return new THREE.MeshStandardMaterial({ color, roughness: 0.45, ...fibres });
    case "strip":
      // Fur and its hide: soft, with a little sheen on the guard hairs.
      return new THREE.MeshStandardMaterial({ color: natural(color), roughness: 0.75, side: THREE.DoubleSide, ...fibres });
    case "tubing":
      // Braided Mylar: bright metallic strands with a pearly play of colour.
      return new THREE.MeshPhysicalMaterial({
        color, roughness: 0.28, metalness: 0.8, iridescence: 0.7, iridescenceIOR: 1.5, side: THREE.DoubleSide, ...fibres,
      });
  }
}
