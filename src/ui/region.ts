import { REGIONS } from "../recipe/natural";
import { REGION_KEY, useStoredSet } from "./storage";

type Region = (typeof REGIONS)[number];

/** The visitor's region for the hatch calendar and trips, and choosing another. */
export function useRegion(): [Region | null, (r: Region) => void] {
  const stored = useStoredSet(REGION_KEY);
  const region = REGIONS.find((r) => stored.has(r)) ?? null;
  const choose = (r: Region) => {
    for (const v of stored.values) if (v !== r) stored.set(v, false);
    stored.set(r, true);
  };
  return [region, choose];
}
