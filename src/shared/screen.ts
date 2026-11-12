import type { Item } from "@owlbear-rodeo/sdk";
import { validateUrl } from "./url";

export const NS = "com.webscreens";
/** Item metadata key that marks a scene item as a web screen. */
export const SCREEN_KEY = `${NS}/screen`;
export const OVERLAY_MODAL_ID = `${NS}/overlay`;
/** Local-only broadcast channel: overlay -> background on the same client. */
export const MODE_CHANNEL = `${NS}/mode`;
/** "display": click-through, map usable. "interact": screens receive mouse input. */
export type OverlayMode = "display" | "interact";

/**
 * Placeholder fill. Owlbear only hit-tests the border of a shape whose fill is
 * fully transparent, which made screens hard to select. A near-zero fill makes
 * the whole area selectable while staying invisible under the overlay.
 */
export const PLACEHOLDER_FILL_OPACITY = 0.01;

export const DEFAULT_PAGE_WIDTH = 1280;
const PAGE_WIDTH_MIN = 320;
const PAGE_WIDTH_MAX = 3840;

/** Persistent per-screen settings, stored in the placeholder item's metadata. */
export interface ScreenConfig {
  version: 1;
  url: string;
  /** Width in CSS px the embedded page is laid out at, then scaled to fit the item. */
  pageWidth: number;
}

/** A placeholder scene item resolved into everything the overlay needs. */
export interface WebScreen {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  x: number;
  y: number;
  rotation: number;
  /** Size in scene units (item size times item scale). */
  width: number;
  height: number;
  config: ScreenConfig;
}

export function parseConfig(raw: unknown): ScreenConfig | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.url !== "string") return null;
  const checked = validateUrl(r.url);
  if (!checked.ok) return null;
  const pw =
    typeof r.pageWidth === "number" && Number.isFinite(r.pageWidth)
      ? Math.min(PAGE_WIDTH_MAX, Math.max(PAGE_WIDTH_MIN, Math.round(r.pageWidth)))
      : DEFAULT_PAGE_WIDTH;
  return { version: 1, url: checked.url, pageWidth: pw };
}

/** Returns null for anything that is not a well-formed web screen item. */
export function readScreen(item: Item): WebScreen | null {
  if (item.type !== "SHAPE") return null;
  const config = parseConfig(item.metadata[SCREEN_KEY]);
  if (!config) return null;
  const shape = item as Item & { width: number; height: number };
  const width = Math.abs(shape.width * item.scale.x);
  const height = Math.abs(shape.height * item.scale.y);
  if (!(width > 0 && height > 0)) return null;
  return {
    id: item.id,
    name: item.name,
    visible: item.visible,
    locked: item.locked,
    x: item.position.x,
    y: item.position.y,
    rotation: item.rotation,
    width,
    height,
    config,
  };
}
