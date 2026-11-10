import { describe, expect, it } from "vitest";
import { watchForUpdates } from "./update";

/** A stand-in for navigator.serviceWorker: a controller, and the workers taking over. */
const workers = (controller: object | null) => {
  const listeners: (() => void)[] = [];
  return { controller, addEventListener: (_: "controllerchange", l: () => void) => void listeners.push(l), takeOver: () => listeners.forEach((l) => l()) };
};

describe("noticing a new version", () => {
  it("says so when a new worker takes over a page an earlier one served", () => {
    const sw = workers({});
    let updates = 0;
    watchForUpdates(sw, () => updates++);
    expect(updates).toBe(0);
    sw.takeOver();
    expect(updates).toBe(1);
  });

  it("says nothing on a first visit, when the first worker takes the page over", () => {
    const sw = workers(null);
    let updates = 0;
    watchForUpdates(sw, () => updates++);
    sw.takeOver();
    expect(updates).toBe(0);
  });

  it("says so when a later version takes over a page first visited before any worker", () => {
    const sw = workers(null);
    let updates = 0;
    watchForUpdates(sw, () => updates++);
    sw.takeOver();
    sw.takeOver();
    expect(updates).toBe(1);
  });
});
