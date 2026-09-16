// ---------------------------------------------------------------------------
// Oggy e2e WebMCP helpers — page.evaluate wrappers
// ---------------------------------------------------------------------------

import { expect, type Page } from "@playwright/test";

/**
 * Get all WebMCP tools registered on the page.
 * Returns tool names and descriptions.
 */
export async function getRegisteredTools(
  page: Page,
): Promise<Array<{ name: string; description: string }>> {
  return page.evaluate(async () => {
    const mc = (document as any).modelContext;
    if (!mc || typeof mc.getTools !== "function") return [];
    try {
      const tools = await mc.getTools();
      return tools.map((t: any) => ({
        name: t.name,
        description: t.description || "",
      }));
    } catch {
      return [];
    }
  });
}

/**
 * Execute a named WebMCP tool with the given arguments.
 */
export async function executeTool(
  page: Page,
  toolName: string,
  args: Record<string, unknown>,
): Promise<string | null> {
  return page.evaluate(
    async (payload) => {
      const { name, input } = JSON.parse(payload) as {
        name: string;
        input: Record<string, unknown>;
      };
      const mc = (document as any).modelContext;
      if (!mc) return null;
      const tools = await mc.getTools();
      const tool = tools.find((t: any) => t.name === name);
      if (!tool) return null;
      const result = await mc.executeTool(tool, JSON.stringify(input));
      if (result == null) return null;
      return typeof result === "string" ? result : JSON.stringify(result);
    },
    JSON.stringify({ name: toolName, input: args }),
  );
}

/**
 * Check if document.modelContext exists on the page.
 */
export async function hasModelContext(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    return "modelContext" in document && !!(document as any).modelContext;
  });
}

/** Poll until Oggy-synthesized tools (excluding native demo_ping) are present. */
export async function waitForOggyTools(page: Page, min = 1): Promise<void> {
  await expect
    .poll(
      async () => {
        const tools = await getRegisteredTools(page);
        return tools.filter((t) => t.name !== "demo_ping").length;
      },
      { timeout: 15_000 },
    )
    .toBeGreaterThanOrEqual(min);
}
