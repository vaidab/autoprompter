import { test, expect } from "vitest";
import { defaults, validatePreset } from "../src/presets";
import { loadPreferences, savePreferences } from "../src/storage";
test("preset defaults and validation", () => {
  expect(defaults.map((p) => [p.width, p.height, p.fontSize])).toEqual([
    [640, 360, 32],
    [900, 600, 40],
    [1200, 800, 56],
  ]);
  expect(defaults.map((p) => p.lineSpacing)).toEqual([1.5, 1, 1.5]);
  expect(defaults.every((p) => p.speed === 30)).toBe(true);
  expect(validatePreset({ ...defaults[0], width: -1 })).toBeNull();
  expect(validatePreset({ ...defaults[0], fontSize: Infinity })).toBeNull();
});
test("saved presets survive changes to shipped defaults", () => {
  const saved = JSON.stringify({
    script: "Text salvat",
    selected: "custom",
    presets: [
      {
        id: "custom",
        name: "My preset",
        width: 900,
        height: 600,
        fontSize: 48,
        lineSpacing: 1.2,
        speed: 30,
      },
    ],
  });
  const prefs = loadPreferences({ getItem: () => saved, setItem() {} });
  expect(prefs.selected).toBe("custom");
  expect(prefs.presets[0].fontSize).toBe(48);
  expect(prefs.presets[0].lineSpacing).toBe(1.2);
  expect(prefs.script).toBe("Text salvat");
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
