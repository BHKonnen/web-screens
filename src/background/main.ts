import OBR from "@owlbear-rodeo/sdk";
import { MODE_CHANNEL, NS, OVERLAY_MODAL_ID, SCREEN_KEY, readScreen } from "../shared/screen";

/**
 * Hidden background page. It runs on every client as soon as the extension is
 * loaded, which is what makes screens appear for players without any click.
 *
 * The overlay has two modes, per client:
 *  - display:  click-through, so the map stays fully usable (default)
 *  - interact: the screens receive mouse input so pages can be clicked and
 *              zoomed in place. The rest of the map is blocked until the user
 *              leaves the mode.
 * Owlbear fixes a modal's pointer behavior when it opens, so switching modes
 * closes and reopens the overlay (embedded pages reload).
 */

type Mode = "display" | "interact";

// Root-absolute path including the hosting sub-folder (e.g. "/my-repo/"), set at build time.
const BASE = import.meta.env.BASE_URL;

async function openOverlay(mode: Mode): Promise<void> {
  try {
    await OBR.modal.close(OVERLAY_MODAL_ID);
  } catch {
    /* not open yet */
  }
  await OBR.modal.open({
    id: OVERLAY_MODAL_ID,
    url: `${BASE}overlay.html${mode === "interact" ? "?mode=interact" : ""}`,
    fullScreen: true,
    hideBackdrop: true,
    hidePaper: true,
    disablePointerEvents: mode === "display",
  });
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

OBR.onReady(async () => {
  setupContextMenus();

  // The overlay asks to go back to display mode when the user is done.
  OBR.broadcast.onMessage(MODE_CHANNEL, async (event) => {
    if (event.data === "display" && (await OBR.scene.isReady())) await openOverlay("display");
  });

  if (await OBR.scene.isReady()) await openOverlay("display");
  OBR.scene.onReadyChange(async (ready) => {
    if (ready) await openOverlay("display");
    else await OBR.modal.close(OVERLAY_MODAL_ID);
  });
});
