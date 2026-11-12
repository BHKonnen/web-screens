/**
 * Per-browser display settings. The panel and the overlay are the same origin,
 * so localStorage is shared between them and a `storage` event tells the
 * overlay when the panel changed something.
 */
export interface UiMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** The right-hand toolbar is the one piece of Owlbear UI that is always on screen. */
export const DEFAULT_MARGINS: UiMargins = { top: 0, right: 64, bottom: 0, left: 0 };
export const MARGINS_KEY = "com.webscreens/ui-margins";

const clamp = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(400, Math.max(0, Math.round(v))) : fallback;

export function loadMargins(): UiMargins {
  try {
    const raw = localStorage.getItem(MARGINS_KEY);
    if (!raw) return { ...DEFAULT_MARGINS };
    const p = JSON.parse(raw) as Partial<Record<keyof UiMargins, unknown>>;
    return {
      top: clamp(p.top, DEFAULT_MARGINS.top),
      right: clamp(p.right, DEFAULT_MARGINS.right),
      bottom: clamp(p.bottom, DEFAULT_MARGINS.bottom),
      left: clamp(p.left, DEFAULT_MARGINS.left),
    };
  } catch {
    return { ...DEFAULT_MARGINS }; // storage unavailable or corrupt: use defaults
  }
}

export function saveMargins(m: UiMargins): boolean {
  try {
    localStorage.setItem(MARGINS_KEY, JSON.stringify(m));
    return true;
  } catch {
    return false;
  }
}

/** Screens are clipped to the area inside the margins, so they never cover the UI there. */
export function applyMargins(el: HTMLElement, m: UiMargins): void {
  el.style.clipPath = `inset(${m.top}px ${m.right}px ${m.bottom}px ${m.left}px)`;
}
