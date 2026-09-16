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
  if (testid) locators.push({ strategy: "testid", value: testid });

  const ariaLabel = el.getAttribute("aria-label");
  const role = el.getAttribute("role") || el.tagName.toLowerCase();
  if (ariaLabel) {
    locators.push({ strategy: "aria", value: `${role}[${ariaLabel}]` });
  }

  const id = el.getAttribute("id");
  if (id) locators.push({ strategy: "id", value: id });

  const name = el.getAttribute("name");
  if (name) locators.push({ strategy: "name", value: name });

  // Short CSS path as fallback
  const tag = el.tagName.toLowerCase();
  const nthType = getNthOfType(el);
  const parent = el.parentElement;
  const parentTag = parent ? parent.tagName.toLowerCase() : "";
  const css = parent
    ? `${parentTag} > ${tag}:nth-of-type(${nthType})`
    : tag;
  locators.push({ strategy: "css", value: css });

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
