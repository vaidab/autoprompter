import { test, expect } from "@playwright/test";
test("script is literal, preferences persist, controls fit a narrow screen", async ({
  page,
}) => {
  await page.routeWebSocket("**/ws", (ws) => ws.close());
  await page.goto("/");
  await page
    .getByLabel("Your script")
    .fill("<img onerror=alert(1)> Știință ❤️");
  await page.getByLabel("Font size").fill("52");
  await page.getByLabel("Font size").dispatchEvent("change");
  await page.reload();
  await expect(page.getByLabel("Your script")).toHaveValue(
    "<img onerror=alert(1)> Știință ❤️",
  );
  await expect(page.getByLabel("Font size")).toHaveValue("52");
  await page.goto("/prompter");
  await expect(page.locator("#script")).toContainText("<img onerror=alert(1)>");
  await expect(page.locator("#script img")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 700 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
