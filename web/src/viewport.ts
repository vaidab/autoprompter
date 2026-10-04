import type { ViewportSnapshot } from "./protocol";
export function measureViewport(
  container: HTMLElement,
  generation: number,
  revision: number,
  anchorId: number | null,
): ViewportSnapshot {
  const box = container.getBoundingClientRect();
  const top = Math.max(0, box.top),
    bottom = Math.min(innerHeight, box.top + container.clientHeight),
    left = Math.max(0, box.left),
    right = Math.min(innerWidth, box.left + container.clientWidth);
  const visibleIds: number[] = [];
  const tokenRects = new Map<number, DOMRect[]>();
  for (const span of container.querySelectorAll<HTMLElement>("[data-token]")) {
    const id = Number(span.dataset.token);
    tokenRects.set(id, [
      ...(tokenRects.get(id) ?? []),
      ...span.getClientRects(),
    ]);
  }
  if (document.visibilityState !== "hidden")
    for (const [id, rects] of tokenRects) {
      if (
        rects.length &&
        rects.every(
          (r) =>
            r.width > 0 &&
            r.height > 0 &&
            r.top >= top &&
            r.bottom <= bottom &&
            r.left >= left &&
            r.right <= right,
        )
      )
        visibleIds.push(id);
    }
  return { generation, revision, visibleIds, anchorId };
}
