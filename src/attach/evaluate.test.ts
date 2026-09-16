import { describe, it, expect } from "vitest";
import { evaluateAttachments } from "@/attach/evaluate";
import { diffAttachments } from "@/attach/diff";
import { pageContextFromLocation } from "@/core/page-context";
import { BUILTIN_MCP_CATALOG } from "@/domains";
import { MCP_ID, UPDATE_TOOL_NAME, LIST_SKILLS_TOOL_NAME } from "@/core/tool-names";
import type { AttachmentTarget, OriginBundle, DomainMcp } from "@/core";

function page(href: string, recordingActive = false) {
  return pageContextFromLocation({ href, recordingActive });
}

function learned(): DomainMcp {
  return {
    id: "learned-1",
    version: 1,
    synthesizedAt: "2026-01-01T00:00:00Z",
    tools: [
      {
        name: "q",
        description: "search",
        inputSchema: { type: "object", properties: {} },
        annotations: {
          readOnlyHint: false,
          consequentialHint: false,
          untrustedContentHint: false,
        },
        steps: [{ type: "click", locators: [{ strategy: "testid", value: "x" }] }],
      },
    ],
  };
}

function ids(targets: AttachmentTarget[]): string[] {
  return targets.map((t) => t.id).sort();
}

function names(targets: AttachmentTarget[]): string[] {
  return targets.flatMap((t) => t.mcp.tools.map((tool) => tool.name));
}

describe("evaluateAttachments", () => {
  it("attaches amazon domain tools + meta on amazon.com without a bundle", () => {
    const targets = evaluateAttachments({
      page: page("https://www.amazon.com/s?k=shoes"),
      bundle: null,
      catalog: BUILTIN_MCP_CATALOG,
    });
    expect(ids(targets)).toEqual([MCP_ID.commerceAmazon, MCP_ID.meta].sort());
    expect(names(targets)).toEqual(
      expect.arrayContaining([
        "find_listing",
        "click_object",
        "sign_up",
        "login",
        "add_to_cart",
        UPDATE_TOOL_NAME,
        LIST_SKILLS_TOOL_NAME,
      ]),
    );
    expect(names(targets)).not.toContain("click");
  });

  it("attaches primitives only while recording on an unknown host", () => {
    const idle = evaluateAttachments({
      page: page("http://127.0.0.1:4173/"),
      bundle: null,
      catalog: BUILTIN_MCP_CATALOG,
    });
    expect(idle).toEqual([]);

    const rec = evaluateAttachments({
      page: page("http://127.0.0.1:4173/", true),
      bundle: null,
      catalog: BUILTIN_MCP_CATALOG,
    });
    expect(ids(rec)).toEqual([MCP_ID.meta, MCP_ID.primitives].sort());
    expect(names(rec)).toEqual(
      expect.arrayContaining(["click", "scroll", "move", "slide", "input", "output", "read"]),
    );
  });

  it("origin disabled detaches everything unless recording", () => {
    const bundle: OriginBundle = {
      origin: "https://www.amazon.com",
      enabled: false,
      mcp: learned(),
      sessions: [],
    };
    expect(
      evaluateAttachments({
        page: page("https://www.amazon.com/"),
        bundle,
        catalog: BUILTIN_MCP_CATALOG,
      }),
    ).toEqual([]);

    const rec = evaluateAttachments({
      page: page("https://www.amazon.com/", true),
      bundle,
      catalog: BUILTIN_MCP_CATALOG,
    });
    expect(ids(rec)).toContain(MCP_ID.commerceAmazon);
    expect(ids(rec)).toContain(MCP_ID.primitives);
    expect(ids(rec)).not.toContain("learned-1");
  });

  it("attaches learned origin MCP when enabled", () => {
    const bundle: OriginBundle = {
      origin: "http://127.0.0.1:4173",
      enabled: true,
      mcp: learned(),
      sessions: [],
    };
    const targets = evaluateAttachments({
      page: page("http://127.0.0.1:4173/"),
      bundle,
      catalog: BUILTIN_MCP_CATALOG,
    });
    expect(ids(targets)).toEqual(["learned-1", MCP_ID.meta].sort());
  });

  it("applies approved overlays at attach time", () => {
    const targets = evaluateAttachments({
      page: page("https://www.amazon.com/"),
      bundle: {
        origin: "https://www.amazon.com",
        enabled: true,
        mcp: null,
        sessions: [],
        toolOverlays: { find_listing: { description: "patched" } },
      },
      catalog: BUILTIN_MCP_CATALOG,
    });
    const amazon = targets.find((t) => t.id === MCP_ID.commerceAmazon);
    expect(amazon?.mcp.tools.find((t) => t.name === "find_listing")?.description).toBe(
      "patched",
    );
  });
});

describe("diffAttachments", () => {
  it("is a no-op when fingerprints match", () => {
    const desired = evaluateAttachments({
      page: page("https://www.amazon.com/"),
      bundle: null,
      catalog: BUILTIN_MCP_CATALOG,
    });
    const current = Object.fromEntries(
      desired.map((t) => [t.id, { fingerprint: t.fingerprint }]),
    );
    const plan = diffAttachments(current, desired);
    expect(plan.attach).toEqual([]);
    expect(plan.detach).toEqual([]);
    expect(plan.unchanged.sort()).toEqual(ids(desired));
  });

  it("detaches on loadCriteria mismatch (SPA left amazon)", () => {
    const onAmazon = evaluateAttachments({
      page: page("https://www.amazon.com/s"),
      bundle: null,
      catalog: BUILTIN_MCP_CATALOG,
    });
    const current = Object.fromEntries(
      onAmazon.map((t) => [t.id, { fingerprint: t.fingerprint }]),
    );
    const off = evaluateAttachments({
      page: page("https://example.com/"),
      bundle: null,
      catalog: BUILTIN_MCP_CATALOG,
    });
    const plan = diffAttachments(current, off);
    expect(plan.detach.sort()).toEqual(ids(onAmazon));
    expect(plan.attach).toEqual([]);
  });

  it("replaces an id when the fingerprint changes (overlay / skill snapshot)", () => {
    const first = evaluateAttachments({
      page: page("https://www.amazon.com/"),
      bundle: null,
      catalog: BUILTIN_MCP_CATALOG,
    });
    const current = Object.fromEntries(
      first.map((t) => [t.id, { fingerprint: t.fingerprint }]),
    );
    const second = evaluateAttachments({
      page: page("https://www.amazon.com/"),
      bundle: {
        origin: "https://www.amazon.com",
        enabled: true,
        mcp: null,
        sessions: [],
        toolOverlays: { find_listing: { description: "v2" } },
      },
      catalog: BUILTIN_MCP_CATALOG,
    });
    const plan = diffAttachments(current, second);
    expect(plan.attach.map((t) => t.id)).toContain(MCP_ID.commerceAmazon);
    expect(plan.detach).toEqual([]);
  });
});
