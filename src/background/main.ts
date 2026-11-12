import OBR, { isShape, type Item } from "@owlbear-rodeo/sdk";
import {
  MODE_CHANNEL,
  NS,
  OVERLAY_MODAL_ID,
  PLACEHOLDER_FILL_OPACITY,
  SCREEN_KEY,
  readScreen,
  type OverlayMode,
} from "../shared/screen";

/**
 * Hidden background page. It runs on every client as soon as the extension is
 * loaded, which is what makes screens appear for players without any click.
 *
 * The overlay has two modes, per client:
 *  - display:  click-through, so the map stays fully usable (default)
 *  - interact: the screens receive mouse input so pages can be clicked and
 *              zoomed in place. It stays on until the user presses Done or Esc.
 * Owlbear fixes a modal's pointer behavior when it opens, so switching modes
 * closes and reopens the overlay (embedded pages reload).
 */

// Root-absolute path including the hosting sub-folder (e.g. "/my-repo/"), set at build time.
const BASE = import.meta.env.BASE_URL;

let current: OverlayMode | null = null;
let requested: OverlayMode | null = null;
let running = false;
let forceOpen = false;

// Serialize modal operations: quick clicks and scene changes cannot race.
async function flushOverlay(): Promise<void> {
  if (running) return;
  running = true;
  try {
    while (current !== requested || forceOpen) {
      const target = requested;
      forceOpen = false;
      try { await OBR.modal.close(OVERLAY_MODAL_ID); } catch { /* not open */ }
      current = null;
      if (target === null || target !== requested) continue;
      try {
        await OBR.modal.open({
          id: OVERLAY_MODAL_ID,
          url: `${BASE}overlay.html${target === "interact" ? "?mode=interact" : ""}`,
          fullScreen: true,
          hideBackdrop: true,
          hidePaper: true,
          disablePointerEvents: target === "display",
        });
        current = target;
      } catch (error) {
        console.error("Web Screens: could not open overlay", error);
        requested = null;
      }
    }
  } finally { running = false; }
}

async function openOverlay(mode: OverlayMode, force = false): Promise<void> {
  requested = mode;
  forceOpen ||= force;
  await flushOverlay();
}

async function closeOverlay(): Promise<void> {
  requested = null;
  forceOpen = false;
  await flushOverlay();
}

const HAS_SCREEN = [{ key: ["metadata", SCREEN_KEY], value: undefined, operator: "!=" as const }];

function setupContextMenus(): void {
  OBR.contextMenu.create({
    id: `${NS}/interact`,
    icons: [
      {
        icon: `${BASE}interact.svg`,
        label: "Interact with screen",
        filter: { min: 1, max: 1, every: HAS_SCREEN },
      },
    ],
    onClick() {
      void openOverlay("interact");
    },
  });

  // Fallback for sites that need a big window: the page in a normal Owlbear modal.
  OBR.contextMenu.create({
    id: `${NS}/window`,
    icons: [
      {
        icon: `${BASE}icon.svg`,
        label: "Open screen in window",
        filter: { min: 1, max: 1, every: HAS_SCREEN },
      },
    ],
    async onClick(context) {
      const screen = readScreen(context.items[0]);
      if (!screen) return;
      const [vw, vh] = await Promise.all([OBR.viewport.getWidth(), OBR.viewport.getHeight()]);
      await OBR.modal.open({
        id: `${NS}/window/${screen.id}`,
        url: screen.config.url,
        width: Math.max(480, Math.round(vw * 0.92)),
        height: Math.max(360, Math.round(vh * 0.9)),
      });
    },
  });
}

// GM only. Screens made by the first version had a fully transparent fill, which
// Owlbear treats as "click the border only". Fix them in place.
let repairing = false;
async function repairPlaceholders(items: Item[]): Promise<void> {
  if (repairing) return;
  const ids = items
    .filter((i) => isShape(i) && SCREEN_KEY in i.metadata && i.style.fillOpacity < PLACEHOLDER_FILL_OPACITY)
    .map((i) => i.id);
  if (!ids.length) return;
  repairing = true;
  try {
    await OBR.scene.items.updateItems(ids, (drafts) => {
      for (const d of drafts) {
        if (isShape(d)) d.style.fillOpacity = PLACEHOLDER_FILL_OPACITY;
      }
    });
  } catch {
    /* best effort */
  } finally {
    repairing = false;
  }
}

OBR.onReady(async () => {
  setupContextMenus();
  const isGM = (await OBR.player.getRole()) === "GM";

  // The panel and the overlay ask for a mode change on this client only.
  OBR.broadcast.onMessage(MODE_CHANNEL, async (event) => {
    if ((event.data === "display" || event.data === "interact") && (await OBR.scene.isReady())) {
      await openOverlay(event.data);
    }
  });

  let stopRepair: (() => void) | undefined;
  const sceneOpened = async () => {
    await openOverlay("display", true);
    if (isGM) {
      stopRepair?.();
      await repairPlaceholders(await OBR.scene.items.getItems());
      stopRepair = OBR.scene.items.onChange((items) => void repairPlaceholders(items));
    }
  };
  const sceneClosed = async () => {
    stopRepair?.();
    stopRepair = undefined;
    await closeOverlay();
  };

  if (await OBR.scene.isReady()) await sceneOpened();
  OBR.scene.onReadyChange(async (ready) => {
    if (ready) await sceneOpened();
    else await sceneClosed();
  });
});
