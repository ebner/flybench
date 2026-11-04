/**
 * What is on the shank so far, as a function of x: layers wound all the way round, and what is
 * tied on top or underneath (a hair wing's bound butts, a wing case, a beard), which makes a hump
 * on that side only. Turns wound over it lie on a circle round the shank underneath and over the
 * hump on top. Each new layer of wraps sits on the current profile and then adds to it.
 */
export class Profile {
  static readonly BINS = 400;

  private constructor(
    readonly x0: number,
    readonly x1: number,
    /** All the way round. */
    private readonly r: Float32Array,
    /** On top only. */
    private readonly up: Float32Array,
    /** Underneath only. */
    private readonly down: Float32Array,
  ) {}

  static bare(x0: number, x1: number, wireRadius: number): Profile {
    const empty = new Float32Array(Profile.BINS);
    return new Profile(x0, x1, new Float32Array(Profile.BINS).fill(wireRadius), empty, empty);
  }

  private sample(values: Float32Array, x: number): number {
    const t = ((x - this.x0) / (this.x1 - this.x0)) * (Profile.BINS - 1);
    const i = Math.max(0, Math.min(Profile.BINS - 2, Math.floor(t)));
    const f = Math.max(0, Math.min(1, t - i));
    return values[i]! * (1 - f) + values[i + 1]! * f;
  }

  /** How far the top of it is from the shank's axis: where what is tied on top lies. */
  radiusAt(x: number): number {
    return this.sample(this.r, x) + this.sample(this.up, x);
  }

  /** How far the underside is from the axis: where what is tied underneath lies. */
  underAt(x: number): number {
    return this.sample(this.r, x) + this.sample(this.down, x);
  }

  /**
   * The circle turns wound at x lie on: through the top and the underside, its centre raised
   * (or lowered) off the axis by `centre`.
   */
  ringAt(x: number): { radius: number; centre: number } {
    const r = this.sample(this.r, x);
    const up = this.sample(this.up, x);
    const down = this.sample(this.down, x);
    return { radius: r + (up + down) / 2, centre: (up - down) / 2 };
  }

  /** How far the ring reaches out to the sides. */
  sideAt(x: number): number {
    const { radius, centre } = this.ringAt(x);
    return Math.sqrt(radius * radius - centre * centre);
  }

  /** Largest radius over [a, b]. */
  maxRadius(a: number, b: number): number {
    let max = this.radiusAt(a);
    const steps = 20;
    for (let k = 1; k <= steps; k++) max = Math.max(max, this.radiusAt(a + ((b - a) * k) / steps));
    return max;
  }

  /**
   * Returns a new profile raised over [a, b] to reach at least `reach(x)` from the axis on top and
   * underneath (a body of spun hair trimmed to shape), fading in and out over `fade` of the range
   * at its ends, so what is wound on just past them starts on the shank.
   */
  raisedTo(a: number, b: number, reach: (x: number) => { top: number; under: number }, fade = 0.1): Profile {
    const up = new Float32Array(this.up);
    const down = new Float32Array(this.down);
    for (let i = 0; i < Profile.BINS; i++) {
      const x = this.x0 + ((this.x1 - this.x0) * i) / (Profile.BINS - 1);
      if (x <= a || x >= b) continue;
      const f = (x - a) / (b - a);
      const e = Math.min(1, f / fade, (1 - f) / fade);
      const w = e * e * (3 - 2 * e);
      const { top, under } = reach(x);
      const r = this.r[i]!;
      if (top > r + up[i]!) up[i] = up[i]! + (top - r - up[i]!) * w;
      if (under > r + down[i]!) down[i] = down[i]! + (under - r - down[i]!) * w;
    }
    return new Profile(this.x0, this.x1, this.r, up, down);
  }

  /**
   * Returns a new profile with a layer of `thickness` over [a, b], tapering over `taper` at both
   * ends: just outside the range, or, with `within`, inside it (a dubbed noodle thins at its ends).
   * `where`: all the way round, or only on top or underneath.
   */
  withLayer(a: number, b: number, thickness: number, taper = 0.03, within = false, where: "round" | "top" | "under" = "round"): Profile {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const source = where === "round" ? this.r : where === "top" ? this.up : this.down;
    const values = new Float32Array(source);
    for (let i = 0; i < Profile.BINS; i++) {
      const x = this.x0 + ((this.x1 - this.x0) * i) / (Profile.BINS - 1);
      const inside = Math.min(x - lo, hi - x) - (within ? taper : 0);
      if (inside <= -taper) continue;
      const w = inside >= 0 ? 1 : 1 + inside / taper;
      values[i] = values[i]! + thickness * w * w * (3 - 2 * w);
    }
    return new Profile(
      this.x0,
      this.x1,
      where === "round" ? values : this.r,
      where === "top" ? values : this.up,
      where === "under" ? values : this.down,
    );
  }
}
