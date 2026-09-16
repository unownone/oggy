// ---------------------------------------------------------------------------
// Oggy recorder — DOM event capture + sanitized network observation
// Used in both isolated and MAIN world contexts.
// Zero chrome.* dependencies.
// ---------------------------------------------------------------------------

import {
  isSensitiveField,
  redactValue,
  scoreLocators,
  type Locator,
  type RecordedEvent,
} from "@/core";

// ── Target filtering ──────────────────────────────────────────────────────

const INTERACTIVE_TAGS = new Set([
  "A",
  "BUTTON",
  "INPUT",
  "SELECT",
  "TEXTAREA",
  "OPTION",
  "LABEL",
  "DETAILS",
  "SUMMARY",
]);

export function shouldRecordTarget(el: EventTarget | null): boolean {
  if (!el || !(el instanceof Element)) return false;
  if (INTERACTIVE_TAGS.has(el.tagName)) return true;
  if (el.getAttribute("role") === "button") return true;
  if (el.getAttribute("contenteditable") === "true") return true;
  if (el.closest("a, button, [role=button]")) return true;
  return false;
}

// ── DOM event → RecordedEvent ─────────────────────────────────────────────

export function toRecordedEvent(
  e: Event,
  href: string,
): RecordedEvent | null {
  const t = Date.now();
  const target = e.target;

  if (!target || !(target instanceof Element)) return null;

  const locators = scoreLocators(target);

  switch (e.type) {
    case "click": {
      const text =
        target.textContent?.trim().slice(0, 120) || undefined;
      const role =
        target.getAttribute("role") || target.tagName.toLowerCase();
      return { kind: "click", locators, text, role, url: href, t };
    }

    case "input":
    case "change": {
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) {
        return null;
      }
      const fieldInfo = {
        type: "type" in target ? (target as HTMLInputElement).type : undefined,
        autocomplete: target.getAttribute("autocomplete") || undefined,
        name: target.getAttribute("name") || undefined,
      };
      const rawValue = target.value;
      const value = redactValue(rawValue, fieldInfo);

      return {
        kind: "input",
        locators,
        fieldName: fieldInfo.name || target.getAttribute("aria-label") || undefined,
        inputType: fieldInfo.type,
        value,
        url: href,
        t,
      };
    }

    case "submit": {
      return { kind: "submit", locators, url: href, t };
    }

    default:
      return null;
  }
}

// ── Network sanitization ──────────────────────────────────────────────────

const SENSITIVE_HEADERS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "x-auth-token",
]);

/**
 * Strips query parameters and sensitive headers from network metadata.
 * Only preserves method, origin+pathname pattern, and status.
 */
export function sanitizeNetwork(input: {
  method: string;
  url: string;
  status?: number;
  headers?: Headers;
}): RecordedEvent {
  let urlPattern: string;
  try {
    const u = new URL(input.url);
    urlPattern = `${u.origin}${u.pathname}`;
  } catch {
    urlPattern = input.url.split("?")[0];
  }

  return {
    kind: "network",
    method: input.method.toUpperCase(),
    urlPattern,
    status: input.status,
    t: Date.now(),
  };
}
