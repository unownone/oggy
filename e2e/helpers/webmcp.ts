// ---------------------------------------------------------------------------
// Oggy e2e WebMCP helpers — page.evaluate wrappers
// ---------------------------------------------------------------------------

import type { Page } from "@playwright/test";

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
    async ({ name, input }) => {
      const mc = (document as any).modelContext;
      if (!mc) return null;
      const tools = await mc.getTools();
      const tool = tools.find((t: any) => t.name === name);
      if (!tool) return null;
      return mc.executeTool(tool, input);
    },
    { name: toolName, input: args },
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
