import { test, expect } from "@playwright/test";

const initial = {
  script: "Astăzi vorbim despre încredere.",
  preset: {
    id: "test",
    name: "Test",
    width: 900,
    height: 600,
    fontSize: 36,
    lineSpacing: 1.5,
    speed: 30,
  },
  hasPreferences: true,
  status: "paused",
  mode: "voice",
  generation: 1,
  owner: "me",
  prompter: "p",
  model: "ready",
  detail: "Model ready",
};

for (const scenario of [
  { name: "secondary setup", state: { owner: "someone-else" } },
  { name: "no prompter", state: { prompter: null } },
  { name: "model loading", state: { model: "loading" } },
])
  test(`Space cannot open the microphone in ${scenario.name}`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      (window as any).__captureRequests = 0;
      navigator.mediaDevices.getUserMedia = async () => {
        (window as any).__captureRequests++;
        throw new Error("Unexpected microphone request");
      };
    });
    await page.routeWebSocket("**/ws", (ws) =>
      ws.onMessage((raw) => {
        const m = JSON.parse(raw.toString());
        if (m.role) {
          ws.send(JSON.stringify({ type: "welcome", id: "me" }));
          ws.send(
            JSON.stringify({
              type: "state",
              state: { ...initial, ...scenario.state },
            }),
          );
        }
      }),
    );
    await page.goto("/");
    await expect(page.locator("#status")).not.toContainText("Connecting");
    await expect(page.locator("#start")).toBeDisabled();
    await page.keyboard.press("Space");
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => (window as any).__captureRequests)).toBe(
      0,
    );
  });

test("device-loss recovery message survives the pause acknowledgment", async ({
  page,
}) => {
  await page.routeWebSocket("**/ws", (ws) =>
    ws.onMessage((raw) => {
      const m = JSON.parse(raw.toString());
      if (m.role) ws.send(JSON.stringify({ type: "welcome", id: "me" }));
      if (m.role || m.type === "pause")
        ws.send(JSON.stringify({ type: "state", state: initial }));
    }),
  );
  await page.goto("/");
  await expect(page.locator("#start")).toBeEnabled();
  await page.evaluate(() =>
    document.dispatchEvent(new CustomEvent("microphone-lost")),
  );
  await page.waitForTimeout(100);
  await expect(page.locator("#detail")).toContainText(
    "Microphone disconnected",
  );
});
