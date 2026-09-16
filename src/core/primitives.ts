import type { Locator, RecordedEvent } from "./index";
import {
  type DomainToolName,
  type PrimitiveKind,
  isDomainToolName,
} from "./tool-names";

/** One observed user/agent action in the recording vocabulary. */
export interface PrimitiveCall {
  primitive: PrimitiveKind;
  locators?: Locator[];
  args?: Record<string, unknown>;
  text?: string;
  url: string;
  t: number;
  /** True when a value is required but was redacted or missing. */
  requiredRead?: boolean;
  /** Domain tool this primitive appears to belong to, if any. */
  toolHint?: DomainToolName;
}

export function recordedEventToPrimitive(
  event: RecordedEvent,
): PrimitiveCall | null {
  switch (event.kind) {
    case "click":
      return {
        primitive: "click",
        locators: event.locators,
        text: event.text,
        url: event.url,
        t: event.t,
        toolHint: hintFromClickText(event.text),
      };
    case "input":
      return {
        primitive: "input",
        locators: event.locators,
        args: {
          fieldName: event.fieldName,
          inputType: event.inputType,
          value: event.value,
        },
        url: event.url,
        t: event.t,
        requiredRead: event.value === undefined,
      };
    case "submit":
      return {
        primitive: "click",
        locators: event.locators,
        args: { intent: "submit" },
        url: event.url,
        t: event.t,
      };
    case "navigate":
      return {
        primitive: "output",
        args: { from: event.from, to: event.to, how: event.how },
        url: event.to,
        t: event.t,
      };
    case "network":
      return {
        primitive: "output",
        args: {
          method: event.method,
          urlPattern: event.urlPattern,
          status: event.status,
        },
        url: event.urlPattern,
        t: event.t,
      };
    case "scroll":
      return {
        primitive: "scroll",
        locators: event.locators,
        args: { deltaX: event.deltaX, deltaY: event.deltaY },
        url: event.url,
        t: event.t,
      };
    case "move":
      return {
        primitive: "move",
        locators: event.locators,
        url: event.url,
        t: event.t,
      };
    case "slide":
      return {
        primitive: "slide",
        locators: event.locators,
        args: { from: event.from, to: event.to },
        url: event.url,
        t: event.t,
      };
    case "read":
      return {
        primitive: "read",
        locators: event.locators,
        args: { fieldName: event.fieldName, value: event.value },
        url: event.url,
        t: event.t,
        requiredRead: event.value === undefined,
      };
    case "output":
      return {
        primitive: "output",
        locators: event.locators,
        text: event.text,
        url: event.url,
        t: event.t,
      };
    default: {
      const _exhaustive: never = event;
      throw new Error(
        `Unhandled recorded event: ${(_exhaustive as RecordedEvent).kind}`,
      );
    }
  }
}

export function hintFromClickText(text: string | undefined): DomainToolName | undefined {
  if (!text) return undefined;
  if (/add to cart|buy now/i.test(text)) return "add_to_cart";
  if (/sign up|create account|register/i.test(text)) return "sign_up";
  if (/log\s?in|sign in/i.test(text)) return "login";
  return undefined;
}

export function assertDomainToolHint(
  name: string | undefined,
): DomainToolName | undefined {
  if (!name) return undefined;
  return isDomainToolName(name) ? name : undefined;
}
