/**
 * Whether this device gets the realistic water (its panorama and gravel are a few megabytes, and
 * it draws the scene three times a frame). Reduced motion, a slow device or a data saver keep the
 * drawn water.
 */
export function realisticCapable(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  if (nav.connection?.saveData) return false;
  // Assumption: below 4 GB of memory or 4 cores the extra passes stutter.
  if (nav.deviceMemory !== undefined && nav.deviceMemory < 4) return false;
  if (nav.hardwareConcurrency !== undefined && nav.hardwareConcurrency < 4) return false;
  return !softwareRendering();
}

/**
 * Whether the fly's 3D view starts with its shadows (a second drawing of the fly each frame).
 * A view that then draws slowly drops them itself.
 */
export function shadowsCapable(): boolean | "force" {
  if (typeof window === "undefined") return false;
  // For trying a device out: ?shadows=1 in the address forces them on, ?shadows=0 off.
  if (asked === "1") return "force";
  if (asked === "0" || shadowTrouble) return false;
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  // Assumption: as for the realistic water, below 4 GB of memory or 4 cores the extra pass stutters.
  if (nav.deviceMemory !== undefined && nav.deviceMemory < 4) return false;
  if (nav.hardwareConcurrency !== undefined && nav.hardwareConcurrency < 4) return false;
  // (Whether the graphics can take them, the scene sees from its own context: software
  // drawing, or a GPU that loses its context drawing them. See FlyScene's `shadowsUnsafe`.)
  return true;
}

/** What the address said about shadows when the page was opened (the app rewrites addresses later). */
const asked = typeof location === "undefined" ? null : new URLSearchParams(location.search).get("shadows");

/** A 3D view with shadows lost its graphics context or couldn't start: no more shadows on this page. */
let shadowTrouble = false;
export function noteShadowTrouble(): void {
  shadowTrouble = true;
}

let software: boolean | null = null;

/** WebGL drawn on the processor (no usable graphics driver): a few frames a second at best. */
function softwareRendering(): boolean {
  if (software !== null) return software;
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    const info = gl?.getExtension("WEBGL_debug_renderer_info");
    const name = gl && info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
    software = /swiftshader|llvmpipe|softpipe|software/i.test(name);
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    software = false;
  }
  return software;
}
