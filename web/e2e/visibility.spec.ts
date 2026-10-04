import { test, expect } from "@playwright/test";
test("viewport excludes clipped words and tracks reflow", async ({ page }) => {
  await page.routeWebSocket("**/ws", (ws) => ws.close());
  await page.goto("/");
  await page
    .getByLabel("Your script")
    .fill("Astăzi vorbim despre încredere și curaj.\n".repeat(20));
  await page.goto("/prompter");
  const ids = await page.evaluate(async () => {
    const { measureViewport } = await import("/src/viewport.ts");
    const r = document.getElementById("reading")!;
    return measureViewport(r, 1, 0, null).visibleIds;
  });
  expect(ids.length).toBeGreaterThan(3);
  expect(ids.length).toBeLessThan(120);
  await page.locator("#reading").evaluate((e) => (e.scrollTop = 200));
  const after = await page.evaluate(async () => {
    const { measureViewport } = await import("/src/viewport.ts");
    return measureViewport(document.getElementById("reading")!, 1, 1, null)
      .visibleIds;
  });
  expect(after[0]).toBeGreaterThan(ids[0]);
});
