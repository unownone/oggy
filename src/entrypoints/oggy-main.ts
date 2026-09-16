// ---------------------------------------------------------------------------
// Oggy MAIN world script — runs in the page's JS context
// Owns WebMCP polyfill, tool registration, and recipe playback.
// No chrome.* / browser.* APIs here.
// ---------------------------------------------------------------------------

import { BUS } from "@/core";
import type { DomainMcp } from "@/core";
import { ensureModelContext, registerRecipes } from "@/webmcp";

export default defineUnlistedScript(() => {
  let currentController: AbortController | null = null;

  void boot();

  async function boot() {
    await ensureModelContext();
    window.dispatchEvent(new CustomEvent(BUS.hello));
  }

  // Listen for register command
  window.addEventListener(BUS.register, (async (e: CustomEvent) => {
    const mcp = e.detail?.mcp as DomainMcp | undefined;
    if (!mcp || !mcp.tools || mcp.tools.length === 0) return;

    // Abort any previous registration
    if (currentController) {
      currentController.abort();
      currentController = null;
    }

    try {
      await ensureModelContext();
      currentController = await registerRecipes(mcp);
    } catch (err) {
      console.error("[oggy] Failed to register tools:", err);
    }
  }) as EventListener);

  // Listen for abort command
  window.addEventListener(BUS.abort, () => {
    if (currentController) {
      currentController.abort();
      currentController = null;
    }
  });

  // Hook history for navigation recording
  hookHistory();
});

// ── History hooks ─────────────────────────────────────────────────────────

function hookHistory(): void {
  const originalPush = history.pushState.bind(history);
  const originalReplace = history.replaceState.bind(history);

  history.pushState = function (...args: Parameters<typeof history.pushState>) {
    const from = window.location.href;
    originalPush(...args);
    emitNavigate(from, window.location.href, "history");
  };

  history.replaceState = function (...args: Parameters<typeof history.replaceState>) {
    const from = window.location.href;
    originalReplace(...args);
    emitNavigate(from, window.location.href, "history");
  };

  window.addEventListener("popstate", () => {
    emitNavigate("", window.location.href, "history");
  });
}

function emitNavigate(from: string, to: string, how: "link" | "history" | "reload"): void {
  window.dispatchEvent(
    new CustomEvent(BUS.record, {
      detail: {
        event: {
          kind: "navigate" as const,
          from,
          to,
          how,
          t: Date.now(),
        },
      },
    }),
  );
}
