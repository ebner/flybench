/**
 * The radius of everything wound onto the shank so far, as a function of x.
 * Each new layer of wraps sits on top of the current profile and then adds to it.
 */
export class Profile {
  static readonly BINS = 400;

  private constructor(
    readonly x0: number,
    readonly x1: number,
    private readonly r: Float32Array,
  ) {}

  static bare(x0: number, x1: number, wireRadius: number): Profile {
    return new Profile(x0, x1, new Float32Array(Profile.BINS).fill(wireRadius));
  }

  radiusAt(x: number): number {
    const t = ((x - this.x0) / (this.x1 - this.x0)) * (Profile.BINS - 1);
    const i = Math.max(0, Math.min(Profile.BINS - 2, Math.floor(t)));
    const f = Math.max(0, Math.min(1, t - i));
    return this.r[i]! * (1 - f) + this.r[i + 1]! * f;
  }

  /** Largest radius over [a, b]. */
  maxRadius(a: number, b: number): number {
    let max = this.radiusAt(a);
    const steps = 20;
    for (let k = 1; k <= steps; k++) max = Math.max(max, this.radiusAt(a + ((b - a) * k) / steps));
    return max;
  }

  /**
   * Returns a new profile with a layer of `thickness` over [a, b], tapering over `taper` at both
   * ends: just outside the range, or, with `within`, inside it (a dubbed noodle thins at its ends).
   */
  withLayer(a: number, b: number, thickness: number, taper = 0.03, within = false): Profile {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const r = new Float32Array(this.r);
    for (let i = 0; i < Profile.BINS; i++) {
      const x = this.x0 + ((this.x1 - this.x0) * i) / (Profile.BINS - 1);
      const inside = Math.min(x - lo, hi - x) - (within ? taper : 0);
      if (inside <= -taper) continue;
      const w = inside >= 0 ? 1 : 1 + inside / taper;
      r[i] = r[i]! + thickness * w * w * (3 - 2 * w);
    }
    return new Profile(this.x0, this.x1, r);
  }
}
