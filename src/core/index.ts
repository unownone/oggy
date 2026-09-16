// ---------------------------------------------------------------------------
// Oggy core — origin keys, redaction, locators, message parsing, shared types
// Zero chrome.* dependencies. Importable from any context including tests.
// ---------------------------------------------------------------------------

// ── Storage keys ───────────────────────────────────────────────────────────
export const STORAGE_ORIGINS_KEY = "oggy.origins";
export const STORAGE_RECORDING_KEY = "oggy.recording";

// ── MAIN ↔ Isolated content-script CustomEvent bus ────────────────────────
export const BUS = {
  hello: "oggy:v1:hello",
  register: "oggy:v1:register",
  abort: "oggy:v1:abort",
  record: "oggy:v1:record",
} as const;

// ── Origin key helpers ────────────────────────────────────────────────────

/** Branded string for clarity: always `new URL(href).origin`. */
export type OriginKey = string;

export function toOriginKey(href: string): OriginKey {
  try {
    return new URL(href).origin;
  } catch {
    return href;
  }
}

/** True for http(s) pages we can record; false for chrome-extension://, about:, etc. */
export function isRecordableHref(href: string): boolean {
  try {
    const protocol = new URL(href).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/** True for http(s) page URLs — not chrome-extension://, about:, etc. */
export function isHttpUrl(url: string | undefined | null): boolean {
  return typeof url === "string" && isRecordableHref(url);
}

export interface TabHint {
  url?: string;
  active?: boolean;
  lastAccessed?: number;
}

/**
 * Pick the origin to record against. Prefers an active http(s) tab so a
 * popup opened as a full page (e2e) does not steal the origin.
 */
export function selectRecordableOrigin(tabs: TabHint[]): OriginKey | undefined {
  const web = tabs.filter(
    (t): t is TabHint & { url: string } =>
      typeof t.url === "string" && isRecordableHref(t.url),
  );
  if (web.length === 0) return undefined;

  const active = web.find((t) => t.active);
  if (active) return toOriginKey(active.url);

  web.sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0));
  return toOriginKey(web[0].url);
}

/**
 * Pick the webpage tab to associate with the popup/side panel.
 * Prefers the active http(s) tab so opening popup.html as a page (e2e)
 * still records against the demo site, not chrome-extension://.
 */
export function pickPageTabUrl(
  tabs: Array<{ active?: boolean; url?: string }>,
): string | undefined {
  const activeHttp = tabs.find((t) => t.active && isHttpUrl(t.url));
  if (activeHttp?.url) return activeHttp.url;
  return tabs.find((t) => isHttpUrl(t.url))?.url;
}

// ── Sensitive-field detection & redaction ──────────────────────────────────

const SENSITIVE_TYPES = new Set(["password", "hidden"]);

const SENSITIVE_AUTOCOMPLETES = new Set([
  "cc-number",
  "cc-csc",
  "cc-exp",
  "cc-exp-month",
  "cc-exp-year",
  "cc-name",
  "cc-type",
  "new-password",
  "current-password",
  "one-time-code",
]);

const SENSITIVE_NAME_PATTERNS = [
  /pass(word)?/i,
  /\bpwd\b/i,
  /\bssn\b/i,
  /\bsocial.?sec/i,
  /\bcvv\b/i,
  /\bcvc\b/i,
  /\bcsc\b/i,
  /(?:^|[^a-z])otp(?:$|[^a-z])/i,
  /\bpin\b/i,
  /credit.?card/i,
  /card.?num/i,
  /secret/i,
  /token/i,
];

export function isSensitiveField(el: {
  type?: string;
  autocomplete?: string;
  name?: string;
}): boolean {
  if (el.type && SENSITIVE_TYPES.has(el.type.toLowerCase())) return true;
  if (el.autocomplete) {
    const tokens = el.autocomplete
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 0);
    if (tokens.some((t) => SENSITIVE_AUTOCOMPLETES.has(t))) return true;
  }
  if (el.name) {
    if (SENSITIVE_NAME_PATTERNS.some((re) => re.test(el.name!))) return true;
  }
  return false;
}

/**
 * Returns `undefined` when the value must be redacted, otherwise returns the
 * original value unchanged.
 */
export function redactValue(
  value: string,
  field: { type?: string; autocomplete?: string; name?: string },
): string | undefined {
  if (isSensitiveField(field)) return undefined;
  return value;
}

// ── Locator scoring ───────────────────────────────────────────────────────

export interface Locator {
  strategy: "testid" | "aria" | "id" | "name" | "css";
  value: string;
}

export function scoreLocators(el: Element): Locator[] {
  const locators: Locator[] = [];

  const testid = el.getAttribute("data-testid");
  if (testid && uniqueSelector(`[data-testid="${cssEscape(testid)}"]`)) {
    locators.push({ strategy: "testid", value: testid });
  }

  const ariaLabel = el.getAttribute("aria-label");
  const role = el.getAttribute("role") || el.tagName.toLowerCase();
  if (ariaLabel) {
    locators.push({ strategy: "aria", value: `${role}[${ariaLabel}]` });
  }

  const id = el.getAttribute("id");
  if (id && uniqueSelector(`#${cssEscape(id)}`)) {
    locators.push({ strategy: "id", value: id });
  }

  const name = el.getAttribute("name");
  if (name) locators.push({ strategy: "name", value: name });

  // Ancestor-aware CSS path so "3rd result" doesn't collapse to the first
  // match of `article > a:nth-of-type(1)`.
  locators.push({ strategy: "css", value: cssPath(el) });

  return locators;
}

function getNthOfType(el: Element): number {
  const parent = el.parentElement;
  if (!parent) return 1;
  const tag = el.tagName;
  let idx = 0;
  for (const child of Array.from(parent.children)) {
    if (child.tagName === tag) idx++;
    if (child === el) return idx;
  }
  return 1;
}

function uniqueSelector(selector: string): boolean {
  try {
    return document.querySelectorAll(selector).length === 1;
  } catch {
    return false;
  }
}

function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

function firstClass(el: Element): string | undefined {
  const raw = el.getAttribute("class");
  if (!raw) return undefined;
  return raw.split(/\s+/).find((c) => c.length > 0);
}

/**
 * Build a CSS path of up to 6 ancestors, stopping at a unique id/testid.
 * Includes `:nth-of-type` at each hop so list-index clicks survive replay.
 */
export function cssPath(el: Element): string {
  const parts: string[] = [];
  let node: Element | null = el;

  for (let depth = 0; depth < 6 && node; depth++) {
    const tag = node.tagName.toLowerCase();

    if (node === document.documentElement) {
      parts.unshift("html");
      break;
    }
    if (node === document.body) {
      parts.unshift("body");
      break;
    }

    const testid = node.getAttribute("data-testid");
    if (testid && uniqueSelector(`[data-testid="${cssEscape(testid)}"]`)) {
      parts.unshift(`${tag}[data-testid="${cssEscape(testid)}"]`);
      break;
    }

    const id = node.getAttribute("id");
    if (id && !/^\d/.test(id) && uniqueSelector(`#${cssEscape(id)}`)) {
      parts.unshift(`${tag}#${cssEscape(id)}`);
      break;
    }

    const nth = getNthOfType(node);
    const cls = firstClass(node);
    const classSel = cls ? `.${cssEscape(cls)}` : "";
    parts.unshift(`${tag}${classSel}:nth-of-type(${nth})`);
    node = node.parentElement;
  }

  return parts.join(" > ");
}

// ── Message parsing ───────────────────────────────────────────────────────

export type OggyMessage =
  | { type: "oggy/record/start" }
  | { type: "oggy/record/stop" }
  | { type: "oggy/record/status" }
  | { type: "oggy/origin/get"; origin: OriginKey }
  | { type: "oggy/origin/list" }
  | { type: "oggy/origin/setEnabled"; origin: OriginKey; enabled: boolean }
  | { type: "oggy/origin/delete"; origin: OriginKey }
  | { type: "oggy/session/append"; origin: OriginKey; event: RecordedEvent };

export type OggyResponse =
  | { ok: true; recording: RecordingState }
  | { ok: true; bundle: OriginBundle | null }
  | { ok: true; bundles: OriginBundle[] }
  | { ok: false; error: string };

const VALID_MESSAGE_TYPES = new Set<string>([
  "oggy/record/start",
  "oggy/record/stop",
  "oggy/record/status",
  "oggy/origin/get",
  "oggy/origin/list",
  "oggy/origin/setEnabled",
  "oggy/origin/delete",
  "oggy/session/append",
]);

export function parseMessage(input: unknown): OggyMessage {
  if (
    typeof input !== "object" ||
    input === null ||
    !("type" in input) ||
    typeof (input as Record<string, unknown>).type !== "string"
  ) {
    throw new Error("Invalid message: missing or non-string type");
  }
  const msg = input as Record<string, unknown>;
  if (!VALID_MESSAGE_TYPES.has(msg.type as string)) {
    throw new Error(`Invalid message type: ${msg.type}`);
  }
  return input as OggyMessage;
}

// ── Domain data types ─────────────────────────────────────────────────────

export interface OriginBundle {
  origin: OriginKey;
  enabled: boolean;
  mcp: DomainMcp | null;
  sessions: RecordingSession[];
}

export interface DomainMcp {
  id: string;
  version: number;
  synthesizedAt: string;
  tools: ToolRecipe[];
}

export interface ToolRecipe {
  name: string;
  title?: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: {
    readOnlyHint: boolean;
    consequentialHint: boolean;
    untrustedContentHint: boolean;
  };
  steps: ReplayStep[];
}

export type ReplayStep =
  | { type: "click"; locators: Locator[] }
  | { type: "fill"; locators: Locator[]; arg: string }
  | { type: "select"; locators: Locator[]; arg: string }
  | { type: "submit"; locators: Locator[] }
  | { type: "navigate"; urlTemplate?: string; urlArg?: string }
  | { type: "waitFor"; locators?: Locator[]; urlIncludes?: string };

export type RecordedEvent =
  | {
      kind: "click";
      locators: Locator[];
      text?: string;
      role?: string;
      url: string;
      t: number;
    }
  | {
      kind: "input";
      locators: Locator[];
      fieldName?: string;
      inputType?: string;
      value?: string;
      url: string;
      t: number;
    }
  | { kind: "submit"; locators: Locator[]; url: string; t: number }
  | {
      kind: "navigate";
      from: string;
      to: string;
      how: "link" | "history" | "reload";
      t: number;
    }
  | {
      kind: "network";
      method: string;
      urlPattern: string;
      status?: number;
      t: number;
    };

export interface RecordingSession {
  id: string;
  origin: OriginKey;
  startedAt: string;
  endedAt?: string;
  events: RecordedEvent[];
}

export interface RecordingState {
  active: boolean;
  origin?: OriginKey;
  sessionId?: string;
}
