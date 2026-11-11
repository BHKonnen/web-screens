export type UrlResult = { ok: true; url: string } | { ok: false; reason: string };

const MAX_URL_LENGTH = 2048;

/**
 * Validates a URL before it is stored or ever given to an iframe.
 * Only https is accepted: Owlbear Rodeo is served over https, so http frames
 * would be blocked as mixed content anyway. javascript:, data:, blob:, file:
 * and every other scheme are rejected by the allow-list below, not by a deny-list.
 */
export function validateUrl(input: string): UrlResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, reason: "Enter a URL." };
  if (trimmed.length > MAX_URL_LENGTH) return { ok: false, reason: "URL is too long." };

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, reason: "That is not a valid URL." };
  }
  if (parsed.protocol !== "https:") {
    return { ok: false, reason: "Only https:// URLs are allowed." };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, reason: "URLs with embedded credentials are not allowed." };
  }
  return { ok: true, url: parsed.toString() };
}
