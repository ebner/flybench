import { readdir, readFile, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import type { Plugin } from "vite";
import { isPatternFile } from "../src/studio/draft";

/** Where the studio page reads and writes pattern files. */
export const STUDIO_API = "/__studio/patterns";

const MAX_BYTES = 256 * 1024;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * The authoring studio's file access, on the dev server only (never in a build):
 *   GET  /__studio/patterns          the pattern file names
 *   GET  /__studio/patterns/<file>   one file's text
 *   PUT  /__studio/patterns/<file>   save it (with ?create=1, only if it doesn't exist yet)
 * Requests must come to a local host name and carry the X-Flybench-Studio header, which a
 * page on another site can't send without a preflight the dev server doesn't grant.
 */
export function studioPlugin(root: string): Plugin {
  const dir = path.join(root, "patterns");
  return {
    name: "flybench-studio",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(STUDIO_API, (req, res) => {
        handle(dir, req, res).catch((e: unknown) => send(res, 500, String(e)));
      });
    },
  };
}

async function handle(dir: string, req: IncomingMessage, res: ServerResponse) {
  const host = (req.headers.host ?? "").replace(/:\d+$/, "");
  if (!LOCAL_HOSTS.has(host) || req.headers["x-flybench-studio"] !== "1") return send(res, 403, "studio requests only from this machine");

  const url = new URL(req.url ?? "/", "http://localhost");
  const name = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (name === "") {
    if (req.method !== "GET") return send(res, 405, "GET only");
    const files = (await readdir(dir)).filter(isPatternFile).sort();
    return send(res, 200, JSON.stringify(files), "application/json");
  }
  if (!isPatternFile(name)) return send(res, 400, `not a pattern file name: ${name}`);
  const file = path.join(dir, name);

  if (req.method === "GET") {
    try {
      return send(res, 200, await readFile(file, "utf8"), "text/plain; charset=utf-8");
    } catch {
      return send(res, 404, `no such pattern: ${name}`);
    }
  }
  if (req.method === "PUT") {
    const text = await readBody(req);
    if (text === null) return send(res, 413, "too large");
    try {
      await writeFile(file, text, { encoding: "utf8", flag: url.searchParams.get("create") === "1" ? "wx" : "w" });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "EEXIST") return send(res, 409, `${name} already exists`);
      throw e;
    }
    return send(res, 204, "");
  }
  return send(res, 405, "GET or PUT only");
}

function readBody(req: IncomingMessage): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BYTES) {
        resolve(null);
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function send(res: ServerResponse, status: number, body: string, type = "text/plain; charset=utf-8") {
  res.statusCode = status;
  if (body) res.setHeader("Content-Type", type);
  res.end(body);
}
