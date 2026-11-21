// The clock behind a question's `time_ms` (docs/STATS.md §2): it counts only while the question is on screen
// and the learner is active. Pure: every method is handed the current time, so it is easy to test.
//
//   start(now)    the question appeared (or the tab came back): the clock runs
//   stop(now)     the question was left, or the tab was hidden: the clock pauses
//   activity(now) a mouse move, key press or scroll
//   elapsed(now)  active milliseconds so far, summed over every start / stop
//
// After IDLE_CUTOFF_MS without activity the clock stops counting; the next activity restarts it.

export const IDLE_CUTOFF_MS = 120_000;

export class ActiveClock {
  private total = 0; // ms from finished stretches
  private from: number | null = null; // when the current stretch began; null = stopped
  private lastActive = 0;

  constructor(private readonly cutoff = IDLE_CUTOFF_MS) {}

  get running(): boolean {
    return this.from !== null;
  }

  start(now: number): void {
    if (this.from !== null) return;
    this.from = now;
    this.lastActive = now;
  }

  stop(now: number): void {
    this.total = this.elapsed(now);
    this.from = null;
  }

  activity(now: number): void {
    if (this.from === null) return;
    if (now - this.lastActive > this.cutoff) {
      // the learner was idle: count up to the cutoff, skip the rest of the gap, start a new stretch
      this.total += this.lastActive + this.cutoff - this.from;
      this.from = now;
    }
    this.lastActive = now;
  }

  elapsed(now: number): number {
    if (this.from === null) return this.total;
    return this.total + Math.max(0, Math.min(now, this.lastActive + this.cutoff) - this.from);
  }
}
