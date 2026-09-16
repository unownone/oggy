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
  "FORM",
]);

const INTERACTIVE_SELECTOR =
  "a, button, [role=button], input, select, textarea, label, form";

export function shouldRecordTarget(el: EventTarget | null): boolean {
  if (!el || !(el instanceof Element)) return false;
  if (INTERACTIVE_TAGS.has(el.tagName)) return true;
  if (el.getAttribute("role") === "button") return true;
  if (el.getAttribute("contenteditable") === "true") return true;
  if (el.closest(INTERACTIVE_SELECTOR)) return true;
  return false;
}

/** Walk up from a nested click target (e.g. span inside a button) to the control. */
export function resolveInteractiveTarget(el: Element): Element {
  if (INTERACTIVE_TAGS.has(el.tagName) || el.getAttribute("role") === "button") {
    return el;
  }
  return el.closest(INTERACTIVE_SELECTOR) ?? el;
}

// ── DOM event → RecordedEvent ─────────────────────────────────────────────

export function toRecordedEvent(
  e: Event,
  href: string,
): RecordedEvent | null {
  const t = Date.now();
  const target = e.target;

  if (!target || !(target instanceof Element)) return null;

  const interactive = resolveInteractiveTarget(target);
  const locators = scoreLocators(interactive);

  switch (e.type) {
    case "click": {
      const text =
        interactive.textContent?.trim().slice(0, 120) || undefined;
      const role =
        interactive.getAttribute("role") || interactive.tagName.toLowerCase();
      return { kind: "click", locators, text, role, url: href, t };
    }

    case "input":
    case "change": {
      if (
        !(
          interactive instanceof HTMLInputElement ||
          interactive instanceof HTMLTextAreaElement ||
          interactive instanceof HTMLSelectElement
        )
      ) {
        return null;
      }
      const fieldInfo = {
        type:
          "type" in interactive
            ? (interactive as HTMLInputElement).type
            : undefined,
        autocomplete: interactive.getAttribute("autocomplete") || undefined,
        name: interactive.getAttribute("name") || undefined,
      };
      const rawValue = interactive.value;
      const value = redactValue(rawValue, fieldInfo);

      return {
        kind: "input",
        locators,
        fieldName:
          fieldInfo.name ||
          interactive.getAttribute("aria-label") ||
          undefined,
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
