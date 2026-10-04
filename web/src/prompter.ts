import { loadPreferences } from "./storage";
import { defaults } from "./presets";
import { renderScript } from "./script";
import type { Preset } from "./protocol";
export function prompter() {
  const p = loadPreferences();
  let preset = p.presets.find((x) => x.id === p.selected) ?? defaults[1];
  document.querySelector("#app")!.innerHTML =
    `<main class="prompter-shell"><nav class="prompter-toolbar"><a href="/" target="autoprompter-setup">Setup</a><span id="status" role="status">Ready to read</span><button id="toggle">Start</button><button id="reset">Reset</button><button id="hide">Hide controls</button></nav><button id="show" class="show-controls" hidden aria-label="Show controls">Controls</button><div id="reading" tabindex="0" aria-label="Prompter text"><div id="script"></div></div><div id="reading-status" aria-live="polite"></div></main>`;
  const reading = document.getElementById("reading")!,
    script = document.getElementById("script")!;
  function render(text: string, config: Preset) {
    preset = config;
    renderScript(script, text);
    reading.style.width = `min(100%, ${preset.width}px)`;
    reading.style.height = `min(calc(100dvh - 64px), ${preset.height}px)`;
    script.style.fontSize = `${preset.fontSize}px`;
    script.style.lineHeight = String(preset.lineSpacing);
    document.dispatchEvent(
      new CustomEvent("script-rendered", { detail: { text, preset } }),
    );
  }
  render(p.script, preset);
  document.getElementById("hide")!.onclick = () => {
    document.querySelector<HTMLElement>("nav")!.style.visibility = "hidden";
    document.getElementById("show")!.hidden = false;
  };
  document.getElementById("show")!.onclick = () => {
    document.querySelector<HTMLElement>("nav")!.style.visibility = "visible";
    document.getElementById("show")!.hidden = true;
  };
  import("./reading")
    .then(({ connectReading }) => connectReading(reading, script, () => preset))
    .catch(() => {});
}
