import OBR from "@owlbear-rodeo/sdk";
import type { Sample, ViewTransform } from "./camera";

const IDLE_MS = 100; // ~20 Hz while the camera is at rest
const IDLE_AFTER_MS = 600;
const EPSILON = 0.01;

/**
 * The SDK has no viewport change event, so the camera has to be sampled.
 * While the camera moves, one sample is requested per animation frame (never
 * more than one in flight); at rest it drops to a slow timer; with no screens
 * on stage, or while the page is hidden, it stops entirely.
 *
 * The transform is derived from two transformPoint calls rather than assuming
 * how getPosition and getScale relate to the drawing.
 */
export class ViewportTracker {
  private generation = 0;
  private timer: number | undefined;
  private raf: number | undefined;
  private active = false;
  private last: ViewTransform | undefined;
  private lastMoveAt = 0;

  constructor(private readonly onSample: (s: Sample) => void) {
    document.addEventListener("visibilitychange", () => this.restart());
  }

  /** The most recent real reading. */
  get latest(): ViewTransform | undefined {
    return this.last;
  }

  setActive(active: boolean): void {
    if (active === this.active) return;
    this.active = active;
    this.restart();
  }

  private restart(): void {
    this.generation++;
    window.clearTimeout(this.timer);
    if (this.raf !== undefined) cancelAnimationFrame(this.raf);
    this.timer = this.raf = undefined;
    if (this.active && !document.hidden) {
      this.lastMoveAt = performance.now();
      this.next(this.generation, false);
    }
  }

  private next(gen: number, idle: boolean): void {
    if (idle) this.timer = window.setTimeout(() => void this.tick(gen), IDLE_MS);
    else this.raf = requestAnimationFrame(() => void this.tick(gen));
  }

  private async tick(gen: number): Promise<void> {
    const started = performance.now();
    try {
      // Position and scale are requested together to reduce cross-frame skew.
      // The SDK has no atomic viewport snapshot, so small residual lag is possible.
      const [origin, scale] = await Promise.all([
        OBR.viewport.transformPoint({ x: 0, y: 0 }),
        OBR.viewport.getScale(),
      ]);
      if (gen !== this.generation) return; // superseded while waiting
      const done = performance.now();
      const next: ViewTransform = { x: origin.x, y: origin.y, scale };
      const l = this.last;
      const moved =
        !l ||
        Math.abs(l.x - next.x) > EPSILON ||
        Math.abs(l.y - next.y) > EPSILON ||
        Math.abs(l.scale - next.scale) > 1e-6;
      this.last = next;
      if (moved) this.lastMoveAt = done;
      // The reading reflects the camera roughly halfway through the round trip.
      this.onSample({ ...next, t: (started + done) / 2 });
    } catch {
      if (gen !== this.generation) return;
      // Transient failure (e.g. scene closing): retry at the idle rate.
    }
    this.next(gen, performance.now() - this.lastMoveAt > IDLE_AFTER_MS);
  }
}
