import { describe, it, expect } from "vitest";
import { toOriginKey, pickPageTabUrl } from "@/core";

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
