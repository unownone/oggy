/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import { playStep } from "@/webmcp";
import type { ReplayStep } from "@/core";

describe("playStep", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("fill step sets input value and dispatches events", async () => {
    const input = document.createElement("input");
    input.setAttribute("data-testid", "search-input");
    document.body.appendChild(input);

    const events: string[] = [];
    input.addEventListener("input", () => events.push("input"));
    input.addEventListener("change", () => events.push("change"));

    const step: ReplayStep = {
      type: "fill",
      locators: [{ strategy: "testid", value: "search-input" }],
      arg: "q",
    };

    await playStep(step, { q: "oggy test" });

    expect(input.value).toBe("oggy test");
    expect(events).toContain("input");
    expect(events).toContain("change");
  });

  it("click step clicks a button", async () => {
    const btn = document.createElement("button");
    btn.setAttribute("data-testid", "submit-btn");
    document.body.appendChild(btn);

    let clicked = false;
    btn.addEventListener("click", () => {
      clicked = true;
    });

    const step: ReplayStep = {
      type: "click",
      locators: [{ strategy: "testid", value: "submit-btn" }],
    };

    await playStep(step, {});
    expect(clicked).toBe(true);
  });

  it("fill+click recipe mutates demo-like DOM", async () => {
    // Set up a mini demo page
    const input = document.createElement("input");
    input.setAttribute("data-testid", "demo-search-input");
    input.setAttribute("name", "q");
    document.body.appendChild(input);

    const result = document.createElement("div");
    result.setAttribute("data-testid", "demo-result");
    document.body.appendChild(result);

    const btn = document.createElement("button");
    btn.setAttribute("data-testid", "demo-search-submit");
    btn.addEventListener("click", () => {
      result.textContent = `Results for "${input.value}"`;
    });
    document.body.appendChild(btn);

    // Play fill step
    await playStep(
      { type: "fill", locators: [{ strategy: "testid", value: "demo-search-input" }], arg: "q" },
      { q: "oggy" },
    );

    // Play click step
    await playStep(
      { type: "click", locators: [{ strategy: "testid", value: "demo-search-submit" }] },
      {},
    );

    expect(input.value).toBe("oggy");
    expect(result.textContent).toBe('Results for "oggy"');
  });

  it("select step changes a select element", async () => {
    const select = document.createElement("select");
    select.setAttribute("data-testid", "category");
    select.innerHTML = '<option value="a">A</option><option value="b">B</option>';
    document.body.appendChild(select);

    let changed = false;
    select.addEventListener("change", () => {
      changed = true;
    });

    await playStep(
      { type: "select", locators: [{ strategy: "testid", value: "category" }], arg: "cat" },
      { cat: "b" },
    );

    expect(select.value).toBe("b");
    expect(changed).toBe(true);
  });

  it("gracefully handles missing element", async () => {
    const step: ReplayStep = {
      type: "click",
      locators: [{ strategy: "testid", value: "nonexistent" }],
    };

    // Should not throw
    await expect(playStep(step, {})).resolves.toBeUndefined();
  });

  it("scroll step into view does not throw", async () => {
    const el = document.createElement("div");
    el.setAttribute("data-testid", "card");
    el.scrollIntoView = () => undefined;
    document.body.appendChild(el);
    await expect(
      playStep(
        { type: "scroll", locators: [{ strategy: "testid", value: "card" }] },
        {},
      ),
    ).resolves.toBeUndefined();
  });
});
