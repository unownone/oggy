import { describe, it, expect } from "vitest";
import { segmentSession } from "@/engine";
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

describe("segmentation edge cases", () => {
  it("idle gap exactly at 3s boundary does NOT split", () => {
    const events: RecordedEvent[] = [
      { kind: "click", locators: loc("a"), text: "A", url: "https://example.com", t: 1000 },
      { kind: "click", locators: loc("b"), text: "B", url: "https://example.com", t: 4000 },
    ];
    // 3000ms gap is exactly at boundary — should NOT split (> 3000 required)
    const segs = segmentSession(makeSession(events));
    expect(segs).toHaveLength(1);
  });

  it("idle gap just over 3s splits", () => {
    const events: RecordedEvent[] = [
      { kind: "click", locators: loc("a"), text: "A", url: "https://example.com", t: 1000 },
      { kind: "click", locators: loc("b"), text: "B", url: "https://example.com", t: 4001 },
    ];
    const segs = segmentSession(makeSession(events));
    expect(segs).toHaveLength(2);
  });

  it("multiple navigations create multiple segments", () => {
    const events: RecordedEvent[] = [
      { kind: "click", locators: loc("a"), text: "A", url: "https://example.com", t: 1000 },
      { kind: "navigate", from: "https://example.com", to: "https://example.com/p1", how: "link", t: 1100 },
      { kind: "click", locators: loc("b"), text: "B", url: "https://example.com/p1", t: 1200 },
      { kind: "navigate", from: "https://example.com/p1", to: "https://example.com/p2", how: "link", t: 1300 },
      { kind: "click", locators: loc("c"), text: "C", url: "https://example.com/p2", t: 1400 },
    ];
    const segs = segmentSession(makeSession(events));
    expect(segs).toHaveLength(3);
  });

  it("checkout text in a segment sets consequentialHint via engine", async () => {
    const { HeuristicEngine } = await import("@/engine");
    const engine = new HeuristicEngine();

    const session = makeSession([
      { kind: "click", locators: loc("buy"), text: "Buy Now", url: "https://example.com", t: 1000 },
    ]);

    const mcp = await engine.synthesize({ origin: "https://example.com", session });
    expect(mcp.tools[0].annotations.consequentialHint).toBe(true);
  });

  it("delete text sets consequentialHint", async () => {
    const { HeuristicEngine } = await import("@/engine");
    const engine = new HeuristicEngine();

    const session = makeSession([
      { kind: "click", locators: loc("del"), text: "Delete Account", url: "https://example.com", t: 1000 },
    ]);

    const mcp = await engine.synthesize({ origin: "https://example.com", session });
    expect(mcp.tools[0].annotations.consequentialHint).toBe(true);
  });

  it("non-consequential text does not set hint", async () => {
    const { HeuristicEngine } = await import("@/engine");
    const engine = new HeuristicEngine();

    const session = makeSession([
      { kind: "click", locators: loc("search"), text: "Search", url: "https://example.com", t: 1000 },
    ]);

    const mcp = await engine.synthesize({ origin: "https://example.com", session });
    expect(mcp.tools[0].annotations.consequentialHint).toBe(false);
  });
});
