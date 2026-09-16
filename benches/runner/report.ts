export interface VariantOutcome {
  id: string;
  query: string;
  ok: boolean;
  detail: string;
}

export interface SpecOutcome {
  id: string;
  kind: "fixture" | "live";
  title: string;
  site: string;
  skipped?: string;
  toolsLoaded: boolean;
  tools: Array<{ name: string; steps: string[] }>;
  variants: VariantOutcome[];
  passRate: number;
}

export interface BenchReport {
  startedAt: string;
  finishedAt: string;
  live: boolean;
  results: SpecOutcome[];
  totals: {
    specs: number;
    skipped: number;
    toolsLoaded: number;
    variants: number;
    passed: number;
    failed: number;
    passRate: number;
  };
}

export function finalizeSpec(partial: Omit<SpecOutcome, "passRate">): SpecOutcome {
  const counted = partial.variants;
  const passed = counted.filter((v) => v.ok).length;
  const passRate = counted.length === 0 ? 0 : passed / counted.length;
  return { ...partial, passRate };
}

export function finalizeReport(
  startedAt: string,
  live: boolean,
  results: SpecOutcome[],
): BenchReport {
  const variants = results.flatMap((r) => r.variants);
  const passed = variants.filter((v) => v.ok).length;
  const skipped = results.filter((r) => r.skipped).length;
  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    live,
    results,
    totals: {
      specs: results.length,
      skipped,
      toolsLoaded: results.filter((r) => r.toolsLoaded).length,
      variants: variants.length,
      passed,
      failed: variants.length - passed,
      passRate: variants.length === 0 ? 0 : passed / variants.length,
    },
  };
}

export function formatReport(report: BenchReport): string {
  const lines: string[] = [];
  lines.push("Oggy bench report");
  lines.push("=================");
  for (const spec of report.results) {
    if (spec.skipped) {
      lines.push(`- ${spec.id}: SKIP ${spec.skipped}`);
      continue;
    }
    if (!spec.toolsLoaded) {
      lines.push(`- ${spec.id}: FAIL tools did not load`);
      continue;
    }
    const pct = Math.round(spec.passRate * 100);
    lines.push(
      `- ${spec.id}: ${pct}% (${spec.variants.filter((v) => v.ok).length}/${spec.variants.length}) tools=${spec.tools.map((t) => t.name).join(",") || "none"}`,
    );
    for (const v of spec.variants) {
      lines.push(`    ${v.ok ? "ok  " : "fail"} ${v.id}: ${v.detail}`);
    }
  }
  const pct = Math.round(report.totals.passRate * 100);
  lines.push("");
  lines.push(
    `totals: ${pct}%  ${report.totals.passed}/${report.totals.variants} variants  ${report.totals.toolsLoaded}/${report.totals.specs} specs loaded tools  ${report.totals.skipped} skipped`,
  );
  return lines.join("\n");
}

export function githubSummary(report: BenchReport): string {
  const rows = report.results.map((spec) => {
    if (spec.skipped) return `| \`${spec.id}\` | ${spec.kind} | skipped | ${spec.skipped} |`;
    if (!spec.toolsLoaded) return `| \`${spec.id}\` | ${spec.kind} | tools missing | — |`;
    const pct = Math.round(spec.passRate * 100);
    return `| \`${spec.id}\` | ${spec.kind} | ${pct}% | ${spec.tools.map((t) => t.name).join(", ")} |`;
  });
  return [
    "## Oggy benches",
    "",
    `| spec | kind | pass rate | tools |`,
    `| --- | --- | --- | --- |`,
    ...rows,
    "",
    `Overall variant pass rate: **${Math.round(report.totals.passRate * 100)}%** (${report.totals.passed}/${report.totals.variants}).`,
  ].join("\n");
}
