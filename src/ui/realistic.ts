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
