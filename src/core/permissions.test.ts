import { describe, it, expect } from "vitest";
import {
  applyApprovedPatch,
  applyOverlayToTool,
  proposeToolUpdate,
  resolveToolUpdate,
} from "@/core/permissions";
import type { ToolRecipe } from "@/core";

const tool: ToolRecipe = {
  name: "find_listing",
  description: "old",
  inputSchema: { type: "object", properties: {} },
  annotations: {
    readOnlyHint: false,
    consequentialHint: false,
    untrustedContentHint: false,
  },
  steps: [],
};

describe("permissioned update_tool", () => {
  it("proposeToolUpdate is always pending and does not mutate the recipe", () => {
    const before = structuredClone(tool);
    const proposal = proposeToolUpdate({
      origin: "https://www.amazon.com",
      toolName: "find_listing",
      reason: "locator drifted",
      patch: { description: "new" },
    });
    expect(proposal.status).toBe("pending");
    expect(tool).toEqual(before);
  });

  it("applyApprovedPatch throws on pending and denied proposals", () => {
    const pending = proposeToolUpdate({
      origin: "https://www.amazon.com",
      toolName: "find_listing",
      reason: "x",
      patch: { description: "new" },
    });
    expect(() => applyApprovedPatch(tool, pending)).toThrow(/without approved/);

    const denied = resolveToolUpdate(pending, "denied");
    expect(denied.status).toBe("denied");
    expect(() => applyApprovedPatch(tool, denied)).toThrow(/without approved/);
    expect(tool.description).toBe("old");
  });

  it("applyApprovedPatch writes only after approve", () => {
    const pending = proposeToolUpdate({
      origin: "https://www.amazon.com",
      toolName: "find_listing",
      reason: "x",
      patch: { description: "new" },
    });
    const approved = resolveToolUpdate(pending, "approved");
    const next = applyApprovedPatch(tool, approved);
    expect(next.description).toBe("new");
    expect(tool.description).toBe("old");
  });

  it("applyOverlayToTool is the attach-time path for already-approved overlays", () => {
    const next = applyOverlayToTool(tool, { description: "overlay" });
    expect(next.description).toBe("overlay");
  });
});
