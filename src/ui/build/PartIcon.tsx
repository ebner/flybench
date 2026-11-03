import type { ReactNode } from "react";
import type { Role } from "../../edit/parts";

/** A small drawing of a part on a hook: the hook in faint ink, the part in the accent colour. */
export function PartIcon({ role, large = false }: { role: Role | "hook" | "thread"; large?: boolean }) {
  const part: Record<Role | "hook" | "thread", ReactNode> = {
    hook: null,
    thread: <path d="M24 20 H44 M30 20 V34 M30 34 h-3 v6 h6 v-6 z" />,
    bead: <circle cx="43" cy="20" r="3.6" fill="currentColor" />,
    weight: <path d="M20 18.5 H38 M20 21.5 H38" strokeWidth={2.2} />,
    eyes: <path d="M40 15 v10 M37.5 15 h5 M37.5 25 h5" strokeWidth={2} />,
    tag: <path d="M14 20 h3" strokeWidth={4} />,
    tail: <path d="M14 20 L3 17 M14 20 L2 20 M14 20 L3 23" />,
    butt: <path d="M15 20 h3" strokeWidth={6} strokeLinecap="round" />,
    rib: <path d="M16 17 L19 23 M22 17 L25 23 M28 17 L31 23 M34 17 L37 23" />,
    body: <path d="M15 20 H38" strokeWidth={5} strokeLinecap="round" />,
    thorax: <path d="M30 20 H40" strokeWidth={7} strokeLinecap="round" />,
    back: <path d="M15 16.5 Q27 13 40 16.5" strokeWidth={2.2} />,
    wing: <path d="M33 19 L30 5 M33 19 L36 6" />,
    hackle: <path d="M40 20 L40 8 M40 20 L46 10 M40 20 L34 10 M40 20 L40 31 M40 20 L46 30 M40 20 L34 30" />,
    legs: <path d="M32 20 L26 30 M36 20 L36 31 M40 20 L45 30" />,
    antennae: <path d="M45 19 Q50 12 49 7 M45 19 Q52 14 54 11" />,
    flash: <path d="M38 19 L12 15 M38 19 L13 19" strokeDasharray="2 2" />,
    head: <circle cx="42" cy="20" r="4" fill="currentColor" />,
    other: <circle cx="28" cy="20" r="3" />,
  };
  return (
    <svg className={large ? "wb-icon large" : "wb-icon"} viewBox="0 0 56 40" aria-hidden="true">
      <path className="wb-icon-hook" d="M46 20 H14 C6 20 6 34 14 34 C19 34 21 30 21 27" />
      <circle className="wb-icon-hook" cx="47.5" cy="20" r="1.5" />
      <g className="wb-icon-part">{part[role]}</g>
    </svg>
  );
}
