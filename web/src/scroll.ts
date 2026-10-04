// Exact critically damped motion: retarget without resetting velocity or overshoot.
export class FollowScroll {
  position = 0;
  private velocity = 0;
  private target: number | null = null;
  get active() {
    return this.target !== null;
  }
  stop() {
    this.target = null;
    this.velocity = 0;
  }
  aim(target: number, current: number) {
    if (!this.active) this.position = current;
    this.target = target;
  }
  step(milliseconds: number) {
    if (this.target === null) return this.position;
    const delta = Math.min(milliseconds, 50) / 1000;
    const displacement = this.position - this.target;
    const coefficient = this.velocity + 7 * displacement;
    const decay = Math.exp(-7 * delta);
    const next = this.target + (displacement + coefficient * delta) * decay;
    this.velocity = (this.velocity - 7 * coefficient * delta) * decay;
    // Reversals may arrive mid-flight. Never coast past the new target.
    if (displacement === 0 || (next - this.target) * displacement < 0) {
      this.position = this.target;
      this.stop();
      return this.position;
    }
    this.position = next;
    if (
      Math.abs(this.position - this.target) < 0.2 &&
      Math.abs(this.velocity) < 2
    ) {
      this.position = this.target;
      this.stop();
    }
    return this.position;
  }
}
