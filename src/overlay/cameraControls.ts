import OBR from "@owlbear-rodeo/sdk";
import { zoomAbout, type ViewTransform } from "./camera";

const ZOOM_SENSITIVITY = 0.0015;

function onEmptySpace(target: EventTarget | null): boolean {
  return !(target instanceof Element && target.closest(".screen, #bar"));
}

/**
 * In interact mode the overlay covers the map and swallows its mouse input.
 * So that people can still move around, dragging empty space pans the map and
 * the wheel zooms it, by driving Owlbear's own camera.
 *
 * This relies on getPosition()/setPosition() meaning the same thing as the
 * screen position of the scene origin. That is checked once at start-up; if it
 * does not hold, nothing is enabled and false is returned (the Done button is
 * then the only way to move the map).
 */
export async function enableCameraControls(getView: () => ViewTransform | undefined): Promise<boolean> {
  try {
    const [pos, origin] = await Promise.all([OBR.viewport.getPosition(), OBR.viewport.transformPoint({ x: 0, y: 0 })]);
    if (Math.abs(pos.x - origin.x) > 1 || Math.abs(pos.y - origin.y) > 1) return false;
  } catch {
    return false;
  }

  // Only the newest requested camera state matters; send one request at a time.
  let pending: { scale?: number; position: { x: number; y: number } } | null = null;
  let busy = false;
  const flush = async () => {
    if (busy) return;
    busy = true;
    try {
      while (pending) {
        const p = pending;
        pending = null;
        if (p.scale !== undefined) await OBR.viewport.setScale(p.scale);
        await OBR.viewport.setPosition(p.position);
      }
    } catch {
      /* camera call failed (scene closing); ignore */
    } finally {
      busy = false;
    }
  };
  const send = (p: { scale?: number; position: { x: number; y: number } }) => {
    pending = p;
    void flush();
  };

  let intent: ViewTransform | null = null; // where wheel zooming is heading
  let intentAt = 0;
  let drag: { startX: number; startY: number; origin: ViewTransform } | null = null;

  document.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || !onEmptySpace(e.target)) return;
    const v = getView();
    if (!v) return;
    intent = null;
    drag = { startX: e.clientX, startY: e.clientY, origin: v };
    document.body.classList.add("panning");
  });
  document.addEventListener("pointermove", (e) => {
    if (!drag) return;
    send({ position: { x: drag.origin.x + e.clientX - drag.startX, y: drag.origin.y + e.clientY - drag.startY } });
  });
  const endDrag = () => {
    drag = null;
    document.body.classList.remove("panning");
  };
  document.addEventListener("pointerup", endDrag);
  document.addEventListener("pointercancel", endDrag);
  window.addEventListener("blur", endDrag);

  document.addEventListener(
    "wheel",
    (e) => {
      if (!onEmptySpace(e.target)) return;
      e.preventDefault();
      const now = performance.now();
      // Rapid wheel ticks build on where we are heading, not on a stale reading.
      if (!intent || now - intentAt > 400) {
        const v = getView();
        if (!v) return;
        intent = { ...v };
      }
      intentAt = now;
      const unit = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1;
      intent = zoomAbout(intent, { x: e.clientX, y: e.clientY }, Math.exp(-e.deltaY * unit * ZOOM_SENSITIVITY));
      send({ scale: intent.scale, position: { x: intent.x, y: intent.y } });
    },
    { passive: false },
  );

  return true;
}
