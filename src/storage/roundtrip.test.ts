import { describe, it, expect, beforeEach } from "vitest";
import { fakeBrowser } from "wxt/testing";
import {
  ensureSession,
  appendEvent,
  getBundle,
  setRecordingState,
  replaceMcp,
  findSessionsById,
} from "@/storage";
import { defaultEngine } from "@/engine";
import type { Locator, RecordedEvent } from "@/core";

const ORIGIN = "http://127.0.0.1:4173";

function loc(testid: string): Locator[] {
  return [{ strategy: "testid", value: testid }];
}

describe("recording → synthesis round-trip", () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it("start, append click+input+submit, stop → session + mcp.tools.length >= 1", async () => {
    const sessionId = "sess-roundtrip";
    await setRecordingState({
      active: true,
      origin: ORIGIN,
      sessionId,
    });
    await ensureSession(ORIGIN, sessionId);

    const events: RecordedEvent[] = [
      {
        kind: "input",
        locators: loc("demo-search-input"),
        fieldName: "q",
        inputType: "text",
        value: "shoes",
        url: `${ORIGIN}/`,
        t: 1000,
      },
      {
        kind: "click",
        locators: loc("demo-search-submit"),
        text: "Search",
        role: "button",
        url: `${ORIGIN}/`,
        t: 1100,
      },
      {
        kind: "submit",
        locators: loc("search-form"),
        url: `${ORIGIN}/`,
        t: 1110,
      },
    ];

    for (const event of events) {
      await appendEvent(ORIGIN, event);
    }

    const beforeStop = await getBundle(ORIGIN);
    expect(beforeStop).not.toBeNull();
    expect(beforeStop!.sessions).toHaveLength(1);
    expect(beforeStop!.sessions[0].id).toBe(sessionId);
    expect(beforeStop!.sessions[0].events).toHaveLength(3);

    const matches = await findSessionsById(sessionId);
    expect(matches).toHaveLength(1);

    const mcp = await defaultEngine.synthesize({
      origin: ORIGIN,
      session: matches[0].session,
    });
    await replaceMcp(ORIGIN, mcp);

    const afterStop = await getBundle(ORIGIN);
    expect(afterStop?.mcp).not.toBeNull();
    expect(afterStop!.mcp!.tools.length).toBeGreaterThanOrEqual(1);
    expect(afterStop!.mcp!.tools[0].steps.some((s) => s.type === "fill")).toBe(
      true,
    );
  });

  it("ensureSession is idempotent for the same session id", async () => {
    await ensureSession(ORIGIN, "sess-1");
    await ensureSession(ORIGIN, "sess-1");
    const bundle = await getBundle(ORIGIN);
    expect(bundle!.sessions).toHaveLength(1);
    expect(bundle!.sessions[0].events).toHaveLength(0);
  });
});
