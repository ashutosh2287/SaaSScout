import { describe, expect, it } from "vitest";
import { createSingleFlight } from "./singleflight";

describe("createSingleFlight", () => {
  it("allows one start and returns a fresh token", () => {
    const f = createSingleFlight();
    const t = f.start();
    expect(t).not.toBeNull();
    expect(f.isCurrent(t!)).toBe(true);
  });

  it("rejects a second start while the slot is held (double-fire guard)", () => {
    const f = createSingleFlight();
    expect(f.start()).not.toBeNull();
    expect(f.start()).toBeNull();
  });

  it("drops a stale completion after the operation is invalidated (e.g. file replaced)", () => {
    const f = createSingleFlight();
    const a = f.start()!;
    f.invalidate();
    const b = f.start()!; // newer operation allowed after invalidation
    expect(a).not.toBe(b);
    expect(f.isCurrent(a)).toBe(false);
    expect(f.isCurrent(b)).toBe(true);
  });

  it("stops a completion commit after unmount invalidation", () => {
    const f = createSingleFlight();
    const t = f.start()!;
    f.invalidate(); // component unmounted
    expect(f.isCurrent(t)).toBe(false);
    expect(f.start()).not.toBeNull(); // a fresh mount/op can still begin
  });

  it("lets an out-of-order completion survive without freeing the newer slot", () => {
    const f = createSingleFlight();
    const a = f.start()!;
    f.invalidate();
    const b = f.start()!;
    f.end(a); // superseded A finallys late
    expect(f.isCurrent(b)).toBe(true);
    f.end(b);
    expect(f.isCurrent(b)).toBe(false);
  });

  it("end does not close the slot for a mismatched token", () => {
    const f = createSingleFlight();
    const t = f.start()!;
    f.end(t + 999);
    expect(f.isCurrent(t)).toBe(true);
  });
});