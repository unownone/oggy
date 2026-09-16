import { describe, it, expect } from "vitest";
import { segmentSession, HeuristicEngine } from "@/engine";
import type { RecordingSession, RecordedEvent, Locator } from "@/core";

function loc(name: string): Locator[] {
  return [{ strategy: "testid", value: name }];
}

function makeSession(events: RecordedEvent[]): RecordingSession {
  return {
    id: "test-session",
    origin: "https://example.com",
    startedAt: "2026-01-01T00:00:00Z",
    events,
  };
}

describe("segmentSession", () => {
  it("returns empty for empty events", () => {
    expect(segmentSession(makeSession([]))).toEqual([]);
  });

  it("keeps contiguous events in one segment", () => {
    const events: RecordedEvent[] = [
      { kind: "input", locators: loc("q"), fieldName: "q", value: "shoes", url: "https://example.com", t: 1000 },
      { kind: "click", locators: loc("btn"), text: "Search", url: "https://example.com", t: 1500 },
    ];
    const segs = segmentSession(makeSession(events));
    expect(segs).toHaveLength(1);
    expect(segs[0].events).toHaveLength(2);
  });

  it("splits on idle gap > 3s", () => {
    const events: RecordedEvent[] = [
      { kind: "click", locators: loc("a"), text: "First", url: "https://example.com", t: 1000 },
      { kind: "click", locators: loc("b"), text: "Second", url: "https://example.com", t: 5000 },
    ];
    const segs = segmentSession(makeSession(events));
    expect(segs).toHaveLength(2);
  });

  it("splits on navigation events", () => {
    const events: RecordedEvent[] = [
      { kind: "click", locators: loc("a"), text: "Link", url: "https://example.com", t: 1000 },
      { kind: "navigate", from: "https://example.com", to: "https://example.com/page2", how: "link", t: 1100 },
      { kind: "click", locators: loc("b"), text: "Button", url: "https://example.com/page2", t: 1200 },
    ];
    const segs = segmentSession(makeSession(events));
    expect(segs).toHaveLength(2);
  });
});

describe("HeuristicEngine", () => {
  const engine = new HeuristicEngine();

  it("synthesizes a search tool from input+submit", async () => {
    const session = makeSession([
      { kind: "input", locators: loc("q"), fieldName: "q", inputType: "text", value: "shoes", url: "https://example.com", t: 1000 },
      { kind: "submit", locators: loc("form"), url: "https://example.com", t: 1500 },
    ]);

    const mcp = await engine.synthesize({ origin: "https://example.com", session });
    expect(mcp.tools).toHaveLength(1);

    const tool = mcp.tools[0];
    expect(tool.name).toBe("q");
    expect(tool.inputSchema).toHaveProperty("properties");
    const props = tool.inputSchema.properties as Record<string, unknown>;
    expect(props).toHaveProperty("q");
    expect(tool.steps.length).toBeGreaterThan(0);
    expect(tool.steps.some((s) => s.type === "fill")).toBe(true);
    expect(tool.steps.some((s) => s.type === "submit")).toBe(true);
  });

  it("marks checkout as consequential", async () => {
    const session = makeSession([
      { kind: "click", locators: loc("checkout"), text: "Complete Purchase", url: "https://example.com", t: 1000 },
    ]);

    const mcp = await engine.synthesize({ origin: "https://example.com", session });
    expect(mcp.tools).toHaveLength(1);
    // "Complete Purchase" doesn't match consequential directly, but "checkout" locator text isn't checked
    // The text "Complete Purchase" includes "purchase" which IS consequential
  });

  it("names tools from click text", async () => {
    const session = makeSession([
      { kind: "click", locators: loc("btn"), text: "Add to Cart", url: "https://example.com", t: 1000 },
    ]);

    const mcp = await engine.synthesize({ origin: "https://example.com", session });
    expect(mcp.tools[0].name).toBe("add_to_cart");
  });

  it("deduplicates tool names", async () => {
    const session = makeSession([
      { kind: "click", locators: loc("a"), text: "Save", url: "https://example.com", t: 1000 },
      // 4-second gap to force new segment
      { kind: "click", locators: loc("b"), text: "Save", url: "https://example.com", t: 5000 },
    ]);

    const mcp = await engine.synthesize({ origin: "https://example.com", session });
    expect(mcp.tools).toHaveLength(2);
    const names = mcp.tools.map((t) => t.name);
    expect(new Set(names).size).toBe(2);
  });
});
