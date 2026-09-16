# Recording + domain MCP + skills

Normative spec for Oggy. Implementation lives in the typed contracts under `src/core/*`, `src/attach/*`, `src/domains/*`, plus hooks in the existing entrypoints.

This document describes **the architecture the product must follow**, including what already ships and what the new contracts add. It is written against this repo, not a generic agent stack.

---

## 1. What already exists vs what this spec adds

Today the shipped loop is:

```
popup Record → content/MAIN capture DOM events → chrome.storage session
  → HeuristicEngine.synthesize (on stop) → OriginBundle.mcp
  → content injects that one DomainMcp onto document.modelContext
```

| Concern | In the repo today | This spec |
| --- | --- | --- |
| Recording | `src/recorder/index.ts` captures `click` / `input` / `submit`; MAIN `hookHistory` emits `navigate` | Same capture, **mapped to primitive tool calls**. New primitive kinds exist on the types (`scroll`, `move`, `slide`, `read`, `output`); DOM capture for the noisy ones is not auto-enabled. |
| Synthesis | `HeuristicEngine` **replaces** `OriginBundle.mcp` on stop | Still runs (learned MCP). Stop **also** builds a `SkillFlow` and stores it on the session. A Skill is created **only** when the user confirms. |
| Injection | Once per page load in `src/entrypoints/content.ts` (`injectBundleIfEnabled`); one `AbortController` in `oggy-main.ts` | Every page load **and** every `SPA_REFRESH_MS` (500). Multiple MCPs, diff attach/detach by id+fingerprint. |
| Domain tools | None. Tool names are inferred from click text (`add_to_cart` happens to appear if the user clicked “Add to Cart”). | Builtin catalog. Amazon host gets `find_listing`, `click_object`, `sign_up`, `login`, `add_to_cart` whenever `loadCriteria` matches. |
| Skills | No type, no storage, no UI | `Skill` / `SkillFlow` types, `oggy/skill/create`, `oggy_list_skills`. |
| `loadCriteria` | Implicit: “this origin’s `bundle.mcp` if `enabled`” | Explicit `LoadCriteria` on every attachable MCP. |
| Agent tool mutation | `replaceMcp` overwrites the whole pack with no prompt | Builtin `oggy_update_tool`. Execute **never** mutates. User must approve. |
| Permission UX | Origin enable/disable only | Pending `ToolUpdateProposal` in the side panel; Approve / Deny. |
| SPA | `history.pushState` is recorded as `navigate` during recording; tools are **not** re-evaluated | 500ms page-context snapshot → re-match `loadCriteria`. |

**Coherent defaults this spec picks** (the repo was silent):

1. **Storage stays per-origin** (`OriginKey` = `new URL(href).origin`). `https://www.amazon.com` ≠ `http://www.amazon.com`. Catalog `loadCriteria` may match by **host suffix** so `amazon.com` / `www.amazon.com` share builtin commerce tools.
2. **`OriginBundle.enabled` is the master switch** for Oggy-injected tools on that origin, including catalog + meta. **No bundle** is treated as enabled (so amazon.com gets builtins on first visit). **Recording** is an explicit override: primitives + matching catalog attach for the session even if the origin is disabled.
3. **Skills are context, not a new execute surface.** The agent still calls domain / learned / primitive tools. Skills are listed via `oggy_list_skills` and stored for later runs. This matches WebMCP discussion ([skills as a layer above tools](https://github.com/webmachinelearning/webmcp/issues/161)) without waiting on a protocol primitive.
4. **Heuristic auto-synthesis stays** as the learned-tool path until a skill-creation UI is the primary stop UX. Both run on stop; creating a skill is a separate, user-gated message.

---

## 2. Layers (builtin vs domain vs skill-composed)

```
┌──────────────────────────────────────────────────────────────┐
│  Skill (user-named)                                          │
│  Context: “how to shop for shoes on this origin”             │
│  References tools by name; does not register a new execute.  │
└────────────────────────────┬─────────────────────────────────┘
                             │ composed from
┌────────────────────────────▼─────────────────────────────────┐
│  Domain tools (catalog + learned overlays)                   │
│  find_listing, click_object, sign_up, login, add_to_cart     │
│  + HeuristicEngine recipes on OriginBundle.mcp (layer=learned)│
└────────────────────────────┬─────────────────────────────────┘
                             │ composed from
┌────────────────────────────▼─────────────────────────────────┐
│  Primitives (recording vocabulary)                           │
│  click, scroll, move, slide, input, output, read             │
└──────────────────────────────────────────────────────────────┘

Meta (always when anything Oggy is attached, or while recording):
  oggy_update_tool     — permissioned mutation (MUST ask the user)
  oggy_list_skills     — read-only skill context
```

`ToolLayer` in code: `"primitive" | "domain" | "learned" | "meta"`.

Skills are **not** a `ToolLayer` on `document.modelContext`. They are `OriginBundle.skills`.

---

## 3. End-to-end lifecycle

```
page load (content.ts document_start)
  inject oggy-main.js → hello
  snapshot PageContext
  evaluateAttachments(page, bundle, BUILTIN_MCP_CATALOG)
  diff vs current → MAIN register/abort per mcp.id
  start 500ms timer (SPA refresh)

every 500ms (and on storage / recording / history change)
  snapshot PageContext (href, path, query, hash, title, recordingActive)
  if desired fingerprints unchanged: do nothing   ← no thrash
  else attach new, detach removed, replace changed ids

user clicks Record (oggy/record/start)
  RecordingState.active = true
  content re-evaluates immediately
  primitives MCP attaches (loadCriteria.recording)
  domain catalog attaches if host matches (e.g. amazon.com)
  user DOM actions → RecordedEvent[] → PrimitiveCall[] on the session

user clicks Stop (oggy/record/stop)
  flush in-flight appends
  buildSkillFlow(session) → session.skillFlow          ← shown to the user
  HeuristicEngine.synthesize → replaceMcp (learned)    ← existing product
  primitives detach (recording false)
  re-evaluate: learned + matching catalog + meta remain if origin enabled

user creates a skill (oggy/skill/create)
  Skill persisted on OriginBundle.skills
  oggy_list_skills fingerprint changes → re-register meta MCP
  later agent runs load that context when loadCriteria matches

agent uses tools
  calls domain / learned / primitive tools on document.modelContext
  if a tool is invalid: call oggy_update_tool({ toolName, reason, patch })
    → proposal stored pending
    → side panel asks the user
    → approve: overlay applied, MCP re-attached
    → deny: tool unchanged
```

---

## 4. Data model and contracts

### 4.1 `PageContext`

File: `src/core/page-context.ts`

The 500ms loop snapshots this, not the full DOM.

```
href, origin, host, pathname, search, hash, title, recordingActive
```

`pageContextKey` is the cheap equality key for “did the SPA actually change?”. Evaluation still runs; MAIN is only touched when the attach plan is non-empty.

### 4.2 `LoadCriteria`

File: `src/core/load-criteria.ts`

Every attachable MCP has `loadCriteria`. Empty `{}` matches everything.

```
LoadCriteria = { all?: LoadPredicate[]; any?: LoadPredicate[] }

LoadPredicate =
  | { type: "always" }
  | { type: "origin"; origin: OriginKey }          // exact origin, including scheme+port
  | { type: "hostSuffix"; value: string }          // "amazon.com" matches www.amazon.com
  | { type: "urlIncludes"; value: string }
  | { type: "pathPrefix"; value: string }
  | { type: "pathPattern"; source: string; flags?: string }  // RegExp against pathname
  | { type: "hashIncludes"; value: string }
  | { type: "titleIncludes"; value: string }
  | { type: "recording"; active: boolean }
```

Match rule (must not be guessed later):

```
allMatch = (all ?? []).every(pred)
anyMatch = (any?.length ?? 0) === 0 || any.some(pred)
matches  = allMatch && anyMatch
```

`hostSuffix` matches iff `host === suffix` OR `host.endsWith("." + suffix)` (case-insensitive, leading dots stripped). `notamazon.com` does **not** match `amazon.com`.

`loadCriteria` is **page state only**. Policy gates (`OriginBundle.enabled`) live in `evaluateAttachments`, not in predicates, so a disabled origin cannot be accidentally re-enabled by a catalog entry with `{ type: "always" }`.

### 4.3 `McpManifest` (attachable unit)

File: `src/core/mcp-manifest.ts`

```
McpManifest {
  id: string               // stable, e.g. "oggy.builtin.commerce.amazon"
  layer: ToolLayer
  title: string
  version: number
  loadCriteria: LoadCriteria
  tools: ToolRecipe[]
  skillsSnapshot?: { id, name, description }[]
}
```

`manifestToDomainMcp` is what MAIN already knows how to register (`registerRecipes(DomainMcp)` in `src/webmcp/index.ts`).

`fingerprintMcp` = `id@version` + sorted `name:steps.length:inputSchema` + skills snapshot ids. Used by the diff so SPA ticks are idempotent.

Existing `OriginBundle.mcp` becomes a learned manifest via `learnedToManifest(mcp, origin)` with

```
loadCriteria: { all: [{ type: "origin", origin }] }
```

### 4.4 Tools

`ToolRecipe` (existing, `src/core/index.ts`) gains:

```
layer?: ToolLayer
implementation?:
  | { kind: "recipe" }                              // default: play steps
  | { kind: "builtin"; handler: BuiltinHandlerId }  // MAIN builtin player
  | { kind: "composite"; uses: string[] }           // documents composition
```

**Primitives** (`PrimitiveKind`, `src/core/tool-names.ts`):

| Primitive | Capture (today) | Replay (`ReplayStep.type`) | Notes |
| --- | --- | --- | --- |
| `click` | `RecordedEvent.kind = "click"` / `"submit"` | `click` / `submit` | submit is a click with intent=submit in the skill flow |
| `input` | `kind = "input"` | `fill` / `select` | sensitive values already redacted (`src/core` redact) |
| `scroll` | typed, recorder **off** by default | `scroll` | noisy; enable per-session later |
| `move` | typed, recorder off | `move` | pointer/hover |
| `slide` | typed, recorder off | `slide` | drag |
| `read` | typed; also inferred when an input value is missing | `read` | “read input if required” |
| `output` | `navigate` / `network` map here in the skill flow | `output` | observational |

**Default domain tools** (catalog, Amazon host; `src/domains/commerce.ts`):

| Tool | Composed from primitives | Inputs |
| --- | --- | --- |
| `find_listing` | `input` (search) → `click`/`submit` → `read` results → `output` listings | `{ query: string, index?: number }` |
| `click_object` | `scroll` into view → `move` (optional hover) → `click` | `{ object: string, index?: number }` |
| `sign_up` | `read` required fields → `input` each → `click` submit → `output` | `{ email?, username?, password? }` password is runtime-only, never stored |
| `login` | same as sign_up on the login form | `{ email?, username?, password? }` |
| `add_to_cart` | `click_object` (“Add to Cart”) → `read` cart confirmation → `output` | `{ listing?, quantity? }` |

Amazon locators for the starting recipes come from the existing bench fixture (`benches/sites/amazon/index.html`: `#twotabsearchtextbox`, `button[type=submit]`, `.s-result-item`). They are **starting recipes**, not guaranteed against live amazon.com. Live drift is why `oggy_update_tool` exists.

**Meta:**

| Tool | Permission | Behavior |
| --- | --- | --- |
| `oggy_update_tool` | **Required.** Execute must not mutate. | Creates `ToolUpdateProposal` (`pending`). Returns “awaiting user permission”. |
| `oggy_list_skills` | None (read-only) | Returns `skillsSnapshot` baked in at attach time. |

### 4.5 Skills

File: `src/core/skills.ts`

On stop, `buildSkillFlow(session)` walks `session.events` in order and emits `SkillFlowStep[]`:

- each event → a primitive
- `value == null` on `input` → `requiredRead: true` (agent must `read` or ask)
- optional `toolHint` when a subsequence matches a domain tool (e.g. search input + submit → `find_listing`)

The popup/side panel **must** show this flow after stop (tool names, primitives, required reads). `oggy/skill/create` persists a `Skill`:

```
Skill {
  id, name, description, origin,
  loadCriteria,          // default: this origin
  flow: SkillFlow,
  sourceSessionId,
  createdAt
}
```

No skill is created implicitly by synthesis.

### 4.6 Permissioned `update_tool`

File: `src/core/permissions.ts`

Invariant, tested:

```
proposeToolUpdate(...)           → status = "pending"  (never writes a tool)
resolveToolUpdate(..., "denied") → status = "denied"   (still no write)
applyApprovedPatch(...)          → throws unless status === "approved"
```

`ToolPatch` may change `description`, `inputSchema`, `steps`, `annotations`, `title`, optional `name`.

Approved patches are stored as `OriginBundle.toolOverlays[toolName]` so **catalog tools are not mutated in code**. `evaluateAttachments` applies overlays on every attach. Learned tools in `bundle.mcp.tools` are patched in place as well (version bump).

**UX (required, not optional):**

1. Agent executes `oggy_update_tool`.
2. MAIN dispatches `oggy:v1:permission` (no storage write of the tool).
3. Isolated content posts `oggy/tool/proposeUpdate`.
4. Background upserts `pendingUpdates`, badges `?` (unless currently `REC`).
5. Side panel lists each pending row with **Approve** / **Deny**.
6. `oggy/tool/resolveUpdate` is the only path that may write overlays.

There is no silent `replaceMcp` from MAIN. Existing `replaceMcp` is only for HeuristicEngine on stop (Oggy’s own synthesis, not the agent).

---

## 5. Attachment algorithm (page load + 500ms SPA)

Files: `src/attach/evaluate.ts`, `src/attach/diff.ts`, hook in `src/entrypoints/content.ts`

Constant: `SPA_REFRESH_MS = 500` (`src/core/tool-names.ts`).

### 5.1 `evaluateAttachments({ page, bundle, catalog })`

1. If `page.origin` is not http(s) → `[]`.
2. Let `enabled = bundle?.enabled ?? true`.
3. If `!enabled && !page.recordingActive` → `[]`.
4. From `catalog`, keep manifests whose `loadCriteria` match `page`.
5. If `enabled` and `bundle.mcp?.tools.length` → add `learnedToManifest(bundle.mcp, page.origin)`.
6. If the set is non-empty **or** recording → add the meta manifest (`oggy_update_tool`, `oggy_list_skills` with current `bundle.skills`).
7. Apply `bundle.toolOverlays` to every tool with a matching name.
8. Drop manifests that still have zero tools.
9. Return `AttachmentTarget[]` (`id`, `layer`, `fingerprint`, `mcp`).

Catalog contents (`src/domains/catalog.ts`):

| id | loadCriteria | tools |
| --- | --- | --- |
| `oggy.builtin.primitives` | `{ all: [{ type: "recording", active: true }] }` | 7 primitives |
| `oggy.builtin.commerce.amazon` | `{ all: [{ type: "hostSuffix", value: "amazon.com" }] }` | 5 domain tools |
| `oggy.builtin.meta` | `{ any: [{ type: "recording", active: true }, { type: "always" }] }` | meta tools; **still gated by step 3** |

Unknown hosts do **not** get the five commerce tools. They get primitives while recording, plus whatever was learned on that origin.

### 5.2 `diffAttachments(current, desired)` — no thrash

```
unchanged: id in both AND fingerprint equal  → no MAIN I/O
attach:    id missing in current OR fingerprint changed → registerRecipes (MAIN aborts that id only, then registers)
detach:    id only in current → abort(mcpId)
```

MAIN (`src/entrypoints/oggy-main.ts`) holds `Map<mcpId, AbortController>` instead of a single controller. `BUS.abort` with no `mcpId` still means abort-all (origin disable / delete).

### 5.3 When the loop runs

| Trigger | Where |
| --- | --- |
| Content `main()` after hello | immediate `refreshAttachments` |
| `setInterval(..., SPA_REFRESH_MS)` | SPA / `history.pushState` without reload |
| `browser.storage.onChanged` (`oggy.origins` or `oggy.recording`) | recording start/stop, enable, overlays |
| `oggy/content/register` / `abort` from background | other tabs of the same origin; keep `attached` map in sync |

Do **not** abort+register on an unchanged fingerprint. That is the failure mode this spec exists to prevent.

---

## 6. Failure modes

| Failure | What the system does |
| --- | --- |
| Tool invalid (locator miss) | `playStep` does not throw (existing). Builtin handlers return an error string telling the agent to call `oggy_update_tool` with a patch. |
| `loadCriteria` mismatch (SPA left `/dp/` for `/cart`, or left amazon.com) | Next 500ms tick detaches that MCP id. Learned origin MCP stays if origin still matches. |
| User denies `update_tool` | Proposal `denied`. Overlays unchanged. Agent-visible result: denied. |
| User never answers | Stays `pending`. Tool stays as-is. |
| Agent calls `update_tool` | MAIN does not write storage. Any future helper that writes a tool from a pending proposal **must throw**. |
| Origin disabled | Evaluate returns `[]` unless recording. Background still broadcasts abort-all. |
| SPA hash/path change every 50ms | Tick is 500ms; fingerprint short-circuits MAIN. Worst case: at most one attach/detach per id per 500ms. |
| Name collision with a page-native tool | Existing `uniqueToolName` (`search` → `search_oggy`). |
| Password / secrets | Unchanged redaction. `sign_up` / `login` take password as a **runtime argument**. Skill flow marks those inputs `requiredRead` and stores no value. |
| Heuristic synthesis overwrites learned MCP | Known transition tradeoff. Overlays for catalog tools are independent. Do not use synthesis to write catalog ids. |

---

## 7. Messages

Existing (`src/core/index.ts`): `oggy/record/*`, `oggy/origin/*`, `oggy/session/append`.

Added:

| type | who | effect |
| --- | --- | --- |
| `oggy/skill/create` | popup / side panel | persist `Skill` on the origin bundle |
| `oggy/tool/proposeUpdate` | content (from MAIN event) | upsert pending proposal; **no tool write** |
| `oggy/tool/resolveUpdate` | side panel | `approved` → overlay + optional learned patch; `denied` → status only |

BUS (`oggy:v1:*`): existing `hello`, `register`, `abort`, `record`; added `permission`.

---

## 8. File / module mapping

| Module | Role |
| --- | --- |
| `docs/architecture/recording-mcp-skills.md` | This spec |
| `src/core/tool-names.ts` | Stable names, `SPA_REFRESH_MS`, layer unions |
| `src/core/page-context.ts` | `PageContext`, snapshot key |
| `src/core/load-criteria.ts` | `LoadCriteria`, `matchLoadCriteria` |
| `src/core/mcp-manifest.ts` | Manifest, fingerprint, learned wrap |
| `src/core/primitives.ts` | `RecordedEvent` → `PrimitiveCall` |
| `src/core/skills.ts` | `SkillFlow`, `buildSkillFlow`, `createSkillFromFlow` |
| `src/core/permissions.ts` | Proposal state machine; refuse unapproved patches |
| `src/attach/evaluate.ts` | Which MCPs apply |
| `src/attach/diff.ts` | Idempotent attach plan |
| `src/domains/commerce.ts` | Amazon builtin recipes + composition |
| `src/domains/catalog.ts` | `BUILTIN_MCP_CATALOG` |
| `src/webmcp/index.ts` | Per-recipe execute; permission event; new replay steps |
| `src/webmcp/builtins.ts` | Domain/primitive handlers |
| `src/entrypoints/content.ts` | 500ms loop, recording re-eval, permission bridge |
| `src/entrypoints/oggy-main.ts` | `Map<mcpId, AbortController>` |
| `src/entrypoints/background.ts` | Stop → skill flow; propose/resolve/create skill |
| `src/storage/index.ts` | `skills`, `pendingUpdates`, `toolOverlays` |
| `src/ui/sidepanel.ts` | Skill flow + pending permission rows |
| `src/engine/index.ts` | Unchanged role; maps new event kinds to steps or skip |

Chrome-free modules (`core`, `attach`, `domains`, `engine`, `webmcp`, `recorder`) stay importable from Vitest.

---

## 9. Implementation status (this change)

**In code now (contracts + hooks, not a product rewrite):**

- Types and pure functions above, with unit tests.
- Content 500ms reconciliation + per-id MAIN controllers.
- Stop handler writes `session.skillFlow`.
- Permission state machine + side panel Approve/Deny.
- Amazon catalog + primitives + meta manifests.
- `oggy/skill/create` storage path.

**Still later (intentionally not dumped half-baked):**

- Popup wizard copy for “Create skill from this flow” beyond side panel listing.
- Recorder listeners for `scroll` / `move` / `slide` (types exist; capturing them globally is noisy).
- Turning off HeuristicEngine auto-replace in favor of skill-only stop.
- Host packs beyond amazon.com.

When extending, add a catalog entry and tests for `loadCriteria` / `diffAttachments` before registering new tools on the page.
