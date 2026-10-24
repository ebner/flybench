import { useEffect, useState } from "react";

/** What scripts/render-catalog.ts writes to public/renders/manifest.json. */
export type RenderInfo = { hash: string; frames: number; width: number; height: number };
type Manifest = Record<string, RenderInfo>;

let manifest: Promise<Manifest> | null = null;

function loadManifest(): Promise<Manifest> {
  manifest ??= fetch(`${import.meta.env.BASE_URL}renders/manifest.json`)
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}));
  return manifest;
}

/** Gallery images for a pattern, or null while loading or when it has none yet. */
export function useRenders(): Manifest | null {
  const [m, setM] = useState<Manifest | null>(null);
  useEffect(() => {
    loadManifest().then(setM);
  }, []);
  return m;
}

export function renderUrls(id: string, info: RenderInfo) {
  const base = `${import.meta.env.BASE_URL}renders/${encodeURIComponent(id)}`;
  return { card: `${base}/card.webp?v=${info.hash}`, spin: `${base}/spin.webp?v=${info.hash}` };
}
