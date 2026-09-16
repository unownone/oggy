// ---------------------------------------------------------------------------
// Oggy storage — per-origin chrome.storage.local repository
// ---------------------------------------------------------------------------

import { browser } from "wxt/browser";
import {
  STORAGE_ORIGINS_KEY,
  STORAGE_RECORDING_KEY,
  type OriginKey,
  type OriginBundle,
  type DomainMcp,
  type RecordedEvent,
  type RecordingSession,
  type RecordingState,
} from "@/core";

// ── Internal helpers ──────────────────────────────────────────────────────

async function loadOrigins(): Promise<Record<string, OriginBundle>> {
  const result = await browser.storage.local.get(STORAGE_ORIGINS_KEY);
  return (result[STORAGE_ORIGINS_KEY] as Record<string, OriginBundle>) || {};
}

async function saveOrigins(
  origins: Record<string, OriginBundle>,
): Promise<void> {
  await browser.storage.local.set({ [STORAGE_ORIGINS_KEY]: origins });
}

function emptyBundle(origin: OriginKey): OriginBundle {
  return { origin, enabled: true, mcp: null, sessions: [] };
}

// ── Public API ────────────────────────────────────────────────────────────

export async function getBundle(
  origin: OriginKey,
): Promise<OriginBundle | null> {
  const origins = await loadOrigins();
  return origins[origin] || null;
}

export async function listBundles(): Promise<OriginBundle[]> {
  const origins = await loadOrigins();
  return Object.values(origins);
}

export async function upsertBundle(bundle: OriginBundle): Promise<void> {
  const origins = await loadOrigins();
  origins[bundle.origin] = bundle;
  await saveOrigins(origins);
}

export async function setEnabled(
  origin: OriginKey,
  enabled: boolean,
): Promise<OriginBundle> {
  const origins = await loadOrigins();
  if (!origins[origin]) {
    origins[origin] = emptyBundle(origin);
  }
  origins[origin].enabled = enabled;
  await saveOrigins(origins);
  return origins[origin];
}

export async function deleteOrigin(origin: OriginKey): Promise<void> {
  const origins = await loadOrigins();
  delete origins[origin];
  await saveOrigins(origins);
}

export async function getRecordingState(): Promise<RecordingState> {
  const result = await browser.storage.local.get(STORAGE_RECORDING_KEY);
  return (
    (result[STORAGE_RECORDING_KEY] as RecordingState) || { active: false }
  );
}

export async function setRecordingState(
  state: RecordingState,
): Promise<void> {
  await browser.storage.local.set({ [STORAGE_RECORDING_KEY]: state });
}

/**
 * Create an empty session for `origin` so stop/synthesis always has a row
 * even if the first DOM events arrive a moment later.
 */
export async function ensureSession(
  origin: OriginKey,
  sessionId: string,
): Promise<OriginBundle> {
  const origins = await loadOrigins();
  if (!origins[origin]) {
    origins[origin] = emptyBundle(origin);
  }

  const bundle = origins[origin];
  if (!bundle.sessions.some((s) => s.id === sessionId)) {
    bundle.sessions.push({
      id: sessionId,
      origin,
      startedAt: new Date().toISOString(),
      events: [],
    });
  }

  await saveOrigins(origins);
  return bundle;
}

export async function findSessionsById(
  sessionId: string,
): Promise<Array<{ origin: OriginKey; session: RecordingSession }>> {
  const origins = await loadOrigins();
  const matches: Array<{ origin: OriginKey; session: RecordingSession }> = [];
  for (const bundle of Object.values(origins)) {
    const session = bundle.sessions.find((s) => s.id === sessionId);
    if (session) matches.push({ origin: bundle.origin, session });
  }
  return matches;
}

export async function appendEvent(
  origin: OriginKey,
  event: RecordedEvent,
): Promise<void> {
  const origins = await loadOrigins();
  if (!origins[origin]) {
    origins[origin] = emptyBundle(origin);
  }

  const bundle = origins[origin];
  const recState = await getRecordingState();

  // Prefer the live session id; after stop we may still accept in-flight events
  // for the same id until synthesis runs.
  const sessionId = recState.sessionId || crypto.randomUUID();

  let session = bundle.sessions.find((s) => s.id === sessionId);
  if (!session) {
    session = {
      id: sessionId,
      origin,
      startedAt: new Date().toISOString(),
      events: [],
    };
    bundle.sessions.push(session);
  }

  session.events.push(event);
  await saveOrigins(origins);
}

export async function findSessionById(
  sessionId: string | undefined,
  preferredOrigin?: OriginKey,
): Promise<{ bundle: OriginBundle; session: RecordingSession } | null> {
  if (!sessionId) return null;

  const origins = await loadOrigins();
  if (preferredOrigin && origins[preferredOrigin]) {
    const session = origins[preferredOrigin].sessions.find(
      (s) => s.id === sessionId,
    );
    if (session) {
      return { bundle: origins[preferredOrigin], session };
    }
  }

  for (const bundle of Object.values(origins)) {
    const session = bundle.sessions.find((s) => s.id === sessionId);
    if (session) return { bundle, session };
  }

  return null;
}

export async function replaceMcp(
  origin: OriginKey,
  mcp: DomainMcp,
): Promise<void> {
  const origins = await loadOrigins();
  if (!origins[origin]) {
    origins[origin] = emptyBundle(origin);
  }
  origins[origin].mcp = mcp;
  await saveOrigins(origins);
}
