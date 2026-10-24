import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { stepAt, wrapPoint, type Build, type FreeEndPose, type WrapsPiece } from "../tying/simulate";
import { buildHook } from "./hook";
import { BobbinView, LooseEndView } from "./loose";
import { Surfaces } from "./materials";
import { pieceView, type PieceView } from "./pieces";
import { ShankSpace } from "./space";

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
};

export type ViewName = keyof typeof VIEWS;
export const VIEW_NAMES = Object.keys(VIEWS) as ViewName[];

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
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private surfaces = new Surfaces();
  private fly = new THREE.Group();
  private hook: THREE.Group | null = null;
  private stepViews: { piece: PieceView; window: [number, number]; until?: number }[][] = [];
  private wraps = new Map<number, WrapsPiece>();
  private bobbin: BobbinView | null = null;
  private looseEnds = new Map<string, LooseEndView>();
  private build: Build | null = null;
  private space: ShankSpace | null = null;
  private resizeObserver: ResizeObserver;
  private frame = 0;
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

  /** Follow the action: the camera eases towards whatever the current step works on. */
  private follow = false;
  /** Bounds of what each step adds, for following the action. */
  private stepBounds: THREE.Box3[] = [];
  private currentStep = 0;
  private atEnd = false;
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
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    // Assumption: toned down so material colours read close to their swatches.
    this.scene.environmentIntensity = 0.75;
    pmrem.dispose();
    this.setBackground(options.background === undefined ? "#e8e5de" : options.background);

    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(2, 4, 5);
    this.scene.add(key, new THREE.HemisphereLight(0xffffff, 0x8a8070, 0.6));
    this.scene.add(this.fly);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.minDistance = 0.8;
    // Allow at least the distance a narrow field of view needs to frame the fly.
    this.controls.maxDistance = 14 * Math.max(1, 32 / (options.fov ?? 32));
    this.controls.addEventListener("start", () => {
      this.userMoved = true;
      if (this.follow) {
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
      if (this.follow) this.followAction(dt);
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
    this.stepBounds = build.steps.map((step, i) => {
      this.setTime(step.start + step.duration);
      const box = this.visibleBounds(this.stepViews[i]!.map((v) => v.piece.object));
      return box.isEmpty() ? new THREE.Box3() : box;
    });
    this.setTime(build.duration);
    this.finished = this.visibleBounds();
    this.resetCamera();
    this.setTime(0);
    if (this.grid) this.setGrid(true);
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

  /**
   * A measuring grid in the plane of the hook: thin lines every quarter gape, strong lines
   * every gape, labelled in gapes. x = 0 is the start of the bend, y = 0 the shank.
   */
  setGrid(on: boolean) {
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
    this.grid = measuringGrid(this.finished.isEmpty() ? new THREE.Box3(new THREE.Vector3(-1, -1, 0), new THREE.Vector3(3, 1, 0)) : this.finished);
    this.scene.add(this.grid);
    this.resetCamera();
  }

  /** Follow the action (true) or leave the camera where the user puts it (false). */
  setFollow(on: boolean) {
    this.follow = on;
    if (on) this.userMoved = false;
  }

  /** Where the camera should look while following: the current step's work, or the whole fly at the end. */
  private actionBox(): THREE.Box3 {
    if (this.atEnd) return this.finished;
    let box = this.stepBounds[this.currentStep];
    for (let i = this.currentStep; (!box || box.isEmpty()) && i > 0; i--) box = this.stepBounds[i - 1];
    if (!box || box.isEmpty()) return this.finished;
    // Not closer than about a gape and a half around the action, with the anchor in view.
    const framed = box.clone().expandByPoint(this.anchor);
    const center = framed.getCenter(new THREE.Vector3());
    const size = framed.getSize(new THREE.Vector3()).max(new THREE.Vector3(1.6, 1.2, 1.2));
    return new THREE.Box3().setFromCenterAndSize(center, size);
  }

  private followAction(dt: number) {
    const box = this.actionBox();
    const target = box.getCenter(new THREE.Vector3());
    const offset = this.camera.position.clone().sub(this.controls.target);
    const direction = offset.clone().normalize();
    const distance = this.fitDistance(box, target, direction) * 1.15;
    // Ease towards the action rather than jumping.
    const k = 1 - Math.exp(-dt * 2.5);
    this.controls.target.lerp(target, k);
    const d = offset.length() + (distance - offset.length()) * k;
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

  /** Frames the finished fly from the current view, with a small margin. */
  resetCamera() {
    if (!this.build || this.finished.isEmpty()) return;
    this.userMoved = false;
    // With the measuring grid on, leave room for its labels.
    const framed = this.finished.clone().expandByScalar(this.grid ? 0.45 : 0);
    const target = framed.getCenter(new THREE.Vector3());
    const view = this.viewDirection(this.orbit);
    // "sphere": the distance that fits the fly from every turntable angle, so its size
    // stays the same while it turns.
    const distance =
      this.fit === "sphere"
        ? Math.max(...Array.from({ length: 36 }, (_, i) => this.fitDistance(framed, target, this.viewDirection(i * 10))))
        : this.fitDistance(framed, target, view);
    this.controls.target.copy(target);
    this.camera.position.copy(target).addScaledVector(view, distance * 1.08);
    this.controls.update();
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
    build.steps.forEach((step, i) => {
      const p = clamp01((t - step.start) / step.duration);
      for (const { piece, window, until } of this.stepViews[i]!) {
        const gone = until !== undefined && t >= until;
        piece.setProgress(gone ? 0 : clamp01((p - window[0]) / (window[1] - window[0])));
      }
    });

    this.currentStep = stepAt(build, t);
    this.atEnd = t >= build.duration;
    const current = build.steps[this.currentStep]!;
    const p = clamp01((t - current.start) / current.duration);
    this.poseThread(current.thread, p);
    this.poseLooseEnds(current.freeEnds, p);
    this.anchor.copy(this.anchorFor(current, p));
  }

  /** The point a step works at: the material being wound, else the thread, else what the step adds. */
  private anchorFor(step: Build["steps"][number], p: number): THREE.Vector3 {
    const following = step.freeEnds.find((e) => e.kind === "follow");
    if (following && following.kind === "follow") return this.followed(following.piece, p).point;
    const box = this.stepBounds[step.index];
    if (step.pieces.some((piece) => piece.type !== "wraps" || piece.material !== "thread") && box && !box.isEmpty()) {
      return box.getCenter(new THREE.Vector3());
    }
    if (step.thread?.kind === "follow") return this.followed(step.thread.piece, p).point;
    if (step.thread?.kind === "rest") return this.space!.around(step.thread.x, step.thread.radius, 0);
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
    if (!pose || (pose.kind === "follow" && pose.cut && p >= 0.97)) {
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
    this.hook?.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    this.hook = null;
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
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

function measuringGrid(bounds: THREE.Box3): THREE.Group {
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
  group.add(lines(minor, "#5a6a7a", 0.25), lines(major, "#2a4a6a", 0.6));

  const label = (text: string, x: number, y: number) => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.font = "bold 40px sans-serif";
    ctx.fillStyle = "#2a4a6a";
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

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}
