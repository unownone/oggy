import { describe, it, expect } from "vitest";
import { sanitizeNetwork } from "@/recorder";

describe("sanitizeNetwork", () => {
  it("strips query parameters from URL", () => {
    const event = sanitizeNetwork({
      method: "GET",
      url: "https://api.example.com/search?q=secret&token=abc123",
      status: 200,
    });
    expect(event.kind).toBe("network");
    expect(event.urlPattern).toBe("https://api.example.com/search");
    expect(event.urlPattern).not.toContain("secret");
    expect(event.urlPattern).not.toContain("abc123");
  });

  it("uppercases the method", () => {
    const event = sanitizeNetwork({
      method: "post",
      url: "https://api.example.com/data",
      status: 201,
    });
    expect(event.method).toBe("POST");
  });

  it("preserves status code", () => {
    const event = sanitizeNetwork({
      method: "GET",
      url: "https://api.example.com/data",
      status: 404,
    });
    expect(event.status).toBe(404);
  });

  it("handles URLs without query strings", () => {
    const event = sanitizeNetwork({
      method: "GET",
      url: "https://api.example.com/users/123",
    });
    expect(event.urlPattern).toBe("https://api.example.com/users/123");
  });

  it("handles malformed URLs gracefully", () => {
    const event = sanitizeNetwork({
      method: "GET",
      url: "not-a-url?secret=value",
    });
    expect(event.urlPattern).toBe("not-a-url");
    expect(event.urlPattern).not.toContain("secret");
  });

  it("does not include headers in the output", () => {
    const headers = new Headers();
    headers.set("Authorization", "Bearer secret");
    headers.set("Cookie", "session=abc123");

    const event = sanitizeNetwork({
      method: "GET",
      url: "https://api.example.com/data",
      status: 200,
      headers,
    });

    // The event should not contain any header info
    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain("Bearer");
    expect(serialized).not.toContain("secret");
    expect(serialized).not.toContain("session=abc123");
  });
});
