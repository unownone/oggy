/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import { scoreLocators } from "@/core";

function makeEl(tag: string, attrs: Record<string, string> = {}): Element {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, v);
  }
  document.body.appendChild(el);
  return el;
}

describe("scoreLocators", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("prefers data-testid as highest priority", () => {
    const el = makeEl("button", {
      "data-testid": "my-btn",
      "aria-label": "Click me",
      id: "btn1",
      name: "submit",
    });
    const locs = scoreLocators(el);
    expect(locs[0]).toEqual({ strategy: "testid", value: "my-btn" });
  });

  it("produces aria after testid", () => {
    const el = makeEl("button", {
      "data-testid": "my-btn",
      "aria-label": "Click me",
      role: "button",
    });
    const locs = scoreLocators(el);
    expect(locs[0].strategy).toBe("testid");
    expect(locs[1].strategy).toBe("aria");
    expect(locs[1].value).toContain("Click me");
  });

  it("uses id when no testid or aria", () => {
    const el = makeEl("input", { id: "search-input" });
    const locs = scoreLocators(el);
    expect(locs[0].strategy).toBe("id");
    expect(locs[0].value).toBe("search-input");
  });

  it("uses name when no testid/aria/id", () => {
    const el = makeEl("input", { name: "q" });
    const locs = scoreLocators(el);
    expect(locs[0].strategy).toBe("name");
    expect(locs[0].value).toBe("q");
  });

  it("always includes css fallback as last strategy", () => {
    const el = makeEl("div", {});
    const locs = scoreLocators(el);
    expect(locs[locs.length - 1].strategy).toBe("css");
  });

  it("order is testid → aria → id → name → css", () => {
    const el = makeEl("input", {
      "data-testid": "t",
      "aria-label": "a",
      id: "i",
      name: "n",
    });
    const strategies = scoreLocators(el).map((l) => l.strategy);
    expect(strategies).toEqual(["testid", "aria", "id", "name", "css"]);
  });
});
