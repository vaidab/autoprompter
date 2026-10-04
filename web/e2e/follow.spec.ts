import { test, expect } from "@playwright/test";
const script =
  "🎯 Astăzi vorbim despre încredere și curaj.\nMâine mergem împreună spre munte.\nAcum ascultăm povestea unui prieten.\n\n" +
  "Acesta este un paragraf lung despre viață.\n".repeat(20) +
  "Finalul se află foarte departe.";
async function fixture(page: any, content = script) {
  let socket: any, view: any;
  let generation = 1,
    seq = 0;
  let acknowledge = true;
  let status = "listening";
  const sent: any[] = [];
  const state = () => ({
    script: content,
    preset: {
      id: "a",
      name: "Test",
      width: 900,
      height: 600,
      fontSize: 32,
      lineSpacing: 1.5,
      speed: 30,
    },
    mode: "voice",
    status,
    generation,
    owner: "setup",
    prompter: "p",
    model: "ready",
    detail: "",
  });
  await page.routeWebSocket("**/ws", (ws: any) => {
    socket = ws;
    ws.onMessage((raw: any) => {
      const msg = JSON.parse(raw.toString());
      sent.push(msg);
      if (msg.role) {
        ws.send(JSON.stringify({ type: "welcome", id: "p" }));
        ws.send(JSON.stringify({ type: "state", state: state() }));
      }
      if (msg.type === "viewport") view = msg.viewport;
      if (msg.type === "invalidate" && acknowledge) {
        generation++;
        ws.send(JSON.stringify({ type: "state", state: state() }));
      }
    });
  });
  await page.goto("/prompter");
  await expect.poll(() => view?.visibleIds.length ?? 0).toBeGreaterThan(5);
  return {
    send(text: string, speechEndMs: number, gen = generation) {
      socket.send(
        JSON.stringify({
          type: "transcript",
          generation: gen,
          sequence: ++seq,
          viewport: { ...view, generation: gen },
          text,
          audioEndMs: seq * 500,
          speechEndMs,
          inferenceMs: 80,
        }),
      );
    },
    holdAck() {
      acknowledge = false;
    },
    reset() {
      socket.send(JSON.stringify({ type: "reset" }));
    },
    pause() {
      status = "paused";
      socket.send(JSON.stringify({ type: "state", state: state() }));
    },
    sent,
  };
}
test("recognition follows visible text and ignores offscreen speech", async ({
  page,
}) => {
  const f = await fixture(page);
  f.send("astăzi vorbim despre încredere", 1000);
  await expect(page.locator(".current")).toHaveText("încredere");
  f.send("finalul se află foarte departe", 2000);
  await expect(page.locator(".current")).toHaveText("încredere");
  f.send("mâine mergem împreună spre munte", 3000);
  await expect(page.locator(".current")).toHaveText("munte");
  f.send("astăzi vorbim despre încredere", 4000);
  await expect(page.locator(".current")).toHaveText("încredere");
});
test("read progress follows repetitions and reset, with a green current word", async ({
  page,
}) => {
  const f = await fixture(page);
  f.send("mâine mergem împreună spre munte", 1000);
  await expect(page.locator(".current")).toHaveText("munte");
  await expect(page.locator('[data-token="0"]')).toHaveClass(/read/);
  await expect
    .poll(async () =>
      page.locator(".current").evaluate((el) => {
        const c = getComputedStyle(el)
          .backgroundColor.match(/[\d.]+/g)!
          .map(Number);
        return c[1] > c[0] && c[3] > 0 && c[3] < 1;
      }),
    )
    .toBe(true);
  f.send("astăzi vorbim despre încredere", 2000);
  await expect(page.locator(".current")).toHaveText("încredere");
  await expect(page.locator('[data-token="6"]')).not.toHaveClass(/read/);
  f.reset();
  await expect(page.locator(".read,.current")).toHaveCount(0);
});
test("Markdown formatting remains matchable without speaking syntax or URLs", async ({
  page,
}) => {
  const f = await fixture(
    page,
    "# 🎯 Începem cu încredere\n\nAstăzi **vorbim despre** *curaj*.\n\n- Mâine mergem [împreună](https://example.com) spre munte.\n\n" +
      "Text pentru continuare.\n".repeat(15),
  );
  await expect(page.locator("#script h1")).toHaveText(
    "🎯 Începem cu încredere",
  );
  await expect(page.locator("#script strong")).toHaveText("vorbim despre");
  await expect(page.locator("#script em")).toHaveText("curaj");
  await expect(page.locator("#script li")).toContainText(
    "Mâine mergem împreună spre munte.",
  );
  await expect(page.locator("#script")).not.toContainText("https://");
  f.send("astăzi vorbim despre curaj", 1000);
  await expect(page.locator("em .current")).toHaveText("curaj");
  await page.waitForTimeout(180);
  await page.screenshot({
    path: "../.runtime/screenshots/markdown-desktop.png",
  });
  await page.setViewportSize({ width: 390, height: 700 });
  await page.screenshot({
    path: "../.runtime/screenshots/markdown-narrow.png",
  });
});
test("pause cancels an in-flight voice scroll and reduced motion settles immediately", async ({
  page,
}) => {
  const f = await fixture(
    page,
    Array.from(
      { length: 30 },
      (_, i) => `Linia numărul ${i} rămâne vizibilă.`,
    ).join("\n"),
  );
  f.send("linia numărul 8 rămâne vizibilă", 1000);
  await expect
    .poll(() => page.locator("#reading").evaluate((el) => el.scrollTop))
    .toBeGreaterThan(10);
  f.pause();
  await expect(page.locator("#status")).toHaveText("Paused");
  const stopped = await page.locator("#reading").evaluate((el) => el.scrollTop);
  await page.waitForTimeout(200);
  expect(await page.locator("#reading").evaluate((el) => el.scrollTop)).toBe(
    stopped,
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  const next = await fixture(
    page,
    Array.from(
      { length: 30 },
      (_, i) => `Linia numărul ${i} rămâne vizibilă.`,
    ).join("\n"),
  );
  next.send("linia numărul 8 rămâne vizibilă", 1000);
  await expect(page.locator(".current")).toHaveText("vizibilă");
  const position = await page
    .locator("#reading")
    .evaluate((el) => el.scrollTop);
  expect(position).toBeGreaterThan(100);
  await page.waitForTimeout(150);
  expect(await page.locator("#reading").evaluate((el) => el.scrollTop)).toBe(
    position,
  );
});
test("formatting inside a word preserves its identity and pasted HTML stays inert", async ({
  page,
}) => {
  const f = await fixture(
    page,
    "Astăzi vorbim despre în**credere**.\n\n<img src=x onerror=alert(1)>\n\n![emoție](https://example.com/a.png) &amp; curaj.",
  );
  f.send("astăzi vorbim despre încredere", 1000);
  await expect(page.locator(".current")).toHaveText(["în", "credere"]);
  await expect(page.locator("#script img")).toHaveCount(0);
  await expect(page.locator("#script")).toContainText(
    "<img src=x onerror=alert(1)>",
  );
  await expect(page.locator("#script")).toContainText("emoție & curaj.");
});
test("voice scroll eases over many frames and yields immediately to manual navigation", async ({
  page,
}) => {
  const f = await fixture(
    page,
    Array.from(
      { length: 30 },
      (_, i) => `Linia numărul ${i} rămâne vizibilă.`,
    ).join("\n"),
  );
  await page.evaluate(() => {
    (window as any).positions = [];
    let n = 0;
    function record() {
      (window as any).positions.push(
        document.querySelector("#reading")!.scrollTop,
      );
      if (n++ < 80) requestAnimationFrame(record);
    }
    requestAnimationFrame(record);
  });
  f.send("linia numărul 8 rămâne vizibilă", 1000);
  await expect(page.locator(".current")).toHaveText("vizibilă");
  await page.waitForTimeout(1000);
  const positions: number[] = await page.evaluate(
    () => (window as any).positions,
  );
  const moving = positions
    .slice(1)
    .map((v, i) => v - positions[i])
    .filter((v) => v > 0);
  expect(moving.length).toBeGreaterThan(25);
  expect(Math.max(...moving)).toBeLessThan(25);
  await page.locator("#reading").dispatchEvent("wheel", { deltaY: 10 });
  const stopped = await page.locator("#reading").evaluate((el) => el.scrollTop);
  await page.waitForTimeout(200);
  expect(await page.locator("#reading").evaluate((el) => el.scrollTop)).toBe(
    stopped,
  );
});
test("manual navigation blocks recognition before the server acknowledges it", async ({
  page,
}) => {
  const f = await fixture(page);
  f.send("astăzi vorbim despre încredere", 1000);
  await expect(page.locator(".current")).toHaveText("încredere");
  f.holdAck();
  await page.locator("#reading").dispatchEvent("wheel", { deltaY: 20 });
  f.send("mâine mergem împreună spre munte", 2000);
  await page.waitForTimeout(100);
  await expect(page.locator(".current")).toHaveText("încredere");
});
test("a revised old hypothesis does not jump backward, but newly spoken repetition does", async ({
  page,
}) => {
  const f = await fixture(page);
  f.send("astăzi vorbim despre încredere și curaj", 1800);
  await expect(page.locator(".current")).toHaveText("curaj");
  f.send("astăzi vorbim despre încredere", 1200);
  await page.waitForTimeout(100);
  await expect(page.locator(".current")).toHaveText("curaj");
  f.send("astăzi vorbim despre încredere", 3000);
  await expect(page.locator(".current")).toHaveText("încredere");
});
test("a prompter already hidden when a start arrives requests pause", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(document, "hidden", { get: () => true }),
  );
  let paused = false;
  await page.routeWebSocket("**/ws", (ws) =>
    ws.onMessage((raw) => {
      const m = JSON.parse(raw.toString());
      if (m.role) {
        ws.send(JSON.stringify({ type: "welcome", id: "p" }));
        ws.send(
          JSON.stringify({
            type: "state",
            state: {
              script,
              preset: {
                width: 900,
                height: 600,
                fontSize: 32,
                lineSpacing: 1.5,
                speed: 30,
              },
              status: "listening",
              mode: "voice",
              generation: 1,
              owner: "s",
              prompter: "p",
              model: "ready",
            },
          }),
        );
      }
      if (m.type === "pause") paused = true;
    }),
  );
  await page.goto("/prompter");
  await expect.poll(() => paused).toBe(true);
});
