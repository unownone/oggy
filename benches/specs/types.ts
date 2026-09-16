// ---------------------------------------------------------------------------
// Oggy bench specs — record a flow, then replay keyword variants through
// synthesized WebMCP tools. No LLM in this loop.
// ---------------------------------------------------------------------------

import type { Page } from "@playwright/test";

export type BenchKind = "fixture" | "live";

export interface BenchVariant {
  id: string;
  query: string;
}

export interface BenchAssertResult {
  ok: boolean;
  detail: string;
}

export interface BenchSpec {
  id: string;
  kind: BenchKind;
  title: string;
  /** Human-readable site this bench stands in for. */
  site: string;
  startUrl: string;
  recordQuery: string;
  variants: BenchVariant[];
  /**
   * Dismiss walls / cookie banners. Return a skip reason if the page cannot
   * be exercised (captcha, login, etc.).
   */
  prepare?: (page: Page) => Promise<string | null>;
  /** Drive the canonical flow while Oggy is recording. */
  record: (page: Page) => Promise<void>;
  /** After tool replay, did search + 3rd-hit activation succeed? */
  assert: (page: Page, variant: BenchVariant) => Promise<BenchAssertResult>;
}

export const DEFAULT_VARIANTS: BenchVariant[] = [
  { id: "automation", query: "automation" },
  { id: "playwright", query: "playwright" },
  { id: "webmcp", query: "webmcp" },
  { id: "locators", query: "locators" },
  { id: "typescript", query: "typescript" },
];

export const FIXTURE_ORIGIN = "http://127.0.0.1:4174";
