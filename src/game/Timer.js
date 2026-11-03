// Countdown driven by a deadline, not by counting ticks, so throttled intervals
// and animations can't make it drift. `remainingMs()` is always authoritative.
export class Timer {
  constructor({ durationMs, tickMs, onTick, onExpire, now = () => performance.now() }) {
    this.durationMs = durationMs;
    this.tickMs = tickMs;
    this.onTick = onTick;
    this.onExpire = onExpire;
    this.now = now;
    this.deadline = 0;
    this.intervalId = null;
    this.frozenMs = durationMs;
  }

  get running() {
    return this.intervalId !== null;
  }

  start() {
    this.stop();
    this.deadline = this.now() + this.durationMs;
    this.intervalId = setInterval(() => this.tick(), this.tickMs);
    this.tick();
  }

  stop() {
    if (!this.running) return;
    this.frozenMs = this.remainingMs();
    clearInterval(this.intervalId);
    this.intervalId = null;
  }

  // Holds the clock at its current value. stop() ends it, pause() can resume.
  pause() {
    this.stop();
  }

  resume() {
    if (this.running) return;
    this.deadline = this.now() + this.frozenMs;
    this.intervalId = setInterval(() => this.tick(), this.tickMs);
  }

  remainingMs() {
    if (!this.running) return this.frozenMs;
    return Math.max(0, this.deadline - this.now());
  }

  penalize(ms) {
    this.deadline -= ms;
    this.onTick(this.remainingMs());
  }

  tick() {
    const remaining = this.remainingMs();
    this.onTick(remaining);
    if (remaining <= 0) {
      this.stop();
      this.onExpire();
    }
  }
}
