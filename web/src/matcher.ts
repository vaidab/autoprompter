import type { Token, MatchDecision } from "./protocol";
import { tokenize } from "./script";
const fillers = new Set(["hmm", "hm", "aaa", "ăă", "aa"]);
function align(a: string[], b: string[]) {
  let row = b.map((_, i) => ({ cost: i + 1, matches: 0 }));
  row.unshift({ cost: 0, matches: 0 });
  for (let i = 1; i <= a.length; i++) {
    const next = [{ cost: i, matches: 0 }];
    for (let j = 1; j <= b.length; j++) {
      const same = a[i - 1] === b[j - 1];
      const opts = [
        {
          cost: row[j - 1].cost + (same ? 0 : 1),
          matches: row[j - 1].matches + (same ? 1 : 0),
        },
        { cost: row[j].cost + 1, matches: row[j].matches },
        { cost: next[j - 1].cost + 1, matches: next[j - 1].matches },
      ];
      opts.sort((x, y) => x.cost - y.cost || y.matches - x.matches);
      next.push(opts[0]);
    }
    row = next;
  }
  return row[b.length];
}
export function matchPhrase(
  tokens: Token[],
  spoken: string,
  visibleIds: number[],
  anchorId: number | null,
): MatchDecision {
  const words = tokenize(spoken)
    .map((t) => t.folded)
    .filter((w) => !fillers.has(w))
    .slice(-12);
  if (words.length < 2) return { kind: "hold" };
  const visible = new Set(visibleIds);
  const candidates = new Map<number, { score: number; matches: number }>();
  for (let end = 0; end < tokens.length; end++) {
    if (!visible.has(end) || tokens[end].folded !== words.at(-1)) continue;
    const adjacent = anchorId !== null && end > anchorId && end - anchorId <= 2;
    const required = adjacent ? 2 : 3;
    for (
      let start = end;
      start >= Math.max(0, end - 15) && visible.has(start);
      start--
    ) {
      const target = tokens.slice(start, end + 1).map((t) => t.folded);
      for (let count = required; count <= words.length; count++) {
        const source = words.slice(-count);
        const result = align(source, target);
        if (result.matches < required) continue;
        const similarity =
          1 - result.cost / Math.max(source.length, target.length);
        if (similarity < 0.72) continue;
        const score = similarity + Math.min(result.matches, 10) * 0.025;
        const prev = candidates.get(end);
        if (!prev || score > prev.score)
          candidates.set(end, { score, matches: result.matches });
      }
    }
  }
  const sorted = [...candidates.entries()].sort(
    (a, b) => b[1].score - a[1].score,
  );
  if (!sorted.length) return { kind: "hold" };
  let [id, best] = sorted[0];
  const rival = sorted.find(([other]) => Math.abs(other - id) > 2);
  if (rival && best.score - rival[1].score < 0.12) {
    if (anchorId === null) return { kind: "hold" };
    const near = sorted
      .filter(([, v]) => best.score - v.score < 0.12)
      .sort((a, b) => Math.abs(a[0] - anchorId!) - Math.abs(b[0] - anchorId!));
    if (
      near.length > 1 &&
      Math.abs(near[1][0] - anchorId) - Math.abs(near[0][0] - anchorId) < 3
    )
      return { kind: "hold" };
    [id, best] = near[0];
  }
  return { kind: "move", tokenId: id, score: best.score };
}
