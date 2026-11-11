import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { pieceProgress, stepAt, stepEnd, stepProgress, wrapAt, wrapPoint, type Build, type FreeEndPose, type WrapsPiece } from "../tying/simulate";
import { buildHook } from "./hook";
import { buildNatural, disposeNatural } from "./natural";
import type { Natural } from "../recipe/natural";
import { proportions } from "../tying/proportions";
import { BobbinView, LooseEndView } from "./loose";
import { Surfaces } from "./materials";
import { pieceView, smooth, type PieceView } from "./pieces";
import { ShankSpace } from "./space";
import type { Water, WaterLook } from "./water";
import { CLUMPS, HOLDS_AIR, WET_SPREAD, type Fishing } from "../tying/fishing";
import { mulberry32 } from "./random";
import type { RealAssets } from "./real/assets";
import type { RealWater } from "./real/RealWater";
import type { Dimple } from "./real/waves";

/**
 * The water (drawn and realistic, the tippet, wetness, shadows on the bed): fetched the first
 * time a scene puts its fly in the water, and kept for every scene after.
 */
let kit: typeof import("./waterKit") | null = null;

const Y_UP = new THREE.Vector3(0, 1, 0);
// Assumption: at full strength a mass of hair or marabou shades itself dull and grey; at half,
// wings and hackle still shade the body and bright wings stay bright (chosen by the reviewer
// from a comparison, 2026-11-10).
const SHADOW_STRENGTH = 0.5;
/** WebGL drawn on the processor: a few frames a second at best. */
function drawnInSoftware(gl: WebGLRenderingContext | WebGL2RenderingContext): boolean {
  try {
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    return /swiftshader|llvmpipe|softpipe|software/i.test(info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "");
  } catch {
    return false;
  }
}

/** Where the key light shines from: above, in front and a little to the eye's side. */
const KEY_FROM = new THREE.Vector3(2, 4, 5).normalize();
const Z_AXIS = new THREE.Vector3(0, 0, 1);
// Assumption: a cut end takes about a quarter of its step to drop out of sight, some three gapes down.
const CUT_FALLS = 0.25;
const CUT_DROP = 3;

const REST_DIRECTIONS = {
  "back-down": new THREE.Vector3(-0.8, -1, 0.15).normalize(),
  "back-up": new THREE.Vector3(-0.9, 0.8, 0.2).normalize(),
  out: new THREE.Vector3(0.25, -1, 0.35).normalize(),
  /** Lying back over the bend, waiting to be pulled over the body. */
  "back-flat": new THREE.Vector3(-1, 0.18, 0).normalize(),
  /** Lying back under the bend, waiting to be pulled over the belly. */
  "under-flat": new THREE.Vector3(-1, -0.18, 0).normalize(),
  /** Sticking out forward over the eye, waiting to be folded back. */
  "forward-flat": new THREE.Vector3(1, 0.18, 0).normalize(),
};

/** Camera directions (from the fly towards the camera) for the named views. */
const VIEWS = {
  /** Slightly from above and in front: the interactive default. */
  default: new THREE.Vector3(0.12, 0.12, 1).normalize(),
  /** Straight from the side, eye to the right: the view for measuring proportions. */
  side: new THREE.Vector3(0, 0, 1),
  top: new THREE.Vector3(0, 1, 0.02).normalize(),
  front: new THREE.Vector3(1, 0.05, 0).normalize(),
  behind: new THREE.Vector3(-1, 0.05, 0).normalize(),
  "three-quarter": new THREE.Vector3(0.55, 0.35, 1).normalize(),
  /** In the water, from the side: just above the waterline, looking into a cut-away tank. */
  "water-side": new THREE.Vector3(0, 0.07, 1).normalize(),
  /** In the water, a trout's view: from below and in front, looking up at the fly against the surface. */
  "water-below": new THREE.Vector3(0.25, -1, 0.75).normalize(),
  /**
   * In the realistic water, a trout's view: steeply enough (about 25° from straight up) that the
   * fly sits in Snell's window, the bright circle of sky, as in photos taken from under the water.
   */
  "water-trout": new THREE.Vector3(0.15, -1, 0.42).normalize(),
  /** In the realistic water, the angler's view: from above and in front, looking down onto the water. */
  "water-angler": new THREE.Vector3(0.55, 0.4, 1).normalize(),
  /** In the realistic water, a trout's view of something deep or on the bottom: level with it, a little above the stones. */
  "water-bed": new THREE.Vector3(0.45, 0.5, 1).normalize(),
  /** In the realistic water, the angler looking steeply down on something deep (the water bends a shallow look away). */
  "water-angler-deep": new THREE.Vector3(0.35, 1.3, 0.6).normalize(),
};

export type ViewName = keyof typeof VIEWS;

/** The tippet in the realistic water: the knot on the fly, the line from it (in the fly's frame), its mesh. */
interface WaterLine {
  knot: THREE.Group;
  start: THREE.Vector3;
  direction: THREE.Vector3;
  mesh: THREE.Mesh;
  floating: boolean;
}
export const VIEW_NAMES = Object.keys(VIEWS) as ViewName[];

/** The finished fly (or, in the realistic water, a natural on its own) shown in water. */
export interface WaterSetting {
  fishing: Fishing;
  /** "side" for the drawn water's cut-away tank; "angler" from above in the realistic water; "below" a trout's view. */
  view: "side" | "below" | "angler";
  /** No waves, drift or swimming: the water held still (and for reduced motion). */
  still: boolean;
  look: WaterLook;
  /** Realistic water: a river panorama, a gravel bed, reflection and refraction. Without it, the drawn water. */
  real?: RealAssets;
  /** A finer riverbed (the build-time stills). */
  detailed?: boolean;
}

/**
 * A natural's length in gapes when shown on its own, at its middle size.
 * Assumption: the gape of a #12 hook, about 5 mm, as the unit.
 */
export function naturalAlone(n: Natural): number {
  return (n.size.min + n.size.max) / 2 / 5;
}

/** How a natural is shown in the realistic water, from where it is found. */
export function naturalFishing(n: Natural): Fishing {
  switch (n.rides) {
    case "on-surface":
      return { depth: "surface", motion: "drift", hang: 0, sits: n.sits ?? "feet" };
    case "in-film":
      // Assumption: an emerger hangs tail down in the film, as an emerger pattern does.
      // An adult that has fallen in (an ant, a beetle) lies awash, half under.
      return { depth: "film", motion: "drift", hang: n.stage === "emerger" ? 35 : 0, ...(n.stage === "adult" && { sits: "half" as const }) };
    case "swimming":
      return { depth: "below", motion: "swim", hang: 0 };
    case "crawling":
      return { depth: "deep", motion: "drift", hang: 0 };
    default:
      return { depth: "below", motion: "drift", hang: 0 };
  }
}

/** The vertical field of view of a 3D view on a page, in degrees (the default). */
const VIEW_FOV = 32;

export interface FlySceneOptions {
  /** Vertical field of view in degrees. A narrow one gives a nearly distortion-free view for measuring. */
  fov?: number;
  /** Background colour; null for a transparent canvas. */
  background?: string | null;
  /**
   * For a view on a page: when frames come slowly while the fly moves, it is drawn a little
   * less sharp until it is still again. Never for pictures (the build's renders, snapshots).
   */
  adaptive?: boolean;
  /** Drawn at the screen's full pixel density, whatever it is (the build's pictures); a view on a page stops at 2. */
  fullDensity?: boolean;
  /**
   * The key light casts soft shadows: wings and hackle on the body, the fly on itself. In an
   * `adaptive` view they are dropped for good once frames come slowly.
   */
  shadows?: boolean;
}

/** Direction the thread (or a material end) leaves the shank when the wrap is at `angle`. */
function leaveDirection(angle: number, target = new THREE.Vector3()) {
  return target.set(0, -Math.cos(angle), Math.sin(angle));
}

/**
 * Owns the three.js scene for one fly. The scene is a pure function of time:
 * `setTime(t)` shows exactly what the timeline says for t, so scrubbing and
 * replaying need no extra state.
 */
export class FlyScene {
  private renderer: THREE.WebGLRenderer;
  private environment!: THREE.WebGLRenderTarget;
  /** The studio lights; the realistic water is lit by its panorama alone. */
  private lights!: THREE.Light[];
  private key!: THREE.DirectionalLight;
  private shadows = false;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private surfaces = new Surfaces();
  private fly = new THREE.Group();
  /** Holds the fly; moves it as the water carries it, without touching the fly's own transform. */
  private rig = new THREE.Group();
  private hook: THREE.Group | null = null;
  /** `eased`: moves that start and stop (all but winding, which the thread and the material's end follow turn by turn). */
  private stepViews: { piece: PieceView; window: [number, number]; until?: number; eased: boolean }[][] = [];
  private wraps = new Map<number, WrapsPiece>();
  private bobbin: BobbinView | null = null;
  private looseEnds = new Map<string, LooseEndView>();
  private build: Build | null = null;
  private space: ShankSpace | null = null;
  private resizeObserver!: ResizeObserver;
  private frame = 0;
  private baseMaxDistance!: number;
  /** Bounds of the finished fly, which the default view frames. */
  private finished = new THREE.Box3();
  /** Once the user orbits or zooms, resizing no longer re-frames the fly. */
  private userMoved = false;
  /** Turned or zoomed by hand since this scene was made: the slow turn stays off. */
  private handled = false;
  /** Seconds a turn of the slow turn takes; 0 while not turning. Turned here rather than by the
   * controls' own auto-rotation, whose damping carries it on for a while after it stops. */
  private turnSeconds = 0;
  /** Which way round the camera was when the slow turn began (an angle round the vertical), to go back to after it. */
  private turnedFrom: number | null = null;
  private turningBack = false;
  private view: ViewName = "default";
  /** Degrees the view is turned around the vertical axis (turntables). */
  private orbit = 0;
  /**
   * "box" frames the fly as tightly as the view allows; "sphere" frames its bounding
   * sphere, so the size stays the same from every angle (turntables).
   */
  private fit: "box" | "sphere" = "box";
  private grid: THREE.Group | null = null;
  /** The proportion guide: a measurement for each part, shown once its step is reached. */
  private guide: THREE.Group | null = null;
  private guideColor = "#2a4a6a";
  private guideView = false;
  /** A natural (insect, shrimp, fish) shown beside or over the fly, or on its own. */
  private natural: THREE.Group | null = null;
  /** What the natural was built from, to build it again on the water. */
  private naturalData: Natural | null = null;
  /** The time last shown, so re-measuring can come back to it. */
  private time = 0;
  private water: {
    setting: WaterSetting;
    view: Water | RealWater;
    /** What is in the water: the finished fly, or a natural on its own (moved into the rig while there). */
    subject: "fly" | "natural";
    /** A natural's own transform before it went into the water. */
    home: THREE.Matrix4;
    /** Puts back what the realistic water changed: materials, sky and lights. */
    restore: (() => void) | null;
    level: number;
    pivot: THREE.Vector3;
    /** The fly as it hangs in the water, for framing. */
    bounds: THREE.Box3;
    /** How the fly hangs in the water before it moves (tail down in the film). */
    hang: THREE.Matrix4;
    bubbles: THREE.InstancedMesh | null;
    /** Soft fibres under water, drawn closer to the shank. */
    soft: THREE.Object3D[];
    /** The realistic water's tippet: the knot on the fly, the line from it (redrawn as the fly moves). */
    line: WaterLine | null;
  } | null = null;
  /** Seconds of water motion shown, kept apart from the tying timeline. */
  private waterTime = 0;

  /** Follow the action: the camera eases towards whatever the current step works on. */
  private follow = false;
  /** Bounds of what each step adds, for following the action. */
  private stepBounds: THREE.Box3[] = [];
  private hookBounds = new THREE.Box3();
  /** A new fly: the following camera takes its framing at once instead of easing to it. */
  private followFresh = true;
  private currentStep = 0;
  private atEnd = false;
  /** What resetCamera frames: the whole fly, or only what is tied on the hook (material swatches). */
  private framing: "fly" | "dressing" = "fly";
  /** World point the current step works at (thread contact, material being wound), for callouts. */
  private anchor = new THREE.Vector3();
  private lastFrame = 0;
  /** Called when the user takes over the camera, which stops following. */
  onFollowChange?: (follow: boolean) => void;
  /** Called every frame with the screen position (CSS pixels) of the current step's anchor. */
  /**
   * Where the step's label points, and the screen box of the fly as tied so far (so the label
   * can sit clear of it), in CSS pixels; null when there is nothing to label.
   */
  onAnchor?: (point: { x: number; y: number } | null, fly?: { left: number; top: number; right: number; bottom: number }) => void;
  /** The builder's focus (the steps shown in full), the meshes made faint and their own materials, the faint copies. */
  private focus: ReadonlySet<number> | null = null;
  private fainted = new Map<THREE.Mesh, THREE.Material>();
  private faintOf = new Map<THREE.Material, THREE.Material>();
  private depthOnly: THREE.Material | null = null;
  private focusThread = false;
  /** After each frame is drawn: for overlays that follow the fly (the builder's handles). */
  onDraw?: () => void;
  private disposed = false;
  /** Counts the calls of setWater, so one answered late (its code just fetched) doesn't undo a later one. */
  private waterAsked = 0;
  /** Something has changed that the next frame must show; frames are only drawn then. */
  private dirty = true;
  /** Out of sight (scrolled away): nothing is drawn until it is back. */
  private offscreen = false;
  private seen: IntersectionObserver | null = null;
  /** The sharpness the screen asks for, and the one in use (lower while slow frames go by). */
  private fullRatio = 1;
  private ratio = 1;
  private adaptive = false;
  private slowFrames = 0;
  private stillFrames = 0;
  /** Whether the key light casts shadows in this scene (now). */
  get hasShadows(): boolean {
    return this.shadows;
  }
  /** Called when the browser takes the WebGL context away (true) and when it gives it back. */
  onContextLost?: (lost: boolean) => void;

  constructor(
    private container: HTMLElement,
    options: FlySceneOptions = {},
  ) {
    this.camera = new THREE.PerspectiveCamera(options.fov ?? VIEW_FOV, 1, 0.05, 500);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: options.background === null });
    try {
      this.start(options);
    } catch (e) {
      // Nothing left behind: a browser allows only a few WebGL contexts, and the page may try again.
      cancelAnimationFrame(this.frame);
      (this.resizeObserver as ResizeObserver | undefined)?.disconnect();
      this.seen?.disconnect();
      this.renderer.dispose();
      this.renderer.forceContextLoss();
      this.renderer.domElement.remove();
      throw e;
    }
  }

  private start(options: FlySceneOptions) {
    const container = this.container;
    // Shadows are a second drawing of the fly each frame: not where WebGL is drawn on the
    // processor (no usable graphics driver), which this context itself can tell.
    if (options.shadows && drawnInSoftware(this.renderer.getContext())) options = { ...options, shadows: false };
    this.fullRatio = this.ratio = options.fullDensity ? window.devicePixelRatio : Math.min(window.devicePixelRatio, 2);
    this.adaptive = options.adaptive ?? false;
    this.renderer.setPixelRatio(this.ratio);
    // Khronos' neutral curve, made for showing things in their true colours: bright, saturated
    // materials (hot orange, chartreuse) keep their colour, where a film-like curve washes them out.
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    if (options.shadows) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    this.shadows = !!options.shadows;
    container.appendChild(this.renderer.domElement);

    this.environment = this.makeEnvironment();
    // Assumption: toned down so material colours read close to their swatches.
    this.scene.environmentIntensity = 0.75;
    // The browser may take the context away (a phone back from another app, a GPU reset):
    // three.js rebuilds what it uploaded when it comes back; the surroundings, drawn once
    // into a texture, are made again here.
    const canvas = this.renderer.domElement;
    canvas.addEventListener("webglcontextlost", (e) => {
      // Its own doing, when the scene is disposed of.
      if (this.disposed) return;
      e.preventDefault();
      this.onContextLost?.(true);
    });
    canvas.addEventListener("webglcontextrestored", () => {
      this.environment.dispose();
      this.environment = this.makeEnvironment();
      this.dirty = true;
      this.onContextLost?.(false);
    });
    this.setBackground(options.background === undefined ? "#e8e5de" : options.background);

    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.copy(KEY_FROM);
    this.lights = [key, new THREE.HemisphereLight(0xffffff, 0x8a8070, 0.6)];
    this.scene.add(...this.lights);
    this.key = key;
    if (this.shadows) {
      key.castShadow = true;
      // Fine fibres: a large map, softened, and biased so they don't shade themselves in stripes.
      const size = options.fullDensity ? 4096 : 2048;
      key.shadow.mapSize.set(size, size);
      key.shadow.radius = 3;
      key.shadow.bias = -0.0004;
      key.shadow.normalBias = 0.008;
      key.shadow.intensity = SHADOW_STRENGTH;
      this.scene.add(key.target);
    }
    this.rig.matrixAutoUpdate = false;
    this.rig.add(this.fly);
    this.scene.add(this.rig);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    // One finger scrolls the page past the view; two fingers turn and zoom the fly.
    this.controls.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_ROTATE };
    this.renderer.domElement.style.touchAction = "pan-y";
    this.controls.minDistance = 0.8;
    // Allow at least the distance a narrow field of view needs to frame the fly; framing a
    // long fly in a narrow viewport raises it (see allowDistance).
    this.baseMaxDistance = 14 * Math.max(1, 32 / (options.fov ?? VIEW_FOV));
    this.controls.maxDistance = this.baseMaxDistance;
    this.controls.addEventListener("start", () => this.takeOver());

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    if (typeof IntersectionObserver === "function") {
      this.seen = new IntersectionObserver(([entry]) => {
        this.offscreen = !entry!.isIntersecting;
        this.dirty = true;
      });
      this.seen.observe(container);
    }

    const loop = (now: number) => {
      this.frame = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - (this.lastFrame || now)) / 1000);
      this.lastFrame = now;
      // Following waits while the fly is in the water, and goes on when it is back at the vise.
      if (this.follow && !this.water) this.followAction(dt);
      if (this.water && !this.water.setting.still) this.setWaterTime(this.waterTime + dt);
      if (this.turnSeconds > 0) this.turnBy((2 * Math.PI * dt) / this.turnSeconds);
      if (this.turningBack) this.turnBack(dt);
      // Whatever moved the camera (the hand, following, the slow turn), the controls notice.
      const moved = this.controls.update();
      const flowing = !!this.water && !this.water.setting.still;
      if (this.offscreen) return;
      if (!moved && !this.dirty && !flowing) return this.settle();
      this.dirty = false;
      this.pace(dt);
      this.draw();
      this.reportAnchor();
      this.onDraw?.();
    };
    this.frame = requestAnimationFrame(loop);
  }

  /** Shows a fly; `keepCamera` leaves the view as it is (the builder, while a part is being dragged). */
  setBuild(build: Build, keepCamera = false) {
    this.dirty = true;
    this.setFocus(null);
    this.clearFly();
    this.build = build;
    this.space = new ShankSpace(build.hook);
    this.hook = buildHook(build.hook);
    this.fly.add(this.hook);

    for (const step of build.steps) {
      this.stepViews.push(
        step.pieces.map((p) => {
          if (p.type === "wraps") this.wraps.set(p.id, p);
          const piece = pieceView(p, this.surfaces, this.space!);
          this.fly.add(piece.object);
          return { piece, window: p.window, until: p.until, eased: p.type !== "wraps" };
        }),
      );
    }
    this.bobbin = new BobbinView(build.threadRadius, build.threadColor, this.surfaces);
    this.fly.add(this.bobbin.object);
    this.time = 0;
    this.measure(keepCamera);
    if (this.grid) this.setGrid(true, undefined, !keepCamera);
    if (this.guide) this.setProportions(true);
  }

  /**
   * The proportion guide: the gape grid behind the fly, and labelled measurements of each
   * part (tail and wing lengths, hackle fibres, how much of the shank the body covers), each
   * appearing with the step that ties it. `color` is the theme's ink for lines and labels.
   */
  setProportions(on: boolean, color?: string) {
    this.dirty = true;
    // Already showing: a new colour (the theme changed) or a rebuild leaves the camera where it is.
    const redraw = on && this.guide !== null;
    if (color) this.guideColor = color;
    if (this.guide) {
      disposeTree(this.guide);
      this.fly.remove(this.guide);
      this.guide = null;
    }
    // Proportions are judged from the side, square to the grid: no slow turn meanwhile.
    if (on) {
      this.turnSeconds = 0;
      this.turningBack = false;
    }
    if (on !== this.guideView) {
      this.guideView = on;
      this.setView(on ? "side" : "default", 0, this.fit);
    }
    this.setGrid(on, this.guideColor, !redraw);
    if (!on || !this.build) return;
    const guide = new THREE.Group();
    const space = this.space!;
    const at = (x: number, y: number) => space.point(new THREE.Vector3(x, y, 0));
    // Lengthwise measurements stack above the fly, each on its own line.
    const local = this.finished.clone().applyMatrix4(this.fly.matrixWorld.clone().invert());
    const size = local.getSize(new THREE.Vector3());
    // Labels and spacing in proportion to the fly, so they read the same on a midge and a streamer.
    const h = Math.max(0.2, 0.07 * Math.max(size.x, size.y));
    let level = 0;
    for (const d of proportions(this.build)) {
      const item = new THREE.Group();
      item.userData.step = d.step;
      if (d.kind === "along") {
        const y = local.max.y + 1.6 * h + 2 * h * level++;
        const a = at(d.x0, y);
        const b = at(d.x1, y);
        item.add(guideLines([a, b, a, a.clone().setY(a.y - h / 2), b, b.clone().setY(b.y - h / 2)], this.guideColor));
        item.add(guideLabel(d.label, a.clone().lerp(b, 0.5).setY(y + 0.75 * h), this.guideColor, "center", h));
      } else {
        const sign = d.side === "top" ? 1 : -1;
        const a = at(d.x, sign * d.r);
        const b = at(d.x, sign * (d.r + d.length));
        item.add(guideLines([a, b, b.clone().setX(b.x - h / 3), b.clone().setX(b.x + h / 3)], this.guideColor));
        item.add(guideLabel(d.label, b.clone().setX(b.x + h / 2), this.guideColor, "left", h));
      }
      guide.add(item);
    }
    this.guide = guide;
    this.fly.add(guide);
    this.showGuide();
    // Framed again now that the measurements are there (following does this by itself).
    if (!redraw) this.resetCamera();
  }

  private showGuide() {
    if (!this.guide) return;
    for (const item of this.guide.children) item.visible = this.atEnd || item.userData.step <= this.currentStep;
  }

  /** Shows the fly upside down, turned about the shank, the way a point-up fly swims. */
  setTurnedOver(on: boolean) {
    this.dirty = true;
    if (this.fly.rotation.x === (on ? Math.PI : 0)) return;
    this.fly.rotation.x = on ? Math.PI : 0;
    this.fly.updateMatrixWorld(true);
    if (this.build) this.measure();
  }

  /** Bounds of each step and of the finished fly, for framing; then back to the current time. */
  private measure(keepCamera = false) {
    const build = this.build!;
    const time = this.time;
    // Measured where the fly is tied, not where the water has carried it.
    const water = this.water?.setting ?? null;
    if (water) this.setWater(null);
    this.stepBounds = build.steps.map((step, i) => {
      this.setTime(stepEnd(step));
      const box = this.visibleBounds(this.stepViews[i]!.map((v) => v.piece.object));
      return box.isEmpty() ? new THREE.Box3() : box;
    });
    this.setTime(build.duration);
    this.finished = this.visibleBounds();
    this.hookBounds = this.visibleBounds([this.hook!]);
    if (this.shadows) this.aimShadows();
    this.followFresh = true;
    if (!keepCamera) this.resetCamera();
    this.setTime(time);
    if (water) this.setWater(water);
  }

  /**
   * The finished fly in water, placed by how it fishes: riding on the surface, hanging in the
   * film, just under or deep. In the realistic water a natural shown on its own can go in too,
   * placed by where it is found. null takes it back to the vise.
   */
  /**
   * Puts the fly in the water, or takes it out (null). The first time, the water's code is
   * fetched first: the promise is done when the water is there. Later calls, and taking the fly
   * out, happen at once.
   */
  setWater(setting: WaterSetting | null): Promise<void> {
    const asked = ++this.waterAsked;
    if (!setting || kit) {
      this.applyWater(setting);
      return Promise.resolve();
    }
    return import("./waterKit").then((loaded) => {
      kit = loaded;
      // Unless the scene has gone, or been asked for something else, meanwhile.
      if (asked === this.waterAsked && !this.disposed) this.applyWater(setting);
    });
  }

  private applyWater(setting: WaterSetting | null) {
    if (setting) kit!.patchFogForWater();
    this.dirty = true;
    // Stilling the water or a new theme keeps the camera where the visitor put it.
    const before = this.water?.setting;
    const sameView = !!before && !!setting && before.view === setting.view && before.fishing === setting.fishing && !!before.real === !!setting.real;
    if (this.water) {
      this.water.view.dispose();
      this.scene.remove(this.water.view.group);
      if (this.water.bubbles) {
        this.water.bubbles.dispose();
        this.water.bubbles.geometry.dispose();
        (this.water.bubbles.material as THREE.Material).dispose();
        this.fly.remove(this.water.bubbles);
      }
      for (const o of this.water.soft) o.scale.set(1, 1, 1);
      if (this.water.line) {
        this.fly.remove(this.water.line.knot);
        this.water.line.knot.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.geometry.dispose();
            (o.material as THREE.Material).dispose();
          }
        });
      }
      this.water.restore?.();
      // Back where it was, without the water's motion.
      if (this.water.subject === "natural" && this.natural) {
        this.fly.remove(this.natural);
        this.scene.add(this.natural);
        this.natural.matrix.copy(this.water.home);
        this.natural.matrix.decompose(this.natural.position, this.natural.quaternion, this.natural.scale);
      }
      this.water = null;
      this.scene.fog = null;
      this.rig.matrix.identity();
      this.rig.updateMatrixWorld(true);
    }
    const alone = !this.build && !!this.natural && !!setting?.real;
    if (!setting || (!this.build && !alone)) {
      if (this.view.startsWith("water-")) this.setView("default");
      return;
    }
    let level: number;
    let subject: THREE.Box3;
    // Undoes the fly's wetness (the realistic water's).
    let wet = () => {};
    const home = new THREE.Matrix4();
    if (this.build) {
      this.setTime(this.build.duration);
      subject = this.finished;
      // Deep in the realistic water: room for the camera above the fly, under the surface.
      // Tail down from the front of the shank, for an emerger in the film.
      const front = this.fly.localToWorld(this.space!.point(new THREE.Vector3(0.85 * this.build.hook.shankLength, 0, 0)));
      this.rig.matrix.copy(rotationAbout(front, THREE.MathUtils.degToRad(setting.fishing.hang)));
      const sits = setting.fishing.sits;
      const floats = setting.real && (sits === "hackle" || sits === "body" || sits === "half") ? sits : null;
      const settle = (how: "hackle" | "body" | "half") => {
        // A floating fly comes to rest as it sits, tilted until front and rear both bear.
        this.rig.matrix.identity();
        this.rig.updateMatrixWorld(true);
        const rest = this.restingPose(how);
        this.rig.matrix.copy(rotationAbout(rest.about, rest.angle));
        this.rig.updateMatrixWorld(true);
        return rest.level;
      };
      if (floats) level = settle(floats);
      else level = setting.real && setting.fishing.depth === "deep" ? subject.max.y + deepWater(subject) : waterLevel(setting.fishing.depth, subject);
      if (setting.real) {
        // A fished fly is wet all over, soaked where it is under the water. Wet fibres clump, so
        // a floating fly settles again on them before its contacts are worked out.
        const sunkFly = setting.fishing.depth === "below" || setting.fishing.depth === "deep";
        wet = kit!.wetFly(
          this.build.steps.flatMap((step, i) =>
            step.pieces.map((p, j) => {
              const object = this.stepViews[i]![j]!.piece.object;
              const box = new THREE.Box3().setFromObject(object);
              // Soaked where it is under: a body (not fibres) that is partly under carries water through.
              const soaked = sunkFly || box.getCenter(new THREE.Vector3()).y < level || (box.min.y < level && !kit!.CLINGS.has(p.look));
              return { object, look: p.look, wet: soaked ? ("soaked" as const) : ("damp" as const), under: sunkFly || box.max.y < level };
            }),
          ),
        );
        if (floats) level = settle(floats);
        if (floats === "body" || floats === "half") {
          const lay = this.layWings(level);
          const before = wet;
          wet = () => {
            lay();
            before();
          };
        }
      }
    } else {
      // The natural moves into the rig (still at rest), so the water carries it as it does a fly.
      this.natural!.updateMatrix();
      home.copy(this.natural!.matrix);
      this.fly.attach(this.natural!);
      subject = this.naturalBounds();
      const body = this.natural!.getObjectByName("body");
      // Its bulk: the body, the pronotum and wings folded over its back (a beetle's wing cases).
      const bulk = new THREE.Box3();
      if (body) bulk.expandByObject(body);
      for (const o of this.natural!.children) {
        if (o.userData.part === "pronotum" || (o.userData.part === "wings" && o.userData.shape === "back")) bulk.expandByObject(o);
      }
      level = naturalLevel(setting.fishing, subject, bulk.isEmpty() ? subject : bulk);
      if (setting.fishing.sits === "feet" && body) {
        // Standing, it settles until four of its feet bear on the film, not only the lowest one.
        // A foot is what reaches below the belly; claws and segments close together are one foot.
        const belly = new THREE.Box3().setFromObject(body).min.y;
        const reach = 0.08 * (subject.max.x - subject.min.x);
        const feet: THREE.Vector3[] = [];
        const v = new THREE.Vector3();
        this.natural!.updateMatrixWorld(true);
        this.natural!.traverseVisible((o) => {
          if (!(o instanceof THREE.Mesh) || o instanceof THREE.InstancedMesh || o === body) return;
          const pos = o.geometry.getAttribute("position");
          let low: THREE.Vector3 | null = null;
          for (let i = 0; i < pos.count; i++) {
            v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
            if (!low || v.y < low.y) low = v.clone();
          }
          if (!low || low.y >= belly) return;
          const near = feet.find((f) => Math.hypot(f.x - low!.x, f.z - low!.z) < reach);
          if (!near) feet.push(low);
          else if (low.y < near.y) near.copy(low);
        });
        feet.sort((a, b) => a.y - b.y);
        if (feet.length >= 4) level = feet[3]!.y + 0.02;
        // Assumption: its legs splay on the film until its belly rides just over it, about a tenth
        // of its depth (as a Hexagenia dun's in photos); the film holds the legs (restOnFilm).
        if (!bulk.isEmpty()) level = Math.max(level, bulk.min.y - 0.1 * (bulk.max.y - bulk.min.y));
      }
      // On the surface or awash, its legs, feelers and tails rest on the film, not through it:
      // built again with the film holding them up.
      if (this.naturalData && (setting.fishing.depth === "surface" || (setting.fishing.depth === "film" && setting.fishing.hang === 0))) {
        const dry = this.natural!;
        dry.updateMatrixWorld(true);
        const onWater = buildNatural(this.naturalData, dry.worldToLocal(new THREE.Vector3(0, level, 0)).y);
        onWater.matrix.copy(dry.matrix);
        onWater.matrix.decompose(onWater.position, onWater.quaternion, onWater.scale);
        this.fly.remove(dry);
        this.fly.add(onWater);
        this.natural = onWater;
        wet = () => {
          this.fly.remove(onWater);
          disposeNatural(onWater);
          this.fly.add(dry);
          this.natural = dry;
        };
      }
      const front = new THREE.Vector3(subject.max.x - 0.15 * (subject.max.x - subject.min.x), subject.getCenter(new THREE.Vector3()).y, 0);
      this.rig.matrix.copy(rotationAbout(front, THREE.MathUtils.degToRad(setting.fishing.hang)));
    }
    this.rig.updateMatrixWorld(true);
    const bounds = this.visibleBounds();
    const pivot = bounds.getCenter(new THREE.Vector3());
    const touches = setting.fishing.depth === "surface" || setting.fishing.depth === "film";
    let view: Water | RealWater;
    let restore: (() => void) | null = null;
    let line: WaterLine | null = null;
    if (setting.real) {
      const real = setting.real;
      const crawling = !this.build && setting.fishing.depth === "deep";
      // Assumption: a glide where trout feed, the gravel some 25 cm under the surface (50 gapes on
      // a #12), out of focus and darkened by the water, so the surface carries the picture (the
      // reviewer's choice, 2026-10-30); a fly fished deep and a natural that crawls are near the stones.
      const bed = crawling ? bounds.min.y + 0.1 : setting.fishing.depth === "deep" ? Math.min(level - 8, bounds.min.y - 1.5) : level - 50;
      // The panorama's sun behind the angler's shoulder, a little to the left.
      const angler = VIEWS["water-angler"];
      const sunAzimuth = Math.atan2(angler.x, angler.z) + 0.6;
      const skyRotation = sunAzimuth - real.sunAzimuth;
      const sun = new THREE.Vector3(Math.cos(real.sunElevation) * Math.sin(sunAzimuth), Math.sin(real.sunElevation), Math.cos(real.sunElevation) * Math.cos(sunAzimuth));
      const dimples = touches ? this.contactDimples(level) : [];
      // A fly is fished on a tippet, tied to its eye; through a tube, it comes out of the tube's
      // front (the knot is hidden in the sleeve behind).
      const eye = this.build ? this.fly.getObjectByName("eye") : undefined;
      const exit = this.build && !eye ? this.fly.getObjectByName("line-exit") : undefined;
      if (eye || exit) {
        const knot = eye
          ? kit!.clinchKnot(eye)
          : { object: new THREE.Group(), start: exit!.getWorldPosition(new THREE.Vector3()), direction: new THREE.Vector3(1, 0, 0).transformDirection(exit!.matrixWorld) };
        const floating = touches;
        const path = kit!.tippetPath(knot.start, knot.direction, level, floating);
        dimples.push(...kit!.tippetDimples(path, level, kit!.MAX_DIMPLES - dimples.length));
        this.fly.attach(knot.object);
        const toFly = this.fly.matrixWorld.clone().invert();
        line = { knot: knot.object, start: knot.start.clone().applyMatrix4(toFly), direction: knot.direction.clone().transformDirection(toFly), mesh: kit!.tippetMesh(path), floating };
      }
      view = new kit!.RealWater({ assets: real, level, centre: pivot, bed, dimples, skyRotation, sun, detailed: setting.detailed });
      if (line) view.group.add(line.mesh);
      // In the sun the fly (and its tippet) shadow the stones, and the dents in the film show there;
      // through more than about 10 cm of water (20 gapes) they are lost in the light scattered on the way.
      if (!crawling && level - bed < 20) {
        // Assumption: shadows cast by a summer day's sun at least 65° high, from the panorama's
        // sun's side: its own (a low evening sun) would throw them out of the picture.
        const high = Math.max(real.sunElevation, THREE.MathUtils.degToRad(65));
        const caster = new THREE.Vector3(Math.cos(high) * Math.sin(sunAzimuth), Math.sin(high), Math.cos(high) * Math.cos(sunAzimuth));
        const shadows = kit!.bedShadows({ assets: real, casters: line ? [this.fly, line.mesh] : [this.fly], dimples, level, bed, centre: pivot, bedSegments: setting.detailed ? 360 : 240, sun: caster });
        if (shadows) view.group.add(shadows);
      }
      const environment = this.scene.environment;
      const background = this.scene.background;
      const intensity = this.scene.environmentIntensity;
      const exposure = this.renderer.toneMappingExposure;
      const far = this.camera.far;
      this.scene.environment = real.sky;
      this.scene.background = real.sky;
      this.scene.environmentRotation.set(0, skyRotation, 0);
      this.scene.backgroundRotation.set(0, skyRotation, 0);
      this.scene.backgroundBlurriness = 0.06;
      this.scene.environmentIntensity = 1;
      this.renderer.toneMappingExposure = 1.45;
      this.camera.far = 900;
      this.camera.updateProjectionMatrix();
      for (const light of this.lights) light.visible = false;
      // Insects shed water: they keep their dry sheen.
      const materials = kit!.realMaterials(this.fly);
      restore = () => {
        materials();
        wet();
        this.scene.environment = environment;
        this.scene.background = background;
        this.scene.environmentRotation.set(0, 0, 0);
        this.scene.backgroundRotation.set(0, 0, 0);
        this.scene.backgroundBlurriness = 0;
        this.scene.environmentIntensity = intensity;
        this.renderer.toneMappingExposure = exposure;
        this.camera.far = far;
        this.camera.updateProjectionMatrix();
        for (const light of this.lights) light.visible = true;
      };
      // From below, what is under water is seen through it (from above the water's shader tints it).
      if (setting.view === "below") this.scene.fog = new THREE.Fog("#4a5648", level, 40);
    } else {
      view = new kit!.Water({
        level,
        centre: pivot,
        look: setting.look,
        dimples: touches ? this.dimples(level) : [],
        motion: setting.fishing.motion,
        cut: setting.view === "side" ? subject.max.z + 0.4 : null,
      });
      // Wet and tinted below the waterline (see patchFogForWater), more so the deeper it is.
      this.scene.fog = new THREE.Fog(setting.look.water, level, 6);
    }
    this.scene.add(view.group);
    // Fibres clump only where the whole fly is under water.
    const sunk = setting.fishing.depth === "below" || setting.fishing.depth === "deep";
    const soft =
      sunk && this.build
        ? this.build.steps.flatMap((step, i) => step.pieces.flatMap((p, j) => (CLUMPS.has(p.look) ? [this.stepViews[i]![j]!.piece.object] : [])))
        : [];
    for (const o of soft) o.scale.set(1, WET_SPREAD, WET_SPREAD);
    this.fly.updateMatrixWorld(true);
    this.water = {
      setting,
      view,
      subject: this.build ? "fly" : "natural",
      home,
      restore,
      level,
      pivot,
      bounds,
      hang: this.rig.matrix.clone(),
      bubbles: this.build ? this.bubbles(level) : null,
      soft,
      line,
    };
    // Stilling the water holds it where it is.
    this.setWaterTime(this.waterTime);
    // Deep down, a trout sees the fly level with it rather than against the surface.
    const deep = setting.real && setting.fishing.depth === "deep";
    if (!sameView) this.setView(setting.view === "side" ? "water-side" : setting.view === "angler" ? (deep ? "water-angler-deep" : "water-angler") : deep ? "water-bed" : setting.real ? "water-trout" : "water-below");
  }

  /** The water and the fly in it at `t` seconds of water time. */
  setWaterTime(t: number) {
    this.dirty = true;
    this.waterTime = t;
    const w = this.water;
    if (!w) return;
    w.view.setTime(t);
    const { depth, motion } = w.setting.fishing;
    const view = w.view;
    const c = w.pivot;
    // On a tippet in the realistic water the fly is steadier than in the drawn water's tank.
    const real = view instanceof kit!.RealWater;
    let lift = 0;
    let pitch = 0;
    let roll = 0;
    if (w.subject === "natural" && depth === "deep") {
      // Resting on the stones.
    } else if (motion === "swim") {
      // Straightens and lifts on each pull, dips nose first in the pause after it.
      const f = (t % kit!.Water.STRIP) / kit!.Water.STRIP;
      const pull = f < 0.3 ? Math.sin((f / 0.3) * Math.PI) : 0;
      const glide = f < 0.3 ? 0 : (f - 0.3) / 0.7;
      lift = 0.06 * pull - 0.08 * glide;
      pitch = 0.05 * pull - 0.07 * glide;
      roll = (real ? 0.015 : 0.03) * Math.sin(1.3 * t);
      // Soft fibres pressed in by the pull, opening out again in the pause.
      const spread = WET_SPREAD * (1 - 0.12 * pull + 0.08 * Math.sin(Math.PI * glide));
      for (const o of w.soft) o.scale.set(1, spread, spread);
    } else if (motion === "swing") {
      // Held against the current on the tippet, swaying a little, its fibres working in the flow.
      lift = (real ? 0.015 : 0.02) * Math.sin(1.1 * t);
      pitch = (real ? 0.02 : 0.03) * Math.sin(0.8 * t);
      roll = (real ? 0.025 : 0.08) * Math.sin(0.9 * t);
      const spread = WET_SPREAD * (1 + 0.05 * Math.sin(3 * t));
      for (const o of w.soft) o.scale.set(1, spread, spread);
    } else if (depth === "surface" || depth === "film") {
      // Rides the swell, held by the film and the tippet lying in it: it follows the surface
      // averaged over its length and width, not the slope under any one point.
      const half = Math.max(1, (w.bounds.max.x - w.bounds.min.x) / 2);
      const side = Math.max(0.6, (w.bounds.max.z - w.bounds.min.z) / 2);
      if (!real) {
        // The drawn water's waves, as they were: the slope under the fly.
        const height = (x: number, z: number) => kit!.waveHeight(x, z, t);
        lift = height(c.x, c.z);
        pitch = 6 * (height(c.x + 0.5, c.z) - height(c.x - 0.5, c.z));
        roll = 6 * (height(c.x, c.z + 0.5) - height(c.x, c.z - 0.5));
      } else {
        const swell = (x: number, z: number) => kit!.rippleHeight(x, z, t);
        let sum = 0;
        for (const dx of [-half, 0, half]) for (const dz of [-side, 0, side]) sum += swell(c.x + dx, c.z + dz);
        lift = sum / 9;
        pitch = (swell(c.x + half, c.z) - swell(c.x - half, c.z)) / (2 * half);
        // The tippet in the film steadies it against rolling.
        roll = (0.5 * (swell(c.x, c.z + side) - swell(c.x, c.z - side))) / (2 * side);
      }
    } else {
      // Sunk, it hangs on the tippet in the current: a slow, small sway (in the drawn water it
      // tumbles as it did).
      lift = (real ? 0.02 : 0.05) * Math.sin(0.5 * t);
      pitch = (real ? 0.03 : 0.1) * Math.sin(0.31 * t);
      roll = (real ? 0.03 : 0.18) * Math.sin(0.43 * t + 1);
    }
    const turn = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(roll, 0, pitch));
    this.rig.matrix
      .makeTranslation(c.x, c.y + lift, c.z)
      .multiply(turn)
      .multiply(new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z))
      .multiply(w.hang);
    this.rig.updateMatrixWorld(true);
    // The tippet follows the eye and lies on the ripples as they pass.
    if (w.line) {
      const start = w.line.start.clone().applyMatrix4(this.fly.matrixWorld);
      const direction = w.line.direction.clone().transformDirection(this.fly.matrixWorld);
      const old = w.line.mesh.geometry;
      w.line.mesh.geometry = kit!.tippetGeometry(kit!.tippetPath(start, direction, w.level, w.line.floating, (x, z) => kit!.rippleHeight(x, z, t)));
      old.dispose();
    }
  }

  /**
   * A fly lying low in the film, fished a while: its wings laid back over it come down until their
   * tips rest on the water (no lower than along the shank). Returns what puts them back.
   */
  // Assumption: damp hair, CDC and feather wings that slope back over a low-floating fly sink until
  // their tips lie on the film, as in photos of CDC & Elks and hair-wing sedges on the water;
  // upright wings stay up.
  private layWings(level: number): () => void {
    const undo: (() => void)[] = [];
    const m = new THREE.Matrix4();
    const tips = (object: THREE.Object3D) => {
      object.updateMatrixWorld(true);
      const ys: number[] = [];
      object.traverseVisible((o) => {
        if (o instanceof THREE.InstancedMesh) {
          o.geometry.computeBoundingBox();
          const end = o.geometry.boundingBox!.max.y;
          for (let i = 0; i < o.count; i++) ys.push(new THREE.Vector3(0, end, 0).applyMatrix4(o.getMatrixAt(i, m).premultiply(o.matrixWorld)).y);
        } else if (o instanceof THREE.Mesh) {
          const pos = o.geometry.getAttribute("position");
          const v = new THREE.Vector3();
          for (let i = 0; i < pos.count; i++) ys.push(v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).y);
        }
      });
      // The third lowest, so one stray fibre doesn't hold the wing up.
      return ys.sort((a, b) => a - b)[Math.min(2, ys.length - 1)] ?? Infinity;
    };
    this.build!.steps.forEach((step, i) =>
      step.pieces.forEach((p, j) => {
        const laidBack = (p.type === "bundle" && p.direction === "back") || p.type === "feather";
        if (!laidBack || p.side !== "top" || p.angle <= 0 || p.angle >= THREE.MathUtils.degToRad(60)) return;
        const object = this.stepViews[i]![j]!.piece.object;
        object.updateMatrix();
        const home = object.matrix.clone();
        const root = this.space!.point(new THREE.Vector3(p.x, p.radius, 0));
        // Turning it about its root, across the shank: a positive turn brings the tips down.
        const turn = (angle: number) => {
          object.matrix.copy(rotationAbout(root, angle)).multiply(home);
          object.matrix.decompose(object.position, object.quaternion, object.scale);
        };
        // Assumption: the tips press about a fiftieth of a gape into the film.
        const film = level - 0.02;
        if (tips(object) <= film) return;
        let a = 0;
        let b = p.angle;
        turn(b);
        if (tips(object) < film) {
          for (let k = 0; k < 24; k++) {
            const mid = (a + b) / 2;
            turn(mid);
            if (tips(object) > film) a = mid;
            else b = mid;
          }
          turn(b);
        }
        undo.push(() => {
          object.matrix.copy(home);
          object.matrix.decompose(object.position, object.quaternion, object.scale);
        });
      }),
    );
    return () => undo.forEach((u) => u());
  }

  /**
   * How a floating fly rests on a flat film in the realistic water, once fished a while. Riding
   * on its hackle, it bears on the tips of its fibres (hackle, tail) and, where they don't reach,
   * its hook, tilted about its weight (the hook's, towards the bend) until it bears both in front
   * of that and behind it; damp, it settles until its body all but touches the film. Lying with
   * its body in the film or half under, it is tilted until its body bears alike front and rear,
   * and sinks to that depth. The tips stay at or under the film.
   */
  private restingPose(sits: "hackle" | "body" | "half"): { about: THREE.Vector3; angle: number; level: number } {
    // The dressing bears on the film; the hook's bend hangs through it. The hook counts only for
    // a half the dressing doesn't reach (a bare shank). The body is the dressing that isn't fibres.
    const points: THREE.Vector3[] = [];
    const core: THREE.Vector3[] = [];
    const hookPoints: THREE.Vector3[] = [];
    const m = new THREE.Matrix4();
    this.fly.updateMatrixWorld(true);
    const inHook = new Set<THREE.Object3D>();
    this.hook?.traverse((o) => inHook.add(o));
    const sample = (o: THREE.Mesh, into: THREE.Vector3[][]) => {
      const pos = o.geometry.getAttribute("position");
      const stride = Math.max(1, Math.floor(pos.count / 4000));
      for (let i = 0; i < pos.count; i += stride) {
        const p = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        for (const list of into) list.push(p);
      }
    };
    // The body: wraps (thread, floss, dubbing, herl, a hackle's stem), covers and extended bodies,
    // and spun hair, a body made of fibres; not wings, posts, legs, eyes or beads.
    const bodies = new Set<THREE.Object3D>();
    const spun = new Set<THREE.Object3D>();
    this.build!.steps.forEach((step, i) =>
      step.pieces.forEach((p, j) => {
        const into = p.type === "wraps" || p.type === "cover" || p.type === "extension" || p.type === "sleeve" ? bodies : p.type === "bundle" && p.span !== undefined ? spun : null;
        this.stepViews[i]![j]!.piece.object.traverse((o) => into?.add(o));
      }),
    );
    this.fly.traverseVisible((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      if (inHook.has(o)) return sample(o, [hookPoints]);
      if (o instanceof THREE.InstancedMesh) {
        // Each instance is one fibre along its own y axis: its ends.
        o.geometry.computeBoundingBox();
        const { min, max } = o.geometry.boundingBox!;
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, m).premultiply(o.matrixWorld);
          const ends = [new THREE.Vector3(0, min.y, 0).applyMatrix4(m), new THREE.Vector3(0, max.y, 0).applyMatrix4(m)];
          points.push(...ends);
          if (spun.has(o)) core.push(...ends);
        }
        return;
      }
      sample(o, bodies.has(o) ? [points, core] : [points]);
    });
    const shank = this.build!.hook.shankLength;
    const at = (x: number) => this.fly.localToWorld(this.space!.point(new THREE.Vector3(x * shank, 0, 0)));
    // Assumption: the hook's weight sits about a third of the way along the shank from the bend.
    const about = at(0.3);
    const bend = at(0);
    const eye = at(1);
    // Along the middle of the shank: not the head or the tag.
    const span = (p: THREE.Vector3) => {
      const u = (p.x - bend.x) / (eye.x - bend.x);
      return u > 0.1 && u < 0.85;
    };
    const body = core.filter(span);
    if (body.length === 0) body.push(...hookPoints.filter(span));
    // A bare tube has no vertices along its middle: its axis, then.
    if (body.length === 0) for (let u = 0.15; u < 0.85; u += 0.1) body.push(at(u));
    const c = (angle: number) => Math.cos(angle);
    const s = (angle: number) => Math.sin(angle);
    const lifted = (p: THREE.Vector3, angle: number) => about.y + s(angle) * (p.x - about.x) + c(angle) * (p.y - about.y);
    // The third lowest, so one stray fibre doesn't carry the fly.
    const low = (ys: number[]) => ys.sort((a, b) => a - b)[Math.min(2, ys.length - 1)] ?? 0;
    const turned = (angle: number, bearing: THREE.Vector3[]) => {
      const halves = (list: THREE.Vector3[]) => {
        const front: number[] = [];
        const rear: number[] = [];
        for (const p of list) (c(angle) * (p.x - about.x) - s(angle) * (p.y - about.y) > 0 ? front : rear).push(lifted(p, angle));
        return { front, rear };
      };
      const dressing = halves(bearing);
      const hook = halves(hookPoints);
      return {
        front: low(dressing.front.length ? dressing.front : hook.front),
        rear: low(dressing.rear.length ? dressing.rear : hook.rear),
      };
    };
    // Nose up raises the front: find the tilt at which front and rear bear alike.
    const bearing = sits === "hackle" ? points : body;
    let a = -0.6;
    let b = 0.6;
    for (let k = 0; k < 30; k++) {
      const mid = (a + b) / 2;
      const t = turned(mid, bearing);
      if (t.front < t.rear) a = mid;
      else b = mid;
    }
    const angle = (a + b) / 2;
    const t = turned(angle, points);
    // Assumption: the tips press about a fiftieth of a gape into the film.
    const tips = Math.min(t.front, t.rear) + 0.02;
    // The body's underside, and the shank above it.
    const under = body.reduce((lowest, p) => (lifted(p, angle) < lifted(lowest, angle) ? p : lowest));
    const bottom = low(body.map((p) => lifted(p, angle)));
    const u = THREE.MathUtils.clamp((under.x - bend.x) / (eye.x - bend.x), 0, 1);
    const axis = lifted(bend, angle) + u * (lifted(eye, angle) - lifted(bend, angle));
    const depth = Math.max(0, axis - bottom);
    // Its top: the third highest, as for the underside.
    const top = -low(body.map((p) => -lifted(p, angle)));
    // Assumption: fished for a few minutes a fly is no longer dry: its body carries water. A
    // hackled fly rides with its belly in the film (its lower third under, the lower hackle
    // fibres through it); a body in the film is half under, to the shank; a fly that floats
    // half under (a foam body or back) has six tenths of its depth under.
    const level = sits === "hackle" ? bottom + 0.6 * depth : sits === "body" ? axis : bottom + 0.6 * (top - bottom);
    return { about, angle, level: Math.max(tips, level) };
  }

  /**
   * Where something dents the surface film, for the realistic water: the lowest points of
   * whatever reaches through it (hackle tips, tails, an insect's feet), at most kit!.MAX_DIMPLES.
   */
  private contactDimples(level: number): Dimple[] {
    const cells = new Map<string, { x: number; z: number; y: number }>();
    const v = new THREE.Vector3();
    const m = new THREE.Matrix4();
    this.fly.updateMatrixWorld(true);
    this.fly.traverseVisible((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const pos = o.geometry.getAttribute("position");
      const instances = o instanceof THREE.InstancedMesh ? o.count : 1;
      // Sampled, so a dense hackle doesn't cost a pass over every vertex of every fibre.
      const stride = Math.max(1, Math.floor((pos.count * instances) / 60000));
      for (let k = 0; k < instances; k++) {
        if (o instanceof THREE.InstancedMesh) o.getMatrixAt(k, m).premultiply(o.matrixWorld);
        else m.copy(o.matrixWorld);
        for (let i = (k * 7) % stride; i < pos.count; i += stride) {
          v.fromBufferAttribute(pos, i).applyMatrix4(m);
          if (v.y > level + 0.02 || v.y < level - 0.3) continue;
          const key = `${Math.round(v.x / 0.12)},${Math.round(v.z / 0.12)}`;
          const cell = cells.get(key);
          if (!cell || v.y < cell.y) cells.set(key, { x: v.x, z: v.z, y: v.y });
        }
      }
    });
    const all = [...cells.values()].sort((a, b) => a.y - b.y);
    // Assumption: the meniscus round a fibre tip or foot spreads about a millimetre (a fifth of a
    // gape on a #12), a fraction of the capillary length; deeper where it presses harder.
    return all.slice(0, kit!.MAX_DIMPLES - 20).map((c) => ({ x: c.x, z: c.z, r: 0.18, d: Math.min(0.03, 0.012 + 0.1 * Math.max(0, level - c.y)) }));
  }

  /** Where the fly dents the surface film: the fibres (hackle, tail, legs) that reach through it. */
  private dimples(level: number): { x: number; z: number; r: number }[] {
    const cells = new Map<string, { x: number; z: number; r: number }>();
    const m = new THREE.Matrix4();
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    this.fly.updateMatrixWorld(true);
    // Only what shows: hidden loose ends and superseded wraps leave no dents.
    this.fly.traverseVisible((o) => {
      if (!(o instanceof THREE.InstancedMesh)) return;
      // Each instance is one fibre along its own y axis.
      o.geometry.computeBoundingBox();
      const { min, max } = o.geometry.boundingBox!;
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m).premultiply(o.matrixWorld);
        a.set(0, min.y, 0).applyMatrix4(m);
        b.set(0, max.y, 0).applyMatrix4(m);
        if ((a.y - level) * (b.y - level) > 0) continue;
        const p = a.lerp(b, (level - a.y) / (b.y - a.y || 1));
        const key = `${Math.round(p.x / 0.15)},${Math.round(p.z / 0.15)}`;
        if (!cells.has(key)) cells.set(key, { x: p.x, z: p.z, r: 0.07 });
      }
    });
    // At most 24 (the shader's limit), spread over the whole fly.
    const all = [...cells.values()];
    return Array.from({ length: Math.min(24, all.length) }, (_, i) => all[Math.floor((i * all.length) / Math.min(24, all.length))]!);
  }

  /** Silvery air caught in CDC, dubbing and marabou under water. */
  private bubbles(level: number): THREE.InstancedMesh | null {
    const random = mulberry32(11);
    const points: THREE.Vector3[] = [];
    const v = new THREE.Vector3();
    const m = new THREE.Matrix4();
    const inverse = this.fly.matrixWorld.clone().invert();
    this.build!.steps.forEach((step, i) => {
      step.pieces.forEach((p, j) => {
        if (!HOLDS_AIR.has(p.look)) return;
        this.stepViews[i]![j]!.piece.object.traverseVisible((o) => {
          if (!(o instanceof THREE.Mesh)) return;
          const instances = o instanceof THREE.InstancedMesh ? o.count : 1;
          if (instances === 0) return;
          const pos = o.geometry.getAttribute("position");
          for (let k = 0; k < 12; k++) {
            if (o instanceof THREE.InstancedMesh) o.getMatrixAt(Math.floor(random() * instances), m).premultiply(o.matrixWorld);
            else m.copy(o.matrixWorld);
            v.fromBufferAttribute(pos, Math.floor(random() * pos.count)).applyMatrix4(m);
            if (v.y < level - 0.02) points.push(v.clone().applyMatrix4(inverse));
          }
        });
      });
    });
    if (points.length === 0) return null;
    const mesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.08, fog: false }),
      Math.min(points.length, 160),
    );
    for (let i = 0; i < mesh.count; i++) {
      const s = 0.012 + 0.02 * random();
      mesh.setMatrixAt(i, m.makeScale(s, s, s).setPosition(points[i]!));
    }
    this.fly.add(mesh);
    return mesh;
  }

  setBackground(color: string | null) {
    this.dirty = true;
    this.scene.background = color === null ? null : new THREE.Color(color);
  }

  /** Switches to a named view, turned `orbit` degrees around the vertical axis, framing the finished fly. */
  setView(view: ViewName, orbit = 0, fit: "box" | "sphere" = "box") {
    this.dirty = true;
    this.view = view;
    this.orbit = orbit;
    this.fit = fit;
    this.resetCamera();
  }

  /**
   * Hands the scene as it is now to the build-time path tracer (scripts/render-water.ts): the
   * renderer, scene and camera, and the realistic water if it is showing. The scene stops
   * drawing itself, as the tracer draws instead.
   */
  forTracing(): { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; water: RealWater | null; target: THREE.Vector3 } {
    cancelAnimationFrame(this.frame);
    this.controls.update();
    return {
      renderer: this.renderer,
      scene: this.scene,
      camera: this.camera,
      water: kit !== null && this.water?.view instanceof kit.RealWater ? this.water.view : null,
      target: this.controls.target.clone(),
    };
  }

  /**
   * The box to lay a picture of the fly out by, so that it sits as a 3D view on a page will
   * show the fly: left, top, width and height as fractions of the picture this camera takes.
   * A view frames the fly by fitting its bounds from the same side at a wider angle
   * (`resetCamera`, `fitDistance`): a corner nearer the eye needs more room there than in the
   * picture, so each counts as further out by its nearness times the view's angle. Fitted to a
   * view with the same margin, this box gives the fly the size the view gives it; both look at
   * the middle of the bounds, so it is centred.
   */
  framedBounds(): [number, number, number, number] {
    const target = this.controls.target;
    const view = this.camera.position.clone().sub(target);
    const distance = view.length();
    view.normalize();
    const right = new THREE.Vector3().crossVectors(Y_UP, view).normalize();
    const up = new THREE.Vector3().crossVectors(view, right);
    const tan = Math.tan(THREE.MathUtils.degToRad(VIEW_FOV / 2));
    const b = this.finished;
    let across = 0;
    let high = 0;
    for (const x of [b.min.x, b.max.x])
      for (const y of [b.min.y, b.max.y])
        for (const z of [b.min.z, b.max.z]) {
          const c = new THREE.Vector3(x, y, z).sub(target);
          const near = c.dot(view);
          // (Across, the room a corner needs depends a little on the view's shape: taken for one
          // a fifth wider than high, between a phone's and a desktop's.)
          across = Math.max(across, Math.abs(c.dot(right)) + near * tan * 1.2);
          high = Math.max(high, Math.abs(c.dot(up)) + near * tan);
        }
    // Half the picture's height at the fly, in gapes.
    const half = distance * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const part = (v: number) => Math.round(v * 10000) / 10000;
    const w = across / (half * this.camera.aspect);
    const h = high / half;
    return [part(0.5 - w / 2), part(0.5 - h / 2), part(w), part(h)];
  }

  /** Asks for a frame, after a change the scene can't know of (an overlay's size, say). */
  invalidate() {
    this.dirty = true;
  }

  /** The key light's shadow fitted round the finished fly, and everything on the fly set to cast and take shadows. */
  private aimShadows() {
    const ball = this.finished.getBoundingSphere(new THREE.Sphere());
    const r = Math.max(0.5, ball.radius);
    this.key.target.position.copy(ball.center);
    this.key.position.copy(ball.center).add(KEY_FROM.clone().multiplyScalar(4 * r));
    const camera = this.key.shadow.camera;
    camera.left = camera.bottom = -1.1 * r;
    camera.right = camera.top = 1.1 * r;
    camera.near = 0.5 * r;
    camera.far = 8 * r;
    camera.updateProjectionMatrix();
    this.fly.traverse((o) => {
      // (A band of shade drawn on the body is shade already.)
      if (o instanceof THREE.Mesh && !o.userData.shade) o.castShadow = o.receiveShadow = true;
    });
  }

  private makeEnvironment(): THREE.WebGLRenderTarget {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    const environment = pmrem.fromScene(room, 0.04);
    this.scene.environment = environment.texture;
    room.dispose();
    pmrem.dispose();
    return environment;
  }

  /** While frames are drawn one after another: slow ones lower the sharpness a step. */
  private pace(dt: number) {
    this.stillFrames = 0;
    if (!this.adaptive || this.water || (this.ratio <= 1 && !this.shadows)) return;
    // Assumption: under about 35 frames a second for a third of a second reads as stutter.
    this.slowFrames = dt > 1 / 35 ? this.slowFrames + 1 : Math.max(0, this.slowFrames - 1);
    if (this.slowFrames < 12) return;
    this.slowFrames = 0;
    // The shadows go first, and stay off: they cost a second drawing of the whole fly.
    if (this.shadows) {
      this.shadows = false;
      this.key.castShadow = false;
      this.renderer.shadowMap.enabled = false;
      this.scene.traverse((o) => {
        if (o instanceof THREE.Mesh) for (const m of [o.material].flat()) m.needsUpdate = true;
      });
      return;
    }
    if (this.ratio <= 1) return;
    this.ratio = Math.max(1, this.ratio * 0.75);
    this.renderer.setPixelRatio(this.ratio);
  }

  /** Nothing to draw: once the fly has been still for a moment, one frame at full sharpness. */
  private settle() {
    if (this.ratio >= this.fullRatio || ++this.stillFrames < 10) return;
    this.ratio = this.fullRatio;
    this.slowFrames = 0;
    this.renderer.setPixelRatio(this.ratio);
    this.dirty = true;
  }

  /** Draws a frame right away, for screenshots between animation frames. */
  renderNow() {
    this.draw();
  }

  private draw() {
    if (kit !== null && this.water?.view instanceof kit.RealWater) this.water.view.render(this.renderer, this.scene, this.camera);
    else this.renderer.render(this.scene, this.camera);
  }

  /** The fly as it is at the current time, framed whole, copied to a canvas (the printable recipe card). */
  snapshot(): HTMLCanvasElement {
    this.resetCamera();
    this.controls.update();
    this.renderNow();
    const source = this.renderer.domElement;
    const copy = document.createElement("canvas");
    copy.width = source.width;
    copy.height = source.height;
    copy.getContext("2d")!.drawImage(source, 0, 0);
    return copy;
  }

  /**
   * A measuring grid in the plane of the hook: thin lines every quarter gape, strong lines
   * every gape, labelled in gapes. x = 0 is the start of the bend, y = 0 the shank.
   */
  setGrid(on: boolean, color = "#2a4a6a", reframe = true) {
    this.dirty = true;
    if (this.grid) {
      this.grid.traverse((o) => {
        if (o instanceof THREE.LineSegments || o instanceof THREE.Sprite) {
          o.geometry.dispose();
          const m = o.material as THREE.Material & { map?: THREE.Texture | null };
          m.map?.dispose();
          m.dispose();
        }
      });
      this.scene.remove(this.grid);
      this.grid = null;
    }
    if (!on) return;
    // Around the fly, or a natural shown on its own.
    const around = !this.finished.isEmpty() ? this.finished : this.natural ? this.naturalBounds() : new THREE.Box3(new THREE.Vector3(-1, -1, 0), new THREE.Vector3(3, 1, 0));
    // Seen from above, the grid lies flat under the fly (or natural) instead of standing behind it.
    const flat = this.view === "top";
    this.grid = measuringGrid(flat ? new THREE.Box3(new THREE.Vector3(around.min.x, around.min.z, 0), new THREE.Vector3(around.max.x, around.max.z, 0)) : around, color);
    if (flat) this.grid.rotation.x = Math.PI / 2;
    this.scene.add(this.grid);
    if (reframe) this.resetCamera();
  }

  /**
   * A slow turn round the fly, as on a turntable (one turn in `seconds`), until the visitor turns
   * or zooms it themselves.
   */
  setTurning(on: boolean, seconds = 40) {
    const was = this.turnSeconds > 0;
    this.turnSeconds = on && !this.handled ? seconds : 0;
    const turning = this.turnSeconds > 0;
    if (turning && !was) {
      if (!this.turningBack) this.turnedFrom = this.azimuth();
      this.turningBack = false;
    }
    // Stopped (to play the steps): back round to where it was, to watch them from that side.
    if (!turning && was) this.turningBack = this.turnedFrom !== null;
  }

  /** The user takes the camera: the slow turn and following stop. */
  private takeOver() {
    this.userMoved = true;
    this.handled = true;
    this.turnSeconds = 0;
    this.turningBack = false;
    // Turning the fly in the water leaves following as it is, for back at the vise.
    if (this.follow && !this.water) {
      this.follow = false;
      this.onFollowChange?.(false);
    }
  }

  /** Turns the camera round what it looks at, as dragging does (radians: round the vertical, and up or down). */
  orbitBy(round: number, up: number) {
    this.takeOver();
    const at = new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(this.controls.target));
    at.theta += round;
    at.phi = Math.min(Math.PI - 0.05, Math.max(0.05, at.phi - up));
    this.camera.position.copy(this.controls.target).add(new THREE.Vector3().setFromSpherical(at));
  }

  /** Moves the camera closer (a factor under 1) or further away, within what the controls allow. */
  zoomBy(factor: number) {
    this.takeOver();
    const offset = this.camera.position.clone().sub(this.controls.target);
    offset.setLength(Math.min(this.controls.maxDistance, Math.max(this.controls.minDistance, offset.length() * factor)));
    this.camera.position.copy(this.controls.target).add(offset);
  }

  /** The whole fly from one side, for a look; the view the camera goes back to stays as it was. */
  lookFrom(view: ViewName) {
    this.takeOver();
    const kept = this.view;
    this.view = view;
    this.resetCamera();
    this.view = kept;
  }

  private azimuth(): number {
    const offset = this.camera.position.clone().sub(this.controls.target);
    return Math.atan2(offset.x, offset.z);
  }

  /** Round the vertical through what the camera looks at. */
  private turnBy(angle: number) {
    const offset = this.camera.position.clone().sub(this.controls.target).applyAxisAngle(Y_UP, angle);
    this.camera.position.copy(this.controls.target).add(offset);
  }

  private turnBack(dt: number) {
    const delta = Math.atan2(Math.sin(this.turnedFrom! - this.azimuth()), Math.cos(this.turnedFrom! - this.azimuth()));
    const step = Math.abs(delta) < 0.002 ? delta : delta * (1 - Math.exp(-dt * 5));
    this.turnBy(step);
    if (step === delta) this.turningBack = false;
  }

  /** Follow the action (true) or leave the camera where the user puts it (false). */
  setFollow(on: boolean) {
    this.follow = on;
    if (on) this.userMoved = false;
  }

  /**
   * What the camera frames while following: the whole hook and everything tied on it by the
   * end of the current step. The frame only widens as the fly grows (a tail, a long wing), so
   * it never zooms in on a detail and the hook always shows where on it the work is.
   */
  private actionBox(): THREE.Box3 {
    const box = (this.atEnd ? this.finished.clone() : this.hookBounds.clone()).union(this.naturalBounds());
    if (!this.atEnd) for (let i = 0; i <= this.currentStep; i++) box.union(this.stepBounds[i]!);
    // With the proportion guide on, its measurements so far are in the picture too.
    if (this.guide) {
      for (const item of this.guide.children) if (item.visible) box.union(guideBounds(item));
      // Headroom for the view buttons over the top of the picture.
      box.max.y += 0.12 * (box.max.y - box.min.y);
    }
    return box;
  }

  private followAction(dt: number) {
    const box = this.actionBox();
    const target = box.getCenter(new THREE.Vector3());
    const offset = this.camera.position.clone().sub(this.controls.target);
    const direction = offset.clone().normalize();
    const distance = this.fitDistance(box, target, direction) * 1.1;
    // Ease towards the new framing rather than jumping, except on a new fly, which starts framed.
    const k = this.followFresh ? 1 : 1 - Math.exp(-dt * 2.5);
    this.followFresh = false;
    this.controls.target.lerp(target, k);
    const d = offset.length() + (distance - offset.length()) * k;
    this.allowDistance(distance);
    this.camera.position.copy(this.controls.target).addScaledVector(direction, d);
  }

  /**
   * Where a point on the shank's plane (x along the shank from the start of the bend, y up, in
   * gapes) is on the canvas, in CSS pixels from its top left; null when it is out of view.
   */
  screenOf(x: number, y: number): { x: number; y: number } | null {
    if (!this.space) return null;
    const p = this.fly.localToWorld(this.space.point(new THREE.Vector3(x, y, 0))).project(this.camera);
    if (p.z > 1) return null;
    const { clientWidth: w, clientHeight: h } = this.container;
    return { x: ((p.x + 1) / 2) * w, y: ((1 - p.y) / 2) * h };
  }

  /** The point on the shank's plane (x, y in gapes, as screenOf takes) under a canvas point in CSS pixels; null if the plane is edge on. */
  shankPointAt(px: number, py: number): { x: number; y: number } | null {
    const { clientWidth: w, clientHeight: h } = this.container;
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((px / w) * 2 - 1, 1 - (py / h) * 2), this.camera);
    this.fly.updateMatrixWorld(true);
    // The fly's own plane through the shank (a straight shank's space is the fly's).
    const normal = new THREE.Vector3(0, 0, 1).transformDirection(this.fly.matrixWorld);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, this.fly.localToWorld(new THREE.Vector3()));
    if (Math.abs(ray.ray.direction.dot(normal)) < 0.05) return null;
    const hit = ray.ray.intersectPlane(plane, new THREE.Vector3());
    if (!hit) return null;
    const local = this.fly.worldToLocal(hit);
    // In the shank's own terms: along a curved shank, and off it.
    return this.space ? this.space.unpoint(local.x, local.y) : { x: local.x, y: local.y };
  }

  /**
   * The builder's focus: the pieces of these steps in full, the rest of the fly faint (null: the
   * whole fly). Kept until the next setBuild, which draws everything in full again.
   */
  setFocus(steps: ReadonlySet<number> | null, thread = false) {
    this.dirty = true;
    this.focus = steps;
    this.focusThread = thread;
    this.applyFocus();
  }

  /**
   * Makes the unfocused steps' meshes faint (again: some pieces rebuild their meshes as time
   * moves). A faint mesh is drawn twice: first only into the depth buffer, then faintly where it
   * is nearest, so a dense bunch of fibres is faint once, not built up fibre over fibre.
   */
  private applyFocus() {
    const restore = (o: THREE.Mesh) => {
      o.material = this.fainted.get(o)!;
      o.renderOrder = 0;
      const twin = o.children.find((c) => c.userData.depthTwin);
      if (twin) o.remove(twin);
      this.fainted.delete(o);
    };
    if (!this.focus) {
      for (const o of [...this.fainted.keys()]) restore(o);
      for (const m of this.faintOf.values()) m.dispose();
      this.faintOf.clear();
      this.depthOnly?.dispose();
      this.depthOnly = null;
      return;
    }
    this.depthOnly ??= new THREE.MeshBasicMaterial({ colorWrite: false });
    this.stepViews.forEach((views, i) => {
      views.forEach((v, j) => {
        // The thread in full wherever it was wound, when the thread is chosen.
        const faint = !this.focus!.has(i) && !(this.focusThread && this.build?.steps[i]?.pieces[j]?.material === "thread");
        v.piece.object.traverse((o) => {
          if (!(o instanceof THREE.Mesh) || Array.isArray(o.material) || o.userData.depthTwin) return;
          if (!faint) {
            if (this.fainted.has(o)) restore(o);
            return;
          }
          if (this.fainted.has(o)) return;
          const own = o.material as THREE.Material;
          let f = this.faintOf.get(own);
          if (!f) {
            f = own.clone();
            f.transparent = true;
            // Faint enough to see through to the chosen parts, still showing where the rest sits.
            f.opacity = Math.min(own.opacity, 0.22);
            f.depthWrite = false;
            f.depthFunc = THREE.LessEqualDepth;
            this.faintOf.set(own, f);
          }
          this.fainted.set(o, own);
          o.material = f;
          o.renderOrder = 2;
          const twin =
            o instanceof THREE.InstancedMesh ? new THREE.InstancedMesh(o.geometry, this.depthOnly!, o.count) : new THREE.Mesh(o.geometry, this.depthOnly!);
          if (twin instanceof THREE.InstancedMesh && o instanceof THREE.InstancedMesh) {
            twin.instanceMatrix = o.instanceMatrix;
            twin.onBeforeRender = () => (twin.count = o.count);
          }
          twin.userData.depthTwin = true;
          twin.renderOrder = 1;
          twin.frustumCulled = false;
          o.add(twin);
        });
      });
    });
  }

  /** The step whose piece is under a canvas point (CSS pixels), or null: what the visitor tapped. */
  pickStep(px: number, py: number): number | null {
    const { clientWidth: w, clientHeight: h } = this.container;
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((px / w) * 2 - 1, 1 - (py / h) * 2), this.camera);
    // Thin fibres are hard to hit exactly: a little slack.
    ray.params.Line = { threshold: 0.05 };
    let best: { distance: number; step: number } | null = null;
    this.stepViews.forEach((views, i) => {
      for (const v of views) {
        if (!v.piece.object.visible) continue;
        const hit = ray.intersectObject(v.piece.object, true).find((x) => x.object.visible);
        if (hit && (!best || hit.distance < best.distance)) best = { distance: hit.distance, step: i };
      }
    });
    return (best as { step: number } | null)?.step ?? null;
  }

  private reportAnchor() {
    if (!this.onAnchor) return;
    if (!this.build || this.atEnd) {
      this.onAnchor(null);
      return;
    }
    const p = this.anchor.clone().project(this.camera);
    if (p.z > 1 || Math.abs(p.x) > 1 || Math.abs(p.y) > 1) {
      this.onAnchor(null);
      return;
    }
    const { clientWidth: w, clientHeight: h } = this.container;
    // The fly as far as it is tied, on the screen.
    const tied = this.stepBounds.slice(0, this.currentStep + 1).reduce((all, b) => all.union(b), this.hookBounds.clone());
    let box: { left: number; top: number; right: number; bottom: number } | undefined;
    if (!tied.isEmpty()) {
      box = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
      for (const x of [tied.min.x, tied.max.x])
        for (const y of [tied.min.y, tied.max.y])
          for (const z of [tied.min.z, tied.max.z]) {
            const c = new THREE.Vector3(x, y, z).project(this.camera);
            const sx = ((c.x + 1) / 2) * w;
            const sy = ((1 - c.y) / 2) * h;
            box.left = Math.min(box.left, sx);
            box.right = Math.max(box.right, sx);
            box.top = Math.min(box.top, sy);
            box.bottom = Math.max(box.bottom, sy);
          }
    }
    this.onAnchor({ x: ((p.x + 1) / 2) * w, y: ((1 - p.y) / 2) * h }, box);
  }

  /** World-space bounds of the visible fly (or of `only` these objects), without the bobbin and loose ends. */
  private visibleBounds(only?: THREE.Object3D[]): THREE.Box3 {
    const box = new THREE.Box3();
    const part = new THREE.Box3();
    this.fly.updateMatrixWorld(true);
    const skip = new Set<THREE.Object3D>([...(this.bobbin ? [this.bobbin.object] : []), ...[...this.looseEnds.values()].map((v) => v.object)]);
    const visit = (o: THREE.Object3D) => {
      if (!o.visible || skip.has(o)) return;
      if (o instanceof THREE.InstancedMesh) {
        if (o.count > 0) {
          o.computeBoundingBox();
          box.union(part.copy(o.boundingBox!).applyMatrix4(o.matrixWorld));
        }
      } else if (o instanceof THREE.Mesh) {
        o.geometry.computeBoundingBox();
        box.union(part.copy(o.geometry.boundingBox!).applyMatrix4(o.matrixWorld));
      }
      o.children.forEach(visit);
    };
    if (only) only.forEach(visit);
    else visit(this.fly);
    return box;
  }

  setFraming(framing: "fly" | "dressing") {
    this.dirty = true;
    this.framing = framing;
    this.resetCamera();
  }

  /**
   * Shows a natural with the fly, `length` gapes long (its body length at the fly's scale):
   * "beside" below the finished fly, "over" laid along the hook, half see-through. Without a
   * fly, it is shown on its own. null takes it away.
   */
  setNatural(n: Natural | null, length = 4, at: "beside" | "over" = "beside") {
    this.dirty = true;
    // A natural in the water on its own comes out first, and the new one goes in.
    const water = this.water?.subject === "natural" ? this.water.setting : null;
    if (water) this.setWater(null);
    if (this.natural) {
      disposeNatural(this.natural);
      this.scene.remove(this.natural);
      this.natural = null;
    }
    if (!n) {
      this.resetCamera();
      return;
    }
    const g = buildNatural(n);
    this.naturalData = n;
    g.scale.setScalar(length);
    if (this.build && !this.finished.isEmpty()) {
      const fly = this.finished;
      const own = new THREE.Box3().setFromObject(g);
      if (at === "over") {
        // Its head just behind the eye, its body along the shank: front end to the shank's end.
        const eye = this.fly.localToWorld(this.space!.point(new THREE.Vector3(this.build.hook.shankLength, 0, 0)));
        const head = (g.userData.head as THREE.Vector3).clone().multiplyScalar(length);
        g.position.copy(eye).sub(head);
        g.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            const m = o.material as THREE.Material;
            m.transparent = true;
            m.opacity = Math.min(m.opacity, 0.5);
            m.depthWrite = false;
          }
        });
      } else {
        const gap = 0.25 * (fly.max.y - fly.min.y);
        g.position.set(fly.getCenter(new THREE.Vector3()).x - own.getCenter(new THREE.Vector3()).x, fly.min.y - gap - own.max.y, 0);
      }
    }
    this.natural = g;
    this.scene.add(g);
    if (water && !this.build) this.setWater({ ...water, fishing: naturalFishing(n) });
    else this.resetCamera();
  }

  private naturalBounds(): THREE.Box3 {
    return this.natural ? new THREE.Box3().setFromObject(this.natural) : new THREE.Box3();
  }

  /** Frames the finished fly from the current view, with a small margin. */
  resetCamera() {
    this.dirty = true;
    if (this.water) {
      // The waterline in the picture too, when the fly is near it; in the realistic water some
      // of the river round it.
      const real = !!this.water.setting.real;
      const framed = this.water.bounds.clone().expandByScalar(real ? 0.35 : 0.3);
      // The realistic water shows the surface all round; the drawn tank needs its waterline framed.
      if (!real && this.water.setting.fishing.depth !== "deep") framed.expandByPoint(new THREE.Vector3(this.water.pivot.x, this.water.level + 0.3, 0));
      this.frameBox(framed);
      // A trout's view of something deep stays under the surface: closer in, if need be.
      if (real && this.view === "water-bed") {
        const target = this.controls.target;
        const dir = this.camera.position.clone().sub(target).normalize();
        const most = (this.water.level - 1 - target.y) / Math.max(0.05, dir.y);
        if (this.camera.position.distanceTo(target) > most) {
          this.camera.position.copy(target).addScaledVector(dir, most);
          this.controls.update();
        }
      }
      // The angler stands above the water: looking down on a sunk fly from further back.
      if (real && (this.view === "water-angler" || this.view === "water-angler-deep")) {
        const target = this.controls.target;
        const dir = this.camera.position.clone().sub(target).normalize();
        const needed = (this.water.level + 1.5 - target.y) / Math.max(0.05, dir.y);
        if (this.camera.position.distanceTo(target) < needed) {
          this.allowDistance(needed);
          this.camera.position.copy(target).addScaledVector(dir, needed);
          this.controls.update();
        }
      }
      return;
    }
    if (!this.build || this.finished.isEmpty()) {
      // A natural on its own.
      if (this.natural) this.frameBox(this.naturalBounds());
      return;
    }
    this.userMoved = false;
    const subject = (
      this.framing === "dressing" ? this.stepBounds.reduce((all, b) => all.union(b), new THREE.Box3()).expandByScalar(0.12) : this.finished
    ).clone().union(this.naturalBounds());
    // With the measuring grid on, leave room for its labels, and for the proportion guide's.
    const framed = subject.clone().expandByScalar(this.grid ? 0.45 : 0);
    if (this.guide) {
      for (const item of this.guide.children) framed.union(guideBounds(item));
      framed.max.y += 0.12 * (framed.max.y - framed.min.y);
    }
    this.frameBox(framed);
  }

  /** Points the camera at `framed` from the current view, filling the picture with a small margin. */
  private frameBox(framed: THREE.Box3) {
    this.userMoved = false;
    this.turningBack = false;
    const target = framed.getCenter(new THREE.Vector3());
    const view = this.viewDirection(this.orbit);
    // "sphere": the distance that fits the fly from every turntable angle, so its size
    // stays the same while it turns.
    const distance =
      this.fit === "sphere"
        ? Math.max(...Array.from({ length: 36 }, (_, i) => this.fitDistance(framed, target, this.viewDirection(i * 10))))
        : this.fitDistance(framed, target, view);
    this.controls.target.copy(target);
    this.allowDistance(distance * 1.08);
    this.camera.position.copy(target).addScaledVector(view, distance * 1.08);
    this.controls.update();
  }

  /** Lets the controls reach a framing distance, with room to zoom out a little further. */
  private allowDistance(distance: number) {
    this.controls.maxDistance = Math.max(this.baseMaxDistance, distance * 1.5);
  }

  private viewDirection(orbit: number): THREE.Vector3 {
    return VIEWS[this.view].clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(orbit));
  }

  /** The camera distance along `view` at which every corner of `box` is inside the view frustum. */
  private fitDistance(box: THREE.Box3, target: THREE.Vector3, view: THREE.Vector3): number {
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), view).normalize();
    const up = new THREE.Vector3().crossVectors(view, right);
    const tanV = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const tanH = tanV * this.camera.aspect;
    let distance = 0;
    for (const x of [box.min.x, box.max.x]) {
      for (const y of [box.min.y, box.max.y]) {
        for (const z of [box.min.z, box.max.z]) {
          const c = new THREE.Vector3(x, y, z).sub(target);
          const depth = c.dot(view);
          distance = Math.max(distance, Math.abs(c.dot(right)) / tanH + depth, Math.abs(c.dot(up)) / tanV + depth);
        }
      }
    }
    return distance;
  }

  setTime(t: number) {
    this.dirty = true;
    const build = this.build;
    if (!build) return;
    this.time = t;
    // A bare hook (the builder's hook pictures): nothing to show but the hook.
    if (build.steps.length === 0) {
      this.atEnd = true;
      if (this.bobbin) this.bobbin.object.visible = false;
      return;
    }
    build.steps.forEach((step, i) => {
      for (const view of this.stepViews[i]!) {
        const u = pieceProgress(step, view, t);
        view.piece.setProgress(view.eased ? smooth(u) : u);
      }
    });
    if (this.focus) this.applyFocus();

    this.currentStep = stepAt(build, t);
    this.atEnd = t >= stepEnd(build.steps[build.steps.length - 1]!);
    const current = build.steps[this.currentStep]!;
    const p = stepProgress(current, t);
    this.poseThread(current.thread, p);
    this.poseLooseEnds(current.freeEnds, p);
    // The label points where the step is working: along the shank as the material or thread
    // goes, on the side facing the viewer, not round each turn, which would swing it about.
    this.anchor.copy(this.anchorFor(current, p));
    this.showGuide();
  }

  /** The point a step works at: the material being wound, else the thread, else what the step adds. */
  private anchorFor(step: Build["steps"][number], p: number): THREE.Vector3 {
    // Points on the fly are in its own frame; it may be turned over ("As it swims").
    const world = (v: THREE.Vector3) => this.fly.localToWorld(v);
    const following = step.freeEnds.find((e) => e.kind === "follow");
    if (following && following.kind === "follow") return world(this.along(following.piece, p));
    // A material being wound: where the winding has got to.
    const wound = step.pieces.find((piece) => piece.type === "wraps" && piece.material !== "thread");
    if (wound) return world(this.along(wound.id, p));
    const box = this.stepBounds[step.index];
    if (step.pieces.some((piece) => piece.type !== "wraps" || piece.material !== "thread") && box && !box.isEmpty()) {
      return box.getCenter(new THREE.Vector3());
    }
    if (step.thread?.kind === "follow") return world(this.along(step.thread.piece, p));
    if (step.thread?.kind === "rest") return world(this.space!.around(step.thread.x, step.thread.radius, 0));
    return this.finished.getCenter(new THREE.Vector3());
  }

  /** How far along the shank a wraps piece has got at step progress p, on its side facing the viewer. */
  private along(id: number, p: number): THREE.Vector3 {
    const piece = this.wraps.get(id);
    if (!piece) return this.finished.getCenter(new THREE.Vector3());
    const [a, b] = piece.window;
    const u = clamp01((p - a) / (b - a));
    // Round a parachute's post: down the post as the hackle goes, on its side facing the viewer.
    if (piece.path === "post" && piece.post) {
      const y = piece.post.y0 + (piece.post.y1 - piece.post.y0) * u;
      return this.space!.point(new THREE.Vector3(piece.post.x, y, piece.post.radius + piece.strandRadius));
    }
    const at = wrapAt(piece, u);
    return this.space!.around(at.x, at.radius, 0, undefined, at.centre);
  }

  /** Where thread or material leaves a wraps piece at step progress p, in world space. */
  private followed(id: number, p: number, far = false) {
    const piece = this.wraps.get(id)!;
    const [a, b] = piece.window;
    const u = clamp01((p - a) / (b - a));
    const w = wrapPoint(piece, u);
    const side = far ? -1 : 1;
    const point = this.space!.point(new THREE.Vector3(w.point[0], w.point[1], side * w.point[2]));
    const leave = this.space!.direction(w.x, new THREE.Vector3(w.leave[0], w.leave[1], side * w.leave[2]).normalize());
    return { u, point, leave };
  }

  private poseThread(pose: Build["steps"][number]["thread"], p: number) {
    if (!this.bobbin) return;
    // Turned over, the fly is shown as it swims, not at the vise: no bobbin hanging upwards.
    if (!pose || this.fly.rotation.x !== 0 || (pose.kind === "follow" && pose.cut && p >= 0.97)) {
      this.bobbin.setPose(null);
      return;
    }
    if (pose.kind === "rest") {
      this.bobbin.setPose(this.space!.around(pose.x, pose.radius, 0), this.space!.direction(pose.x, leaveDirection(0)));
      return;
    }
    const { point, leave } = this.followed(pose.piece, p);
    this.bobbin.setPose(point, leave);
  }

  private poseLooseEnds(ends: FreeEndPose[], p: number) {
    const shown = new Set<string>();
    for (const end of ends) {
      // A cut end drops away rather than vanishing.
      const falling = end.kind === "rest" && end.hideAfter !== undefined && p >= end.hideAfter ? (p - end.hideAfter) / CUT_FALLS : 0;
      if (falling >= 1) continue;
      const key = `${end.material}:${end.length}`;
      let view = this.looseEnds.get(key);
      if (!view) {
        view = new LooseEndView(end, this.surfaces);
        this.looseEnds.set(key, view);
        this.fly.add(view.object);
      }
      shown.add(key);
      if (end.kind === "rest") {
        const local = REST_DIRECTIONS[end.direction];
        const base = this.space!.point(new THREE.Vector3(end.x, local.y * end.radius, local.z * end.radius));
        // (Down in the fly's own frame, as at the vise; faster as it goes, tipping over.)
        const dir = this.space!.direction(end.x, local.clone());
        if (falling > 0) {
          base.y -= CUT_DROP * falling * falling;
          dir.applyAxisAngle(Z_AXIS, -1.2 * falling * falling).normalize();
        }
        view.setPose(base, dir, 1);
      } else {
        const { point, leave, u } = this.followed(end.piece, p, end.far);
        view.setPose(point, leave, 1 - 0.6 * u);
      }
    }
    for (const [key, view] of this.looseEnds) view.object.visible = shown.has(key);
  }

  private clearFly() {
    for (const views of this.stepViews) for (const { piece } of views) piece.dispose();
    for (const view of this.looseEnds.values()) view.dispose();
    this.bobbin?.dispose();
    // The hook has its own materials, made fresh with it.
    this.hook?.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    this.hook = null;
    if (this.guide) disposeTree(this.guide);
    this.fly.clear();
    this.stepViews = [];
    this.wraps.clear();
    this.looseEnds.clear();
    this.bobbin = null;
  }

  private resize() {
    this.dirty = true;
    const { clientWidth: w, clientHeight: h } = this.container;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (!this.userMoved) this.resetCamera();
  }

  dispose() {
    this.disposed = true;
    // The faint copies and the pieces' own materials put back, so each is disposed once.
    this.setFocus(null);
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.seen?.disconnect();
    this.setNatural(null);
    this.clearFly();
    this.surfaces.dispose();
    this.setGrid(false);
    this.setWater(null);
    this.controls.dispose();
    this.environment.dispose();
    this.renderer.dispose();
    // Release the WebGL context now: browsers allow only a few at a time.
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}

/** Disposes the geometries, materials and textures of a group of lines and labels. */
function disposeTree(group: THREE.Object3D) {
  group.traverse((o) => {
    if (o instanceof THREE.LineSegments || o instanceof THREE.Sprite) {
      o.geometry.dispose();
      const m = o.material as THREE.Material & { map?: THREE.Texture | null };
      m.map?.dispose();
      m.dispose();
    }
  });
}

/** World bounds of a measurement, its labels included (a sprite's own bounds ignore its size and anchor). */
function guideBounds(item: THREE.Object3D): THREE.Box3 {
  const box = new THREE.Box3();
  item.updateWorldMatrix(true, true);
  for (const o of item.children) {
    if (o instanceof THREE.Sprite) {
      const p = o.getWorldPosition(new THREE.Vector3());
      const left = p.x - o.scale.x * o.center.x;
      box.expandByPoint(new THREE.Vector3(left, p.y - o.scale.y / 2, p.z));
      box.expandByPoint(new THREE.Vector3(left + o.scale.x, p.y + o.scale.y / 2, p.z));
    } else box.union(new THREE.Box3().setFromObject(o));
  }
  return box;
}

/** Line segments (pairs of points) drawn over the fly. */
function guideLines(points: THREE.Vector3[], color: string): THREE.LineSegments {
  const g = new THREE.BufferGeometry().setFromPoints(points);
  const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9, depthTest: false, depthWrite: false }));
  l.renderOrder = 2;
  return l;
}

/** A text label facing the camera, `h` gapes tall, anchored at its centre or its left end. */
function guideLabel(text: string, at: THREE.Vector3, color: string, align: "center" | "left", h: number): THREE.Sprite {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const font = "italic 44px Spectral, Georgia, serif";
  ctx.font = font;
  canvas.width = Math.ceil(ctx.measureText(text).width) + 8;
  canvas.height = 64;
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.fillText(text, 4, 32);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false }));
  sprite.scale.set((h * canvas.width) / canvas.height, h, 1);
  sprite.center.set(align === "left" ? 0 : 0.5, 0.5);
  sprite.position.copy(at);
  sprite.renderOrder = 2;
  return sprite;
}

function measuringGrid(bounds: THREE.Box3, color: string): THREE.Group {
  const group = new THREE.Group();
  const x0 = Math.floor(bounds.min.x * 4) / 4 - 0.25;
  const x1 = Math.ceil(bounds.max.x * 4) / 4 + 0.25;
  const y0 = Math.floor(bounds.min.y * 4) / 4 - 0.25;
  const y1 = Math.ceil(bounds.max.y * 4) / 4 + 0.25;
  const minor: number[] = [];
  const major: number[] = [];
  const isMajor = (v: number) => Math.abs(v - Math.round(v)) < 1e-6;
  for (let x = x0; x <= x1 + 1e-6; x += 0.25) (isMajor(x) ? major : minor).push(x, y0, 0, x, y1, 0);
  for (let y = y0; y <= y1 + 1e-6; y += 0.25) (isMajor(y) ? major : minor).push(x0, y, 0, x1, y, 0);
  const lines = (points: number[], color: string, opacity: number) => {
    const g = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthTest: false, depthWrite: false });
    const l = new THREE.LineSegments(g, m);
    // Drawn first and without depth, so the fly always covers it.
    l.renderOrder = -1;
    return l;
  };
  group.add(lines(minor, color, 0.18), lines(major, color, 0.5));

  const label = (text: string, x: number, y: number) => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.font = "bold 40px sans-serif";
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 64, 32);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: false, depthWrite: false }),
    );
    sprite.scale.set(0.3, 0.15, 1);
    sprite.position.set(x, y, 0);
    sprite.renderOrder = -1;
    group.add(sprite);
  };
  for (let x = Math.ceil(x0); x <= x1; x++) label(String(x), x, y0 - 0.12);
  for (let y = Math.ceil(y0); y <= y1; y++) label(String(y), x0 - 0.18, y);
  return group;
}

/** A rotation by `angle` about the z axis through `at`. */
function rotationAbout(at: THREE.Vector3, angle: number): THREE.Matrix4 {
  return new THREE.Matrix4()
    .makeTranslation(at.x, at.y, at.z)
    .multiply(new THREE.Matrix4().makeRotationZ(angle))
    .multiply(new THREE.Matrix4().makeTranslation(-at.x, -at.y, -at.z));
}

/** World y of the water's surface for a fly fishing at `depth`, from the finished fly's bounds. */
// Assumption: a dry fly sits with its body just above the film and the hook's bend and the
// hackle's lower fibres through it; an emerger hangs with its shank just under the film and its
// wing or post above; a wet fly or nymph fishes a little under the surface, a weighted one deep.
function waterLevel(depth: Fishing["depth"], fly: THREE.Box3): number {
  switch (depth) {
    case "surface":
      return -0.12;
    case "film":
      return 0.08;
    case "below":
      return fly.max.y + 0.7;
    case "deep":
      return fly.max.y + 2.5;
  }
}

/** How far under the surface something deep is in the realistic water: room for the camera to look at it from under the surface, more for a big fish. */
function deepWater(body: THREE.Box3): number {
  return Math.max(6, 0.75 * (body.max.x - body.min.x));
}

/** The level of the water for a natural on its own (`all` of it, its `body`), from where it is found. */
function naturalLevel(fishing: Fishing, all: THREE.Box3, body: THREE.Box3): number {
  switch (fishing.depth) {
    case "surface": {
      const h = body.max.y - body.min.y;
      // Assumption: its body resting on the film sinks two fifths of its depth into it (wings and
      // back above); spent, it lies more than half in it; standing, its feet just dent it.
      if (fishing.sits === "body") return body.min.y + 0.4 * h;
      if (fishing.sits === "spent") return body.min.y + 0.6 * h;
      return all.min.y + 0.04;
    }
    case "film":
      // Assumption: an ant or beetle that has fallen in lies awash, six tenths of its body under.
      if (fishing.sits === "half") return body.min.y + 0.6 * (body.max.y - body.min.y);
      return body.getCenter(new THREE.Vector3()).y;
    case "below":
      return all.max.y + 1;
    case "deep":
      return all.max.y + deepWater(all);
  }
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}
