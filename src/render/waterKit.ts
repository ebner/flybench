/**
 * Everything the fly's 3D scene needs to put it in water, drawn or realistic. Fetched by the
 * scene the first time a fly goes in the water (FlyScene.setWater), so a view at the vise
 * doesn't carry it.
 */
export { patchFogForWater, Water, waveHeight } from "./water";
export { RealWater } from "./real/RealWater";
export { realMaterials } from "./real/upgrade";
export { MAX_DIMPLES, rippleHeight } from "./real/waves";
export { clinchKnot, tippetDimples, tippetGeometry, tippetMesh, tippetPath } from "./real/tippet";
export { CLINGS, wetFly } from "./real/wet";
export { bedShadows } from "./real/shadows";
