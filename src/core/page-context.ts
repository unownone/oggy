/**
 * Snapshot of page state used by loadCriteria matching.
 * The 500ms SPA loop compares this, not the full DOM.
 */
export interface PageContext {
  href: string;
  origin: string;
  host: string;
  pathname: string;
  search: string;
  hash: string;
  title: string;
  recordingActive: boolean;
}

export function pageContextFromLocation(input: {
  href: string;
  title?: string;
  recordingActive?: boolean;
}): PageContext {
  let origin = input.href;
  let host = "";
  let pathname = "";
  let search = "";
  let hash = "";
  try {
    const url = new URL(input.href);
    origin = url.origin;
    host = url.hostname;
    pathname = url.pathname;
    search = url.search;
    hash = url.hash;
  } catch {
    // Invalid href: leave URL parts empty; origin falls back to the raw string.
  }

  return {
    href: input.href,
    origin,
    host,
    pathname,
    search,
    hash,
    title: input.title ?? "",
    recordingActive: input.recordingActive ?? false,
  };
}

/** Cheap equality key. Evaluate still runs; MAIN I/O is gated by the attach diff. */
export function pageContextKey(page: PageContext): string {
  return [
    page.origin,
    page.pathname,
    page.search,
    page.hash,
    page.title,
    page.recordingActive ? "1" : "0",
  ].join("|");
}
