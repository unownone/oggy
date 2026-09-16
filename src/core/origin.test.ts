import { describe, it, expect } from "vitest";
import { toOriginKey } from "@/core";

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
