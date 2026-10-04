import { test, expect } from "vitest";
import { Resampler } from "../src/resampler";
test.each([48000, 44100])(
  "resamples %i Hz continuously to mono 16 kHz",
  (rate) => {
    const r = new Resampler(rate);
    let count = 0;
    const input = Float32Array.from({ length: rate }, (_, i) =>
      Math.sin((2 * Math.PI * 440 * i) / rate),
    );
    for (let i = 0; i < input.length; i += 128)
      count += r.push(input.slice(i, i + 128)).length;
    expect(count).toBe(16000);
  },
);
test("suppresses above-Nyquist input", () => {
  const r = new Resampler(48000);
  const input = Float32Array.from({ length: 48000 }, (_, i) =>
    Math.sin((2 * Math.PI * 12000 * i) / 48000),
  );
  const out = r.push(input).slice(100);
  expect(
    Math.sqrt(out.reduce((s, v) => s + v * v, 0) / out.length),
  ).toBeLessThan(0.12);
});
