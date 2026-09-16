import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { BrowserContext, Page } from "@playwright/test";
import type { BenchSpec } from "../specs/types";
import { launchExtensionContext, readOriginMcp, toOrigin } from "./browser";
import {
  gotoStart,
  startRecording,
  stopRecording,
  waitForToolsInStorage,
} from "./record";
import {
  classifyTools,
  replayVariant,
  type StoredTool,
  waitForInjectedTools,
} from "./replay";
import {
  finalizeReport,
  finalizeSpec,
  formatReport,
  type SpecOutcome,
  type VariantOutcome,
} from "./report";
import { startFixtureServer } from "./server";

export interface RunOptions {
  headed: boolean;
  live: boolean;
}

export async function runSpecs(
  specs: BenchSpec[],
  options: RunOptions,
): Promise<ReturnType<typeof finalizeReport>> {
  const startedAt = new Date().toISOString();
  const needsFixtures = specs.some((s) => s.kind === "fixture");
  const server = needsFixtures ? await startFixtureServer() : null;

  const { context, extensionId } = await launchExtensionContext(options.headed);
  const results: SpecOutcome[] = [];

  try {
    for (const spec of specs) {
      results.push(await runOne(context, extensionId, spec));
    }
  } finally {
    await context.close();
    if (server) await server.close();
  }

  return finalizeReport(startedAt, options.live, results);
}

async function runOne(
  context: BrowserContext,
  extensionId: string,
  spec: BenchSpec,
): Promise<SpecOutcome> {
  const page = await context.newPage();
  const origin = toOrigin(spec.startUrl);
  const empty = (extra: Partial<SpecOutcome> = {}): SpecOutcome =>
    finalizeSpec({
      id: spec.id,
      kind: spec.kind,
      title: spec.title,
      site: spec.site,
      toolsLoaded: false,
      tools: [],
      variants: [],
      ...extra,
    });

  try {
    await gotoStart(page, spec.startUrl);
    if (spec.prepare) {
      const skip = await spec.prepare(page);
      if (skip) return empty({ skipped: skip });
    }

    await startRecording(context, extensionId);
    await page.bringToFront();
    try {
      await spec.record(page);
    } catch (err) {
      await stopRecording(context, extensionId).catch(() => undefined);
      return empty({
        skipped: `record phase failed: ${String(err)}`,
      });
    }
    await stopRecording(context, extensionId);

    const loaded = await waitForToolsInStorage(context, origin);
    const mcp = await readOriginMcp(context, origin);
    const stored = (mcp?.tools || []) as StoredTool[];
    const toolsMeta = stored.map((t) => ({
      name: t.name,
      steps: t.steps.map((s) => s.type),
    }));

    if (!loaded || stored.length === 0) {
      return finalizeSpec({
        id: spec.id,
        kind: spec.kind,
        title: spec.title,
        site: spec.site,
        toolsLoaded: false,
        tools: toolsMeta,
        variants: spec.variants.map((v) => ({
          id: v.id,
          query: v.query,
          ok: false,
          detail: "tools did not load after record/stop",
        })),
      });
    }

    const classified = classifyTools(stored);
    const variants: VariantOutcome[] = [];

    for (const variant of spec.variants) {
      variants.push(await runVariant(page, spec, classified, variant));
    }

    return finalizeSpec({
      id: spec.id,
      kind: spec.kind,
      title: spec.title,
      site: spec.site,
      toolsLoaded: true,
      tools: toolsMeta,
      variants,
    });
  } catch (err) {
    return empty({ skipped: `spec crashed: ${String(err)}` });
  } finally {
    await page.close().catch(() => undefined);
  }
}

async function runVariant(
  page: Page,
  spec: BenchSpec,
  classified: ReturnType<typeof classifyTools>,
  variant: { id: string; query: string },
): Promise<VariantOutcome> {
  try {
    await gotoStart(page, spec.startUrl);
    if (spec.prepare) {
      const skip = await spec.prepare(page);
      if (skip) {
        return { id: variant.id, query: variant.query, ok: false, detail: skip };
      }
    }
    await waitForInjectedTools(page);
    const replay = await replayVariant(page, classified, variant.query);
    if (!replay.ok) {
      return { id: variant.id, query: variant.query, ok: false, detail: replay.detail };
    }
    const asserted = await spec.assert(page, variant);
    return {
      id: variant.id,
      query: variant.query,
      ok: asserted.ok,
      detail: asserted.detail,
    };
  } catch (err) {
    return {
      id: variant.id,
      query: variant.query,
      ok: false,
      detail: `variant crashed: ${String(err)}`,
    };
  }
}

export function writeReport(
  report: ReturnType<typeof finalizeReport>,
  outPath: string,
): void {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  const summary = formatReport(report);
  writeFileSync(outPath.replace(/\.json$/, ".txt"), summary + "\n", "utf8");
  console.log(summary);
  console.log(`\nJSON report: ${outPath}`);
}
