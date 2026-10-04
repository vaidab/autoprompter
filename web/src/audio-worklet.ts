import { Resampler } from "./resampler";
declare const sampleRate: number;
declare class AudioWorkletProcessor {
  port: MessagePort;
  constructor();
}
declare function registerProcessor(
  name: string,
  processor: typeof AudioWorkletProcessor,
): void;
class Capture extends AudioWorkletProcessor {
  private resampler = new Resampler(sampleRate);
  private buffer = new Float32Array(8000);
  private used = 0;
  process(inputs: Float32Array[][]) {
    const channels = inputs[0];
    if (!channels?.length) return true;
    const mono = new Float32Array(channels[0].length);
    for (const channel of channels)
      for (let i = 0; i < mono.length; i++)
        mono[i] += channel[i] / channels.length;
    for (const value of this.resampler.push(mono)) {
      this.buffer[this.used++] = value;
      if (this.used === this.buffer.length) {
        this.port.postMessage(this.buffer, [this.buffer.buffer]);
        this.buffer = new Float32Array(8000);
        this.used = 0;
      }
    }
    return true;
  }
}
registerProcessor("capture", Capture);
