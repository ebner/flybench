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
export function shadowsCapable(): boolean {
  if (typeof window === "undefined" || shadowTrouble) return false;
  // Not on phones and tablets: after shadows came to the 3D view (2026-11-10) it stopped
  // starting at all in Chrome on a Pixel 10 Pro, with "WebGL turned off", which is what Chrome
  // says once a page has lost its graphics context too often. Shadows are the one heavy thing
  // that view gained; until they are seen to work on such devices, those go without.
  if (typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches) return false;
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  // Assumption: as for the realistic water, below 4 GB of memory or 4 cores the extra pass stutters.
  if (nav.deviceMemory !== undefined && nav.deviceMemory < 4) return false;
  if (nav.hardwareConcurrency !== undefined && nav.hardwareConcurrency < 4) return false;
  // (Whether WebGL is drawn in software the scene sees from its own context: no context is
  // made here just to ask.)
  return true;
}

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
