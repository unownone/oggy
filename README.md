# 🐾 Oggy

**Teaching AI to use a website, one step at a time!**

Oggy is a Chrome extension that records your interactions on any website, synthesizes [WebMCP](https://webmachinelearning.github.io/webmcp/) tools from those recordings, and injects them onto `document.modelContext` on page load — so any AI agent can operate the site through structured tools instead of guessing from the DOM.

## How it works

```
Record → Synthesize → Inject → Agent uses tools
```

1. **Record** – Toggle recording in the popup; Oggy captures clicks, form fills, navigations, and sanitized network metadata. Passwords, credit card numbers, and other sensitive fields are never stored.
2. **Synthesize** – When you stop recording, a pluggable engine (heuristic v1) segments the session into logical tasks and outputs named WebMCP tool recipes with JSON Schema inputs.
3. **Inject** – On page load, Oggy registers the recipes as real `document.modelContext` tools using the WebMCP Imperative API (polyfilled via `@mcp-b/webmcp-polyfill` when the browser doesn't ship it natively).
4. **Agent uses tools** – Chrome's built-in agent, the Model Context Tool Inspector, or any in-page agent can discover and execute the tools.

## Quick start

### Prerequisites

- Chrome 149+ with `chrome://flags/#enable-webmcp-testing` enabled (for native WebMCP)
- Node.js 20+

### Install and build

```bash
git clone <this-repo> && cd mcpify
npm install
npm run build
```

### Load the extension

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top-right)
3. Click **Load unpacked** → select `.output/chrome-mv3/`
4. Navigate to any website and click the Oggy icon

### Test with the demo site

```bash
npm run demo
# Opens http://127.0.0.1:4173
```

Navigate to the demo in Chrome, record a search flow, stop, reload — the synthesized tools appear on `document.modelContext`.

### Inspect tools

Install the [Model Context Tool Inspector](https://chromewebstore.google.com/detail/gbpdfapgefenggkahomfgkhfehlcenpd) to see registered tools, test them manually, or chat with Gemini to verify they work.

## Development

```bash
npm run dev          # WXT dev mode with HMR
npm run lint         # ESLint
npm run test         # Vitest unit tests
npm run test:watch   # Vitest watch mode
npm run test:coverage # Coverage report
npm run e2e          # Build + Playwright e2e (requires built extension)
npm run bench        # Record→replay CSS-fixture benches (google/amazon/x stand-ins)
npm run bench -- --live  # Same loop against the live sites (flaky; report-only)
```

### CI

- **Pull requests** run lint, Vitest unit tests, and Playwright e2e (in parallel).
- **Pushes to `main`** (and manual *Run workflow*) build and zip the Chrome extension. From the Actions run, download `oggy-chrome-mv3` (unpacked, for Load unpacked) or `oggy-chrome-mv3-zip`.

### Project structure

```
src/
├── core/           # Origin keys, redaction, locators, messages, types (zero chrome.*)
├── engine/         # Pluggable synthesis engine (HeuristicEngine v1, zero chrome.*)
├── recorder/       # DOM event capture, network sanitization
├── webmcp/         # Polyfill, tool registration, recipe playback (MAIN world)
├── storage/        # Per-origin chrome.storage.local repository
├── ui/             # Vanilla popup + side panel
└── entrypoints/    # WXT entrypoints (background, content, popup, sidepanel, oggy-main)
demo/site/          # Static demo page with data-testids
e2e/                # Playwright e2e journey specs
```

### Architecture

- **MAIN world** (`oggy-main.js`): owns `document.modelContext`, polyfill, `registerTool`, recipe playback. No `chrome.*` APIs.
- **Isolated content script**: owns recording, storage messaging, and bridges to MAIN via CustomEvents (`oggy:v1:*`).
- **Background service worker**: message handler, recording state, synthesis-on-stop, badge.
- **Popup/Side panel**: vanilla HTML + TS, communicate via `browser.runtime.sendMessage`.

### Domain storage

MCPs are stored per-origin (like cookies), not per-domain. `https://app.example.com` and `http://app.example.com` are separate origins with separate tool sets.

## WebMCP standard

Oggy implements the [WebMCP](https://webmachinelearning.github.io/webmcp/) draft standard:

- `document.modelContext.registerTool()` — register tools with name, description, inputSchema, execute
- `document.modelContext.getTools()` — discover registered tools
- `document.modelContext.executeTool()` — invoke a tool
- `toolchange` event — notification when tools are added/removed
- `AbortSignal` for tool lifecycle management

## License

MIT
