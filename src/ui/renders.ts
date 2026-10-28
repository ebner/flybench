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

/** Material swatches: what scripts/render-catalog.ts writes to public/renders/materials/manifest.json. */
let swatches: Promise<Record<string, string>> | null = null;

/** Swatch picture addresses by swatchName (src/catalog/swatch.ts), or null while loading. */
export function useSwatches(): Record<string, string> | null {
  const [m, setM] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    swatches ??= fetch(`${import.meta.env.BASE_URL}renders/materials/manifest.json`)
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}));
    swatches.then((hashes: Record<string, string>) =>
      setM(Object.fromEntries(Object.entries(hashes).map(([name, hash]) => [name, `${import.meta.env.BASE_URL}renders/materials/${name}.webp?v=${hash}`]))),
    );
  }, []);
  return m;
}

export function renderUrls(id: string, info: RenderInfo) {
  const base = `${import.meta.env.BASE_URL}renders/${encodeURIComponent(id)}`;
  return { card: `${base}/card.webp?v=${info.hash}`, spin: `${base}/spin.webp?v=${info.hash}` };
}
