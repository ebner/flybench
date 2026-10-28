import type { Build, Piece } from "./simulate";

/**
 * The proportions a tyer checks, as measurements on the fly for the proportion guide: how far
 * tails, wings and other bunches reach, how long hackle fibres and legs stand out, and how much
 * of the shank a body covers. Positions are along the shank (`x`, in gapes, as the simulation
 * places pieces); lengths are in gapes.
 */
export type Dimension =
  /** Lengthwise: from x0 to x1, drawn as a bracket above the fly. */
  | { kind: "along"; step: number; material: string; label: string; x0: number; x1: number }
  /** Standing out from the shank at x: from radius r out to r + length. */
  | { kind: "out"; step: number; material: string; label: string; x: number; r: number; length: number; side: "top" | "under" };

const times = (n: number) => `${Math.round(n * 10) / 10}× gape`;

export function proportions(build: Build): Dimension[] {
  const dims: Dimension[] = [];
  const role = (id: string) => {
    const r = id.replace(/-/g, " ");
    return r.charAt(0).toUpperCase() + r.slice(1);
  };
  const seen = new Set<string>();
  // A body: every pass of the same material along the shank, from the first step it appears in.
  const bodies = new Map<string, { step: number; x0: number; x1: number }>();
  const shank = build.hook.shankLength;

  build.steps.forEach((step) => {
    for (const piece of step.pieces as Piece[]) {
      const id = piece.material;
      if (id === "thread") continue;
      // A bunch or feather sticking out (a tail, wing, beard), not spun hair or trimmed butts.
      const sticksOut = (piece.type === "bundle" && piece.direction !== "radial" && !piece.cut) || piece.type === "feather";
      if (sticksOut && !seen.has(id)) {
        seen.add(id);
        const label = `${role(id)}: ${times(piece.length)}`;
        if (piece.angle >= Math.PI / 3) {
          // Upright (a divided wing, a post): measured standing up from the shank.
          dims.push({ kind: "out", step: step.index, material: id, label, x: piece.x, r: piece.radius, length: piece.length, side: piece.side });
        } else {
          const reach = piece.length * Math.cos(piece.angle);
          const back = piece.type === "feather" || piece.direction === "back";
          dims.push({ kind: "along", step: step.index, material: id, label, x0: piece.x, x1: piece.x + (back ? -reach : reach) });
        }
      } else if (piece.type === "legs" && !seen.has(id)) {
        seen.add(id);
        dims.push({ kind: "out", step: step.index, material: id, label: `${role(id)}: ${times(piece.length)}`, x: piece.x, r: piece.radius, length: piece.length, side: "under" });
      }
      if (piece.type === "wraps" && piece.path === "travel") {
        // Hackle stands out from where it is wound; other wound or dubbed materials make a body.
        if (piece.look === "hackle" && piece.fibreLength) {
          if (!seen.has(id)) {
            seen.add(id);
            const x = Math.max(piece.x0, piece.x1);
            dims.push({ kind: "out", step: step.index, material: id, label: `${role(id)} fibres: ${times(piece.fibreLength)}`, x, r: 0, length: piece.fibreLength, side: "top" });
          }
        } else if (piece.look !== "wire" && piece.look !== "tinsel") {
          const b = bodies.get(id);
          const [a, z] = [Math.min(piece.x0, piece.x1), Math.max(piece.x0, piece.x1)];
          bodies.set(id, b ? { step: b.step, x0: Math.min(b.x0, a), x1: Math.max(b.x1, z) } : { step: step.index, x0: a, x1: z });
        }
      }
    }
  });
  for (const [id, b] of bodies) {
    if (b.x1 - b.x0 < 0.15 * shank) continue;
    dims.push({ kind: "along", step: b.step, material: id, label: `${role(id)}: ${Math.round(((b.x1 - b.x0) / shank) * 100)}% of the shank`, x0: b.x0, x1: b.x1 });
  }
  // Parts measured the same at the same place (a brown and a grizzly tail, two hackles wound
  // together) share one measurement: "Tail brown, tail grizzly: 1.7× gape".
  const merged: Dimension[] = [];
  for (const d of dims.sort((a, b) => a.step - b.step)) {
    const value = d.label.slice(d.label.indexOf(": "));
    const same = merged.find(
      (m) =>
        m.kind === d.kind &&
        m.label.endsWith(value) &&
        (m.kind === "along" && d.kind === "along"
          ? Math.abs(m.x0 - d.x0) < 0.1 && Math.abs(m.x1 - d.x1) < 0.1
          : m.kind === "out" && d.kind === "out" && Math.abs(m.x - d.x) < 0.1 && m.side === d.side),
    );
    if (same) same.label = `${same.label.slice(0, -value.length)}, ${d.label.charAt(0).toLowerCase()}${d.label.slice(1)}`;
    else merged.push({ ...d });
  }
  return merged;
}
