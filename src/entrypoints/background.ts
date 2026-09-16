// ---------------------------------------------------------------------------
// Oggy background service worker
// Owns recording state, storage, synthesis-on-stop, badge updates.
// ---------------------------------------------------------------------------

import { browser } from "wxt/browser";
import {
  toOriginKey,
  parseMessage,
  selectRecordableOrigin,
} from "@/core";
import type {
  DomainMcp,
  OggyMessage,
  OggyResponse,
  OriginKey,
  RecordingState,
} from "@/core";
import {
  getBundle,
  listBundles,
  setEnabled,
  deleteOrigin,
  getRecordingState,
  setRecordingState,
  appendEvent,
  replaceMcp,
  upsertBundle,
  ensureSession,
} from "@/storage";
import { defaultEngine } from "@/engine";

export default defineBackground(() => {
  // Handle messages from popup, sidepanel, content scripts
  browser.runtime.onMessage.addListener(
    (rawMsg: unknown, _sender, sendResponse) => {
      handleMessage(rawMsg)
        .then(sendResponse)
        .catch((err) =>
          sendResponse({ ok: false, error: String(err) } satisfies OggyResponse),
        );
      return true; // async response
    },
  );

  async function handleMessage(raw: unknown): Promise<OggyResponse> {
    const msg = parseMessage(raw);

    switch (msg.type) {
      case "oggy/record/start": {
        const origin = await resolveWebOrigin();
        const sessionId = crypto.randomUUID();
        const state: RecordingState = {
          active: true,
          origin,
          sessionId,
        };
        await setRecordingState(state);
        if (origin) {
          await ensureSession(origin, sessionId);
        }
        updateBadge(true);
        return { ok: true, recording: state };
      }

      case "oggy/record/stop": {
        const prev = await getRecordingState();
        updateBadge(false);

        // Flush in-flight content-script appends while recording is still
        // marked active so late events are not dropped.
        await flushContentScripts();

        if (prev.sessionId) {
          await synthesizeMatchingSessions(prev.sessionId);
        }

        const state: RecordingState = { active: false };
        await setRecordingState(state);
        return { ok: true, recording: state };
      }

      case "oggy/record/status": {
        const recording = await getRecordingState();
        return { ok: true, recording };
      }

      case "oggy/origin/get": {
        const bundle = await getBundle(msg.origin);
        return { ok: true, bundle };
      }

      case "oggy/origin/list": {
        const bundles = await listBundles();
        return { ok: true, bundles };
      }

      case "oggy/origin/setEnabled": {
        const bundle = await setEnabled(msg.origin, msg.enabled);
        if (msg.enabled && bundle.mcp && bundle.mcp.tools.length > 0) {
          await broadcastToOrigin(msg.origin, {
            type: "oggy/content/register",
            mcp: bundle.mcp,
          });
        } else {
          await broadcastToOrigin(msg.origin, { type: "oggy/content/abort" });
        }
        return { ok: true, bundle };
      }

      case "oggy/origin/delete": {
        await broadcastToOrigin(msg.origin, { type: "oggy/content/abort" });
        await deleteOrigin(msg.origin);
        return { ok: true, bundles: await listBundles() };
      }

      case "oggy/session/append": {
        await appendEvent(msg.origin, msg.event);
        const recording = await getRecordingState();
        return { ok: true, recording };
      }

      default: {
        const _exhaustive: never = msg;
        return {
          ok: false,
          error: `Unknown message type: ${(_exhaustive as OggyMessage).type}`,
        };
      }
    }
  }

  async function synthesizeMatchingSessions(sessionId: string): Promise<void> {
    // One extra tick in case a send was in flight when flush returned.
    await sleep(50);
    const bundles = await listBundles();

    for (const bundle of bundles) {
      const session = bundle.sessions.find((s) => s.id === sessionId);
      if (!session || session.events.length === 0) continue;

      session.endedAt = new Date().toISOString();
      await upsertBundle(bundle);

      try {
        const mcp = await defaultEngine.synthesize({
          origin: bundle.origin,
          session,
        });
        await replaceMcp(bundle.origin, mcp);
        if (bundle.enabled && mcp.tools.length > 0) {
          await broadcastToOrigin(bundle.origin, {
            type: "oggy/content/register",
            mcp,
          });
        }
      } catch (err) {
        console.error("[oggy] Synthesis failed:", err);
      }
    }
  }

  function updateBadge(recording: boolean): void {
    browser.action.setBadgeText({ text: recording ? "REC" : "" });
    browser.action.setBadgeBackgroundColor({
      color: recording ? "#e53e3e" : "#4a5568",
    });
  }
});

async function resolveWebOrigin(): Promise<OriginKey | undefined> {
  const tabs = await browser.tabs.query({});
  return selectRecordableOrigin(
    tabs.map((t) => ({
      url: t.url,
      active: t.active,
      lastAccessed: (t as { lastAccessed?: number }).lastAccessed,
    })),
  );
}

async function flushContentScripts(): Promise<void> {
  const tabs = await browser.tabs.query({});
  await Promise.all(
    tabs.map(async (tab) => {
      if (!tab.id) return;
      try {
        await browser.tabs.sendMessage(tab.id, { type: "oggy/content/flush" });
      } catch {
        // Tab has no content script (chrome://, extension pages, etc.)
      }
    }),
  );
}

async function broadcastToOrigin(
  origin: OriginKey,
  message:
    | { type: "oggy/content/abort" }
    | { type: "oggy/content/register"; mcp: DomainMcp },
): Promise<void> {
  const tabs = await browser.tabs.query({});
  await Promise.all(
    tabs.map(async (tab) => {
      if (!tab.id || !tab.url) return;
      if (toOriginKey(tab.url) !== origin) return;
      try {
        await browser.tabs.sendMessage(tab.id, message);
      } catch {
        // Tab has no content script
      }
    }),
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
