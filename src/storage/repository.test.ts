import { describe, it, expect, beforeEach } from "vitest";
import { fakeBrowser } from "wxt/testing";
import {
  getBundle,
  listBundles,
  upsertBundle,
  setEnabled,
  deleteOrigin,
  getRecordingState,
  setRecordingState,
  appendEvent,
  replaceMcp,
  findSessionById,
  upsertPendingUpdate,
  resolvePendingUpdate,
} from "@/storage";
import type { OriginBundle, RecordingState, DomainMcp } from "@/core";

describe("storage repository", () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it("returns null for unknown origin", async () => {
    const bundle = await getBundle("https://unknown.com");
    expect(bundle).toBeNull();
  });

  it("upserts and retrieves a bundle", async () => {
    const bundle: OriginBundle = {
      origin: "https://example.com",
      enabled: true,
      mcp: null,
      sessions: [],
    };
    await upsertBundle(bundle);
    const result = await getBundle("https://example.com");
    expect(result).toEqual(bundle);
  });

  it("lists all bundles", async () => {
    await upsertBundle({ origin: "https://a.com", enabled: true, mcp: null, sessions: [] });
    await upsertBundle({ origin: "https://b.com", enabled: false, mcp: null, sessions: [] });
    const bundles = await listBundles();
    expect(bundles).toHaveLength(2);
    const origins = bundles.map((b) => b.origin).sort();
    expect(origins).toEqual(["https://a.com", "https://b.com"]);
  });

  it("setEnabled creates bundle if missing", async () => {
    const result = await setEnabled("https://new.com", true);
    expect(result.origin).toBe("https://new.com");
    expect(result.enabled).toBe(true);
  });

  it("setEnabled toggles existing bundle", async () => {
    await upsertBundle({ origin: "https://x.com", enabled: true, mcp: null, sessions: [] });
    const result = await setEnabled("https://x.com", false);
    expect(result.enabled).toBe(false);

    const fetched = await getBundle("https://x.com");
    expect(fetched?.enabled).toBe(false);
  });

  it("deleteOrigin removes the bundle", async () => {
    await upsertBundle({ origin: "https://del.com", enabled: true, mcp: null, sessions: [] });
    await deleteOrigin("https://del.com");
    const result = await getBundle("https://del.com");
    expect(result).toBeNull();
  });

  it("domain isolation — different origins are independent", async () => {
    await upsertBundle({ origin: "https://a.com", enabled: true, mcp: null, sessions: [] });
    await upsertBundle({ origin: "https://b.com", enabled: false, mcp: null, sessions: [] });
    expect((await getBundle("https://a.com"))?.enabled).toBe(true);
    expect((await getBundle("https://b.com"))?.enabled).toBe(false);
  });

  it("recording state defaults to inactive", async () => {
    const state = await getRecordingState();
    expect(state.active).toBe(false);
  });

  it("persists recording state", async () => {
    const state: RecordingState = {
      active: true,
      origin: "https://example.com",
      sessionId: "sess-1",
    };
    await setRecordingState(state);
    const result = await getRecordingState();
    expect(result).toEqual(state);
  });

  it("appendEvent creates a session and adds the event", async () => {
    await setRecordingState({
      active: true,
      origin: "https://example.com",
      sessionId: "sess-1",
    });

    await appendEvent("https://example.com", {
      kind: "click",
      locators: [{ strategy: "testid", value: "btn" }],
      url: "https://example.com",
      t: 1000,
    });

    const bundle = await getBundle("https://example.com");
    expect(bundle).not.toBeNull();
    expect(bundle!.sessions).toHaveLength(1);
    expect(bundle!.sessions[0].events).toHaveLength(1);
    expect(bundle!.sessions[0].events[0].kind).toBe("click");
  });

  it("replaceMcp overwrites MCP on an origin", async () => {
    await upsertBundle({ origin: "https://r.com", enabled: true, mcp: null, sessions: [] });

    const mcp: DomainMcp = {
      id: "mcp-1",
      version: 1,
      synthesizedAt: "2026-01-01T00:00:00Z",
      tools: [
        {
          name: "test_tool",
          description: "A test tool",
          inputSchema: { type: "object", properties: {} },
          annotations: {
            readOnlyHint: true,
            consequentialHint: false,
            untrustedContentHint: false,
          },
          steps: [],
        },
      ],
    };
    await replaceMcp("https://r.com", mcp);

    const bundle = await getBundle("https://r.com");
    expect(bundle!.mcp).toEqual(mcp);
    expect(bundle!.mcp!.tools).toHaveLength(1);
  });

  it("resolvePendingUpdate does not write overlays when denied", async () => {
    await upsertBundle({
      origin: "https://r.com",
      enabled: true,
      mcp: null,
      sessions: [],
    });
    await upsertPendingUpdate("https://r.com", {
      id: "p1",
      origin: "https://r.com",
      toolName: "find_listing",
      reason: "broken",
      patch: { description: "should not apply" },
      status: "pending",
      createdAt: "2026-01-01T00:00:00Z",
    });
    const denied = await resolvePendingUpdate("https://r.com", "p1", "denied");
    expect(denied.pendingUpdates?.[0].status).toBe("denied");
    expect(denied.toolOverlays).toBeUndefined();
  });

  it("resolvePendingUpdate writes overlay only when approved", async () => {
    await upsertBundle({
      origin: "https://ok.com",
      enabled: true,
      mcp: null,
      sessions: [],
    });
    await upsertPendingUpdate("https://ok.com", {
      id: "p2",
      origin: "https://ok.com",
      toolName: "find_listing",
      reason: "fix locator",
      patch: { description: "fixed" },
      status: "pending",
      createdAt: "2026-01-01T00:00:00Z",
    });
    const approved = await resolvePendingUpdate("https://ok.com", "p2", "approved");
    expect(approved.toolOverlays?.find_listing).toEqual({ description: "fixed" });
  });

  it("findSessionById locates a session on the preferred origin", async () => {
    await setRecordingState({
      active: true,
      origin: "https://example.com",
      sessionId: "sess-pref",
    });
    await appendEvent("https://example.com", {
      kind: "click",
      locators: [{ strategy: "testid", value: "btn" }],
      url: "https://example.com",
      t: 1,
    });

    const found = await findSessionById("sess-pref", "https://example.com");
    expect(found).not.toBeNull();
    expect(found!.bundle.origin).toBe("https://example.com");
    expect(found!.session.events).toHaveLength(1);
  });

  it("findSessionById falls back across origins when preferred origin has no session", async () => {
    await setRecordingState({
      active: true,
      origin: "chrome-extension://abc",
      sessionId: "sess-other",
    });
    await appendEvent("http://127.0.0.1:4173", {
      kind: "click",
      locators: [{ strategy: "testid", value: "btn" }],
      url: "http://127.0.0.1:4173/",
      t: 1,
    });

    const found = await findSessionById("sess-other", "chrome-extension://abc");
    expect(found).not.toBeNull();
    expect(found!.bundle.origin).toBe("http://127.0.0.1:4173");
  });
});
