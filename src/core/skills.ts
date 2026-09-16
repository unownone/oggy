import type { RecordingSession } from "./index";
import type { LoadCriteria } from "./load-criteria";
import type { DomainToolName, PrimitiveKind } from "./tool-names";
import {
  recordedEventToPrimitive,
  type PrimitiveCall,
} from "./primitives";

export interface SkillFlowStep extends PrimitiveCall {
  primitive: PrimitiveKind;
}

export interface SkillFlow {
  origin: string;
  sessionId: string;
  steps: SkillFlowStep[];
  suggestedName: string;
  suggestedDescription: string;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  origin: string;
  loadCriteria: LoadCriteria;
  flow: SkillFlow;
  sourceSessionId: string;
  createdAt: string;
}

export function buildSkillFlow(session: RecordingSession): SkillFlow {
  const steps: SkillFlowStep[] = [];
  for (const event of session.events) {
    const call = recordedEventToPrimitive(event);
    if (call) steps.push(call);
  }
  annotateDomainHints(steps);

  return {
    origin: session.origin,
    sessionId: session.id,
    steps,
    suggestedName: suggestSkillName(steps),
    suggestedDescription: suggestSkillDescription(session.origin, steps),
  };
}

export function createSkillFromFlow(input: {
  flow: SkillFlow;
  name?: string;
  description?: string;
  id?: string;
  createdAt?: string;
}): Skill {
  const name = (input.name ?? input.flow.suggestedName).trim() || "untitled_skill";
  return {
    id: input.id ?? crypto.randomUUID(),
    name,
    description: input.description ?? input.flow.suggestedDescription,
    origin: input.flow.origin,
    loadCriteria: { all: [{ type: "origin", origin: input.flow.origin }] },
    flow: input.flow,
    sourceSessionId: input.flow.sessionId,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

/**
 * Collapse obvious primitive runs into domain-tool hints.
 * Does not delete primitives — the flow is the source of truth.
 */
export function annotateDomainHints(steps: SkillFlowStep[]): void {
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (step.toolHint) continue;

    if (isSearchInput(step)) {
      const nextAction = steps
        .slice(i + 1)
        .find((s) => s.primitive === "click" || s.primitive === "output");
      if (nextAction) {
        step.toolHint = "find_listing";
        if (nextAction.primitive === "click" && !nextAction.toolHint) {
          nextAction.toolHint = "find_listing";
        }
      }
    }

    if (step.primitive === "click" && step.text && /listing|result/i.test(step.text)) {
      step.toolHint = "click_object";
    }
  }
}

function isSearchInput(step: SkillFlowStep): boolean {
  if (step.primitive !== "input") return false;
  const field = String(step.args?.fieldName ?? "");
  return /^(q|query|search|keywords|field-keywords)$/i.test(field);
}

function suggestSkillName(steps: SkillFlowStep[]): string {
  const hinted = steps.map((s) => s.toolHint).filter((h): h is DomainToolName => !!h);
  if (hinted.includes("add_to_cart")) return "add_to_cart_flow";
  if (hinted.includes("login")) return "login_flow";
  if (hinted.includes("sign_up")) return "sign_up_flow";
  if (hinted.includes("find_listing")) return "find_listing_flow";
  const click = [...steps].reverse().find((s) => s.primitive === "click" && s.text);
  if (click?.text) {
    return slugify(click.text) + "_flow";
  }
  return "recorded_flow";
}

function suggestSkillDescription(origin: string, steps: SkillFlowStep[]): string {
  const primitives = steps.map((s) => s.primitive).join(" → ");
  const required = steps.filter((s) => s.requiredRead).length;
  const reads =
    required > 0 ? ` (${required} required read(s))` : "";
  return `Recorded ${steps.length}-step flow on ${origin}: ${primitives || "(empty)"}${reads}`;
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 48) || "untitled"
  );
}
