import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

export const FIXTURE_PORT = 4174;

const sitesRoot = resolve(
  fileURLToPath(new URL("../sites", import.meta.url)),
);

export function startFixtureServer(
  port = FIXTURE_PORT,
): Promise<{ close: () => Promise<void>; origin: string }> {
  const server = createServer((req, res) => {
    serve(req, res);
  });

  return new Promise((resolveStart, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      resolveStart({
        origin: `http://127.0.0.1:${port}`,
        close: () =>
          new Promise((resolveClose, rejectClose) => {
            server.close((err) => (err ? rejectClose(err) : resolveClose()));
          }),
      });
    });
  });
}

function serve(req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith("/")) rel += "index.html";
  if (rel.startsWith("/")) rel = rel.slice(1);
  const file = resolve(sitesRoot, rel);
  if (!file.startsWith(sitesRoot)) {
    res.writeHead(403).end("forbidden");
    return;
  }
  if (!existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404).end("not found");
    return;
  }
  const type = MIME[extname(file)] || "application/octet-stream";
  res.writeHead(200, { "content-type": type });
  createReadStream(file).pipe(res);
}
