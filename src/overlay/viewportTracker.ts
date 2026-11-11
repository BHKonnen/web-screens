import OBR from "@owlbear-rodeo/sdk";

/** Screen position of the scene origin plus pixels per scene unit. */
export interface ViewTransform {
  x: number;
  y: number;
  scale: number;
}

export interface TrackerStats {
  hz: number;
  rttMs: number;
}

const ACTIVE_MS = 33; // ~30 Hz while the camera is moving
const IDLE_MS = 120; // ~8 Hz once it has been still for IDLE_AFTER_MS
const IDLE_AFTER_MS = 1000;
const EPSILON = 0.01;

/**
 * The SDK has no viewport change event, so the camera has to be sampled.
 * This keeps that cost bounded: one request in flight at a time, no sampling
 * unless at least one screen is on stage, none while the page is hidden, and a
 * lower rate when the camera is still.
 *
 * The transform is derived from two transformPoint calls rather than assuming
 * how getPosition and getScale relate, so it stays correct for any pure
 * scale-and-translate camera.
 */
export class ViewportTracker {
  private generation = 0;
  private timer: number | undefined;
  private active = false;
  private last: ViewTransform | undefined;
  private lastMoveAt = 0;
  private sampleTimes: number[] = [];
  private rttMs = 0;
  private lastStatsAt = 0;

  constructor(
    private readonly onChange: (t: ViewTransform) => void,
    private readonly onStats?: (s: TrackerStats) => void,
  ) {
    document.addEventListener("visibilitychange", () => this.restart());
  }

  setActive(active: boolean): void {
    if (active === this.active) return;
    this.active = active;
    this.restart();
  }

  private restart(): void {
    this.generation++;
    window.clearTimeout(this.timer);
    this.timer = undefined;
    if (this.active && !document.hidden) {
      this.lastMoveAt = performance.now();
      this.schedule(0, this.generation);
    }
  }

  private schedule(delay: number, gen: number): void {
    this.timer = window.setTimeout(() => void this.tick(gen), delay);
  }

  private async tick(gen: number): Promise<void> {
    const started = performance.now();
    try {
      const [origin, unit] = await Promise.all([
        OBR.viewport.transformPoint({ x: 0, y: 0 }),
        OBR.viewport.transformPoint({ x: 1, y: 0 }),
      ]);
      if (gen !== this.generation) return; // superseded while waiting
      const next: ViewTransform = { x: origin.x, y: origin.y, scale: unit.x - origin.x };
      const l = this.last;
      const moved =
        !l ||
        Math.abs(l.x - next.x) > EPSILON ||
        Math.abs(l.y - next.y) > EPSILON ||
        Math.abs(l.scale - next.scale) > 1e-6;
      if (moved) {
        this.last = next;
        this.lastMoveAt = started;
        this.onChange(next);
      }
    } catch {
      if (gen !== this.generation) return;
      // Transient failure (e.g. scene closing): just try again at the idle rate.
    }

    const now = performance.now();
    this.rttMs = now - started;
    this.sampleTimes.push(now);
    while (this.sampleTimes.length && now - this.sampleTimes[0] > 1000) this.sampleTimes.shift();
    if (now - this.lastStatsAt > 500) {
      this.lastStatsAt = now;
      this.onStats?.({ hz: this.sampleTimes.length, rttMs: this.rttMs });
    }

    const idle = now - this.lastMoveAt > IDLE_AFTER_MS;
    const interval = idle ? IDLE_MS : ACTIVE_MS;
    this.schedule(Math.max(0, interval - (now - started)), gen);
  }
}
