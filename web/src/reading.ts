import { connectSession } from "./session";
import { tokenize, renderScript, markProgress } from "./script";
import { FollowScroll } from "./scroll";
import { measureViewport } from "./viewport";
import { acceptUpdate } from "./tracking";
import { matchPhrase } from "./matcher";
import type { Preset, Token, TranscriptUpdate } from "./protocol";
export function connectReading(
  reading: HTMLElement,
  script: HTMLElement,
  getPreset: () => Preset,
) {
  const client = connectSession("prompter");
  const motion = new FollowScroll();
  let renderedText: string | null = null;
  let tokens: Token[] = tokenize(script.textContent ?? "");
  let anchor: number | null = null,
    lastSequence = -1,
    revision = 0,
    generation = -1,
    signature = "";
  let programmaticUntil = 0,
    lastFrame = 0;
  let active = false,
    pendingNavigation = false;
  let lastSpeechEndMs = -Infinity;
  const status = document.getElementById("status")!,
    toggle = document.getElementById("toggle")!;
  const microphone = document.getElementById("microphone-active")!;
  const snapshot = () =>
    measureViewport(reading, client.state?.generation ?? 0, revision, anchor);
  function publish() {
    if (client.state?.prompter === client.id && !pendingNavigation)
      client.send({ type: "viewport", viewport: snapshot() });
  }
  function invalidate() {
    motion.stop();
    pendingNavigation = true;
    client.send({ type: "invalidate" });
  }
  function reset() {
    motion.stop();
    anchor = null;
    lastSequence = -1;
    lastSpeechEndMs = -Infinity;
    programmaticUntil = performance.now() + 100;
    reading.scrollTop = 0;
    markProgress(script, null);
    publish();
  }
  function apply(update: TranscriptUpdate) {
    if (
      !active ||
      pendingNavigation ||
      document.hidden ||
      client.state?.status !== "listening"
    )
      return;
    const view = snapshot();
    if (!acceptUpdate(update, view, lastSequence)) return;
    lastSequence = update.sequence;
    if (
      !Number.isFinite(update.speechEndMs) ||
      update.speechEndMs <= lastSpeechEndMs + 100 ||
      !tokenize(update.text).length
    )
      return;
    const eligible = view.visibleIds.filter((id) =>
      update.viewport.visibleIds.includes(id),
    );
    const match = matchPhrase(tokens, update.text, eligible, anchor);
    if (match.kind === "hold") {
      document.getElementById("reading-status")!.textContent =
        "Waiting for a phrase on screen";
      return;
    }
    if (!snapshot().visibleIds.includes(match.tokenId)) return;
    lastSpeechEndMs = update.speechEndMs;
    anchor = match.tokenId;
    markProgress(script, anchor);
    const span = script.querySelector<HTMLElement>(`[data-token="${anchor}"]`);
    if (!span) return;
    const top =
      span.getBoundingClientRect().top -
      reading.getBoundingClientRect().top +
      reading.scrollTop -
      reading.clientHeight / 3;
    const target = Math.max(
      0,
      Math.min(top, reading.scrollHeight - reading.clientHeight),
    );
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      motion.stop();
      programmaticUntil = performance.now() + 100;
      reading.scrollTop = target;
    } else motion.aim(target, reading.scrollTop);
    document.getElementById("reading-status")!.textContent =
      update.inferenceMs > 1000
        ? "Recognition is catching up…"
        : "Following your voice";
    publish();
    if (anchor === tokens.at(-1)?.id) {
      client.send({ type: "pause" });
      document.getElementById("reading-status")!.textContent = "End of script";
    }
  }
  client.subscribe((msg) => {
    if (msg.type === "state") {
      const s = client.state!;
      active = s.prompter === client.id;
      microphone.hidden = !(
        active &&
        s.owner &&
        s.mode === "voice" &&
        s.status === "listening"
      );
      const next = JSON.stringify([s.script, s.preset]);
      if (next !== signature) {
        signature = next;
        motion.stop();
        const scriptChanged = renderedText !== s.script;
        if (scriptChanged) anchor = null;
        renderedText = s.script;
        tokens = renderScript(script, s.script);
        markProgress(script, anchor);
        reading.style.width = `min(100%, ${s.preset.width}px)`;
        reading.style.height = `min(calc(100dvh - 64px), ${s.preset.height}px)`;
        script.style.fontSize = `${s.preset.fontSize}px`;
        script.style.lineHeight = String(s.preset.lineSpacing);
        if (scriptChanged) reset();
      }
      if (generation !== s.generation) {
        motion.stop();
        generation = s.generation;
        lastSequence = -1;
        lastSpeechEndMs = -Infinity;
        pendingNavigation = false;
      }
      if (!active || s.status !== "listening") motion.stop();
      if (
        active &&
        document.hidden &&
        (s.status === "listening" || s.status === "scrolling")
      )
        client.send({ type: "pause" });
      status.textContent = !active
        ? "Another prompter is active"
        : !s.owner
          ? "Open Setup to reconnect"
          : s.status === "listening"
            ? "Listening"
            : s.status === "scrolling"
              ? "Scrolling"
              : "Paused";
      toggle.textContent =
        s.status === "listening" || s.status === "scrolling"
          ? "Pause"
          : "Start";
      (toggle as HTMLButtonElement).disabled =
        !active ||
        !tokens.length ||
        (s.mode === "voice" && (!s.owner || s.model !== "ready"));
      publish();
    } else if (msg.type === "transcript")
      apply(msg as unknown as TranscriptUpdate);
    else if (msg.type === "reset") reset();
    else if (msg.type === "disconnected" || msg.type === "stopped") {
      microphone.hidden = true;
      active = false;
      motion.stop();
      status.textContent = msg.type === "stopped" ? "Stopped" : "Disconnected";
      (toggle as HTMLButtonElement).disabled = true;
    }
  });
  toggle.onclick = () =>
    client.send({
      type:
        client.state?.status === "listening" ||
        client.state?.status === "scrolling"
          ? "pause"
          : "start",
      mode: client.state?.mode,
    });
  document.getElementById("reset")!.onclick = () =>
    client.send({ type: "reset" });
  let manualPending = false;
  function manual() {
    motion.stop();
    if (!active) return;
    if (!manualPending) {
      manualPending = true;
      invalidate();
      setTimeout(() => {
        manualPending = false;
        publish();
      }, 80);
    }
    programmaticUntil = 0;
  }
  reading.addEventListener("wheel", manual, { passive: true });
  reading.addEventListener("touchstart", manual, { passive: true });
  reading.addEventListener("pointerdown", manual);
  reading.addEventListener(
    "scroll",
    () => {
      revision++;
      if (
        !motion.active &&
        performance.now() > programmaticUntil &&
        active &&
        !manualPending
      )
        manual();
      publish();
    },
    { passive: true },
  );
  new ResizeObserver(() => {
    revision++;
    if (active) invalidate();
    publish();
  }).observe(reading);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) motion.stop();
    if (document.hidden && active) client.send({ type: "pause" });
    else publish();
  });
  document.addEventListener("keydown", (e) => {
    if ((e.target as HTMLElement).closest("input,textarea,select,button,a"))
      return;
    if (e.code === "Space") {
      e.preventDefault();
      toggle.click();
    } else if (
      ["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End"].includes(
        e.code,
      )
    )
      manual();
  });
  function tick(time: number) {
    const delta = lastFrame ? Math.min(time - lastFrame, 100) : 0;
    lastFrame = time;
    if (
      motion.active &&
      active &&
      client.state?.status === "listening" &&
      !document.hidden
    ) {
      programmaticUntil = time + 100;
      reading.scrollTop = motion.step(delta);
    }
    if (active && client.state?.status === "scrolling" && !document.hidden) {
      programmaticUntil = time + 200;
      reading.scrollTop += (client.state.preset.speed * delta) / 1000;
      const last = script.querySelector<HTMLElement>(
        `[data-token="${tokens.at(-1)?.id}"]`,
      );
      if (
        reading.scrollTop + reading.clientHeight >= reading.scrollHeight - 1 ||
        (last &&
          last.getBoundingClientRect().bottom <
            reading.getBoundingClientRect().top + reading.clientHeight / 3)
      ) {
        client.send({ type: "pause" });
        document.getElementById("reading-status")!.textContent =
          "End of script";
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
