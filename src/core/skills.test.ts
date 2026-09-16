import { describe, it, expect } from "vitest";
import { buildSkillFlow, createSkillFromFlow } from "@/core/skills";
import { recordedEventToPrimitive } from "@/core/primitives";
import type { RecordingSession } from "@/core";

const loc = [{ strategy: "testid" as const, value: "q" }];

function session(events: RecordingSession["events"]): RecordingSession {
  return {
    id: "sess-1",
    origin: "https://www.amazon.com",
    startedAt: "2026-01-01T00:00:00Z",
    events,
  };
}

describe("recordedEventToPrimitive", () => {
  it("maps submit to click with intent=submit", () => {
    const call = recordedEventToPrimitive({
      kind: "submit",
      locators: loc,
      url: "https://www.amazon.com/",
      t: 1,
    });
    expect(call?.primitive).toBe("click");
    expect(call?.args).toEqual({ intent: "submit" });
  });

  it("marks redacted input as requiredRead", () => {
    const call = recordedEventToPrimitive({
      kind: "input",
      locators: loc,
      fieldName: "password",
      url: "https://www.amazon.com/",
      t: 1,
    });
    expect(call?.primitive).toBe("input");
    expect(call?.requiredRead).toBe(true);
  });

  it("hints add_to_cart from click text", () => {
    const call = recordedEventToPrimitive({
      kind: "click",
      locators: loc,
      text: "Add to Cart",
      url: "https://www.amazon.com/",
      t: 1,
    });
    expect(call?.toolHint).toBe("add_to_cart");
  });
});

describe("buildSkillFlow", () => {
  it("does not create a Skill; that requires createSkillFromFlow", () => {
    const flow = buildSkillFlow(
      session([
        {
          kind: "input",
          locators: loc,
          fieldName: "q",
          value: "shoes",
          url: "https://www.amazon.com/",
          t: 1,
        },
        {
          kind: "click",
          locators: [{ strategy: "css", value: "button" }],
          text: "Go",
          url: "https://www.amazon.com/",
          t: 2,
        },
      ]),
    );
    expect(flow.steps).toHaveLength(2);
    expect(flow.steps[0].toolHint).toBe("find_listing");
    expect(flow.suggestedName).toBe("find_listing_flow");

    const skill = createSkillFromFlow({ flow, name: "shop_shoes" });
    expect(skill.name).toBe("shop_shoes");
    expect(skill.sourceSessionId).toBe("sess-1");
    expect(skill.loadCriteria).toEqual({
      all: [{ type: "origin", origin: "https://www.amazon.com" }],
    });
  });
});
