import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadRecipe } from "../recipe/load";
import type { Recipe } from "../recipe/schema";
import { isLogEntry, newestFirst, progress, tiedCounts, today, type LogEntry } from "./log";
import { patternTechniques } from "./techniques";

const dir = new URL("../../patterns/", import.meta.url);
const recipes: Recipe[] = readdirSync(dir)
  .filter((f) => f.endsWith(".kdl"))
  .map((f) => {
    const r = loadRecipe(readFileSync(new URL(f, dir), "utf8"));
    if (!r.ok) throw new Error(f);
    return r.recipe;
  });

const entry = (id: string, date: string, count = 1): LogEntry => ({ key: `${id}-${date}`, id, date, count });

describe("tying log", () => {
  it("accepts only well-formed entries", () => {
    expect(isLogEntry(entry("adams", "2026-10-29"))).toBe(true);
    expect(isLogEntry({ ...entry("adams", "2026-10-29"), size: 14, note: "tight" })).toBe(true);
    expect(isLogEntry({ ...entry("adams", "29/10/2026") })).toBe(false);
    expect(isLogEntry({ ...entry("adams", "2026-10-29"), count: 0 })).toBe(false);
    expect(isLogEntry({ ...entry("adams", "2026-10-29"), size: "14" })).toBe(false);
    expect(isLogEntry("adams")).toBe(false);
  });

  it("dates entries by the local day", () => {
    expect(today(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });

  it("counts a pattern's versions together", () => {
    const counts = tiedCounts([entry("willie-gunn", "2026-10-01", 3), entry("willie-gunn-tube", "2026-10-02", 2)], recipes);
    expect(counts.get("willie-gunn")).toBe(5);
    expect(counts.has("willie-gunn-tube")).toBe(false);
  });

  it("lists the newest first, the later-added first within a day", () => {
    const log = [entry("a", "2026-10-01"), { ...entry("b", "2026-10-02"), key: "b1" }, { ...entry("c", "2026-10-02"), key: "c1" }];
    expect(newestFirst(log).map((e) => e.id)).toEqual(["c", "b", "a"]);
  });

  it("marks the learning path and the techniques practised", () => {
    const p = progress([], recipes);
    expect(p.path.length).toBeGreaterThan(5);
    expect(p.path.some((s) => s.tied)).toBe(false);
    const first = p.path[0]!.recipe;
    const tied = progress([entry(first.id, "2026-10-29", 2)], recipes);
    expect(tied.path[0]!.tied).toBe(true);
    for (const t of patternTechniques(first)) expect(tied.practised.get(t)).toBe(2);
    expect(tied.techniques).toBeGreaterThanOrEqual(tied.practised.size);
  });

  it("counts the techniques of a visitor's own fly, off the path", () => {
    const first = progress([], recipes).path[0]!.recipe;
    const own = { ...first, id: "my-copy" };
    const p = progress([entry("my-copy", "2026-10-29")], recipes, [...recipes, own]);
    expect(p.path.some((s) => s.recipe.id === "my-copy")).toBe(false);
    for (const t of patternTechniques(first)) expect(p.practised.get(t)).toBe(1);
  });
});
