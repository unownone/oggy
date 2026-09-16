import type { Page } from "@playwright/test";
import { executeTool, getRegisteredToolNames } from "./browser";

export interface StoredTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  steps: Array<{ type: string }>;
}

export interface ClassifiedTools {
  search?: StoredTool;
  click?: StoredTool;
}

export function classifyTools(tools: StoredTool[]): ClassifiedTools {
  const withFill = tools.filter(
    (t) =>
      t.steps.some((s) => s.type === "fill") || hasInputProps(t.inputSchema),
  );
  const search = withFill[0];
  const click =
    tools.find(
      (t) =>
        t !== search &&
        t.steps.some((s) => s.type === "click") &&
        !t.steps.some((s) => s.type === "fill"),
    ) ||
    (search && search.steps.some((s) => s.type === "click") ? search : undefined);
  return { search, click };
}

function hasInputProps(schema: Record<string, unknown>): boolean {
  const props = schema?.properties;
  return Boolean(props && typeof props === "object" && Object.keys(props).length > 0);
}

export function argsForQuery(
  tool: StoredTool,
  query: string,
): Record<string, unknown> {
  const props = (tool.inputSchema?.properties || {}) as Record<string, unknown>;
  const keys = Object.keys(props);
  if (keys.length === 0) return {};
  return { [keys[0]]: query };
}

export async function waitForInjectedTools(
  page: Page,
  timeoutMs = 8_000,
): Promise<string[]> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const names = await getRegisteredToolNames(page);
    if (names.length > 0) return names;
    await page.waitForTimeout(200);
  }
  return getRegisteredToolNames(page);
}

export async function replayVariant(
  page: Page,
  tools: ClassifiedTools,
  query: string,
): Promise<{ ok: boolean; detail: string }> {
  if (!tools.search) {
    return { ok: false, detail: "no search tool was synthesized" };
  }
  const registered = await waitForInjectedTools(page);
  const searchName = matchName(tools.search.name, registered);
  if (!searchName) {
    return {
      ok: false,
      detail: `search tool "${tools.search.name}" not on document.modelContext (have ${registered.join(", ") || "none"})`,
    };
  }

  const args = argsForQuery(tools.search, query);
  try {
    await executeTool(page, searchName, args);
  } catch (err) {
    return { ok: false, detail: `search execute failed: ${String(err)}` };
  }

  if (tools.click && tools.click.name !== tools.search.name) {
    const clickName = matchName(tools.click.name, registered);
    if (!clickName) {
      return {
        ok: false,
        detail: `click tool "${tools.click.name}" not injected`,
      };
    }
    await page.waitForTimeout(400);
    try {
      await executeTool(page, clickName, {});
    } catch (err) {
      return { ok: false, detail: `click execute failed: ${String(err)}` };
    }
  }

  await page.waitForTimeout(400);
  return { ok: true, detail: "tools executed" };
}

function matchName(desired: string, registered: string[]): string | undefined {
  if (registered.includes(desired)) return desired;
  return registered.find(
    (n) => n === `${desired}_oggy` || n.startsWith(`${desired}_oggy_`),
  );
}
