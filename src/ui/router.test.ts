import { describe, expect, it } from "vitest";
import { href, legacyRoute, parseRoute, routeHref } from "./router";

const rel = (url: string) => url.replace(/^\//, "");

describe("routes", () => {
  it("parse every page", () => {
    expect(parseRoute("")).toEqual({ page: "gallery", query: "" });
    expect(parseRoute("?type=dry")).toEqual({ page: "gallery", query: "type=dry" });
    expect(parseRoute("fly/red-tag/")).toEqual({ page: "fly", id: "red-tag" });
    expect(parseRoute("fly/red-tag/?step=4")).toEqual({ page: "fly", id: "red-tag", step: 4 });
    expect(parseRoute("fly/red-tag/4")).toEqual({ page: "fly", id: "red-tag", step: 4 });
    expect(parseRoute("techniques/")).toEqual({ page: "techniques" });
    expect(parseRoute("technique/palmering/")).toEqual({ page: "technique", id: "palmering" });
    expect(parseRoute("learn")).toEqual({ page: "learn" });
    expect(parseRoute("about/")).toEqual({ page: "about" });
    expect(parseRoute("a/b/c")).toEqual({ page: "not-found", path: "a/b/c" });
    expect(parseRoute("red-tag")).toEqual({ page: "not-found", path: "red-tag" });
    // A stray "%" (or a broken encoding) is not a page, and must not throw.
    expect(parseRoute("fly/100%zz%/")).toEqual({ page: "not-found", path: "fly/100%zz%/" });
    expect(parseRoute("fly/%E0%A4/")).toEqual({ page: "not-found", path: "fly/%E0%A4/" });
  });

  it("round-trip links", () => {
    expect(parseRoute(rel(href.fly("elk-hair-caddis", 7)))).toEqual({ page: "fly", id: "elk-hair-caddis", step: 7 });
    expect(parseRoute(rel(href.fly("elk-hair-caddis", 7, 16)))).toEqual({ page: "fly", id: "elk-hair-caddis", step: 7, size: 16 });
    expect(href.fly("elk-hair-caddis", undefined, 16)).toBe("/fly/elk-hair-caddis/?size=16");
    expect(parseRoute("fly/red-tag/?size=abc")).toEqual({ page: "fly", id: "red-tag" });
    expect(parseRoute(rel(href.technique("wing-case")))).toEqual({ page: "technique", id: "wing-case" });
    expect(parseRoute(rel(href.gallery("type=dry")))).toEqual({ page: "gallery", query: "type=dry" });
    for (const page of ["techniques", "learn", "about", "box", "materials"] as const) {
      expect(parseRoute(rel(routeHref({ page })))).toEqual({ page });
    }
  });

  it("understand old hash links", () => {
    expect(legacyRoute("")).toBeNull();
    expect(legacyRoute("#content")).toBeNull();
    expect(legacyRoute("#/")).toEqual({ page: "gallery", query: "" });
    expect(legacyRoute("#/?type=dry")).toEqual({ page: "gallery", query: "type=dry" });
    expect(legacyRoute("#/fly/red-tag/4")).toEqual({ page: "fly", id: "red-tag", step: 4 });
    expect(legacyRoute("#/red-tag")).toEqual({ page: "fly", id: "red-tag" });
    expect(legacyRoute("#/techniques")).toEqual({ page: "techniques" });
    expect(routeHref(legacyRoute("#/fly/red-tag/4")!)).toBe("/fly/red-tag/?step=4");
  });
});
