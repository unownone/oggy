/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import {
  shouldRecordTarget,
  resolveInteractiveTarget,
  toRecordedEvent,
} from "@/recorder";

describe("shouldRecordTarget", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });
  it("records buttons, inputs, and forms", () => {
    const btn = document.createElement("button");
    const input = document.createElement("input");
    const form = document.createElement("form");
    expect(shouldRecordTarget(btn)).toBe(true);
    expect(shouldRecordTarget(input)).toBe(true);
    expect(shouldRecordTarget(form)).toBe(true);
  });

  it("records clicks on elements nested inside a button", () => {
    const btn = document.createElement("button");
    const span = document.createElement("span");
    btn.appendChild(span);
    document.body.appendChild(btn);
    expect(shouldRecordTarget(span)).toBe(true);
    expect(resolveInteractiveTarget(span)).toBe(btn);
  });

  it("ignores inert text nodes' parent divs", () => {
    const div = document.createElement("div");
    expect(shouldRecordTarget(div)).toBe(false);
  });
});

describe("toRecordedEvent", () => {
  it("captures input+submit as synthesizable events", () => {
    const form = document.createElement("form");
    form.id = "search-form";
    const input = document.createElement("input");
    input.name = "q";
    input.setAttribute("data-testid", "demo-search-input");
    input.value = "shoes";
    const btn = document.createElement("button");
    btn.setAttribute("data-testid", "demo-search-submit");
    btn.textContent = "Search";
    form.appendChild(input);
    form.appendChild(btn);
    document.body.appendChild(form);

    const inputEv = new Event("input", { bubbles: true });
    Object.defineProperty(inputEv, "target", { value: input });
    const recordedInput = toRecordedEvent(inputEv, "http://127.0.0.1:4173/");
    expect(recordedInput?.kind).toBe("input");
    if (recordedInput?.kind === "input") {
      expect(recordedInput.fieldName).toBe("q");
      expect(recordedInput.value).toBe("shoes");
    }

    const clickEv = new Event("click", { bubbles: true });
    Object.defineProperty(clickEv, "target", { value: btn });
    const recordedClick = toRecordedEvent(clickEv, "http://127.0.0.1:4173/");
    expect(recordedClick?.kind).toBe("click");
    if (recordedClick?.kind === "click") {
      expect(recordedClick.text).toBe("Search");
    }

    const submitEv = new Event("submit", { bubbles: true });
    Object.defineProperty(submitEv, "target", { value: form });
    const recordedSubmit = toRecordedEvent(submitEv, "http://127.0.0.1:4173/");
    expect(recordedSubmit?.kind).toBe("submit");
  });

  it("redacts password values", () => {
    const input = document.createElement("input");
    input.type = "password";
    input.name = "password";
    input.value = "superSecretP@ss123";
    document.body.appendChild(input);

    const ev = new Event("input", { bubbles: true });
    Object.defineProperty(ev, "target", { value: input });
    const recorded = toRecordedEvent(ev, "http://127.0.0.1:4173/");
    expect(recorded?.kind).toBe("input");
    if (recorded?.kind === "input") {
      expect(recorded.value).toBeUndefined();
    }
  });
});
