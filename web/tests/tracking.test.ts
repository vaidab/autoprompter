import { test, expect } from "vitest";
import { acceptUpdate } from "../src/tracking";
const viewport = {
  generation: 2,
  revision: 1,
  visibleIds: [2, 3, 4],
  anchorId: 2,
};
const u = {
  generation: 2,
  sequence: 5,
  viewport,
  text: "test",
  audioEndMs: 1000,
  speechEndMs: 900,
  inferenceMs: 10,
};
test("stale generation and sequence rejected; ordinary auto-scroll allowed", () => {
  expect(acceptUpdate(u, { ...viewport, generation: 3 }, 0)).toBe(false);
  expect(acceptUpdate(u, viewport, 5)).toBe(false);
  expect(acceptUpdate(u, { ...viewport, revision: 2 }, 4)).toBe(true);
});
