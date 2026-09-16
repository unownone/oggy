// ---------------------------------------------------------------------------
// Oggy content script — runs in ISOLATED world
// Bridges recording events and MCP injection between page and background.
// ---------------------------------------------------------------------------

import { browser } from "wxt/browser";
import { BUS, STORAGE_RECORDING_KEY, toOriginKey } from "@/core";
import type {
  OggyMessage,
  OggyResponse,
  RecordedEvent,
  DomainMcp,
  RecordingState,
} from "@/core";
import { shouldRecordTarget, toRecordedEvent } from "@/recorder";
import { injectScript } from "wxt/utils/inject-script";

export default defineContentScript({
  matches: ["https://*/*", "http://*/*"],
  runAt: "document_start",

  async main() {
    const origin = toOriginKey(window.location.href);

    // Recorders must attach before the hello/MCP handshake. Waiting on MAIN
    // readiness drops the e2e fill/click that happens at DOMContentLoaded.
    setupDomRecording(origin);
    window.addEventListener(BUS.record, ((e: CustomEvent) => {
      const event = e.detail?.event as RecordedEvent | undefined;
      if (event) queueRecordedEvent(origin, event);
    }) as EventListener);

    const hello = waitForHello();
    await injectScript("/oggy-main.js", { keepInDom: true });
    await hello;
    await injectBundleIfEnabled(origin);

    browser.runtime.onMessage.addListener(
      (msg: unknown, _sender, sendResponse) => {
        if (typeof msg !== "object" || msg === null) return;
        const type = (msg as Record<string, unknown>).type;

        if (type === "oggy/content/abort") {
          dispatchToMain(BUS.abort, {});
          return;
        }
        if (type === "oggy/content/register") {
          const mcp = (msg as Record<string, unknown>).mcp as DomainMcp;
          dispatchToMain(BUS.register, { mcp });
          return;
        }
        if (type === "oggy/content/flush") {
          waitForPendingAppends()
            .then(() => sendResponse({ ok: true }))
            .catch(() => sendResponse({ ok: false }));
          return true;
        }
      },
    );
  },
});

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

async function injectBundleIfEnabled(origin: string): Promise<void> {
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
}

let recordingActive = false;
let inFlightAppends = 0;
let draining = false;
const pendingEvents: Array<{ origin: string; event: RecordedEvent }> = [];

async function refreshRecordingState(): Promise<void> {
  try {
    const recResp = await send({ type: "oggy/record/status" });
    recordingActive =
      recResp.ok && "recording" in recResp && recResp.recording.active;
  } catch {
    // Service worker may still be spinning up
  }
}

function queueRecordedEvent(origin: string, event: RecordedEvent): void {
  pendingEvents.push({ origin, event });
  void drainQueue();
}

async function drainQueue(): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    while (pendingEvents.length > 0) {
      if (!recordingActive) {
        await refreshRecordingState();
      }
      if (!recordingActive) {
        pendingEvents.shift();
        continue;
      }
      const item = pendingEvents.shift();
      if (!item) break;
      inFlightAppends++;
      try {
        await send({
          type: "oggy/session/append",
          origin: item.origin,
          event: item.event,
        });
      } finally {
        inFlightAppends--;
      }
    }
  } finally {
    draining = false;
    if (pendingEvents.length > 0) void drainQueue();
  }
}

async function waitForPendingAppends(): Promise<void> {
  const start = Date.now();
  while (
    (pendingEvents.length > 0 || inFlightAppends > 0 || draining) &&
    Date.now() - start < 2000
  ) {
    await new Promise((r) => setTimeout(r, 20));
  }
}

function setupDomRecording(origin: string): void {
  void refreshRecordingState();

  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    const change = changes[STORAGE_RECORDING_KEY];
    if (!change) return;
    const next = change.newValue as RecordingState | undefined;
    recordingActive = next?.active === true;
  });

  const eventTypes = ["click", "input", "change", "submit"] as const;

  for (const type of eventTypes) {
    document.addEventListener(
      type,
      (e: Event) => {
        if (e.type !== "submit" && !shouldRecordTarget(e.target)) return;
        const recorded = toRecordedEvent(e, window.location.href);
        if (recorded) queueRecordedEvent(origin, recorded);
      },
      { capture: true },
    );
  }
}
