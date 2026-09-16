#!/usr/bin/env node
// Oggy bench CLI — record once, replay many, print pass/fail. No LLM.

import { writeFileSync } from "node:fs";
import { helpText, parseArgs } from "./args";
import { resolveSpecs } from "../specs/catalog";
import { githubSummary } from "./report";
import { runSpecs, writeReport } from "./run";

const VERSION = "0.1.0";

async function main(argv: string[]): Promise<number> {
  let args;
  try {
    args = parseArgs(argv);
  } catch (err) {
    console.error(String(err));
    console.error(helpText());
    return 2;
  }

  if (args.help) {
    console.log(helpText());
    return 0;
  }
  if (args.version) {
    console.log(VERSION);
    return 0;
  }

  let specs;
  try {
    specs = resolveSpecs(args.specIds, args.live);
  } catch (err) {
    console.error(String(err));
    return 2;
  }

  if (args.list) {
    for (const spec of specs) {
      console.log(`${spec.id}\t${spec.kind}\t${spec.title}`);
    }
    return 0;
  }

  if (specs.length === 0) {
    console.error("No specs selected. Try --list or --live.");
    return 2;
  }

  if (args.dryRun) {
    console.log("plan:");
    for (const spec of specs) {
      console.log(
        `- ${spec.id} (${spec.kind}) record="${spec.recordQuery}" variants=${spec.variants.map((v) => v.query).join(",")}`,
      );
    }
    return 0;
  }

  const report = await runSpecs(specs, {
    live: args.live,
  });
  writeReport(report, args.out);

  if (process.env.GITHUB_STEP_SUMMARY) {
    writeFileSync(process.env.GITHUB_STEP_SUMMARY, githubSummary(report) + "\n", {
      flag: "a",
    });
  }

  const fixtureFailedLoad = report.results.some(
    (r) => r.kind === "fixture" && !r.skipped && !r.toolsLoaded,
  );
  const defaultFloor = args.live && specs.every((s) => s.kind === "live") ? 0 : 0.5;
  const floor = args.failUnder ?? defaultFloor;
  if (fixtureFailedLoad) {
    console.error("A fixture spec did not load tools after recording.");
    return 1;
  }
  if (report.totals.passRate + Number.EPSILON < floor) {
    console.error(
      `Pass rate ${report.totals.passRate.toFixed(2)} is below --fail-under ${floor}.`,
    );
    return 1;
  }
  return 0;
}

main(process.argv.slice(2))
  .then((code) => {
    process.exit(code);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
