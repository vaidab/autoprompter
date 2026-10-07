import { test, expect } from "@playwright/test";
test("replacing a script resets the existing prompter without a Reset click", async ({
  page,
  context,
}) => {
  await page.goto("http://127.0.0.1:8766/");
  await expect(page.getByLabel("Your script")).toBeEnabled();
  await page
    .getByLabel("Your script")
    .fill("Script vechi pentru citire.\n\n".repeat(30));
  const p = await context.newPage();
  await p.goto("http://127.0.0.1:8766/prompter");
  await expect(p.locator("#script")).toContainText("Script vechi");
  await p.locator("#reading").evaluate((el) => {
    el.scrollTop = 800;
  });
  await expect
    .poll(() => p.locator("#reading").evaluate((el) => el.scrollTop))
    .toBeGreaterThan(500);
  await page
    .getByLabel("Your script")
    .fill("Începutul scriptului nou trebuie să fie vizibil.\n\n".repeat(30));
  await expect(p.locator("#script")).toContainText("Începutul scriptului nou");
  await expect
    .poll(() => p.locator("#reading").evaluate((el) => el.scrollTop))
    .toBe(0);
  await expect(p.locator(".read,.current")).toHaveCount(0);
  await page.getByLabel("Mode").selectOption("fixed");
  await page.locator("#start").click();
  await expect(p.locator("#status")).toHaveText("Scrolling");
  await expect(p.locator("#script")).not.toContainText("Script vechi");
});
test("real local session synchronizes two pages and fixed-speed pause/reset", async ({
  page,
  context,
}) => {
  await page.goto("http://127.0.0.1:8766/");
  await expect(page.locator("#status")).not.toContainText("Connecting");
  await page
    .getByLabel("Your script")
    .fill("🎯 Astăzi vorbim despre încredere și curaj.\n\n".repeat(15));
  await page.getByLabel("Mode").selectOption("fixed");
  const p = await context.newPage();
  await p.goto("http://127.0.0.1:8766/prompter");
  await expect(p.locator("#script")).toContainText("încredere");
  await expect(page.locator("#start")).toBeEnabled();
  await page.locator("#start").click();
  await expect(p.locator("#status")).toHaveText("Scrolling");
  await expect
    .poll(() => p.locator("#reading").evaluate((e) => e.scrollTop))
    .toBeGreaterThan(10);
  await page.locator("#pause").click();
  const stopped = await p.locator("#reading").evaluate((e) => e.scrollTop);
  await page.waitForTimeout(200);
  expect(await p.locator("#reading").evaluate((e) => e.scrollTop)).toBe(
    stopped,
  );
  await page.locator("#reset").click();
  await expect
    .poll(() => p.locator("#reading").evaluate((e) => e.scrollTop))
    .toBe(0);
  const secondary = await context.newPage();
  await secondary.goto("http://127.0.0.1:8766/");
  await expect(secondary.getByLabel("Your script")).toBeDisabled();
  await secondary.close();
  await p.close();
});
test("secondary setup cannot overwrite prompter text and takeover preserves current script", async ({
  page,
  context,
}) => {
  await page.goto("http://127.0.0.1:8766/");
  await expect(page.getByLabel("Your script")).toBeEnabled();
  await page
    .getByLabel("Your script")
    .fill("Textul original are câteva cuvinte.");
  const secondary = await context.newPage();
  await secondary.goto("http://127.0.0.1:8766/");
  await expect(secondary.getByLabel("Your script")).toBeDisabled();
  await page
    .getByLabel("Your script")
    .fill("Acesta este textul nou și corect.");
  const p = await context.newPage();
  await p.goto("http://127.0.0.1:8766/prompter");
  await expect(p.locator("#script")).toHaveText(
    "Acesta este textul nou și corect.",
  );
  await secondary.evaluate(() => {
    const c = new BroadcastChannel("prompter");
    c.postMessage({
      type: "preferences",
      script: "Text vechi neautorizat",
      preset: {
        id: "x",
        name: "x",
        width: 640,
        height: 360,
        fontSize: 32,
        lineSpacing: 1.5,
        speed: 30,
      },
    });
    c.close();
  });
  await secondary.waitForTimeout(150);
  await expect(p.locator("#script")).toHaveText(
    "Acesta este textul nou și corect.",
  );
  await page.close();
  await expect(secondary.getByLabel("Your script")).toBeEnabled();
  await expect(secondary.getByLabel("Your script")).toHaveValue(
    "Acesta este textul nou și corect.",
  );
  await expect(p.locator("#script")).toHaveText(
    "Acesta este textul nou și corect.",
  );
});
