import { connectSession } from "./session";
import { startCapture } from "./audio";
import { tokenize } from "./script";
import type { Preset, ViewportSnapshot } from "./protocol";
export function connectControls(
  get: () => { script: string; preset: Preset },
  set: (value: { script: string; preset: Preset }) => void,
) {
  const client = connectSession("setup");
  let capture: { stop(): void } | null = null;
  let captureRequest = 0,
    sequence = 0,
    lastGeneration = -1,
    initialized = false,
    starting = false;
  let viewport: ViewportSnapshot | null = null;
  let localError = "";
  const el = <T extends HTMLElement>(id: string) =>
    document.getElementById(id) as T;
  const mode = () => el<HTMLSelectElement>("mode").value as "voice" | "fixed";
  function stop() {
    starting = false;
    captureRequest++;
    capture?.stop();
    capture = null;
  }
  async function ensureCapture() {
    if (capture) return;
    const request = ++captureRequest;
    try {
      const newCapture = await startCapture(
        el<HTMLSelectElement>("microphone").value,
        (samples) => {
          const s = client.state;
          if (
            s?.status === "listening" &&
            viewport?.generation === s.generation &&
            viewport.visibleIds.length
          )
            client.audio(
              { generation: s.generation, sequence: sequence++, viewport },
              samples,
            );
        },
      );
      if (request !== captureRequest) {
        newCapture.stop();
        return;
      }
      capture = newCapture;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const chosen = el<HTMLSelectElement>("microphone").value;
      el<HTMLSelectElement>("microphone").replaceChildren(
        new Option("Default microphone", ""),
        ...devices
          .filter((d) => d.kind === "audioinput")
          .map(
            (d, i) => new Option(d.label || `Microphone ${i + 1}`, d.deviceId),
          ),
      );
      el<HTMLSelectElement>("microphone").value = chosen;
    } catch (e) {
      localError = `Microphone unavailable: ${(e as Error).message}. Check browser permission and try again.`;
      client.send({ type: "pause" });
      stop();
      update();
    }
  }
  function canStart() {
    const s = client.state;
    return (
      !!s &&
      s.owner === client.id &&
      !!s.prompter &&
      !!tokenize(get().script).length &&
      (mode() !== "voice" || s.model === "ready")
    );
  }
  async function start() {
    if (!canStart() || starting) return;
    starting = true;
    localError = "";
    if (mode() === "voice") {
      await ensureCapture();
      if (!capture || !starting) return;
    }
    client.send({ type: "start", mode: mode() });
    starting = false;
  }
  el("start").onclick = start;
  el("pause").onclick = () => {
    stop();
    client.send({ type: "pause" });
  };
  el("reset").onclick = () => client.send({ type: "reset" });
  el("quit").onclick = () => {
    stop();
    client.send({ type: "quit" });
  };
  el("retry").onclick = () => client.send({ type: "retry" });
  el<HTMLSelectElement>("microphone").onchange = () => {
    stop();
    client.send({ type: "pause" });
  };
  document.addEventListener("preferences", () => {
    stop();
    client.send({ type: "preferences", ...get() });
    update();
  });
  document.addEventListener("mode-change", () => {
    stop();
    client.send({ type: "mode", mode: mode() });
  });
  document.addEventListener("microphone-lost", () => {
    stop();
    client.send({ type: "pause" });
    localError =
      "Microphone disconnected. Select a microphone and start again.";
    update();
  });
  function update() {
    const s = client.state;
    const active = s?.status === "listening" || s?.status === "scrolling";
    el("start").hidden = !!active;
    el("pause").hidden = !active;
    el<HTMLButtonElement>("start").disabled = !canStart();
    el("status").textContent = !s
      ? "Local service disconnected"
      : s.owner !== client.id
        ? "Another setup tab is in control"
        : active
          ? s.mode === "voice"
            ? "Listening · following visible text"
            : "Scrolling at a fixed speed"
          : !s.prompter
            ? "Open a prompter to begin"
            : s.model === "loading"
              ? "Loading speech model…"
              : "Ready when you are";
    if (s) el("detail").textContent = localError || s.detail;
    el("retry").hidden = s?.model !== "error";
  }
  client.subscribe((msg) => {
    if (msg.type === "welcome") {
      initialized = false;
      return;
    }
    if (msg.type === "viewport") {
      viewport = msg.viewport;
      return;
    }
    if (msg.type === "state") {
      const s = client.state!;
      if (s.owner === null) client.send({ type: "claim" });
      if (s.owner !== client.id) {
        if (s.hasPreferences) set(s);
        initialized = false;
      } else if (!initialized) {
        initialized = true;
        if (s.hasPreferences) set(s);
        else client.send({ type: "preferences", ...get() });
      }
      if (s.generation !== lastGeneration) {
        lastGeneration = s.generation;
        viewport = null;
        sequence = 0;
        stop();
      }
      if (s.owner === client.id && s.status === "listening") {
        if (!capture) void ensureCapture();
      } else if (!starting || s.owner !== client.id) stop();
      // Secondary setup surfaces are read-only until ownership is released.
      for (const input of document.querySelectorAll<
        | HTMLInputElement
        | HTMLTextAreaElement
        | HTMLSelectElement
        | HTMLButtonElement
      >(
        ".workspace input,.workspace textarea,.workspace select,.workspace button",
      ))
        input.disabled = s.owner !== client.id;
      el<HTMLSelectElement>("mode").value = s.mode;
      el("speed-label").hidden = s.mode !== "fixed";
      update();
    } else if (msg.type === "stopped" || msg.type === "disconnected") {
      stop();
      update();
      el("status").textContent =
        msg.type === "stopped"
          ? "Prompter stopped"
          : "Local service disconnected";
      el("detail").textContent = "Open Start Prompter to reconnect.";
    }
  });
  window.addEventListener("pagehide", stop);
  document.addEventListener("keydown", (e) => {
    if (
      e.code === "Space" &&
      !(e.target as HTMLElement).closest("input,textarea,select,button,a")
    ) {
      e.preventDefault();
      if (capture || client.state?.status === "scrolling") el("pause").click();
      else void start();
    }
  });
  update();
}
