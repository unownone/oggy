import type { PageContext } from "./page-context";

/**
 * Page-state matcher for an attachable MCP.
 * Empty `{}` matches every page. Policy gates (origin enabled) are NOT
 * expressed here — see evaluateAttachments.
 */
export interface LoadCriteria {
  /** Every predicate must match. Omitted / empty = true. */
  all?: LoadPredicate[];
  /** At least one predicate must match. Omitted / empty = true. */
  any?: LoadPredicate[];
}

export type LoadPredicate =
  | { type: "always" }
  | { type: "origin"; origin: string }
  | { type: "hostSuffix"; value: string }
  | { type: "urlIncludes"; value: string }
  | { type: "pathPrefix"; value: string }
  | { type: "pathPattern"; source: string; flags?: string }
  | { type: "hashIncludes"; value: string }
  | { type: "titleIncludes"; value: string }
  | { type: "recording"; active: boolean };

export function matchLoadCriteria(
  criteria: LoadCriteria | undefined,
  page: PageContext,
): boolean {
  const all = criteria?.all ?? [];
  const any = criteria?.any ?? [];
  const allMatch = all.every((pred) => matchPredicate(pred, page));
  const anyMatch = any.length === 0 || any.some((pred) => matchPredicate(pred, page));
  return allMatch && anyMatch;
}

export function matchPredicate(
  pred: LoadPredicate,
  page: PageContext,
): boolean {
  switch (pred.type) {
    case "always":
      return true;
    case "origin":
      return page.origin === pred.origin;
    case "hostSuffix":
      return hostMatchesSuffix(page.host, pred.value);
    case "urlIncludes":
      return page.href.includes(pred.value);
    case "pathPrefix":
      return (
        page.pathname === pred.value || page.pathname.startsWith(pred.value)
      );
    case "pathPattern": {
      try {
        return new RegExp(pred.source, pred.flags ?? "").test(page.pathname);
      } catch {
        return false;
      }
    }
    case "hashIncludes":
      return page.hash.includes(pred.value);
    case "titleIncludes":
      return page.title.includes(pred.value);
    case "recording":
      return page.recordingActive === pred.active;
    default: {
      const _exhaustive: never = pred;
      throw new Error(
        `Unhandled load predicate: ${(_exhaustive as LoadPredicate).type}`,
      );
    }
  }
}

/**
 * "amazon.com" matches amazon.com and www.amazon.com, not notamazon.com.
 */
export function hostMatchesSuffix(host: string, suffix: string): boolean {
  const h = host.toLowerCase().replace(/^\.+/, "");
  const s = suffix.toLowerCase().replace(/^\.+/, "");
  if (!h || !s) return false;
  return h === s || h.endsWith(`.${s}`);
}
