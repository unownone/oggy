# Oggy benches

Record a canonical flow **once** so synthesized WebMCP tools load, then replay
that tool against several keywords and print a pass/fail rate.

There is no LLM in this loop. Playwright drives the record phase; Oggy's
heuristic engine turns the session into `ToolRecipe` JSON; replay calls
`document.modelContext.executeTool`.

```
npm run bench              # CSS fixtures (google / amazon / x stand-ins)
npm run bench -- --list
npm run bench -- --live    # real google.com, amazon.com, x.com (flaky by design)
npm run bench -- --help
```

Live sites change CSS weekly, throw cookie/captcha/login walls, and will not
gate PRs. The GitHub `benches` workflow always runs fixtures; live runs on
schedule or `workflow_dispatch`.

Fixture pages live in `benches/sites/` and copy the *shape* of those UIs
(hashed classes, result lists, nth-item clicks) so we can measure locator
drift without depending on bot-blocked origins.
