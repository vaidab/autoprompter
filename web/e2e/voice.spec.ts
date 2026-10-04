import { test, expect } from "@playwright/test";

const wav = process.env.AUTOPROMPTER_TEST_WAV;
test.use({
  launchOptions: {
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      ...(wav ? [`--use-file-for-fake-audio-capture=${wav}`] : []),
    ],
  },
});

test("real Romanian audio reaches Parakeet through browser capture and moves the prompter", async ({
  page,
  context,
}) => {
  test.skip(
    !wav,
    "Set AUTOPROMPTER_TEST_WAV to a mono 16 kHz Romanian fixture.",
  );
  test.setTimeout(60000);
  await page.addInitScript(() => {
    const captured: MediaStreamTrack[] = [];
    (window as any).__captureTracks = captured;
    const original = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await original(constraints);
      captured.push(...stream.getTracks());
      return stream;
    };
  });
  const events: string[] = [];
  page.on("pageerror", (e) => events.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") events.push(m.text());
  });
  page.on("websocket", (ws) => {
    ws.on("framesent", (e) => {
      if (typeof e.payload === "string")
        events.push(`sent: ${e.payload.slice(0, 800)}`);
      else events.push(`audio: ${e.payload.length} bytes`);
    });
    ws.on("framereceived", (e) => {
      if (typeof e.payload === "string")
        events.push(`received: ${e.payload.slice(0, 1200)}`);
    });
  });
  await page.goto("http://127.0.0.1:8766/");
  await expect(page.getByLabel("Your script")).toBeEnabled();
  await page
    .getByLabel("Your script")
    .fill(
      "🎯 Astăzi vorbim despre încredere și curaj.\n\nUneori ne oprim pentru o clipă, apoi continuăm cu o idee nouă.\n\nMâine mergem împreună spre munte.",
    );
  await page.getByLabel("Font size").fill("36");
  await page.getByLabel("Font size").dispatchEvent("change");
  await page.getByLabel("Mode").selectOption("voice");
  const prompter = await context.newPage();
  await prompter.goto("http://127.0.0.1:8766/prompter");
  await expect(page.locator("#start")).toBeEnabled({ timeout: 30000 });
  await page.screenshot({
    path: "../.runtime/screenshots/setup.png",
    fullPage: true,
  });
  await prompter.screenshot({
    path: "../.runtime/screenshots/prompter.png",
    fullPage: true,
  });
  await page.locator("#start").click();
  try {
    await expect(prompter.locator(".current")).toHaveCount(1, {
      timeout: 20000,
    });
  } catch (error) {
    console.log(events.slice(-30).join("\n"));
    throw error;
  }
  await expect
    .poll(() => prompter.locator(".current").getAttribute("data-token"), {
      timeout: 20000,
    })
    .not.toBe("0");
  await page.locator("#pause").click();
  await expect(prompter.locator("#status")).toHaveText("Paused");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const tracks = (window as any).__captureTracks as MediaStreamTrack[];
        return (
          tracks.length > 0 && tracks.every((t) => t.readyState === "ended")
        );
      }),
    )
    .toBe(true);
  const position = await prompter
    .locator("#reading")
    .evaluate((e) => e.scrollTop);
  await page.waitForTimeout(700);
  expect(await prompter.locator("#reading").evaluate((e) => e.scrollTop)).toBe(
    position,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "../.runtime/screenshots/setup-narrow.png",
    fullPage: true,
  });
  await prompter.close();
});
test("microphone denial stays visible after the service confirms pause", async ({
  page,
  context,
}) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("Test permission denied", "NotAllowedError");
    };
  });
  await page.goto("http://127.0.0.1:8766/");
  await expect(page.getByLabel("Your script")).toBeEnabled();
  await page.getByLabel("Your script").fill("Astăzi vorbim despre încredere.");
  const p = await context.newPage();
  await p.goto("http://127.0.0.1:8766/prompter");
  await expect(page.locator("#start")).toBeEnabled({ timeout: 30000 });
  await page.locator("#start").click();
  await expect(page.locator("#detail")).toContainText("Microphone unavailable");
  await page.waitForTimeout(200);
  await expect(page.locator("#detail")).toContainText("Test permission denied");
});
