// ---------------------------------------------------------------------------
// Oggy popup — record toggle + current-origin MCP toggle
// ---------------------------------------------------------------------------

import { browser } from "wxt/browser";
import type { OggyMessage, OggyResponse, RecordingState, OriginBundle } from "@/core";

async function send(msg: OggyMessage): Promise<OggyResponse> {
  return browser.runtime.sendMessage(msg) as Promise<OggyResponse>;
}

async function getCurrentOrigin(): Promise<string | null> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return null;
  try {
    return new URL(tab.url).origin;
  } catch {
    return null;
  }
}

async function render(): Promise<void> {
  const originLabel = document.querySelector<HTMLElement>('[data-testid="oggy-origin-label"]');
  const recordToggle = document.querySelector<HTMLButtonElement>('[data-testid="oggy-record-toggle"]');
  const mcpToggle = document.querySelector<HTMLButtonElement>('[data-testid="oggy-mcp-toggle"]');
  const toolCount = document.querySelector<HTMLElement>('[data-testid="oggy-tool-count"]');
  const openSidepanel = document.querySelector<HTMLButtonElement>('[data-testid="oggy-open-sidepanel"]');

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
        mcpToggle.setAttribute("aria-pressed", String(bundle?.enabled ?? false));
        mcpToggle.textContent = bundle?.enabled ? "MCP: ON" : "MCP: OFF";
        mcpToggle.disabled = !bundle?.mcp;
      }
      if (toolCount) {
        toolCount.textContent = String(bundle?.mcp?.tools.length ?? 0);
      }
    }
  }

  // Event listeners
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
    if (!origin) return;
    const pressed = mcpToggle.getAttribute("aria-pressed") === "true";
    await send({ type: "oggy/origin/setEnabled", origin, enabled: !pressed });
    await render();
  });

  openSidepanel?.addEventListener("click", async () => {
    try {
      await (browser as any).sidePanel.open({ windowId: (await browser.windows.getCurrent()).id });
    } catch {
      // sidePanel API may not be available
    }
  });
}

document.addEventListener("DOMContentLoaded", render);
