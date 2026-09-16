import type { BuiltinHandlerId, Locator, ToolRecipe } from "@/core";

export async function playBuiltin(
  handler: BuiltinHandlerId,
  args: Record<string, unknown>,
  recipe: ToolRecipe,
  playSteps: (recipe: ToolRecipe, args: Record<string, unknown>) => Promise<void>,
): Promise<string> {
  switch (handler) {
    case "click":
    case "click_object": {
      const el = findObject(args, recipe.steps.flatMap(stepLocators));
      if (!(el instanceof HTMLElement)) {
        return fail(handler, args, "element not found");
      }
      el.scrollIntoView({ block: "center", inline: "nearest" });
      el.dispatchEvent(new PointerEvent("pointermove", { bubbles: true }));
      el.click();
      return `Clicked ${labelOf(el)}`;
    }
    case "scroll": {
      const el = findObject(args, recipe.steps.flatMap(stepLocators));
      if (el instanceof HTMLElement) {
        el.scrollIntoView({ block: "center", inline: "nearest" });
        return `Scrolled to ${labelOf(el)}`;
      }
      window.scrollBy(Number(args.deltaX ?? 0), Number(args.deltaY ?? 0));
      return "Scrolled page";
    }
    case "move": {
      const el = findObject(args, recipe.steps.flatMap(stepLocators));
      if (!(el instanceof HTMLElement)) {
        return fail(handler, args, "element not found");
      }
      el.dispatchEvent(new PointerEvent("pointermove", { bubbles: true }));
      el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
      return `Moved over ${labelOf(el)}`;
    }
    case "slide": {
      const el = findObject(args, recipe.steps.flatMap(stepLocators));
      if (!(el instanceof HTMLElement)) {
        return fail(handler, args, "element not found");
      }
      const fromX = Number(args.fromX ?? 0);
      const fromY = Number(args.fromY ?? 0);
      const toX = Number(args.toX ?? 10);
      const toY = Number(args.toY ?? 0);
      el.dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true, clientX: fromX, clientY: fromY }),
      );
      el.dispatchEvent(
        new PointerEvent("pointermove", { bubbles: true, clientX: toX, clientY: toY }),
      );
      el.dispatchEvent(
        new PointerEvent("pointerup", { bubbles: true, clientX: toX, clientY: toY }),
      );
      return `Slid ${labelOf(el)}`;
    }
    case "input": {
      const el = findObject(args, recipe.steps.flatMap(stepLocators));
      if (
        !(
          el instanceof HTMLInputElement ||
          el instanceof HTMLTextAreaElement ||
          el instanceof HTMLSelectElement
        )
      ) {
        return fail(handler, args, "input not found");
      }
      const value = String(args.value ?? "");
      if (el instanceof HTMLSelectElement) {
        el.value = value;
        el.dispatchEvent(new Event("change", { bubbles: true }));
      } else {
        const proto =
          el instanceof HTMLTextAreaElement
            ? HTMLTextAreaElement.prototype
            : HTMLInputElement.prototype;
        const desc = Object.getOwnPropertyDescriptor(proto, "value");
        if (desc?.set) desc.set.call(el, value);
        else el.value = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
      return `Filled ${labelOf(el)}`;
    }
    case "read":
    case "output": {
      const el = findObject(args, recipe.steps.flatMap(stepLocators));
      const text = el
        ? (el.textContent ?? "").trim().slice(0, 2000)
        : document.body?.innerText?.slice(0, 2000) ?? "";
      if (!el && handler === "read") {
        return fail(handler, args, "element not found; call oggy_update_tool if locators drifted");
      }
      return text || "(empty)";
    }
    case "find_listing": {
      await playSteps(recipe, args);
      const listings = document.querySelectorAll(
        ".s-result-item, [data-component-type='s-search-result']",
      );
      const index = Number(args.index ?? 0);
      const names = Array.from(listings)
        .slice(0, 10)
        .map((node, i) => `${i + 1}. ${(node.textContent ?? "").trim().slice(0, 80)}`);
      if (index > 0 && listings[index - 1] instanceof HTMLElement) {
        const target =
          listings[index - 1].querySelector("a") ?? listings[index - 1];
        if (target instanceof HTMLElement) target.click();
      }
      return names.length
        ? `Listings for "${String(args.query ?? "")}":\n${names.join("\n")}`
        : fail(handler, args, "no listings found");
    }
    case "add_to_cart": {
      await playSteps(recipe, args);
      const btn =
        findObject({ object: args.listing ?? "Add to Cart" }, recipe.steps.flatMap(stepLocators)) ??
        document.getElementById("add-to-cart-button");
      if (btn instanceof HTMLElement) btn.click();
      return btn
        ? "Clicked add to cart"
        : fail(handler, args, "add-to-cart control not found");
    }
    case "sign_up":
    case "login": {
      await playSteps(recipe, args);
      fillNamed("email", args.email);
      fillNamed("username", args.username);
      fillNamed("password", args.password);
      const submit =
        document.querySelector<HTMLElement>(
          'button[type="submit"], input[type="submit"]',
        );
      submit?.click();
      return `Submitted ${handler}`;
    }
    case "oggy_update_tool":
    case "oggy_list_skills":
      return `${handler} must be handled by the registrar, not playBuiltin`;
    default: {
      const _exhaustive: never = handler;
      throw new Error(`Unhandled builtin: ${_exhaustive}`);
    }
  }
}

function fail(
  handler: string,
  args: Record<string, unknown>,
  detail: string,
): string {
  return (
    `Tool "${handler}" failed: ${detail}. ` +
    `If locators are invalid, call oggy_update_tool with toolName="${handler}" ` +
    `and a patch (the user must approve). Args=${JSON.stringify(args)}`
  );
}

function stepLocators(step: ToolRecipe["steps"][number]): Locator[] {
  if ("locators" in step && step.locators) return step.locators;
  return [];
}

function findObject(
  args: Record<string, unknown>,
  fallback: Locator[],
): Element | null {
  const object = String(args.object ?? args.fieldName ?? args.listing ?? "").trim();
  const index = Number(args.index ?? 1);
  if (object) {
    const byTestId = document.querySelector(`[data-testid="${cssEscape(object)}"]`);
    if (byTestId) return byTestId;
    const byId = document.getElementById(object);
    if (byId) return byId;
    const matches = findByText(object);
    if (matches.length > 0) {
      return matches[Math.max(0, index - 1)] ?? matches[0];
    }
  }
  for (const loc of fallback) {
    const el = resolveLocator(loc);
    if (el) return el;
  }
  return null;
}

function findByText(text: string): HTMLElement[] {
  const needle = text.toLowerCase();
  const nodes = document.querySelectorAll<HTMLElement>(
    "a, button, [role=button], input, label, h1, h2, h3, [data-testid], .s-result-item",
  );
  return Array.from(nodes).filter((el) => {
    const hay =
      `${el.getAttribute("aria-label") ?? ""} ${el.textContent ?? ""} ${el.getAttribute("value") ?? ""}`.toLowerCase();
    return hay.includes(needle);
  });
}

function resolveLocator(loc: Locator): Element | null {
  switch (loc.strategy) {
    case "testid":
      return document.querySelector(`[data-testid="${loc.value}"]`);
    case "id":
      return document.getElementById(loc.value);
    case "name":
      return document.querySelector(`[name="${loc.value}"]`);
    case "css":
      return document.querySelector(loc.value);
    case "aria": {
      const match = loc.value.match(/^(\w+)\[(.+)\]$/);
      if (!match) return null;
      return document.querySelector(
        `[role="${match[1]}"][aria-label="${match[2]}"], ${match[1]}[aria-label="${match[2]}"]`,
      );
    }
    default: {
      const _exhaustive: never = loc.strategy;
      throw new Error(`Unhandled locator: ${_exhaustive}`);
    }
  }
}

function fillNamed(name: string, value: unknown): void {
  if (value == null || value === "") return;
  const el =
    document.querySelector<HTMLInputElement>(`input[name="${name}"], input[type="${name}"]`) ??
    document.querySelector<HTMLInputElement>(`input[autocomplete*="${name}"]`);
  if (!el) return;
  el.value = String(value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function labelOf(el: Element): string {
  return (
    el.getAttribute("aria-label") ||
    el.getAttribute("data-testid") ||
    (el.textContent ?? "").trim().slice(0, 80) ||
    el.tagName.toLowerCase()
  );
}

function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}
