import { test, expect } from "vitest";
import { FollowScroll } from "../src/scroll";

test("scroll retargets continuously, converges without overshoot, and stops on cancellation", () => {
  const scroll = new FollowScroll();
  scroll.aim(200, 0);
  for (let i = 0; i < 20; i++) scroll.step(16);
  const before = scroll.position;
  expect(before).toBeGreaterThan(0);
  expect(before).toBeLessThan(200);
  scroll.aim(400, before);
  expect(scroll.position).toBe(before);
  const next = scroll.step(16);
  expect(next - before).toBeLessThan(15);
  scroll.aim(0, next);
  for (let i = 0; i < 200; i++) {
    const value = scroll.step(16);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(400);
  }
  expect(scroll.position).toBe(0);
  expect(scroll.active).toBe(false);
  scroll.aim(100, 0);
  scroll.step(16);
  scroll.stop();
  const stopped = scroll.position;
  expect(scroll.step(1000)).toBe(stopped);
});

test("a delayed frame cannot turn a smooth scroll into an abrupt jump", () => {
  const scroll = new FollowScroll();
  scroll.aim(300, 0);
  expect(scroll.step(60000)).toBeLessThan(30);
});

test("retargeting near the moving position settles without bouncing beyond it", () => {
  const scroll = new FollowScroll();
  scroll.aim(400, 0);
  for (let i = 0; i < 20; i++) scroll.step(16);
  const target = scroll.position + 1;
  scroll.aim(target, scroll.position);
  for (let i = 0; i < 80; i++)
    expect(scroll.step(16)).toBeLessThanOrEqual(target);
  expect(scroll.position).toBe(target);
  expect(scroll.active).toBe(false);
});
