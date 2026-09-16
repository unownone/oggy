// ---------------------------------------------------------------------------
// Oggy WebMCP bridge — polyfill, tool registration, recipe playback
// Runs in the MAIN world. Zero chrome.* dependencies.
// ---------------------------------------------------------------------------

import type { DomainMcp, ReplayStep, Locator } from "@/core";

// ── Polyfill bootstrap ────────────────────────────────────────────────────

/**
 * Ensure `document.modelContext` exists. Uses @mcp-b/webmcp-polyfill when
 * the native API is absent. No-op if already present.
 */
export async function ensureModelContext(): Promise<void> {
  if (
    typeof document !== "undefined" &&
    "modelContext" in document &&
    document.modelContext
  ) {
    return;
  }

  // Dynamic import so we don't bundle the polyfill when native is available
  try {
    const { initializeWebMCPPolyfill } = await import(
      "@mcp-b/webmcp-polyfill"
    );
    initializeWebMCPPolyfill();
  } catch {
    console.warn(
      "[oggy] WebMCP polyfill not available and native document.modelContext missing",
    );
  }
}

// ── Tool registration ─────────────────────────────────────────────────────

/**
 * Register all tools from a DomainMcp onto document.modelContext.
 * Returns an AbortController whose abort() unregisters all Oggy tools.
 */
export async function registerRecipes(
  mcp: DomainMcp,
): Promise<AbortController> {
  await ensureModelContext();

  const controller = new AbortController();
  const mc = (document as any).modelContext;

  if (!mc) {
    console.warn("[oggy] No modelContext available after polyfill attempt");
    return controller;
  }

  // Get existing tool names to detect collisions
  let existingNames: string[] = [];
  try {
    const existing = await mc.getTools();
    existingNames = existing.map((t: any) => t.name);
  } catch {
    // getTools may not be available yet
  }

  for (const recipe of mcp.tools) {
    const name = uniqueToolName(recipe.name, existingNames);
    existingNames.push(name);

    try {
      await mc.registerTool(
        {
          name,
          title: recipe.title || name,
          description: recipe.description,
          inputSchema: recipe.inputSchema,
          annotations: recipe.annotations,
          execute: async (args: Record<string, unknown>) => {
            for (const step of recipe.steps) {
              await playStep(step, args);
            }
            return `Executed ${name} (${recipe.steps.length} steps)`;
          },
        },
        { signal: controller.signal },
      );
    } catch (err) {
      console.warn(`[oggy] Failed to register tool "${name}":`, err);
    }
  }

  return controller;
}

// ── Collision resolution ──────────────────────────────────────────────────

export function uniqueToolName(
  desired: string,
  existing: string[],
): string {
  const set = new Set(existing);
  if (!set.has(desired)) return desired;

  const suffixed = `${desired}_oggy`;
  if (!set.has(suffixed)) return suffixed;

  let counter = 2;
  while (set.has(`${desired}_oggy_${counter}`)) counter++;
  return `${desired}_oggy_${counter}`;
}

// ── Recipe playback ───────────────────────────────────────────────────────

/**
 * Execute a single replay step against the live DOM.
 * `args` contains the tool's input parameters (keys match `step.arg`).
 */
export async function playStep(
  step: ReplayStep,
  args: Record<string, unknown>,
): Promise<void> {
  switch (step.type) {
    case "click": {
      const el = await resolveLocatorsWithWait(step.locators);
      if (el instanceof HTMLElement) el.click();
      break;
    }

    case "fill": {
      const el = await resolveLocatorsWithWait(step.locators);
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement
      ) {
        setNativeValue(el, String(args[step.arg] ?? ""));
      }
      break;
    }

    case "select": {
      const el = resolveLocators(step.locators);
      if (el instanceof HTMLSelectElement) {
        el.value = String(args[step.arg] ?? "");
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
      break;
    }

    case "submit": {
      const el = resolveLocators(step.locators);
      if (el) {
        const form = el.closest("form") || el;
        if (form instanceof HTMLFormElement) {
          form.requestSubmit();
        } else if (el instanceof HTMLElement) {
          el.click();
        }
      }
      break;
    }

    case "navigate": {
      if (step.urlArg && args[step.urlArg]) {
        window.location.href = String(args[step.urlArg]);
      } else if (step.urlTemplate) {
        window.location.href = step.urlTemplate;
      }
      break;
    }

    case "waitFor": {
      await waitForCondition(step);
      break;
    }

    default: {
      const _exhaustive: never = step;
      throw new Error(`Unhandled step type: ${(_exhaustive as ReplayStep).type}`);
    }
  }
}

// ── Locator resolution ────────────────────────────────────────────────────

function setNativeValue(
  el: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): void {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, "value");
  if (desc?.set) desc.set.call(el, value);
  else el.value = value;
  try {
    el.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        cancelable: true,
        inputType: "insertText",
        data: value,
      }),
    );
  } catch {
    el.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
  }
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

async function resolveLocatorsWithWait(locators: Locator[]): Promise<Element | null> {
  const immediate = resolveLocators(locators);
  if (immediate) return immediate;
  await waitForCondition({ type: "waitFor", locators }, 800);
  return resolveLocators(locators);
}

function resolveLocators(locators: Locator[]): Element | null {
  for (const loc of locators) {
    let el: Element | null = null;
    switch (loc.strategy) {
      case "testid":
        el = document.querySelector(`[data-testid="${loc.value}"]`);
        break;
      case "aria":
        // Format: "role[label]"
        {
          const match = loc.value.match(/^(\w+)\[(.+)\]$/);
          if (match) {
            el = document.querySelector(
              `[role="${match[1]}"][aria-label="${match[2]}"], ${match[1]}[aria-label="${match[2]}"]`,
            );
          }
        }
        break;
      case "id":
        el = document.getElementById(loc.value);
        break;
      case "name":
        el = document.querySelector(`[name="${loc.value}"]`);
        break;
      case "css":
        el = document.querySelector(loc.value);
        break;
    }
    if (el) return el;
  }
  return null;
}

async function waitForCondition(
  step: Extract<ReplayStep, { type: "waitFor" }>,
  timeout = 5000,
): Promise<void> {
  const interval = 200;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (step.locators && step.locators.length > 0) {
      if (resolveLocators(step.locators)) return;
    }
    if (step.urlIncludes && window.location.href.includes(step.urlIncludes)) {
      return;
    }
    await new Promise((r) => setTimeout(r, interval));
  }
}
