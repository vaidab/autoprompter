/** Streaming windowed-sinc low-pass decimator; phase survives render blocks. */
export class Resampler {
  private taps = 63;
  private ring = new Float32Array(63);
  private kernel: Float64Array;
  private index = 0;
  private phase = 0;
  constructor(private rate: number) {
    const fc = Math.min(7000, rate * 0.45) / rate;
    this.kernel = Float64Array.from({ length: this.taps }, (_, i) => {
      const x = i - (this.taps - 1) / 2;
      return (
        (x === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * x) / (Math.PI * x)) *
        (0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (this.taps - 1)))
      );
    });
    const sum = this.kernel.reduce((s, x) => s + x, 0);
    this.kernel = this.kernel.map((v) => v / sum);
  }
  push(input: Float32Array): Float32Array {
    const out: number[] = [];
    for (const sample of input) {
      this.ring[this.index] = sample;
      this.phase += 16000;
      if (this.phase >= this.rate) {
        this.phase -= this.rate;
        let value = 0;
        for (let j = 0; j < this.taps; j++)
          value +=
            this.ring[(this.index - j + this.taps) % this.taps] *
            this.kernel[j];
        out.push(value);
      }
      this.index = (this.index + 1) % this.taps;
    }
    return Float32Array.from(out);
  }
}
