import OBR, { buildShape, type Item } from "@owlbear-rodeo/sdk";
import { extractEmbed } from "../shared/embed";
import { DEFAULT_PAGE_WIDTH, SCREEN_KEY, parseConfig, type ScreenConfig } from "../shared/screen";

const DEFAULT_WIDTH = 960;
const DEFAULT_HEIGHT = 540;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
): HTMLElementTagNameMap[K] {
  return Object.assign(document.createElement(tag), props);
}

function field(label: string, input: HTMLInputElement | HTMLTextAreaElement): HTMLDivElement {
  const wrap = el("div");
  wrap.append(el("label", { textContent: label }), input);
  return wrap;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** Every scene item carrying our marker, even ones with a broken URL, so they can still be deleted. */
function isScreenItem(item: Item): boolean {
  return item.type === "SHAPE" && SCREEN_KEY in item.metadata;
}

// ---------------------------------------------------------------- add form

function renderAddForm(app: HTMLElement): void {
  const url = el("textarea", { placeholder: "https://…  or paste the full <iframe> embed code", rows: 4 });
  const width = el("input", { type: "number", value: String(DEFAULT_WIDTH), min: "50" });
  const height = el("input", { type: "number", value: String(DEFAULT_HEIGHT), min: "50" });
  const pageWidth = el("input", { type: "number", value: String(DEFAULT_PAGE_WIDTH), min: "320", max: "3840" });
  const add = el("button", { textContent: "Add screen at view center" });
  const status = el("div", { id: "status" });

  const row = el("div", { className: "row" });
  row.append(field("Width (map units)", width), field("Height (map units)", height));
  app.append(field("Website URL or embed code", url), row, field("Page layout width (px)", pageWidth), add, status);

  const setStatus = (text: string, ok: boolean) => {
    status.className = ok ? "ok" : "err";
    status.textContent = text;
  };

  add.addEventListener("click", async () => {
    const checked = extractEmbed(url.value);
    if (!checked.ok) return setStatus(checked.reason, false);
    const w = Number(width.value);
    // If the embed code states its proportions, use them so the page isn't distorted.
    const h = checked.aspect ? Math.round(w * checked.aspect) : Number(height.value);
    if (!(w >= 50 && h >= 50)) return setStatus("Width and height must be at least 50.", false);

    add.disabled = true;
    try {
      const [vw, vh] = await Promise.all([OBR.viewport.getWidth(), OBR.viewport.getHeight()]);
      const center = await OBR.viewport.inverseTransformPoint({ x: vw / 2, y: vh / 2 });
      const config: ScreenConfig = {
        version: 1,
        url: checked.url,
        pageWidth: Number(pageWidth.value) || DEFAULT_PAGE_WIDTH,
      };

      // The item is the source of truth: position, rotation, lock and visibility
      // are all native Owlbear item properties, synced by Owlbear itself.
      const item = buildShape()
        .name("Web screen")
        .shapeType("RECTANGLE")
        .width(w)
        .height(h)
        .position({ x: center.x - w / 2, y: center.y - h / 2 })
        .layer("PROP")
        .fillColor("#000000")
        .fillOpacity(0)
        .strokeColor("#4f8cff")
        .strokeOpacity(0.9)
        .strokeWidth(4)
        .metadata({ [SCREEN_KEY]: config })
        .build();

      await OBR.scene.items.addItems([item]);
      setStatus(checked.aspect ? "Screen added (height set from the embed proportions)." : "Screen added.", true);
    } catch (err) {
      setStatus(`Could not add screen: ${err instanceof Error ? err.message : String(err)}`, false);
    } finally {
      add.disabled = false;
    }
  });
}

// ---------------------------------------------------------------- screen list

function renderManager(app: HTMLElement): void {
  app.append(el("h2", { textContent: "Screens in this scene" }));
  const list = el("div");
  const listStatus = el("div", { className: "muted" });
  app.append(list, listStatus);

  let latest: Item[] = [];
  let editingId: string | null = null; // don't rebuild the list under an open editor

  const note = (text: string, isError = false) => {
    listStatus.className = isError ? "err" : "muted";
    listStatus.textContent = text;
  };

  const guard = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (err) {
      note(err instanceof Error ? err.message : String(err), true);
    }
  };

  const buildRow = (item: Item): HTMLElement => {
    const config = parseConfig(item.metadata[SCREEN_KEY]);
    const box = el("div", { className: "item" });
    box.append(el("div", { className: "title", textContent: item.name || "Web screen" }));
    box.append(
      el("div", {
        className: config ? "muted" : "err",
        textContent: `${config ? hostOf(config.url) : "Invalid or missing URL"}${item.visible ? "" : "  ·  hidden from players"}`,
      }),
    );

    const btns = el("div", { className: "btns" });
    const button = (label: string, onClick: () => void, cls = "") => {
      const b = el("button", { textContent: label, className: cls });
      b.addEventListener("click", onClick);
      btns.append(b);
      return b;
    };

    button("Go to", () =>
      void guard(async () => {
        const b = await OBR.scene.items.getItemBounds([item.id]);
        const pad = 0.15;
        await OBR.viewport.animateToBounds({
          min: { x: b.min.x - b.width * pad, y: b.min.y - b.height * pad },
          max: { x: b.max.x + b.width * pad, y: b.max.y + b.height * pad },
          width: b.width * (1 + 2 * pad),
          height: b.height * (1 + 2 * pad),
          center: b.center,
        });
      }),
    );

    button(item.visible ? "Hide" : "Show", () =>
      void guard(() =>
        OBR.scene.items.updateItems([item.id], (drafts) => {
          for (const d of drafts) d.visible = !item.visible;
        }),
      ),
    );

    button("Edit URL", () => {
      editingId = item.id;
      const ta = el("textarea", { rows: 3, value: config?.url ?? "", placeholder: "https://…  or <iframe> embed code" });
      const save = el("button", { textContent: "Save" });
      const cancel = el("button", { textContent: "Cancel" });
      const editBtns = el("div", { className: "btns" });
      editBtns.append(save, cancel);
      btns.replaceWith(ta, editBtns);

      cancel.addEventListener("click", () => {
        editingId = null;
        draw();
      });
      save.addEventListener("click", () =>
        void guard(async () => {
          const r = extractEmbed(ta.value);
          if (!r.ok) return note(r.reason, true);
          await OBR.scene.items.updateItems([item.id], (drafts) => {
            for (const d of drafts) {
              const prev = parseConfig(d.metadata[SCREEN_KEY]);
              d.metadata[SCREEN_KEY] = { version: 1, url: r.url, pageWidth: prev?.pageWidth ?? DEFAULT_PAGE_WIDTH };
            }
          });
          editingId = null;
          note("URL updated.");
          draw();
        }),
      );
    });

    // Two-step delete: no window.confirm, which sandboxed frames may block.
    let armed: number | undefined;
    const del = button(
      "Delete",
      () => {
        if (armed === undefined) {
          del.textContent = "Click again to delete";
          armed = window.setTimeout(() => {
            armed = undefined;
            del.textContent = "Delete";
          }, 3000);
          return;
        }
        window.clearTimeout(armed);
        void guard(() => OBR.scene.items.deleteItems([item.id]));
      },
      "danger",
    );

    box.append(btns);
    return box;
  };

  const draw = () => {
    if (editingId !== null) return;
    const screens = latest.filter(isScreenItem);
    list.replaceChildren(
      ...(screens.length
        ? screens.map(buildRow)
        : [el("div", { className: "muted", textContent: "No screens yet. Add one above." })]),
    );
  };

  OBR.scene.items.onChange((items) => {
    latest = items;
    draw();
  });
  void OBR.scene.items.getItems().then((items) => {
    latest = items;
    draw();
  });
}

// ---------------------------------------------------------------- entry

OBR.onReady(async () => {
  const app = document.getElementById("app");
  if (!app) return;
  const role = await OBR.player.getRole();
  if (role !== "GM") {
    app.append(el("div", { className: "err", textContent: "Only the GM can create or edit screens." }));
    return;
  }
  renderAddForm(app);
  renderManager(app);
});
