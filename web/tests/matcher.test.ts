import { test, expect } from "vitest";
import { tokenize } from "../src/script";
import { matchPhrase } from "../src/matcher";
const text =
  "Astăzi vorbim despre încredere și curaj. Mâine mergem împreună spre munte. Acum ascultăm povestea unui prieten.";
const tokens = tokenize(text),
  ids = tokens.map((t) => t.id);
test.each([
  "Astazi vorbim despre incredere",
  "astăzi, hmm, vorbim despre încredere",
  "astăzi vorbim încredere",
])("follows approximate Romanian: %s", (spoken) => {
  expect(matchPhrase(tokens, spoken, ids, 0)).toMatchObject({
    kind: "move",
    tokenId: 3,
  });
});
test("visible skip and visible backward repetition", () => {
  expect(
    matchPhrase(tokens, "acum ascultăm povestea unui prieten", ids, 3),
  ).toMatchObject({ kind: "move", tokenId: 15 });
  expect(
    matchPhrase(tokens, "Astăzi vorbim despre încredere", ids, 12),
  ).toMatchObject({ kind: "move", tokenId: 3 });
});
test("offscreen matches, fillers, unrelated speech, and single common words hold", () => {
  for (const s of [
    "acum ascultăm povestea unui prieten",
    "și",
    "vorbim",
    "hmm deci",
    "telefonul este stricat",
  ])
    expect(matchPhrase(tokens, s, [0, 1, 2, 3, 4, 5], 3)).toEqual({
      kind: "hold",
    });
});
test("duplicate passages with no distinguishing context hold", () => {
  const t = tokenize("Mergem împreună la mare. Mergem împreună la mare.");
  expect(
    matchPhrase(
      t,
      "mergem împreună la mare",
      t.map((x) => x.id),
      null,
    ),
  ).toEqual({ kind: "hold" });
});
test("current position disambiguates an otherwise identical visible phrase", () => {
  const t = tokenize("Mergem împreună la mare. Mergem împreună la mare.");
  expect(
    matchPhrase(
      t,
      "mergem împreună la mare",
      t.map((x) => x.id),
      0,
    ),
  ).toMatchObject({ kind: "move", tokenId: 3 });
});
test("clipped sentence may match only its eligible words", () => {
  expect(
    matchPhrase(tokens, "astăzi vorbim despre încredere", [1, 2, 3], null),
  ).toMatchObject({ kind: "move", tokenId: 3 });
});
