import type { Preset } from "./protocol";
export const defaults: Preset[] = [
  ["compact", "Compact", 640, 360, 32],
  ["standard", "Standard", 900, 600, 44],
  ["large", "Large", 1200, 800, 56],
].map(([id, name, width, height, fontSize]) => ({
  id: id as string,
  name: name as string,
  width: width as number,
  height: height as number,
  fontSize: fontSize as number,
  lineSpacing: 1.5,
  speed: 30,
}));
export function validatePreset(value: unknown): Preset | null {
  if (!value || typeof value !== "object") return null;
  const p = value as Preset;
  if (
    typeof p.id !== "string" ||
    !p.id ||
    typeof p.name !== "string" ||
    !p.name.trim() ||
    p.name.length > 60
  )
    return null;
  const limits = {
    width: [240, 3840],
    height: [160, 2160],
    fontSize: [16, 120],
    lineSpacing: [1, 2.5],
    speed: [1, 300],
  };
  for (const [key, [min, max]] of Object.entries(limits)) {
    const n = p[key as keyof typeof limits];
    if (typeof n !== "number" || !Number.isFinite(n) || n < min || n > max)
      return null;
  }
  return {
    id: p.id,
    name: p.name.trim(),
    width: p.width,
    height: p.height,
    fontSize: p.fontSize,
    lineSpacing: p.lineSpacing,
    speed: p.speed,
  };
}
