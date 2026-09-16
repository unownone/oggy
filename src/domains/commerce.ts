import type { Locator, ToolRecipe } from "@/core";
import type { McpManifest } from "@/core/mcp-manifest";
import { MCP_ID, type DomainToolName } from "@/core/tool-names";

const loc = {
  search: [{ strategy: "id", value: "twotabsearchtextbox" }] satisfies Locator[],
  submit: [
    { strategy: "css", value: "button[type=submit], input[type=submit]" },
  ] satisfies Locator[],
  listing: [{ strategy: "css", value: ".s-result-item" }] satisfies Locator[],
  addToCart: [
    { strategy: "id", value: "add-to-cart-button" },
    { strategy: "css", value: "input#add-to-cart-button, #add-to-cart-button" },
  ] satisfies Locator[],
};

const writeAnno = {
  readOnlyHint: false,
  consequentialHint: false,
  untrustedContentHint: false,
} as const;

const consequential = {
  readOnlyHint: false,
  consequentialHint: true,
  untrustedContentHint: false,
} as const;

/**
 * Default commerce domain tools. Starting recipes use Amazon-like locators
 * from benches/sites/amazon; live sites may need oggy_update_tool overlays.
 *
 * Composition (primitives):
 *   find_listing  = input → click/submit → read → output
 *   click_object  = scroll → move → click
 *   sign_up/login = read (if required) → input* → click → output
 *   add_to_cart   = click_object → read → output
 */
export function commerceDomainTools(): ToolRecipe[] {
  return [
    domainTool("find_listing", {
      description:
        "Search this site and return listings. Primitives: input(query) → click(submit) → read(results) → output.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
          index: { type: "number", description: "Optional 1-based listing index to open" },
        },
        required: ["query"],
      },
      annotations: writeAnno,
      steps: [
        { type: "fill", locators: loc.search, arg: "query" },
        { type: "click", locators: loc.submit },
        { type: "waitFor", locators: loc.listing },
        { type: "read", locators: loc.listing },
        { type: "output", locators: loc.listing },
      ],
    }),
    domainTool("click_object", {
      description:
        "Click a named object on the page (listing, button, link). Primitives: scroll → move → click.",
      inputSchema: {
        type: "object",
        properties: {
          object: { type: "string", description: "Visible name or listing title" },
          index: { type: "number", description: "Optional 1-based index among matches" },
        },
        required: ["object"],
      },
      annotations: writeAnno,
      steps: [
        { type: "scroll", locators: loc.listing },
        { type: "move", locators: loc.listing },
        { type: "click", locators: loc.listing },
      ],
    }),
    domainTool("sign_up", {
      description:
        "Create an account. Password is a runtime argument and is never stored from recordings. Primitives: read (if required) → input → click → output.",
      inputSchema: {
        type: "object",
        properties: {
          email: { type: "string" },
          username: { type: "string" },
          password: { type: "string" },
        },
      },
      annotations: consequential,
      steps: [],
    }),
    domainTool("login", {
      description:
        "Sign in. Password is a runtime argument and is never stored from recordings. Primitives: read (if required) → input → click → output.",
      inputSchema: {
        type: "object",
        properties: {
          email: { type: "string" },
          username: { type: "string" },
          password: { type: "string" },
        },
      },
      annotations: consequential,
      steps: [],
    }),
    domainTool("add_to_cart", {
      description:
        "Add the current or named listing to the cart. Primitives: click_object → read confirmation → output.",
      inputSchema: {
        type: "object",
        properties: {
          listing: { type: "string" },
          quantity: { type: "number" },
        },
      },
      annotations: consequential,
      steps: [
        { type: "click", locators: loc.addToCart },
        { type: "waitFor", locators: loc.addToCart },
      ],
    }),
  ];
}

function domainTool(
  name: DomainToolName,
  spec: {
    description: string;
    inputSchema: Record<string, unknown>;
    annotations: ToolRecipe["annotations"];
    steps: ToolRecipe["steps"];
  },
): ToolRecipe {
  return {
    name,
    title: name,
    description: spec.description,
    inputSchema: spec.inputSchema,
    annotations: spec.annotations,
    steps: spec.steps,
    layer: "domain",
    implementation: { kind: "builtin", handler: name },
  };
}

export const amazonCommerceManifest: McpManifest = {
  id: MCP_ID.commerceAmazon,
  layer: "domain",
  title: "Amazon commerce tools",
  version: 1,
  loadCriteria: { all: [{ type: "hostSuffix", value: "amazon.com" }] },
  tools: commerceDomainTools(),
};
