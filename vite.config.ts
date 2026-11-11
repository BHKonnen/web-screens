import { defineConfig, type Plugin } from "vite";
import { resolve } from "node:path";

/** "my-repo" / "/my-repo" / "/my-repo/" -> "/my-repo/"; empty -> "/" */
function normalizeBase(raw: string | undefined): string {
  const trimmed = (raw ?? "/").trim().replace(/^\/+|\/+$/g, "");
  return trimmed ? `/${trimmed}/` : "/";
}

/**
 * The manifest is generated so its paths always match where the extension is
 * hosted. All paths are root-absolute and include the hosting folder, e.g.
 * "/my-repo/panel.html" on https://user.github.io/my-repo/.
 */
function manifestPlugin(base: string): Plugin {
  const manifest = () =>
    JSON.stringify(
      {
        name: "Web Screens",
        version: "0.1.0",
        manifest_version: 1,
        author: "You",
        description: "Place interactive web pages on the map as screens that follow pan and zoom.",
        icon: `${base}icon.svg`,
        action: {
          title: "Web Screens",
          icon: `${base}icon.svg`,
          popover: `${base}panel.html`,
          width: 360,
          height: 560,
        },
        background_url: `${base}index.html`,
      },
      null,
      2,
    );
  return {
    name: "obr-manifest",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split("?")[0] === `${base}manifest.json`) {
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Access-Control-Allow-Origin", "*"); // runs before Vite's own CORS handling
          res.end(manifest());
          return;
        }
        next();
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "manifest.json", source: manifest() });
    },
  };
}

// BASE_PATH is only used for production builds (GitHub Pages sub-folder);
// `npm run dev` always serves from "/".
export default defineConfig(({ command }) => {
  const base = command === "build" ? normalizeBase(process.env.BASE_PATH) : "/";
  return {
    base,
    plugins: [manifestPlugin(base)],
    server: {
      // Owlbear Rodeo loads the extension from another origin.
      cors: true,
      headers: { "Access-Control-Allow-Origin": "*" },
    },
    build: {
      target: "es2022",
      rollupOptions: {
        input: {
          main: resolve(__dirname, "index.html"),
          panel: resolve(__dirname, "panel.html"),
          overlay: resolve(__dirname, "overlay.html"),
        },
      },
    },
  };
});
