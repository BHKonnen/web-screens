import type { WebScreen } from "../shared/screen";
import type { ViewTransform } from "./viewportTracker";

const IFRAME_SANDBOX = "allow-scripts allow-same-origin allow-forms allow-popups allow-presentation";

interface Entry {
  wrap: HTMLDivElement;
  iframe: HTMLIFrameElement;
  url: string;
}

/**
 * Keeps exactly one iframe per screen. Camera and item movement only change a
 * CSS transform; the iframe's src is touched only when the URL really changes,
 * so panning, zooming and dragging never reload the embedded page.
 */
export class ScreenRenderer {
  private entries = new Map<string, Entry>();
  private screens: WebScreen[] = [];
  private view: ViewTransform | undefined;
  private selected = new Set<string>();

  constructor(private readonly root: HTMLElement) {}

  get count(): number {
    return this.screens.length;
  }

  setScreens(screens: WebScreen[]): void {
    this.screens = screens;
    const live = new Set(screens.map((s) => s.id));
    for (const [id, entry] of this.entries) {
      if (!live.has(id)) {
        entry.wrap.remove(); // removing the node also tears the iframe down
        this.entries.delete(id);
      }
    }
    for (const s of screens) {
      const existing = this.entries.get(s.id);
      if (!existing) this.entries.set(s.id, this.create(s));
      else if (existing.url !== s.config.url) {
        existing.url = s.config.url;
        existing.iframe.src = s.config.url;
      }
    }
    this.layout();
  }

  setView(view: ViewTransform): void {
    this.view = view;
    this.layout();
  }

  setSelection(ids: string[]): void {
    this.selected = new Set(ids);
    this.layout();
  }

  private create(s: WebScreen): Entry {
    const wrap = document.createElement("div");
    wrap.className = "screen";
    const iframe = document.createElement("iframe");
    iframe.setAttribute("sandbox", IFRAME_SANDBOX);
    iframe.setAttribute("referrerpolicy", "no-referrer");
    iframe.setAttribute("allow", ""); // no camera, microphone, geolocation, etc.
    iframe.title = s.name;
    iframe.src = s.config.url;
    wrap.append(iframe);
    this.root.append(wrap);
    return { wrap, iframe, url: s.config.url };
  }

  private layout(): void {
    const v = this.view;
    for (const s of this.screens) {
      const entry = this.entries.get(s.id);
      if (!entry) continue;
      if (!v) {
        entry.wrap.style.display = "none"; // wait for the first camera sample
        continue;
      }
      const pageW = s.config.pageWidth;
      const pageH = (pageW * s.height) / s.width;
      const sx = v.x + s.x * v.scale;
      const sy = v.y + s.y * v.scale;
      const k = (v.scale * s.width) / pageW;
      const st = entry.wrap.style;
      st.display = "";
      st.width = `${pageW}px`;
      st.height = `${pageH}px`;
      // Right-to-left: scale the page to fit, rotate about the item origin, move.
      st.transform = `translate(${sx}px, ${sy}px) rotate(${s.rotation}deg) scale(${k})`;
      entry.wrap.classList.toggle("hidden-gm", !s.visible);
      entry.wrap.classList.toggle("selected", this.selected.has(s.id));
    }
  }
}
