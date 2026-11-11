import { describe, expect, it } from "vitest";
import { unsafeForShadows } from "./FlyScene";

// Shadows are a second drawing of the fly each frame, and on some graphics they do harm.
describe("graphics that shadows are not for", () => {
  it("leaves out the Pixel 10 family's GPU, which loses its WebGL context drawing them", () => {
    expect(unsafeForShadows("ANGLE (Imagination Technologies, PowerVR D-Series DXT-48-1536, OpenGL ES 3.2)")).toBe(true);
  });

  it("leaves out WebGL drawn on the processor", () => {
    expect(unsafeForShadows("ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)")).toBe(true);
    expect(unsafeForShadows("llvmpipe (LLVM 15.0.7, 256 bits)")).toBe(true);
  });

  it("keeps them on other phones' and on desktop graphics", () => {
    for (const renderer of [
      "ANGLE (ARM, Mali-G715, OpenGL ES 3.2)",
      "ANGLE (Qualcomm, Adreno (TM) 750, OpenGL ES 3.2)",
      "Apple GPU",
      "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 (0x00002504) Direct3D11 vs_5_0 ps_5_0, D3D11)",
      "ANGLE (Intel, Mesa Intel(R) Xe Graphics (TGL GT2), OpenGL 4.6)",
      "",
    ])
      expect(unsafeForShadows(renderer), renderer).toBe(false);
  });
});
