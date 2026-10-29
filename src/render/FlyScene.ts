import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { pieceProgress, stepAt, stepEnd, stepProgress, wrapPoint, type Build, type FreeEndPose, type WrapsPiece } from "../tying/simulate";
import { buildHook } from "./hook";
import { buildNatural, disposeNatural } from "./natural";
import type { Natural } from "../recipe/natural";
import { proportions } from "../tying/proportions";
import { BobbinView, LooseEndView } from "./loose";
import { Surfaces } from "./materials";
import { pieceView, type PieceView } from "./pieces";
import { ShankSpace } from "./space";
import { patchFogForWater, Water, waveHeight, type WaterLook } from "./water";
import { CLUMPS, HOLDS_AIR, WET_SPREAD, type Fishing } from "../tying/fishing";
import { mulberry32 } from "./random";

const REST_DIRECTIONS = {
  "back-down": new THREE.Vector3(-0.8, -1, 0.15).normalize(),
  "back-up": new THREE.Vector3(-0.9, 0.8, 0.2).normalize(),
  out: new THREE.Vector3(0.25, -1, 0.35).normalize(),
  /** Lying back over the bend, waiting to be pulled over the body. */
  "back-flat": new THREE.Vector3(-1, 0.18, 0).normalize(),
};

/** Camera directions (from the fly towards the camera) for the named views. */
const VIEWS = {
  /** Slightly from above and in front: the interactive default. */
  default: new THREE.Vector3(0.12, 0.12, 1).normalize(),
  /** Straight from the side, eye to the right: the view for measuring proportions. */
  side: new THREE.Vector3(0, 0, 1),
  top: new THREE.Vector3(0, 1, 0.02).normalize(),
  front: new THREE.Vector3(1, 0.05, 0).normalize(),
  "three-quarter": new THREE.Vector3(0.55, 0.35, 1).normalize(),
  /** In the water, from the side: just above the waterline, looking into a cut-away tank. */
  "water-side": new THREE.Vector3(0, 0.07, 1).normalize(),
  /** In the water, a trout's view: from below and in front, looking up at the fly against the surface. */
  "water-below": new THREE.Vector3(0.25, -1, 0.75).normalize(),
};

export type ViewName = keyof typeof VIEWS;
export const VIEW_NAMES = Object.keys(VIEWS) as ViewName[];

/** The finished fly shown in water. */
export interface WaterSetting {
  fishing: Fishing;
  view: "side" | "below";
  /** No waves, drift or swimming: the water held still (and for reduced motion). */
  still: boolean;
  look: WaterLook;
}

export interface FlySceneOptions {
  /** Vertical field of view in degrees. A narrow one gives a nearly distortion-free view for measuring. */
  fov?: number;
  /** Background colour; null for a transparent canvas. */
  background?: string | null;
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
  private environment: THREE.WebGLRenderTarget;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private surfaces = new Surfaces();
  private fly = new THREE.Group();
  /** Holds the fly; moves it as the water carries it, without touching the fly's own transform. */
  private rig = new THREE.Group();
  private hook: THREE.Group | null = null;
  private stepViews: { piece: PieceView; window: [number, number]; until?: number }[][] = [];
  private wraps = new Map<number, WrapsPiece>();
  private bobbin: BobbinView | null = null;
  private looseEnds = new Map<string, LooseEndView>();
  private build: Build | null = null;
  private space: ShankSpace | null = null;
  private resizeObserver: ResizeObserver;
  private frame = 0;
  private baseMaxDistance: number;
  /** Bounds of the finished fly, which the default view frames. */
  private finished = new THREE.Box3();
  /** Once the user orbits or zooms, resizing no longer re-frames the fly. */
  private userMoved = false;
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
  /** The time last shown, so re-measuring can come back to it. */
  private time = 0;
  private water: {
    setting: WaterSetting;
    view: Water;
    level: number;
    pivot: THREE.Vector3;
    /** The fly as it hangs in the water, for framing. */
    bounds: THREE.Box3;
    /** How the fly hangs in the water before it moves (tail down in the film). */
    hang: THREE.Matrix4;
    bubbles: THREE.InstancedMesh | null;
    /** Soft fibres under water, drawn closer to the shank. */
    soft: THREE.Object3D[];
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
  onAnchor?: (point: { x: number; y: number } | null) => void;

  constructor(
    private container: HTMLElement,
    options: FlySceneOptions = {},
  ) {
    this.camera = new THREE.PerspectiveCamera(options.fov ?? 32, 1, 0.05, 500);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: options.background === null });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(this.renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.environment = pmrem.fromScene(room, 0.04);
    this.scene.environment = this.environment.texture;
    room.dispose();
    // Assumption: toned down so material colours read close to their swatches.
    this.scene.environmentIntensity = 0.75;
    pmrem.dispose();
    this.setBackground(options.background === undefined ? "#e8e5de" : options.background);

    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(2, 4, 5);
    this.scene.add(key, new THREE.HemisphereLight(0xffffff, 0x8a8070, 0.6));
    this.rig.matrixAutoUpdate = false;
    this.rig.add(this.fly);
    this.scene.add(this.rig);
    patchFogForWater();

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    // One finger scrolls the page past the view; two fingers turn and zoom the fly.
    this.controls.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_ROTATE };
    this.renderer.domElement.style.touchAction = "pan-y";
    this.controls.minDistance = 0.8;
    // Allow at least the distance a narrow field of view needs to frame the fly; framing a
    // long fly in a narrow viewport raises it (see allowDistance).
    this.baseMaxDistance = 14 * Math.max(1, 32 / (options.fov ?? 32));
    this.controls.maxDistance = this.baseMaxDistance;
    this.controls.addEventListener("start", () => {
      this.userMoved = true;
      // Turning the fly in the water leaves following as it is, for back at the vise.
      if (this.follow && !this.water) {
        this.follow = false;
        this.onFollowChange?.(false);
      }
    });

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();

    const loop = (now: number) => {
      this.frame = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - (this.lastFrame || now)) / 1000);
      this.lastFrame = now;
      // Following waits while the fly is in the water, and goes on when it is back at the vise.
      if (this.follow && !this.water) this.followAction(dt);
      if (this.water && !this.water.setting.still) this.setWaterTime(this.waterTime + dt);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      this.reportAnchor();
    };
    this.frame = requestAnimationFrame(loop);
  }

  setBuild(build: Build) {
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
          return { piece, window: p.window, until: p.until };
        }),
      );
    }
    this.bobbin = new BobbinView(build.threadRadius, build.threadColor, this.surfaces);
    this.fly.add(this.bobbin.object);
    this.time = 0;
    this.measure();
    if (this.grid) this.setGrid(true);
    if (this.guide) this.setProportions(true);
  }

  /**
   * The proportion guide: the gape grid behind the fly, and labelled measurements of each
   * part (tail and wing lengths, hackle fibres, how much of the shank the body covers), each
   * appearing with the step that ties it. `color` is the theme's ink for lines and labels.
   */
  setProportions(on: boolean, color?: string) {
    // Already showing: a new colour (the theme changed) or a rebuild leaves the camera where it is.
    const redraw = on && this.guide !== null;
    if (color) this.guideColor = color;
    if (this.guide) {
      disposeTree(this.guide);
      this.fly.remove(this.guide);
      this.guide = null;
    }
    // Proportions are judged from the side, square to the grid.
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
    if (this.fly.rotation.x === (on ? Math.PI : 0)) return;
    this.fly.rotation.x = on ? Math.PI : 0;
    this.fly.updateMatrixWorld(true);
    if (this.build) this.measure();
  }

  /** Bounds of each step and of the finished fly, for framing; then back to the current time. */
  private measure() {
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
    this.followFresh = true;
    this.resetCamera();
    this.setTime(time);
    if (water) this.setWater(water);
  }

  /**
   * The finished fly in water, placed by how it fishes: riding on the surface, hanging in the
   * film, just under or deep. null takes it back to the vise.
   */
  setWater(setting: WaterSetting | null) {
    // Stilling the water or a new theme keeps the camera where the visitor put it.
    const before = this.water?.setting;
    const sameView = !!before && !!setting && before.view === setting.view && before.fishing === setting.fishing;
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
      this.water = null;
      this.scene.fog = null;
      this.rig.matrix.identity();
      this.rig.updateMatrixWorld(true);
    }
    if (!setting || !this.build) {
      if (this.view.startsWith("water-")) this.setView("default");
      return;
    }
    this.setTime(this.build.duration);
    const fly = this.finished;
    const level = waterLevel(setting.fishing.depth, fly);
    // Tail down from the front of the shank, for an emerger in the film.
    const front = this.fly.localToWorld(this.space!.point(new THREE.Vector3(0.85 * this.build.hook.shankLength, 0, 0)));
    this.rig.matrix.copy(rotationAbout(front, THREE.MathUtils.degToRad(setting.fishing.hang)));
    this.rig.updateMatrixWorld(true);
    const bounds = this.visibleBounds();
    const pivot = bounds.getCenter(new THREE.Vector3());
    const view = new Water({
      level,
      centre: pivot,
      look: setting.look,
      dimples: setting.fishing.depth === "surface" || setting.fishing.depth === "film" ? this.dimples(level) : [],
      motion: setting.fishing.motion,
      cut: setting.view === "side" ? fly.max.z + 0.4 : null,
    });
    this.scene.add(view.group);
    // Wet and tinted below the waterline (see patchFogForWater), more so the deeper it is.
    this.scene.fog = new THREE.Fog(setting.look.water, level, 6);
    // Fibres clump only where the whole fly is under water.
    const sunk = setting.fishing.depth === "below" || setting.fishing.depth === "deep";
    const soft = sunk
      ? this.build.steps.flatMap((step, i) => step.pieces.flatMap((p, j) => (CLUMPS.has(p.look) ? [this.stepViews[i]![j]!.piece.object] : [])))
      : [];
    for (const o of soft) o.scale.set(1, WET_SPREAD, WET_SPREAD);
    this.fly.updateMatrixWorld(true);
    this.water = { setting, view, level, pivot, bounds, hang: this.rig.matrix.clone(), bubbles: this.bubbles(level), soft };
    // Stilling the water holds it where it is.
    this.setWaterTime(this.waterTime);
    if (!sameView) this.setView(setting.view === "side" ? "water-side" : "water-below");
  }

  /** The water and the fly in it at `t` seconds of water time. */
  setWaterTime(t: number) {
    this.waterTime = t;
    const w = this.water;
    if (!w) return;
    w.view.setTime(t);
    const { depth, motion } = w.setting.fishing;
    const c = w.pivot;
    let lift = 0;
    let pitch = 0;
    let roll = 0;
    if (motion === "swim") {
      // Straightens and lifts on each pull, dips nose first in the pause after it.
      const f = (t % Water.STRIP) / Water.STRIP;
      const pull = f < 0.3 ? Math.sin((f / 0.3) * Math.PI) : 0;
      const glide = f < 0.3 ? 0 : (f - 0.3) / 0.7;
      lift = 0.06 * pull - 0.08 * glide;
      pitch = 0.05 * pull - 0.07 * glide;
      roll = 0.03 * Math.sin(1.3 * t);
      // Soft fibres pressed in by the pull, opening out again in the pause.
      const spread = WET_SPREAD * (1 - 0.12 * pull + 0.08 * Math.sin(Math.PI * glide));
      for (const o of w.soft) o.scale.set(1, spread, spread);
    } else if (motion === "swing") {
      // Held against the current, swaying a little, its fibres working in the flow.
      lift = 0.02 * Math.sin(1.1 * t);
      pitch = 0.03 * Math.sin(0.8 * t);
      roll = 0.08 * Math.sin(0.9 * t);
      const spread = WET_SPREAD * (1 + 0.05 * Math.sin(3 * t));
      for (const o of w.soft) o.scale.set(1, spread, spread);
    } else if (depth === "surface" || depth === "film") {
      // Rides the waves.
      lift = waveHeight(c.x, c.z, t);
      pitch = 6 * (waveHeight(c.x + 0.5, c.z, t) - waveHeight(c.x - 0.5, c.z, t));
      roll = 6 * (waveHeight(c.x, c.z + 0.5, t) - waveHeight(c.x, c.z - 0.5, t));
    } else {
      // Tumbles slowly in the current.
      lift = 0.05 * Math.sin(0.5 * t);
      pitch = 0.1 * Math.sin(0.31 * t);
      roll = 0.18 * Math.sin(0.43 * t + 1);
    }
    const turn = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(roll, 0, pitch));
    this.rig.matrix
      .makeTranslation(c.x, c.y + lift, c.z)
      .multiply(turn)
      .multiply(new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z))
      .multiply(w.hang);
    this.rig.updateMatrixWorld(true);
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
    this.scene.background = color === null ? null : new THREE.Color(color);
  }

  /** Switches to a named view, turned `orbit` degrees around the vertical axis, framing the finished fly. */
  setView(view: ViewName, orbit = 0, fit: "box" | "sphere" = "box") {
    this.view = view;
    this.orbit = orbit;
    this.fit = fit;
    this.resetCamera();
  }

  /** Draws a frame right away, for screenshots between animation frames. */
  renderNow() {
    this.renderer.render(this.scene, this.camera);
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
    this.grid = measuringGrid(this.finished.isEmpty() ? new THREE.Box3(new THREE.Vector3(-1, -1, 0), new THREE.Vector3(3, 1, 0)) : this.finished, color);
    this.scene.add(this.grid);
    if (reframe) this.resetCamera();
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
    this.onAnchor({ x: ((p.x + 1) / 2) * w, y: ((1 - p.y) / 2) * h });
  }

  /** World-space bounds of the visible fly (or of `only` these objects), without the bobbin and loose ends. */
  private visibleBounds(only?: THREE.Object3D[]): THREE.Box3 {
    const box = new THREE.Box3();
    const part = new THREE.Box3();
    this.fly.updateMatrixWorld(true);
    const skip = new Set<THREE.Object3D>([this.bobbin!.object, ...[...this.looseEnds.values()].map((v) => v.object)]);
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
    this.framing = framing;
    this.resetCamera();
  }

  /**
   * Shows a natural with the fly, `length` gapes long (its body length at the fly's scale):
   * "beside" below the finished fly, "over" laid along the hook, half see-through. Without a
   * fly, it is shown on its own. null takes it away.
   */
  setNatural(n: Natural | null, length = 4, at: "beside" | "over" = "beside") {
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
    this.resetCamera();
  }

  private naturalBounds(): THREE.Box3 {
    return this.natural ? new THREE.Box3().setFromObject(this.natural) : new THREE.Box3();
  }

  /** Frames the finished fly from the current view, with a small margin. */
  resetCamera() {
    if (!this.build || this.finished.isEmpty()) {
      // A natural on its own.
      if (this.natural) this.frameBox(this.naturalBounds());
      return;
    }
    if (this.water) {
      // The waterline in the picture too, when the fly is near it.
      const framed = this.water.bounds.clone().expandByScalar(0.3);
      if (this.water.setting.fishing.depth !== "deep") framed.expandByPoint(new THREE.Vector3(this.water.pivot.x, this.water.level + 0.3, 0));
      this.frameBox(framed);
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
    const build = this.build;
    if (!build) return;
    this.time = t;
    build.steps.forEach((step, i) => {
      for (const view of this.stepViews[i]!) view.piece.setProgress(pieceProgress(step, view, t));
    });

    this.currentStep = stepAt(build, t);
    this.atEnd = t >= stepEnd(build.steps[build.steps.length - 1]!);
    const current = build.steps[this.currentStep]!;
    const p = stepProgress(current, t);
    this.poseThread(current.thread, p);
    this.poseLooseEnds(current.freeEnds, p);
    // The label's point is where the step leaves its material or thread, for the whole step:
    // following the tip round each turn would swing the label about while it plays.
    this.anchor.copy(this.anchorFor(current, 1));
    this.showGuide();
  }

  /** The point a step works at: the material being wound, else the thread, else what the step adds. */
  private anchorFor(step: Build["steps"][number], p: number): THREE.Vector3 {
    // Points on the fly are in its own frame; it may be turned over ("As it swims").
    const world = (v: THREE.Vector3) => this.fly.localToWorld(v);
    const following = step.freeEnds.find((e) => e.kind === "follow");
    if (following && following.kind === "follow") return world(this.followed(following.piece, p).point);
    const box = this.stepBounds[step.index];
    if (step.pieces.some((piece) => piece.type !== "wraps" || piece.material !== "thread") && box && !box.isEmpty()) {
      return box.getCenter(new THREE.Vector3());
    }
    if (step.thread?.kind === "follow") return world(this.followed(step.thread.piece, p).point);
    if (step.thread?.kind === "rest") return world(this.space!.around(step.thread.x, step.thread.radius, 0));
    return this.finished.getCenter(new THREE.Vector3());
  }

  /** Where thread or material leaves a wraps piece at step progress p, in world space. */
  private followed(id: number, p: number) {
    const piece = this.wraps.get(id)!;
    const [a, b] = piece.window;
    const u = clamp01((p - a) / (b - a));
    const w = wrapPoint(piece, u);
    const point = this.space!.point(new THREE.Vector3(...w.point));
    const leave = this.space!.direction(w.x, new THREE.Vector3(...w.leave).normalize());
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
      if (end.kind === "rest" && end.hideAfter !== undefined && p >= end.hideAfter) continue;
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
        view.setPose(base, this.space!.direction(end.x, local.clone()), 1);
      } else {
        const { point, leave, u } = this.followed(end.piece, p);
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
    const { clientWidth: w, clientHeight: h } = this.container;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (!this.userMoved) this.resetCamera();
  }

  dispose() {
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
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

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}
