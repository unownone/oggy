import { describe, it, expect } from "vitest";
import { isSensitiveField, redactValue } from "@/core";

describe("isSensitiveField", () => {
  it("detects type=password", () => {
    expect(isSensitiveField({ type: "password" })).toBe(true);
  });

  it("detects type=hidden", () => {
    expect(isSensitiveField({ type: "hidden" })).toBe(true);
  });

  it("detects autocomplete cc-number", () => {
    expect(isSensitiveField({ autocomplete: "cc-number" })).toBe(true);
  });

  it("detects autocomplete cc-csc", () => {
    expect(isSensitiveField({ autocomplete: "cc-csc" })).toBe(true);
  });

  it("detects autocomplete new-password", () => {
    expect(isSensitiveField({ autocomplete: "new-password" })).toBe(true);
  });

  it("detects autocomplete one-time-code", () => {
    expect(isSensitiveField({ autocomplete: "one-time-code" })).toBe(true);
  });

  it("detects autocomplete with section prefix", () => {
    expect(isSensitiveField({ autocomplete: "section-login current-password" })).toBe(true);
  });

  it("detects name=password", () => {
    expect(isSensitiveField({ name: "password" })).toBe(true);
  });

  it("detects name=pwd", () => {
    expect(isSensitiveField({ name: "pwd" })).toBe(true);
  });

  it("detects name containing ssn", () => {
    expect(isSensitiveField({ name: "ssn" })).toBe(true);
  });

  it("detects name containing cvv", () => {
    expect(isSensitiveField({ name: "cvv" })).toBe(true);
  });

  it("detects name containing otp", () => {
    expect(isSensitiveField({ name: "otp_code" })).toBe(true);
  });

  it("detects name=creditcard", () => {
    expect(isSensitiveField({ name: "credit-card-number" })).toBe(true);
  });

  it("detects name=card_num", () => {
    expect(isSensitiveField({ name: "card_num" })).toBe(true);
  });

  it("detects name=secret_key", () => {
    expect(isSensitiveField({ name: "secret_key" })).toBe(true);
  });

  it("detects name=api_token", () => {
    expect(isSensitiveField({ name: "api_token" })).toBe(true);
  });

  it("returns false for type=text", () => {
    expect(isSensitiveField({ type: "text" })).toBe(false);
  });

  it("returns false for name=email", () => {
    expect(isSensitiveField({ name: "email" })).toBe(false);
  });

  it("returns false for name=q (search)", () => {
    expect(isSensitiveField({ name: "q" })).toBe(false);
  });

  it("returns false for empty object", () => {
    expect(isSensitiveField({})).toBe(false);
  });
});

describe("redactValue", () => {
  it("returns undefined for password fields", () => {
    expect(redactValue("secret123", { type: "password" })).toBeUndefined();
  });

  it("returns undefined for cc-number autocomplete", () => {
    expect(redactValue("4111111111111111", { autocomplete: "cc-number" })).toBeUndefined();
  });

  it("returns the original value for normal search text", () => {
    expect(redactValue("hello world", { name: "q", type: "text" })).toBe("hello world");
  });

  it("returns the original value for email field", () => {
    expect(redactValue("user@example.com", { name: "email", type: "email" })).toBe(
      "user@example.com",
    );
  });

  it("returns undefined for fields named password", () => {
    expect(redactValue("hunter2", { name: "password" })).toBeUndefined();
  });
});
