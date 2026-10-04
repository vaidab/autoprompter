import { loadPreferences, savePreferences } from "./storage";
import { defaults, validatePreset } from "./presets";
import { tokenize } from "./script";
import type { Preset } from "./protocol";
export function setup() {
  const prefs = loadPreferences();
  let preset = {
    ...(prefs.presets.find((p) => p.id === prefs.selected) ?? defaults[1]),
  };
  document.querySelector("#app")!.innerHTML =
    `<main class="setup"><header><div><h1>Autoprompter<span class="local-label">Local · Romanian</span></h1><p>Your words. Your pace.</p></div><button id="quit" class="quiet">Quit Prompter</button></header><div class="workspace"><section class="editor"><div class="section-heading"><label for="input">Your script</label><span id="count">0 words</span></div><textarea id="input" aria-label="Your script" spellcheck="false" placeholder="Paste your Romanian script here…\n\nEmojis can stay. They’re cues for you, not words to read."></textarea><p class="hint" id="save-status">Saved on this Mac. Emojis stay silent.</p></section><aside><h2>Reading window</h2><label>Preset<select id="preset"></select></label><div class="two"><label>Width <span>px</span><input id="width" aria-label="Width" type="number" min="240" max="3840"></label><label>Height <span>px</span><input id="height" aria-label="Height" type="number" min="160" max="2160"></label></div><div class="two"><label>Font size <span>px</span><input id="fontSize" aria-label="Font size" type="number" min="16" max="120"></label><label>Line spacing<input id="lineSpacing" aria-label="Line spacing" type="number" min="1" max="2.5" step="0.1"></label></div><label>Preset name<input id="preset-name" maxlength="60"></label><div class="two"><button id="save-preset">Save preset</button><button id="delete-preset" class="quiet">Delete</button></div><hr><h2>Following</h2><label>Mode<select id="mode"><option value="voice">Follow my voice</option><option value="fixed">Fixed-speed scrolling</option></select></label><label id="speed-label" hidden>Scroll speed <span>px / second</span><input id="speed" type="number" min="1" max="300" value="30"></label><label>Microphone<select id="microphone"><option value="">Default microphone</option></select></label><p class="hint">Follows visible text in either direction. Holds while you improvise.</p></aside></div><footer><div class="status-block"><span id="status" role="status">Connecting to local service…</span><small id="detail">Speech stays on your Mac.</small><button id="retry" class="quiet" hidden>Retry model</button></div><div class="actions"><button id="reset">Reset</button><button id="open">Open window</button><a href="/prompter" target="autoprompter" id="open-tab">Open tab</a><button id="start" class="primary" disabled>Start following</button><button id="pause" hidden>Pause</button></div></footer></main>`;
  const el = <T extends HTMLElement>(id: string) =>
    document.getElementById(id) as T;
  const input = el<HTMLTextAreaElement>("input");
  input.value = prefs.script;
  function populate() {
    el<HTMLSelectElement>("preset").replaceChildren(
      ...prefs.presets.map((p) => {
        const o = new Option(p.name, p.id);
        o.selected = p.id === preset.id;
        return o;
      }),
    );
    for (const key of [
      "width",
      "height",
      "fontSize",
      "lineSpacing",
      "speed",
    ] as const)
      el<HTMLInputElement>(key).value = String(preset[key]);
    el<HTMLInputElement>("preset-name").value = preset.name;
  }
  function publish(notify = true) {
    prefs.script = input.value;
    prefs.selected = preset.id;
    const i = prefs.presets.findIndex((p) => p.id === preset.id);
    if (i >= 0) prefs.presets[i] = { ...preset };
    else prefs.presets.push({ ...preset });
    el("save-status").textContent = savePreferences(prefs)
      ? "Saved on this Mac. Emojis stay silent."
      : "Browser storage is unavailable. Keep this page open.";
    el("count").textContent = `${tokenize(input.value).length} words`;
    if (notify)
      document.dispatchEvent(
        new CustomEvent("preferences", {
          detail: { script: input.value, preset },
        }),
      );
  }
  input.oninput = () => publish();
  el<HTMLSelectElement>("preset").onchange = (e) => {
    preset = {
      ...prefs.presets.find(
        (p) => p.id === (e.target as HTMLSelectElement).value,
      )!,
    };
    populate();
    publish();
  };
  for (const key of [
    "width",
    "height",
    "fontSize",
    "lineSpacing",
    "speed",
  ] as const)
    el<HTMLInputElement>(key).onchange = () => {
      const next = validatePreset({
        ...preset,
        [key]: Number(el<HTMLInputElement>(key).value),
      });
      if (next) preset = next;
      populate();
      publish();
    };
  el("save-preset").onclick = () => {
    const name = el<HTMLInputElement>("preset-name").value.trim();
    if (!name) return;
    const existing = prefs.presets.find((p) => p.name === name);
    preset = { ...preset, id: existing?.id ?? crypto.randomUUID(), name };
    if (!existing) prefs.presets.push(preset);
    populate();
    publish();
  };
  el("delete-preset").onclick = () => {
    if (prefs.presets.length <= 1) return;
    prefs.presets = prefs.presets.filter((p) => p.id !== preset.id);
    preset = { ...prefs.presets[0] };
    populate();
    publish();
  };
  el("open").onclick = () => {
    const w = window.open(
      "/prompter",
      "autoprompter",
      `popup,width=${preset.width},height=${preset.height + 64}`,
    );
    if (!w) el("detail").textContent = "Window blocked. Use Open tab instead.";
    else w.focus();
  };
  el<HTMLSelectElement>("mode").onchange = () => {
    el("speed-label").hidden = el<HTMLSelectElement>("mode").value !== "fixed";
    document.dispatchEvent(new CustomEvent("mode-change"));
  };
  populate();
  publish(false);
  // Service integration is loaded separately so manual script editing never depends on model availability.
  import("./controls")
    .then(({ connectControls }) =>
      connectControls(
        () => ({ script: input.value, preset }),
        (value) => {
          input.value = value.script;
          preset = { ...value.preset };
          publish(false);
          populate();
        },
      ),
    )
    .catch(() => {
      el("status").textContent = "Local service unavailable";
    });
}
