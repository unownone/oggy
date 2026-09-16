// ---------------------------------------------------------------------------
// Oggy engine — pluggable tool synthesis from recording sessions
// Zero chrome.* dependencies.
// ---------------------------------------------------------------------------

import type {
  OriginKey,
  RecordingSession,
  DomainMcp,
  ToolRecipe,
  ReplayStep,
  Locator,
  RecordedEvent,
} from "@/core";

// ── Interface ─────────────────────────────────────────────────────────────

export interface ToolSynthesisEngine {
  readonly id: string;
  synthesize(input: {
    origin: OriginKey;
    session: RecordingSession;
  }): Promise<DomainMcp>;
}

// ── Segmentation ──────────────────────────────────────────────────────────

/** A segment is a contiguous slice of events that form one logical "task". */
export interface Segment {
  events: RecordedEvent[];
  startIdx: number;
  endIdx: number;
}

const IDLE_GAP_MS = 3000;

const CONSEQUENTIAL_PATTERNS = [
  /checkout/i,
  /purchase/i,
  /\bbuy\b/i,
  /\bpay\b/i,
  /\border\b/i,
  /\bdelete\b/i,
  /\bremove\b/i,
  /\bcancel\b/i,
  /confirm/i,
];

export function segmentSession(session: RecordingSession): Segment[] {
  const { events } = session;
  if (events.length === 0) return [];

  const segments: Segment[] = [];
  let segStart = 0;

  for (let i = 1; i < events.length; i++) {
    const prev = events[i - 1];
    const curr = events[i];

    const gap = curr.t - prev.t;
    const isNavBoundary = curr.kind === "navigate";

    if (gap > IDLE_GAP_MS || isNavBoundary) {
      segments.push({ events: events.slice(segStart, i), startIdx: segStart, endIdx: i - 1 });
      segStart = i;
    }
  }

  segments.push({
    events: events.slice(segStart),
    startIdx: segStart,
    endIdx: events.length - 1,
  });

  return segments;
}

// ── Naming heuristic ──────────────────────────────────────────────────────

function inferToolName(segment: Segment): string {
  // Try to get a name from the last click or submit event's text
  for (let i = segment.events.length - 1; i >= 0; i--) {
    const ev = segment.events[i];
    if (ev.kind === "click" && ev.text) {
      return slugify(ev.text);
    }
    if (ev.kind === "submit") {
      // Look backward for closest input to get context
      for (let j = i - 1; j >= 0; j--) {
        const prev = segment.events[j];
        if (prev.kind === "input" && prev.fieldName) {
          return slugify(prev.fieldName);
        }
      }
      return "submit_form";
    }
  }

  // Fallback: look at any input field name
  for (const ev of segment.events) {
    if (ev.kind === "input" && ev.fieldName) {
      return slugify(ev.fieldName);
    }
  }

  return `task_${segment.startIdx}`;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 64) || "unnamed";
}

function isConsequential(segment: Segment): boolean {
  for (const ev of segment.events) {
    const textToCheck =
      ev.kind === "click" ? ev.text || "" : ev.kind === "input" ? ev.fieldName || "" : "";
    if (CONSEQUENTIAL_PATTERNS.some((re) => re.test(textToCheck))) return true;
  }
  return false;
}

// ── Schema extraction ─────────────────────────────────────────────────────

function extractInputSchema(segment: Segment): {
  schema: Record<string, unknown>;
  argMap: Map<string, number>;
} {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  const argMap = new Map<string, number>();

  for (let i = 0; i < segment.events.length; i++) {
    const ev = segment.events[i];
    if (ev.kind === "input" && ev.fieldName) {
      const paramName = slugify(ev.fieldName);
      if (!properties[paramName]) {
        properties[paramName] = {
          type: "string",
          description: `Value for ${ev.fieldName}`,
        };
        required.push(paramName);
        argMap.set(paramName, i);
      }
    }
  }

  return {
    schema: {
      type: "object",
      properties,
      required,
    },
    argMap,
  };
}

// ── Step generation ───────────────────────────────────────────────────────

function toReplaySteps(segment: Segment, argMap: Map<string, number>): ReplayStep[] {
  const steps: ReplayStep[] = [];
  const argIndices = new Set(argMap.values());

  for (let i = 0; i < segment.events.length; i++) {
    const ev = segment.events[i];

    switch (ev.kind) {
      case "click":
        steps.push({ type: "click", locators: ev.locators });
        break;
      case "input":
        if (ev.fieldName && argIndices.has(i)) {
          const paramName = slugify(ev.fieldName);
          steps.push({ type: "fill", locators: ev.locators, arg: paramName });
        }
        break;
      case "submit":
        steps.push({ type: "submit", locators: ev.locators });
        break;
      case "navigate":
        steps.push({ type: "navigate", urlTemplate: ev.to });
        break;
      case "network":
        // Network events are informational, not replayable steps
        break;
      default: {
        const _exhaustive: never = ev;
        throw new Error(`Unhandled event kind: ${(_exhaustive as RecordedEvent).kind}`);
      }
    }
  }

  return steps;
}

// ── Heuristic engine ──────────────────────────────────────────────────────

export class HeuristicEngine implements ToolSynthesisEngine {
  readonly id = "heuristic" as const;

  async synthesize(input: {
    origin: OriginKey;
    session: RecordingSession;
  }): Promise<DomainMcp> {
    const segments = segmentSession(input.session);
    const tools: ToolRecipe[] = [];
    const usedNames = new Set<string>();

    for (const segment of segments) {
      if (segment.events.length === 0) continue;

      let name = inferToolName(segment);
      // Deduplicate within this synthesis run
      if (usedNames.has(name)) {
        let suffix = 2;
        while (usedNames.has(`${name}_${suffix}`)) suffix++;
        name = `${name}_${suffix}`;
      }
      usedNames.add(name);

      const { schema, argMap } = extractInputSchema(segment);
        const steps = toReplaySteps(segment, argMap);
        if (steps.length === 0) continue;

      // Build description from event summary
      const actionCount = segment.events.length;
      const inputCount = segment.events.filter((e) => e.kind === "input").length;
      const description =
        `Replays a ${actionCount}-step flow` +
        (inputCount > 0 ? ` with ${inputCount} input field(s)` : "") +
        ` on ${input.origin}`;

      tools.push({
        name,
        description,
        inputSchema: schema,
        annotations: {
          readOnlyHint: false,
          consequentialHint: isConsequential(segment),
          untrustedContentHint: false,
        },
        steps,
      });
    }

    return {
      id: crypto.randomUUID(),
      version: 1,
      synthesizedAt: new Date().toISOString(),
      tools,
    };
  }
}

export const defaultEngine: ToolSynthesisEngine = new HeuristicEngine();
