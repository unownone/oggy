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

  it("css path uniquely resolves the 3rd result in a list", () => {
    const list = document.createElement("div");
    list.id = "rso";
    for (let i = 1; i <= 5; i++) {
      const g = document.createElement("div");
      g.className = "g";
      const a = document.createElement("a");
      a.href = `#r${i}`;
      a.textContent = `Result ${i}`;
      g.appendChild(a);
      list.appendChild(g);
    }
    document.body.appendChild(list);

    const third = list.querySelectorAll("a")[2];
    const css = scoreLocators(third).find((l) => l.strategy === "css")!.value;
    expect(css).toContain("nth-of-type(3)");
    expect(document.querySelector(css)).toBe(third);
    expect(document.querySelector(css)?.textContent).toBe("Result 3");
  });

  it("does not stop the css path on a repeated data-testid (list items)", () => {
    const list = document.createElement("div");
    list.id = "timeline";
    for (let i = 1; i <= 3; i++) {
      const cell = document.createElement("article");
      cell.className = "cellInnerDiv";
      cell.setAttribute("data-testid", "cellInnerDiv");
      const btn = document.createElement("button");
      btn.className = "open-post";
      btn.textContent = "View comments";
      cell.appendChild(btn);
      list.appendChild(cell);
    }
    document.body.appendChild(list);

    const thirdBtn = list.querySelectorAll("button")[2];
    const css = scoreLocators(thirdBtn).find((l) => l.strategy === "css")!.value;
    expect(css).toContain("nth-of-type(3)");
    expect(document.querySelector(css)).toBe(thirdBtn);
  });
});
