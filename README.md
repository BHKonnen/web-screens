# Web Screens for Owlbear Rodeo

Place interactive web pages (Canva, Kumu, …) on the map as "screens". They sit at a
map position, follow pan and zoom, and every player sees them automatically.

## How it works

- A screen is a normal scene item (a rectangle) with the URL stored in its metadata.
  Move, rotate, resize, lock and hide it like any other item. Owlbear syncs it.
- A hidden background page opens a transparent, click-through overlay on every client
  and draws one iframe per screen, positioned from the camera.
- The overlay is click-through, so the map stays usable. To click or zoom **inside** a
  page, select the screen and choose **Interact with screen**. Click **Done** (or empty
  space) to leave. The pages reload when you enter and leave this mode.
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
3. Manage screens in the panel: Go to, Hide/Show, Edit URL, Delete.

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

- No viewport change event exists in the Owlbear SDK, so the overlay samples the camera
  (about 30 Hz while moving, about 8 Hz when still, none with no screens or a hidden tab).
  The screen can trail the map slightly during fast pans.
- The overlay is drawn above the map, tokens and fog. A screen is never hidden by them.
- Interact mode blocks the map for that player until they leave it, and reloads the pages.
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
