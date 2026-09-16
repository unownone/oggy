// ---------------------------------------------------------------------------
// Oggy background service worker
// Owns recording state, storage, synthesis-on-stop, badge updates.
// ---------------------------------------------------------------------------

import { browser } from "wxt/browser";
import { toOriginKey, parseMessage, pickPageTabUrl } from "@/core";
import type { OggyMessage, OggyResponse, RecordingState } from "@/core";
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
  findSessionById,
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
        const tabs = await browser.tabs.query({ currentWindow: true });
        const pageUrl = pickPageTabUrl(tabs);
        const origin = pageUrl ? toOriginKey(pageUrl) : undefined;
        const sessionId = crypto.randomUUID();
        const state: RecordingState = {
          active: true,
          origin,
          sessionId,
        };
        await setRecordingState(state);
        updateBadge(true);
        return { ok: true, recording: state };
      }

      case "oggy/record/stop": {
        const prev = await getRecordingState();
        const state: RecordingState = { active: false };
        await setRecordingState(state);
        updateBadge(false);

        const found = await findSessionById(prev.sessionId, prev.origin);
        if (found && found.session.events.length > 0) {
          found.session.endedAt = new Date().toISOString();
          await upsertBundle(found.bundle);

          try {
            const mcp = await defaultEngine.synthesize({
              origin: found.bundle.origin,
              session: found.session,
            });
            await replaceMcp(found.bundle.origin, mcp);
          } catch (err) {
            console.error("[oggy] Synthesis failed:", err);
          }
        }

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
        return { ok: true, bundle };
      }

      case "oggy/origin/delete": {
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
          error: `Unknown message type: ${((_exhaustive as OggyMessage).type)}`,
        };
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
