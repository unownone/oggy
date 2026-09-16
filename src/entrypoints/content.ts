// ---------------------------------------------------------------------------
// Oggy content script — runs in ISOLATED world
// Bridges recording events and MCP injection between page and background.
// ---------------------------------------------------------------------------

import { browser } from "wxt/browser";
import {
  BUS,
  STORAGE_ORIGINS_KEY,
  STORAGE_RECORDING_KEY,
  toOriginKey,
} from "@/core";
import type {
  OggyMessage,
  OggyResponse,
  RecordedEvent,
  DomainMcp,
  OriginBundle,
  RecordingState,
  ToolUpdateProposal,
} from "@/core";
import { shouldRecordTarget, toRecordedEvent } from "@/recorder";
import { injectScript } from "wxt/utils/inject-script";
import {
  SPA_REFRESH_MS,
  applyAttachPlan,
  diffAttachments,
  evaluateAttachments,
} from "@/attach";
import { pageContextFromLocation } from "@/core/page-context";
import type { AttachmentState } from "@/core/mcp-manifest";
import { BUILTIN_MCP_CATALOG } from "@/domains";

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

    window.addEventListener(BUS.permission, ((e: CustomEvent) => {
      const proposal = e.detail?.proposal as ToolUpdateProposal | undefined;
      if (!proposal) return;
      void send({
        type: "oggy/tool/proposeUpdate",
        origin,
        proposal,
      });
    }) as EventListener);

    const hello = waitForHello();
    await injectScript("/oggy-main.js", { keepInDom: true });
    await hello;
    await refreshAttachments(origin);
    startSpaRefresh(origin);

    browser.runtime.onMessage.addListener(
      (msg: unknown, _sender, sendResponse) => {
        if (typeof msg !== "object" || msg === null) return;
        const type = (msg as Record<string, unknown>).type;

        if (type === "oggy/content/abort") {
          dispatchToMain(BUS.abort, {});
          attached = {};
          return;
        }
        if (type === "oggy/content/register") {
          const mcp = (msg as Record<string, unknown>).mcp as DomainMcp;
          dispatchToMain(BUS.register, { mcp });
          if (mcp?.id) {
            attached[mcp.id] = { fingerprint: "broadcast" };
          }
          void refreshAttachments(origin);
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

let recordingActive = false;
let inFlightAppends = 0;
let draining = false;
const pendingEvents: Array<{ origin: string; event: RecordedEvent }> = [];
let cachedBundle: OriginBundle | null | undefined;
let attached: AttachmentState = {};
let spaTimer: ReturnType<typeof setInterval> | undefined;

async function refreshRecordingState(): Promise<void> {
  try {
    const recResp = await send({ type: "oggy/record/status" });
    recordingActive =
      recResp.ok && "recording" in recResp && recResp.recording.active;
  } catch {
    // Service worker may still be spinning up
  }
}

async function loadBundle(origin: string): Promise<OriginBundle | null> {
  if (cachedBundle !== undefined) return cachedBundle;
  try {
    const bundleResp = await send({ type: "oggy/origin/get", origin });
    cachedBundle =
      bundleResp.ok && "bundle" in bundleResp ? bundleResp.bundle : null;
  } catch {
    cachedBundle = null;
  }
  return cachedBundle;
}

async function refreshAttachments(origin: string): Promise<void> {
  await refreshRecordingState();
  const bundle = await loadBundle(origin);
  const page = pageContextFromLocation({
    href: window.location.href,
    title: document.title,
    recordingActive,
  });
  const desired = evaluateAttachments({
    page,
    bundle,
    catalog: BUILTIN_MCP_CATALOG,
  });
  const plan = diffAttachments(attached, desired);
  for (const id of plan.detach) {
    dispatchToMain(BUS.abort, { mcpId: id });
  }
  for (const target of plan.attach) {
    dispatchToMain(BUS.register, { mcp: target.mcp });
  }
  attached = applyAttachPlan(attached, plan, desired);
}

function startSpaRefresh(origin: string): void {
  if (spaTimer) clearInterval(spaTimer);
  spaTimer = setInterval(() => {
    void refreshAttachments(origin);
  }, SPA_REFRESH_MS);
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
    const recChange = changes[STORAGE_RECORDING_KEY];
    if (recChange) {
      const next = recChange.newValue as RecordingState | undefined;
      recordingActive = next?.active === true;
      void refreshAttachments(origin);
    }
    if (changes[STORAGE_ORIGINS_KEY]) {
      cachedBundle = undefined;
      void refreshAttachments(origin);
    }
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
