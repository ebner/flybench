import * as THREE from "three";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";

/**
 * What the realistic water view is made of, beyond the recipes: a photographed river panorama
 * for sky, light and reflections, and a photoscanned gravel bed (Poly Haven, CC0). The site
 * serves its own copies (public/env/); the build-time stills may use sharper ones.
 */
export interface RealAssetUrls {
  sky: string;
  gravel: { color: string; normal: string; height: string };
}

export interface RealAssets {
  sky: THREE.DataTexture;
  /** Where the panorama's sun is, around +y from +z towards +x (radians). */
  sunAzimuth: number;
  /** How high the panorama's sun stands above the horizon (radians). */
  sunElevation: number;
  gravel: {
    color: THREE.Texture;
    normal: THREE.Texture;
    /** The scan's height at texture coordinates (u, v), 0–1; it repeats. */
    height: (u: number, v: number) => number;
  };
}

/** The site's own copies, under its base address. */
export function siteAssets(base: string): RealAssetUrls {
  return {
    sky: `${base}env/river-sky.hdr`,
    gravel: { color: `${base}env/gravel-color.webp`, normal: `${base}env/gravel-normal.webp`, height: `${base}env/gravel-height.webp` },
  };
}

const loading = new Map<string, Promise<RealAssets>>();

/** Loads the assets once per set of addresses; later calls share the result. */
export function loadRealAssets(urls: RealAssetUrls): Promise<RealAssets> {
  const key = JSON.stringify(urls);
  let p = loading.get(key);
  if (!p) {
    p = load(urls);
    // A failure (offline, say) may be retried later.
    p.catch(() => loading.delete(key));
    loading.set(key, p);
  }
  return p;
}

async function load(urls: RealAssetUrls): Promise<RealAssets> {
  const textures = new THREE.TextureLoader();
  const [sky, color, normal, height] = await Promise.all([
    new HDRLoader().loadAsync(urls.sky),
    textures.loadAsync(urls.gravel.color),
    textures.loadAsync(urls.gravel.normal),
    textures.loadAsync(urls.gravel.height),
  ]);
  sky.mapping = THREE.EquirectangularReflectionMapping;
  color.colorSpace = THREE.SRGBColorSpace;
  for (const t of [color, normal]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
  }
  const sun = findSun(sky);
  return { sky, sunAzimuth: sun.azimuth, sunElevation: sun.elevation, gravel: { color, normal, height: heights(height.image as HTMLImageElement | ImageBitmap) } };
}

/** Where the brightest point in the upper half of an equirectangular panorama is: its azimuth and elevation. */
function findSun(hdr: THREE.DataTexture): { azimuth: number; elevation: number } {
  const { data, width, height } = hdr.image as { data: ArrayLike<number>; width: number; height: number };
  const value = data instanceof Uint16Array ? THREE.DataUtils.fromHalfFloat : (v: number) => v;
  let best = -1;
  let bestU = 0;
  let bestV = 0;
  for (let y = 0; y < height / 2; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const l = value(data[i]!) + value(data[i + 1]!) + value(data[i + 2]!);
      if (l > best) {
        best = l;
        bestU = x / width;
        bestV = (y + 0.5) / height;
      }
    }
  }
  // three's equirectangular mapping: u = atan(dir.z, dir.x) / 2π + 0.5.
  const phi = (bestU - 0.5) * 2 * Math.PI;
  // Rows run from straight up (the first) to straight down.
  return { azimuth: Math.atan2(Math.cos(phi), Math.sin(phi)), elevation: (0.5 - bestV) * Math.PI };
}

/** Bilinear samples of a greyscale height map, wrapping at the edges. */
function heights(image: HTMLImageElement | ImageBitmap): (u: number, v: number) => number {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(image, 0, 0);
  const { data, width: w, height: h } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const at = (i: number, j: number) => data[(((j % h) + h) % h * w + (((i % w) + w) % w)) * 4]! / 255;
  return (u, v) => {
    const x = (((u % 1) + 1) % 1) * w;
    const y = (1 - (((v % 1) + 1) % 1)) * h;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    return (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy) + (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy;
  };
}
