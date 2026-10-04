import { test, expect } from "vitest";
import { defaults, validatePreset } from "../src/presets";
import { loadPreferences, savePreferences } from "../src/storage";
test("preset defaults and validation", () => {
  expect(defaults.map((p) => [p.width, p.height, p.fontSize])).toEqual([
    [640, 360, 32],
    [900, 600, 44],
    [1200, 800, 56],
  ]);
  expect(defaults.every((p) => p.lineSpacing === 1.5 && p.speed === 30)).toBe(
    true,
  );
  expect(validatePreset({ ...defaults[0], width: -1 })).toBeNull();
  expect(validatePreset({ ...defaults[0], fontSize: Infinity })).toBeNull();
});
test("storage denial and corruption never prevent use", () => {
  const bad = {
    getItem() {
      throw Error("denied");
    },
    setItem() {
      throw Error("denied");
    },
  };
  expect(loadPreferences(bad).presets).toEqual(defaults);
  expect(savePreferences(loadPreferences(bad), bad)).toBe(false);
  expect(
    loadPreferences({ getItem: () => "{bad", setItem() {} }).presets,
  ).toEqual(defaults);
});
