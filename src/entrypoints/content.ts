// ---------------------------------------------------------------------------
// Oggy content script — runs in ISOLATED world
// Bridges recording events and MCP injection between page and background.
// ---------------------------------------------------------------------------

import { browser } from "wxt/browser";
import { BUS, toOriginKey } from "@/core";
import type { OggyMessage, OggyResponse, RecordedEvent, DomainMcp } from "@/core";
import { shouldRecordTarget, toRecordedEvent } from "@/recorder";
import { injectScript } from "wxt/utils/inject-script";

export default defineContentScript({
  matches: ["https://*/*", "http://*/*"],
  runAt: "document_start",

  async main() {
    const origin = toOriginKey(window.location.href);

    // Attach recorders immediately so we cannot miss the MAIN-world hello
    // (injectScript may run oggy-main and dispatch hello before we listen).
    setupDomRecording(origin);
    window.addEventListener(BUS.record, ((e: CustomEvent) => {
      const event = e.detail?.event as RecordedEvent | undefined;
      if (event) {
        send({ type: "oggy/session/append", origin, event });
      }
    }) as EventListener);

    const hello = waitForHello();
    await injectScript("/oggy-main.js", { keepInDom: true });
    await hello;

    const bundleResp = await send({ type: "oggy/origin/get", origin });
    if (
      bundleResp.ok &&
      "bundle" in bundleResp &&
      bundleResp.bundle &&
      bundleResp.bundle.enabled &&
      bundleResp.bundle.mcp &&
      bundleResp.bundle.mcp.tools.length > 0
    ) {
      dispatchToMain(BUS.register, { mcp: bundleResp.bundle.mcp });
    }

    browser.runtime.onMessage.addListener((msg: unknown) => {
      if (
        typeof msg === "object" &&
        msg !== null &&
        (msg as Record<string, unknown>).type === "oggy/content/abort"
      ) {
        dispatchToMain(BUS.abort, {});
      }
      if (
        typeof msg === "object" &&
        msg !== null &&
        (msg as Record<string, unknown>).type === "oggy/content/register"
      ) {
        const mcp = (msg as Record<string, unknown>).mcp as DomainMcp;
        dispatchToMain(BUS.register, { mcp });
      }
    });
  },
});

// ── Helpers ───────────────────────────────────────────────────────────────

function send(msg: OggyMessage): Promise<OggyResponse> {
  return browser.runtime.sendMessage(msg) as Promise<OggyResponse>;
}

function waitForHello(): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      window.removeEventListener(BUS.hello, handler);
      resolve();
    };
    const handler = () => done();
    window.addEventListener(BUS.hello, handler);
    setTimeout(done, 2000);
  });
}

function dispatchToMain(eventName: string, detail: unknown): void {
  window.dispatchEvent(
    new CustomEvent(eventName, { detail: JSON.parse(JSON.stringify(detail)) }),
  );
}

function setupDomRecording(origin: string): void {
  const eventTypes = ["click", "input", "change", "submit"] as const;

  for (const type of eventTypes) {
    document.addEventListener(
      type,
      async (e: Event) => {
        const recResp = await send({ type: "oggy/record/status" });
        if (!recResp.ok || !("recording" in recResp) || !recResp.recording.active) {
          return;
        }

        if (!shouldRecordTarget(e.target)) return;

        const recorded = toRecordedEvent(e, window.location.href);
        if (recorded) {
          await send({ type: "oggy/session/append", origin, event: recorded });
        }
      },
      { capture: true },
    );
  }
}
