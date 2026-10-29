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

let naturalPictures: Promise<Record<string, string>> | null = null;

/** Pictures of the naturals by id (public/renders/naturals/), or null while loading. */
export function useNaturalPictures(): Record<string, string> | null {
  const [m, setM] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    naturalPictures ??= fetch(`${import.meta.env.BASE_URL}renders/naturals/manifest.json`)
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}));
    naturalPictures.then((hashes: Record<string, string>) =>
      setM(Object.fromEntries(Object.entries(hashes).map(([id, hash]) => [id, `${import.meta.env.BASE_URL}renders/naturals/${id}.webp?v=${hash}`]))),
    );
  }, []);
  return m;
}

export function renderUrls(id: string, info: RenderInfo) {
  const base = `${import.meta.env.BASE_URL}renders/${encodeURIComponent(id)}`;
  return { card: `${base}/card.webp?v=${info.hash}`, spin: `${base}/spin.webp?v=${info.hash}` };
}

/** The realistic water's stills: what scripts/render-water.ts writes to public/renders/water/manifest.json. */
type WaterManifest = { patterns: Record<string, string>; naturals: Record<string, string> };
export type WaterStills = { angler: string; below: string };

let waterManifest: Promise<WaterManifest> | null = null;

/** The stills of a pattern or natural, from above and from below; null when it has none, undefined while loading. */
export function useWaterStills(kind: "patterns" | "naturals", id: string): WaterStills | null | undefined {
  const [m, setM] = useState<WaterManifest | null>(null);
  useEffect(() => {
    waterManifest ??= fetch(`${import.meta.env.BASE_URL}renders/water/manifest.json`)
      .then((r) => (r.ok ? r.json() : { patterns: {}, naturals: {} }))
      .catch(() => ({ patterns: {}, naturals: {} }));
    waterManifest.then(setM);
  }, []);
  if (!m) return undefined;
  const hash = m[kind]?.[id];
  if (!hash) return null;
  const base = `${import.meta.env.BASE_URL}renders/water/${kind}/${encodeURIComponent(id)}`;
  return { angler: `${base}/angler.webp?v=${hash}`, below: `${base}/below.webp?v=${hash}` };
}

/** All naturals' stills by id (the Naturals index), or null while loading. */
export function useNaturalStills(): Record<string, WaterStills> | null {
  const [m, setM] = useState<WaterManifest | null>(null);
  useEffect(() => {
    waterManifest ??= fetch(`${import.meta.env.BASE_URL}renders/water/manifest.json`)
      .then((r) => (r.ok ? r.json() : { patterns: {}, naturals: {} }))
      .catch(() => ({ patterns: {}, naturals: {} }));
    waterManifest.then(setM);
  }, []);
  if (!m) return null;
  return Object.fromEntries(
    Object.entries(m.naturals ?? {}).map(([id, hash]) => {
      const base = `${import.meta.env.BASE_URL}renders/water/naturals/${encodeURIComponent(id)}`;
      return [id, { angler: `${base}/angler.webp?v=${hash}`, below: `${base}/below.webp?v=${hash}` }];
    }),
  );
}
