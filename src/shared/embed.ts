import { validateUrl } from "./url";

export type EmbedResult =
  | { ok: true; url: string; /** height / width of the embed, when the snippet tells us */ aspect?: number }
  | { ok: false; reason: string };

function parseAspect(iframe: HTMLIFrameElement): number | undefined {
  // 1) width/height attributes, e.g. <iframe width="940" height="600">
  const w = parseFloat(iframe.getAttribute("width") ?? "");
  const h = parseFloat(iframe.getAttribute("height") ?? "");
  if (w > 0 && h > 0 && !(iframe.getAttribute("width") ?? "").includes("%")) return h / w;

  // 2) the "padding-top: 70.7143%" wrapper trick used by Canva and others
  try {
    for (let el = iframe.parentElement; el; el = el.parentElement) {
      const pt = el.style.paddingTop;
      if (pt.endsWith("%")) {
        const pct = parseFloat(pt);
        if (pct > 0 && pct < 400) return pct / 100;
      }
    }
  } catch {
    /* style parsing is best-effort only */
  }
  return undefined;
}

/**
 * Accepts either a plain URL or pasted embed code (<iframe ...>) and returns a
 * validated https URL. The pasted HTML is parsed into an inert document by
 * DOMParser (scripts do not run, nothing loads) and is never inserted into the
 * page: only the iframe's src attribute is read, then re-validated.
 */
export function extractEmbed(input: string): EmbedResult {
  const text = input.trim();
  if (!text) return { ok: false, reason: "Paste a URL or embed code." };

  if (!text.includes("<")) {
    const checked = validateUrl(text);
    return checked.ok ? { ok: true, url: checked.url } : checked;
  }

  const doc = new DOMParser().parseFromString(text, "text/html");
  const iframe = doc.querySelector("iframe");
  const src = iframe?.getAttribute("src");
  if (!iframe || !src) {
    return { ok: false, reason: "No <iframe src=…> found in the pasted code." };
  }
  const checked = validateUrl(src);
  if (!checked.ok) return checked;
  return { ok: true, url: checked.url, aspect: parseAspect(iframe) };
}
