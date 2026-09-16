import { chromium, type BrowserContext, type Page } from "@playwright/test";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const repoRoot = resolveRepoRoot();

function resolveRepoRoot(): string {
  return path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
}

export function extensionPath(): string {
  return path.join(repoRoot, ".output", "chrome-mv3");
}

export function assertExtensionBuilt(): void {
  const dir = extensionPath();
  if (!existsSync(path.join(dir, "manifest.json"))) {
    throw new Error(
      `Built extension not found at ${dir}. Run \`npm run build\` first.`,
    );
  }
}

export async function launchExtensionContext(headed: boolean): Promise<{
  context: BrowserContext;
  extensionId: string;
}> {
  assertExtensionBuilt();
  const dir = extensionPath();
  const context = await chromium.launchPersistentContext("", {
    headless: headed ? false : true,
    args: [
      `--disable-extensions-except=${dir}`,
      `--load-extension=${dir}`,
      "--no-first-run",
      "--no-default-browser-check",
    ],
  });

  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent("serviceworker");
  const extensionId = worker.url().split("/")[2];
  return { context, extensionId };
}

export async function openPopup(
  context: BrowserContext,
  extensionId: string,
): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await page.waitForLoadState("domcontentloaded");
  return page;
}

export async function readOriginMcp(
  context: BrowserContext,
  origin: string,
): Promise<{
  tools: Array<{
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    steps: Array<{ type: string }>;
  }>;
} | null> {
  const [worker] = context.serviceWorkers();
  if (!worker) return null;
  return worker.evaluate(async (originKey) => {
    const data = await chrome.storage.local.get("oggy.origins");
    const origins = (data["oggy.origins"] || {}) as Record<
      string,
      { mcp?: { tools?: unknown[] } }
    >;
    const bundle = origins[originKey];
    if (!bundle?.mcp?.tools) return null;
    return {
      tools: bundle.mcp.tools as Array<{
        name: string;
        description: string;
        inputSchema: Record<string, unknown>;
        steps: Array<{ type: string }>;
      }>,
    };
  }, origin);
}

export async function getRegisteredToolNames(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const mc = (document as unknown as { modelContext?: { getTools: () => Promise<Array<{ name: string }>> } }).modelContext;
    if (!mc || typeof mc.getTools !== "function") return [];
    try {
      const tools = await mc.getTools();
      return tools.map((t) => t.name);
    } catch {
      return [];
    }
  });
}

export async function executeTool(
  page: Page,
  toolName: string,
  args: Record<string, unknown>,
): Promise<string | null> {
  return page.evaluate(
    async ({ name, input }) => {
      const mc = (document as unknown as {
        modelContext?: {
          getTools: () => Promise<Array<{ name: string }>>;
          executeTool: (tool: unknown, payload: string) => Promise<string>;
        };
      }).modelContext;
      if (!mc) return null;
      const tools = await mc.getTools();
      const tool = tools.find((t) => t.name === name);
      if (!tool) return null;
      return mc.executeTool(tool, JSON.stringify(input ?? {}));
    },
    { name: toolName, input: args },
  );
}

export function toOrigin(href: string): string {
  return new URL(href).origin;
}
