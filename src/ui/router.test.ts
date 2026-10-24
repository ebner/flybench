import { describe, expect, it } from "vitest";
import { href, parseRoute } from "./router";

describe("routes", () => {
  it("parse every page", () => {
    expect(parseRoute("")).toEqual({ page: "gallery", query: "" });
    expect(parseRoute("#/?type=dry")).toEqual({ page: "gallery", query: "type=dry" });
    expect(parseRoute("#/fly/red-tag")).toEqual({ page: "fly", id: "red-tag" });
    expect(parseRoute("#/fly/red-tag/4")).toEqual({ page: "fly", id: "red-tag", step: 4 });
    expect(parseRoute("#/red-tag")).toEqual({ page: "fly", id: "red-tag" });
    expect(parseRoute("#/techniques")).toEqual({ page: "techniques" });
    expect(parseRoute("#/technique/palmering")).toEqual({ page: "technique", id: "palmering" });
    expect(parseRoute("#/learn")).toEqual({ page: "learn" });
    expect(parseRoute("#/a/b/c")).toEqual({ page: "not-found", path: "a/b/c" });
  });

  it("round-trip links", () => {
    expect(parseRoute(href.fly("elk-hair-caddis", 7))).toEqual({ page: "fly", id: "elk-hair-caddis", step: 7 });
    expect(parseRoute(href.technique("wing-case"))).toEqual({ page: "technique", id: "wing-case" });
  });
});
