export interface BenchCliArgs {
  help: boolean;
  version: boolean;
  list: boolean;
  live: boolean;
  dryRun: boolean;
  headed: boolean;
  out: string;
  failUnder: number | undefined;
  specIds: string[];
}

const DEFAULT_OUT = "benches/reports/latest.json";

export function parseArgs(argv: string[]): BenchCliArgs {
  const args: BenchCliArgs = {
    help: false,
    version: false,
    list: false,
    live: false,
    dryRun: false,
    headed: true,
    out: DEFAULT_OUT,
    failUnder: undefined,
    specIds: [],
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    switch (token) {
      case "-h":
      case "--help":
        args.help = true;
        break;
      case "-V":
      case "--version":
        args.version = true;
        break;
      case "--list":
        args.list = true;
        break;
      case "--live":
        args.live = true;
        break;
      case "--fixtures-only":
        args.live = false;
        break;
      case "--dry-run":
        args.dryRun = true;
        break;
      case "--headed":
        args.headed = true;
        break;
      case "--headless":
        args.headed = false;
        break;
      case "--out": {
        const value = argv[++i];
        if (!value) throw new Error("--out requires a path");
        args.out = value;
        break;
      }
      case "--fail-under": {
        const value = argv[++i];
        if (value === undefined) throw new Error("--fail-under requires a number 0..1");
        const n = Number(value);
        if (!Number.isFinite(n) || n < 0 || n > 1) {
          throw new Error(`--fail-under must be 0..1, got ${value}`);
        }
        args.failUnder = n;
        break;
      }
      default:
        if (token.startsWith("-")) {
          throw new Error(`Unknown flag: ${token}`);
        }
        args.specIds.push(token);
        break;
    }
  }

  return args;
}

export function helpText(): string {
  return `oggy-bench — record a flow, load synthesized WebMCP tools, replay keyword variants.

No LLM. Playwright drives the record phase; Oggy's heuristic engine synthesizes
tools; replay calls document.modelContext.executeTool.

Usage:
  npm run bench -- [options] [spec-id...]

Options:
  --list              List specs and exit
  --live              Include live internet specs (google.com, amazon.com, x.com)
  --fixtures-only     Only local CSS-fixture sites (default)
  --out <path>        JSON report path (default ${DEFAULT_OUT})
  --headed            Show the browser (default)
  --headless          Headless Chromium
  --fail-under <0-1>  Exit 1 if variant pass rate is below this
                      (default 0.5 fixtures / 0 live)
  --dry-run           Print the plan without launching a browser
  --help              Show this help
  --version           Print 0.1.0

Examples:
  npm run bench
  npm run bench -- google-fixture amazon-fixture
  npm run bench -- --live --headless --out benches/reports/live.json
  npm run bench -- --list

Exit codes:
  0  report written, pass rate meets --fail-under
  1  pass rate below threshold, or a spec failed to load tools (fixtures)
  2  usage / unknown spec / missing build
`;
}
