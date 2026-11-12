# Web Screens 0.3.0 — stability patch

## What changed
- Camera tracking uses measured positions without forward velocity extrapolation (reduces zoom overshoot).
- Stable GPU compositing for screens; no switching `will-change` on every pan.
- Avoids writing identical CSS transforms.
- Serialized modal lifecycle prevents rapid interaction toggles and scene changes from racing.
- Camera idle polling reduced from 20 Hz to 10 Hz.
- Screen iframe remains mounted while moving/resizing/selecting within the same overlay.

## Important Owlbear SDK limitation
The modal API supports `open` and `close`, **not updating `disablePointerEvents` in place**. Switching between fully click-through display mode and interactive mode necessarily destroys/recreates the modal and reloads embedded pages. This version does **not** claim to fix that limitation. Keep interactive work in a separate browser tab or collaborative website if it must survive switching modes. A true zero-reload solution would require a different supported overlay API or sacrificing native map interaction.

## Multiplayer
Scene item metadata synchronizes screen URL, position, visibility and dimensions. Embedded website sessions remain local to each player; real-time collaboration requires support from the embedded website. `localhost` URLs only work on the computer running the server; use HTTPS hosting for remote players.

## Verification
Run `npm ci && npm run build` and test two browsers in one Owlbear room. This patch was statically reviewed but a full browser/SDK integration test is required.

---

# Web Screens for Owlbear Rodeo

Place interactive web pages (Canva, Kumu, …) on the map as "screens". They sit at a
map position, follow pan and zoom, and every player sees them automatically.

## How it works

- A screen is a normal scene item (a rectangle) with the URL stored in its metadata.
  Move, rotate, resize, lock and hide it like any other item. Owlbear syncs it.
  Click anywhere inside the rectangle to select it. While a screen is selected its live
  page steps aside (stays loaded, just hidden) so Owlbear's own resize/rotate handles and
  menus are visible. Deselect it and the page comes back.
- A hidden background page opens a transparent overlay on every client and draws one
  iframe per screen, positioned from the camera. It predicts the camera a few
  milliseconds ahead so screens stay glued to the map while you pan and zoom.
- **Display mode (default):** the overlay is click-through, so the map and tokens work
  normally. The pages themselves can't be clicked in this mode.
- **Interact mode:** click the extension icon -> **Interact with screens** (or select a
  screen -> **Interact with screen**). Now you can click and zoom inside the pages.
  It stays on until you press **Done** or Esc. Drag empty space to move the map and
  scroll to zoom; to move tokens, press Done. The pages reload when you enter and leave.
- **Open screen in window** shows the page in a large Owlbear window instead.

## Run locally (Windows)

1. Install Node.js 20+ (https://nodejs.org).
2. In PowerShell, in the project folder:
   ```
   npm install
   npm run dev
   ```
3. In Owlbear Rodeo: profile menu -> Extensions -> Add extension, paste
   `http://127.0.0.1:5173/manifest.json`.

## Host on GitHub Pages

1. Create a **public** GitHub repository (e.g. `web-screens`) and push this project to
   the `main` branch. `node_modules` and `dist` are already git-ignored.
2. Repository -> Settings -> Pages -> **Build and deployment -> Source: GitHub Actions**.
3. Push (or run the workflow from the Actions tab). `.github/workflows/deploy.yml`
   builds the project and publishes it. Wait for the run to turn green.
4. Your manifest is at `https://<your-username>.github.io/<repo-name>/manifest.json`.
   Open it in a browser: you should see JSON whose paths start with `/<repo-name>/`.

A repository named `<your-username>.github.io` is served from the site root; the
workflow detects this automatically.

Manual build for another host: `BASE_PATH=/folder/ npm run build` (PowerShell:
`$env:BASE_PATH="/folder/"; npm run build`) and upload `dist/`. The host must serve
over https. Any static host works (Cloudflare Pages, Netlify, Vercel).

## Install in Owlbear Rodeo

Profile menu -> Extensions -> Add extension -> paste the manifest URL. Every player
in the room needs the extension installed to see the screens (Owlbear extensions run
per client). If you update the extension, reload the page; GitHub Pages can cache for
a few minutes.

## Using it

1. Click the Web Screens icon (GM only). Paste a URL **or the full `<iframe>` embed
   code**. The iframe's `src` is extracted and its proportions used when given.
2. **Add screen at view center.** Drag/rotate/resize it as usual.
3. Manage screens in the panel: Go to, Select, Hide/Show, Lock/Unlock, Edit URL, Delete.
   Players see the list too (Go to only) and the **Interact with screens** button.
4. Screens created by version 0.1 are repaired automatically when the GM opens the scene.

## Websites

Only pages that allow being embedded (no `X-Frame-Options: DENY/SAMEORIGIN` and no
restrictive `frame-ancestors`) can work. Only `https://` URLs are accepted.

- Usually works: services that provide an embed link, such as Canva (use the `…/view?embed`
  address or paste the embed code) and Kumu embeds.
- Usually blocked: normal pages of large sites (social networks, banking, many
  search/login pages), and anything that sends frame-blocking headers.
- A blocked page shows blank. This version does not detect that and show an error
  (cross-origin frames don't report it reliably).

## Known limitations

- The Owlbear SDK has no camera change event, so the overlay samples the camera (once per
  animation frame while moving, about 20 Hz at rest, never with no screens or a hidden tab)
  and predicts ahead. This greatly reduces lag but cannot remove it: expect a tiny wobble
  when a fast pan stops.
- The overlay is drawn above the map, tokens and fog, and above Owlbear's interface:
  the SDK only offers modals, which are defined as UI on top of everything, and has no layer
  between the map and the interface. Mitigations: screens are cut off 64 px from the right
  edge (where the toolbar sits; adjustable per edge under "Display" in the panel), and a
  selected screen hides itself so menus and handles are not covered. A menu that opens
  over an unselected screen, or an interface element outside the margins, can still be covered.
- Interact mode blocks the map's own mouse handling for that player (tokens can't be
  moved until Done). Panning and zooming are re-implemented through the camera API, and
  switch themselves off if the camera API doesn't behave as expected.
- Entering and leaving interact mode reloads the pages (Owlbear fixes a modal's pointer
  behavior when it opens), so slide position or zoom inside a page is lost.
- A locked screen can't be selected on the map by players: use the panel button.
- "Only the GM can edit" is enforced by the extension's interface. The Owlbear SDK has
  no server-side permission for custom data, so a modified client could still write.
- Players need the extension installed.

## Troubleshooting

- **Extension won't add:** open the manifest URL in a browser; it must load and be https.
- **Panel/overlay 404 on Pages:** the manifest paths must start with `/<repo-name>/`.
  If not, the build ran without `BASE_PATH` (use the provided workflow).
- **Old version after update:** hard-refresh Owlbear (Ctrl+F5) after the Pages run finishes.
- **Screen blank:** the site probably blocks embedding. Test the same URL via **Open
  screen in window**; if blank there too, it cannot be embedded.
- **Screen in the wrong place:** please report it with your browser and window setup.
- **Screen covers part of Owlbear's UI:** panel -> Display -> raise the margin for that edge.
- **Page looks blurry while panning/zooming:** it is sharpened again when the camera stops.
