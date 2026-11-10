/** The player's buttons and speeds, for the pattern page and the builder's "watch it tied". */
const Icon = {
  previous: <path d="M5.5 5H8v14H5.5zM19 5 9 12l10 7z" />,
  play: <path d="M7 4.5v15L19.5 12z" />,
  pause: <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />,
  replay: <path d="M5 12a7 7 0 1 0 2.05-4.95M5 4v4h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
  next: <path d="M16 5h2.5v14H16zM5 5l10 7-10 7z" />,
  more: <path d="M5 10.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6Zm7 0a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6Zm7 0a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6Z" />,
};

export const SPEEDS = [
  [0.5, "half"],
  [1, "normal"],
  [2, "double"],
] as const;

export function TransportIcon({ name }: { name: keyof typeof Icon }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      {Icon[name]}
    </svg>
  );
}
