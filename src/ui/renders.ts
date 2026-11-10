import { useEffect, useState } from "react";
import { WATER_VIEWS } from "./features";
// Part of the app, so the gallery's pictures are in the page from its first moment (the file
// itself is also served, for the service worker).
import rendered from "../../public/renders/manifest.json";

/** What scripts/render-catalog.ts writes to public/renders/manifest.json. */
export type RenderInfo = { hash: string; frames: number; width: number; height: number };
type Manifest = Record<string, RenderInfo>;

/** The gallery images there are, by pattern. */
export function useRenders(): Manifest {
  return rendered;
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

let hookPictures: Promise<Record<string, string>> | null = null;

/** Pictures of the bare hooks by model (public/renders/hooks/), for the builder, or null while loading. */
export function useHookPictures(): Record<string, string> | null {
  const [m, setM] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    hookPictures ??= fetch(`${import.meta.env.BASE_URL}renders/hooks/manifest.json`)
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}));
    hookPictures.then((hashes: Record<string, string>) =>
      setM(Object.fromEntries(Object.entries(hashes).map(([id, hash]) => [id, `${import.meta.env.BASE_URL}renders/hooks/${id}.webp?v=${hash}`]))),
    );
  }, []);
  return m;
}

export function renderUrls(id: string, info: RenderInfo) {
  const base = `${import.meta.env.BASE_URL}renders/${encodeURIComponent(id)}`;
  const card = `${base}/card.webp?v=${info.hash}`;
  // The card again at twice the size, for screens with finer pixels.
  return { card, cards: `${card} 1x, ${base}/card@2x.webp?v=${info.hash} 2x`, spin: `${base}/spin.webp?v=${info.hash}` };
}

/** The realistic water's stills: what scripts/render-water.ts writes to public/renders/water/manifest.json. */
type WaterManifest = { patterns: Record<string, string>; naturals: Record<string, string> };
export type WaterStills = { angler: string; below: string };

let waterManifest: Promise<WaterManifest> | null = null;

/** The stills there are: none while the water views are switched off (src/ui/features.ts). */
function loadWaterManifest(): Promise<WaterManifest> {
  waterManifest ??= WATER_VIEWS
    ? fetch(`${import.meta.env.BASE_URL}renders/water/manifest.json`)
        .then((r) => (r.ok ? r.json() : { patterns: {}, naturals: {} }))
        .catch(() => ({ patterns: {}, naturals: {} }))
    : Promise.resolve({ patterns: {}, naturals: {} });
  return waterManifest;
}

/** The stills of a pattern or natural, from above and from below; null when it has none, undefined while loading. */
export function useWaterStills(kind: "patterns" | "naturals", id: string): WaterStills | null | undefined {
  const [m, setM] = useState<WaterManifest | null>(null);
  useEffect(() => {
    loadWaterManifest().then(setM);
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
    loadWaterManifest().then(setM);
  }, []);
  if (!m) return null;
  return Object.fromEntries(
    Object.entries(m.naturals ?? {}).map(([id, hash]) => {
      const base = `${import.meta.env.BASE_URL}renders/water/naturals/${encodeURIComponent(id)}`;
      return [id, { angler: `${base}/angler.webp?v=${hash}`, below: `${base}/below.webp?v=${hash}` }];
    }),
  );
}
