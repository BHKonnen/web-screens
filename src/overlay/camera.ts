/** Screen position of the scene origin plus pixels per scene unit. */
export interface ViewTransform {
  x: number;
  y: number;
  scale: number;
}

/** A camera reading and the (estimated) moment Owlbear's camera actually had that value. */
export interface Sample extends ViewTransform {
  t: number;
}

const SAME_PX = 0.08;
const SAME_SCALE = 0.000002;

/** Use real SDK samples, never extrapolate a zoom into the future. */
export class CameraSmoother {
  private cur: Sample | undefined;
  private still = true;
  get settled(): boolean { return this.still; }
  get raw(): ViewTransform | undefined {
    return this.cur && { x: this.cur.x, y: this.cur.y, scale: this.cur.scale };
  }
  push(s: Sample): boolean {
    const old = this.cur;
    if (!Number.isFinite(s.x) || !Number.isFinite(s.y) || !Number.isFinite(s.scale) || s.scale <= 0) return false;
    if (!old) { this.cur = s; this.still = true; return true; }
    const same = Math.abs(s.x - old.x) < SAME_PX &&
      Math.abs(s.y - old.y) < SAME_PX &&
      Math.abs(s.scale - old.scale) / old.scale < SAME_SCALE;
    const wasStill = this.still;
    this.still = same;
    if (!same) this.cur = s;
    return !same || !wasStill;
  }
  current(_now: number): ViewTransform | undefined { return this.raw; }
}

/** Zoom by `factor` keeping the scene point under `cursor` fixed on screen. */
export function zoomAbout(
  cam: ViewTransform,
  cursor: { x: number; y: number },
  factor: number,
  min = 0.05,
  max = 10,
): ViewTransform {
  const scale = Math.min(max, Math.max(min, cam.scale * factor));
  const r = scale / cam.scale;
  return { scale, x: cursor.x - (cursor.x - cam.x) * r, y: cursor.y - (cursor.y - cam.y) * r };
}
