import { test, expect } from "vitest";
import { tokenize } from "../src/script";
test("Romanian tokens ignore silent emojis and preserve original offsets", () => {
  const text = "🎯 Știință și încredere ❤️";
  const t = tokenize(text);
  expect(t.map((x) => x.folded)).toEqual(["stiinta", "si", "incredere"]);
  expect(text.slice(t[0].start, t[0].end)).toBe("Știință");
  expect(tokenize("❤️ 👨‍👩‍👧‍👦")).toEqual([]);
  expect(tokenize("s\u0326tiint\u0326a\u0306")[0].folded).toBe("stiinta");
});
test("keycap emoji are silent while plain digits remain matchable", () => {
  expect(tokenize("1️⃣ 2️⃣ 3️⃣ Astăzi sunt 3 idei").map((t) => t.folded)).toEqual([
    "astazi",
    "sunt",
    "3",
    "idei",
  ]);
});
