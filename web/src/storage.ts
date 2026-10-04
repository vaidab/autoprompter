import { defaults, validatePreset } from "./presets";
import type { Preset } from "./protocol";
export type Preferences = {
  script: string;
  presets: Preset[];
  selected: string;
};
type Store = Pick<Storage, "getItem" | "setItem">;
export function loadPreferences(storage?: Store): Preferences {
  const fallback = {
    script: "",
    presets: defaults.map((p) => ({ ...p })),
    selected: "standard",
  };
  try {
    const raw = JSON.parse(
      (storage ?? localStorage).getItem("autoprompter.v1") ?? "null",
    );
    if (!raw) return fallback;
    const presets = Array.isArray(raw.presets)
      ? raw.presets
          .map(validatePreset)
          .filter((p: Preset | null): p is Preset => !!p)
      : [];
    return {
      script: typeof raw.script === "string" ? raw.script : "",
      presets: presets.length ? presets : fallback.presets,
      selected: typeof raw.selected === "string" ? raw.selected : "standard",
    };
  } catch {
    return fallback;
  }
}
export function savePreferences(value: Preferences, storage?: Store): boolean {
  try {
    (storage ?? localStorage).setItem("autoprompter.v1", JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
