import { describe, it, expect } from "vitest";
import {
  toOriginKey,
  isRecordableHref,
  selectRecordableOrigin,
  pickPageTabUrl,
} from "@/core";

describe("toOriginKey", () => {
  it("strips path and query from a full URL", () => {
    expect(toOriginKey("https://app.example.com/page?q=1#hash")).toBe(
      "https://app.example.com",
    );
  });

  it("preserves port numbers", () => {
    expect(toOriginKey("http://localhost:3000/api")).toBe("http://localhost:3000");
  });

  it("treats http and https as different origins", () => {
    const http = toOriginKey("http://example.com/foo");
    const https = toOriginKey("https://example.com/foo");
    expect(http).not.toBe(https);
    expect(http).toBe("http://example.com");
    expect(https).toBe("https://example.com");
  });

  it("handles bare origin strings", () => {
    expect(toOriginKey("https://example.com")).toBe("https://example.com");
  });

  it("returns the input for invalid URLs", () => {
    expect(toOriginKey("not-a-url")).toBe("not-a-url");
  });

  it("strips user info", () => {
    expect(toOriginKey("https://user:pass@example.com/path")).toBe(
      "https://example.com",
    );
  });
});

describe("isRecordableHref", () => {
  it("accepts http and https", () => {
    expect(isRecordableHref("http://127.0.0.1:4173/")).toBe(true);
    expect(isRecordableHref("https://example.com/path")).toBe(true);
  });

  it("rejects extension and browser URLs", () => {
    expect(isRecordableHref("chrome-extension://abc/popup.html")).toBe(false);
    expect(isRecordableHref("chrome://extensions")).toBe(false);
    expect(isRecordableHref("about:blank")).toBe(false);
  });
});

describe("selectRecordableOrigin", () => {
  it("prefers the active http(s) tab", () => {
    expect(
      selectRecordableOrigin([
        { url: "chrome-extension://abc/popup.html", active: true },
        { url: "http://127.0.0.1:4173/", active: true },
      ]),
    ).toBe("http://127.0.0.1:4173");
  });

  it("falls back to the most recently accessed web tab when the active tab is not recordable", () => {
    expect(
      selectRecordableOrigin([
        { url: "chrome-extension://abc/popup.html", active: true, lastAccessed: 9 },
        { url: "http://127.0.0.1:4173/", active: false, lastAccessed: 5 },
        { url: "https://example.com/", active: false, lastAccessed: 8 },
      ]),
    ).toBe("https://example.com");
  });

  it("returns undefined when no web tab exists", () => {
    expect(
      selectRecordableOrigin([
        { url: "chrome-extension://abc/popup.html", active: true },
      ]),
    ).toBeUndefined();
  });
});

describe("pickPageTabUrl", () => {
  it("prefers the active http(s) tab", () => {
    expect(
      pickPageTabUrl([
        { active: false, url: "http://127.0.0.1:4173/" },
        { active: true, url: "https://app.example.com/page" },
      ]),
    ).toBe("https://app.example.com/page");
  });

  it("skips chrome-extension tabs even when they are active", () => {
    expect(
      pickPageTabUrl([
        { active: true, url: "chrome-extension://abcdef/popup.html" },
        { active: false, url: "http://127.0.0.1:4173/" },
      ]),
    ).toBe("http://127.0.0.1:4173/");
  });

  it("returns undefined when there is no http(s) tab", () => {
    expect(
      pickPageTabUrl([
        { active: true, url: "chrome-extension://abcdef/popup.html" },
      ]),
    ).toBeUndefined();
  });
});
