import OBR, { type Item } from "@owlbear-rodeo/sdk";
import { MODE_CHANNEL, readScreen, type WebScreen } from "../shared/screen";
import { CameraSmoother } from "./camera";
import { enableCameraControls } from "./cameraControls";
import { applyMargins, loadMargins, MARGINS_KEY } from "../shared/settings";
import { ScreenRenderer } from "./renderer";
import { ViewportTracker } from "./viewportTracker";

const root = document.getElementById("root")!;
const bar = document.getElementById("bar")!;
const hint = document.getElementById("hint")!;
const exitButton = document.getElementById("exit") as HTMLButtonElement;
const interactive = new URLSearchParams(location.search).get("mode") === "interact";

// Keep screens off the strips where Owlbear's own toolbars sit (adjustable in the panel).
applyMargins(root, loadMargins());
window.addEventListener("storage", (e) => {
  if (e.key === MARGINS_KEY) applyMargins(root, loadMargins());
});

function leaveInteractMode(): void {
  // Only the background page can reopen the overlay, so ask it (this client only).
  void OBR.broadcast.sendMessage(MODE_CHANNEL, "display", { destination: "LOCAL" });
}

if (interactive) {
  // Sticky on purpose: it lasts until Done / Esc, never because of a stray click.
  document.body.classList.add("interactive");
  bar.hidden = false;
  exitButton.addEventListener("click", leaveInteractMode);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") leaveInteractMode();
  });
}

OBR.onReady(async () => {
  const role = await OBR.player.getRole(); // hidden screens are drawn for the GM only
  const renderer = new ScreenRenderer(root, interactive);
  const smoother = new CameraSmoother();

  // Draw on animation frames, ahead of the last reading by the estimated delay,
  // and stop drawing as soon as the camera is at rest.
  let frameId: number | undefined;
  const frame = () => {
    frameId = undefined;
    renderer.setMoving(!smoother.settled);
    const view = smoother.current(performance.now());
    if (view) renderer.setView(view);
    if (!smoother.settled) frameId = requestAnimationFrame(frame);
  };
  const tracker = new ViewportTracker((sample) => {
    if (smoother.push(sample) && frameId === undefined) frameId = requestAnimationFrame(frame);
  });

  const apply = (items: Item[]) => {
    const screens: WebScreen[] = [];
    for (const item of items) {
      const s = readScreen(item);
      // Hidden screens are only drawn for the GM; players never see them.
      if (s && (s.visible || role === "GM")) screens.push(s);
    }
    renderer.setScreens(screens);
    tracker.setActive(screens.length > 0 || interactive);
  };

  apply(await OBR.scene.items.getItems());
  OBR.scene.items.onChange(apply);

  // Selecting a screen (to move, resize or open its menu) hides the live page so
  // Owlbear's own handles and menus are not covered. Applies to everyone.
  renderer.setSelection((await OBR.player.getSelection()) ?? []);
  OBR.player.onChange((p) => renderer.setSelection(p.selection ?? []));

  if (interactive) {
    const panning = await enableCameraControls(() => tracker.latest);
    hint.textContent = panning
      ? "Drag empty space to move the map · scroll to zoom"
      : "Press Done to move the map or tokens";
  }
});
