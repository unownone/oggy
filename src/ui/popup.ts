// ---------------------------------------------------------------------------
// Oggy popup — record toggle + current-origin MCP toggle
// ---------------------------------------------------------------------------

import { browser } from "wxt/browser";
import {
  pickPageTabUrl,
  selectRecordableOrigin,
  type OggyMessage,
  type OggyResponse,
  type OriginBundle,
} from "@/core";

async function send(msg: OggyMessage): Promise<OggyResponse> {
  return browser.runtime.sendMessage(msg) as Promise<OggyResponse>;
}

async function getCurrentOrigin(): Promise<string | null> {
  const tabs = await browser.tabs.query({});
  const url = pickPageTabUrl(tabs);
  if (url) {
    try {
      return new URL(url).origin;
    } catch {
      // fall through to lastAccessed origin
    }
  }
  return (
    selectRecordableOrigin(
      tabs.map((t) => ({
        url: t.url,
        active: t.active,
        lastAccessed: (t as { lastAccessed?: number }).lastAccessed,
      })),
    ) ?? null
  );
}

function bindOnce(): void {
  const recordToggle = document.querySelector<HTMLButtonElement>(
    '[data-testid="oggy-record-toggle"]',
  );
  const mcpToggle = document.querySelector<HTMLButtonElement>(
    '[data-testid="oggy-mcp-toggle"]',
  );
  const openSidepanel = document.querySelector<HTMLButtonElement>(
    '[data-testid="oggy-open-sidepanel"]',
  );

  recordToggle?.addEventListener("click", async () => {
    const recResp = await send({ type: "oggy/record/status" });
    if (recResp.ok && "recording" in recResp) {
      if (recResp.recording.active) {
        await send({ type: "oggy/record/stop" });
      } else {
        await send({ type: "oggy/record/start" });
      }
      await render();
    }
  });

  mcpToggle?.addEventListener("click", async () => {
    const origin = await getCurrentOrigin();
    if (!origin) return;
    const pressed = mcpToggle.getAttribute("aria-pressed") === "true";
    await send({
      type: "oggy/origin/setEnabled",
      origin,
      enabled: !pressed,
    });
    await render();
  });

  openSidepanel?.addEventListener("click", async () => {
    try {
      await (browser as any).sidePanel.open({
        windowId: (await browser.windows.getCurrent()).id,
      });
    } catch {
      // sidePanel API may not be available
    }
  });
}

async function render(): Promise<void> {
  const originLabel = document.querySelector<HTMLElement>(
    '[data-testid="oggy-origin-label"]',
  );
  const recordToggle = document.querySelector<HTMLButtonElement>(
    '[data-testid="oggy-record-toggle"]',
  );
  const mcpToggle = document.querySelector<HTMLButtonElement>(
    '[data-testid="oggy-mcp-toggle"]',
  );
  const toolCount = document.querySelector<HTMLElement>(
    '[data-testid="oggy-tool-count"]',
  );

  const origin = await getCurrentOrigin();
  if (originLabel) originLabel.textContent = origin || "No active tab";

  // Recording state
  const recResp = await send({ type: "oggy/record/status" });
  if (recResp.ok && "recording" in recResp) {
    const rec = recResp.recording;
    if (recordToggle) {
      recordToggle.setAttribute("aria-pressed", String(rec.active));
      recordToggle.textContent = rec.active ? "⏹ Stop" : "⏺ Record";
    }
  }

  // Origin bundle
  if (origin) {
    const bundleResp = await send({ type: "oggy/origin/get", origin });
    if (bundleResp.ok && "bundle" in bundleResp) {
      const bundle = bundleResp.bundle as OriginBundle | null;
      if (mcpToggle) {
        mcpToggle.setAttribute(
          "aria-pressed",
          String(bundle?.enabled ?? false),
        );
        mcpToggle.textContent = bundle?.enabled ? "MCP: ON" : "MCP: OFF";
        // Enable whenever a bundle exists (sessions or synthesized MCP).
        mcpToggle.disabled = !bundle;
      }
      if (toolCount) {
        toolCount.textContent = String(bundle?.mcp?.tools.length ?? 0);
      }
    }
  } else if (mcpToggle) {
    mcpToggle.disabled = true;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  bindOnce();
  void render();
});
