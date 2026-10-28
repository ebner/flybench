import type { HookModel } from "./hook";

/**
 * Hook geometry in the plane of the hook (gape units). The shank is a circular arc of
 * `shankCurve` degrees (0 = straight), symmetric about the horizontal, starting at the
 * origin at the start of the bend. Everything on the fly is placed by arc length u
 * along the shank (u = 0 at the bend, u = shankLength behind the eye), so wraps,
 * tails and wings follow a curved shank exactly as they follow a straight one.
 */

export interface Vec2 {
  x: number;
  y: number;
}

export interface ShankPoint {
  p: Vec2;
  /** Unit tangent, pointing towards the eye. */
  t: Vec2;
}

function headingAt(hook: HookModel, u: number): number {
  const theta = (hook.shankCurve * Math.PI) / 180;
  return theta / 2 - (theta * u) / hook.shankLength;
}

/** Point and tangent on the shank at arc length u; beyond the ends it continues straight. */
export function shankAt(hook: HookModel, u: number): ShankPoint {
  const theta = (hook.shankCurve * Math.PI) / 180;
  const L = hook.shankLength;
  const clamped = Math.max(0, Math.min(L, u));
  let p: Vec2;
  const h = headingAt(hook, clamped);
  if (theta === 0) {
    p = { x: clamped, y: 0 };
  } else {
    const R = L / theta;
    const h0 = theta / 2;
    p = { x: -R * (Math.sin(h) - Math.sin(h0)), y: R * (Math.cos(h) - Math.cos(h0)) };
  }
  const t = { x: Math.cos(h), y: Math.sin(h) };
  const beyond = u - clamped;
  return { p: { x: p.x + t.x * beyond, y: p.y + t.y * beyond }, t };
}

/**
 * The wire's centre line from the eye end of the shank, back along the shank, round the
 * bend and out to the point: a list of points for drawing the hook.
 */
export function hookPath(hook: HookModel, step = 0.02): Vec2[] {
  return [...shankPath(hook, step), ...bendPath(hook, step)];
}

/** The shank's centre line from the eye end back to the start of the bend. */
export function shankPath(hook: HookModel, step = 0.02): Vec2[] {
  const points: Vec2[] = [];
  for (let u = hook.shankLength; u > 0; u -= step) points.push(shankAt(hook, u).p);
  return points;
}

/**
 * Where the eye attaches and which way it points: the end of the shank, or on a jig hook
 * the end of the section bent up from it.
 */
export function eyeBase(hook: HookModel): ShankPoint {
  const end = shankAt(hook, hook.shankLength);
  if (!hook.jig) return end;
  const a = Math.atan2(end.t.y, end.t.x) + (hook.jig.angle * Math.PI) / 180;
  const t = { x: Math.cos(a), y: Math.sin(a) };
  return { p: { x: end.p.x + t.x * hook.jig.length, y: end.p.y + t.y * hook.jig.length }, t };
}

/** The bend and point, from the start of the bend: the part a double or treble repeats. */
export function bendPath(hook: HookModel, step = 0.02): Vec2[] {
  const points: Vec2[] = [];
  // A tube or Waddington has no bend of its own: the treble behind it is drawn separately.
  if (hook.tube) return points;
  // The bend: an arc continuing the shank's curve, of a radius that makes the gape (inside
  // of shank to inside of point) one unit on a straight shank. It turns until the point runs
  // parallel to the hook's axis (eye to bend), as on real hooks: a half circle on a straight
  // shank, less on a curved one, whose rear already slopes down into the bend.
  const start = shankAt(hook, 0);
  const R = (1 + 2 * hook.wireRadius) / 2;
  const back = Math.atan2(-start.t.y, -start.t.x);
  const sweep = Math.PI - Math.atan2(start.t.y, start.t.x);
  // Centre of the bend lies to the left of travel when heading back (i.e. below the shank).
  const cx = start.p.x + R * Math.cos(back + Math.PI / 2);
  const cy = start.p.y + R * Math.sin(back + Math.PI / 2);
  const steps = Math.ceil((sweep * R) / step);
  for (let i = 0; i <= steps; i++) {
    const a = back - Math.PI / 2 + (sweep * i) / steps;
    points.push({ x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) });
  }
  // The point section, rising slightly towards the shank.
  const end = points[points.length - 1]!;
  const dir = back + sweep;
  const rise = 0.12;
  const n = Math.ceil(hook.pointLength / step);
  for (let i = 1; i <= n; i++) {
    const f = i / n;
    const along = hook.pointLength * f;
    points.push({
      x: end.x + along * Math.cos(dir) - rise * f * f * Math.sin(dir),
      y: end.y + along * Math.sin(dir) + rise * f * f * Math.cos(dir),
    });
  }
  return points;
}

/** x of the rearmost point of the hook (outside of the wire), in gapes. */
export function bendEndX(hook: HookModel): number {
  return Math.min(...hookPath(hook).map((p) => p.x)) - hook.wireRadius;
}
