import { describe, it, expect } from "vitest";
import { parseMessage } from "@/core";

describe("parseMessage", () => {
  it("accepts oggy/record/start", () => {
    const msg = parseMessage({ type: "oggy/record/start" });
    expect(msg.type).toBe("oggy/record/start");
  });

  it("accepts oggy/record/stop", () => {
    const msg = parseMessage({ type: "oggy/record/stop" });
    expect(msg.type).toBe("oggy/record/stop");
  });

  it("accepts oggy/record/status", () => {
    const msg = parseMessage({ type: "oggy/record/status" });
    expect(msg.type).toBe("oggy/record/status");
  });

  it("accepts oggy/origin/get with origin", () => {
    const msg = parseMessage({ type: "oggy/origin/get", origin: "https://example.com" });
    expect(msg.type).toBe("oggy/origin/get");
  });

  it("accepts oggy/origin/list", () => {
    const msg = parseMessage({ type: "oggy/origin/list" });
    expect(msg.type).toBe("oggy/origin/list");
  });

  it("accepts oggy/origin/setEnabled", () => {
    const msg = parseMessage({
      type: "oggy/origin/setEnabled",
      origin: "https://example.com",
      enabled: true,
    });
    expect(msg.type).toBe("oggy/origin/setEnabled");
  });

  it("accepts oggy/origin/delete", () => {
    const msg = parseMessage({ type: "oggy/origin/delete", origin: "https://example.com" });
    expect(msg.type).toBe("oggy/origin/delete");
  });

  it("accepts oggy/session/append", () => {
    const msg = parseMessage({
      type: "oggy/session/append",
      origin: "https://example.com",
      event: {
        kind: "click",
        locators: [],
        url: "https://example.com",
        t: 1000,
      },
    });
    expect(msg.type).toBe("oggy/session/append");
  });

  it("rejects unknown type", () => {
    expect(() => parseMessage({ type: "oggy/unknown" })).toThrow("Invalid message type");
  });

  it("rejects null", () => {
    expect(() => parseMessage(null)).toThrow("Invalid message");
  });

  it("rejects non-object", () => {
    expect(() => parseMessage("hello")).toThrow("Invalid message");
  });

  it("rejects missing type field", () => {
    expect(() => parseMessage({ foo: "bar" })).toThrow("Invalid message");
  });

  it("rejects numeric type", () => {
    expect(() => parseMessage({ type: 123 })).toThrow("Invalid message");
  });
});
