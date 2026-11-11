import OBR, { type Item } from "@owlbear-rodeo/sdk";
import { MODE_CHANNEL, readScreen, type WebScreen } from "../shared/screen";
import { ScreenRenderer } from "./renderer";
import { ViewportTracker } from "./viewportTracker";

const root = document.getElementById("root")!;
const exitButton = document.getElementById("exit") as HTMLButtonElement;
const interactive = new URLSearchParams(location.search).get("mode") === "interact";

function leaveInteractMode(): void {
  // Only the background page can reopen the overlay, so ask it (this client only).
  void OBR.broadcast.sendMessage(MODE_CHANNEL, "display", { destination: "LOCAL" });
}

if (interactive) {
  document.body.classList.add("interactive");
  exitButton.hidden = false;
  exitButton.addEventListener("click", leaveInteractMode);
  // Clicks inside an iframe never reach this document, so any pointer-down we
  // see outside a screen is a click on empty space: treat it as "done".
  document.addEventListener("pointerdown", (e) => {
    const target = e.target as Element | null;
    if (!target?.closest(".screen") && target !== exitButton) leaveInteractMode();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") leaveInteractMode();
  });
}

OBR.onReady(async () => {
  const role = await OBR.player.getRole();
  const renderer = new ScreenRenderer(root);
  const tracker = new ViewportTracker((view) => renderer.setView(view));

  const apply = (items: Item[]) => {
    const screens: WebScreen[] = [];
    for (const item of items) {
      const s = readScreen(item);
      // Hidden screens are only drawn for the GM; players never see them.
      if (s && (s.visible || role === "GM")) screens.push(s);
    }
    renderer.setScreens(screens);
    tracker.setActive(screens.length > 0);
  };

  apply(await OBR.scene.items.getItems());
  OBR.scene.items.onChange(apply);

  if (role === "GM") {
    // Selection handles are drawn under this overlay, so mirror selection here.
    renderer.setSelection((await OBR.player.getSelection()) ?? []);
    OBR.player.onChange((p) => renderer.setSelection(p.selection ?? []));
  }
});
