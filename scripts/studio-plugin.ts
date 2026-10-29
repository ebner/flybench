import { readdir, readFile, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import type { Plugin } from "vite";
import { isPatternFile } from "../src/studio/draft";

/** Where the studio page reads and writes pattern and natural files: /__studio/<kind>/… */
export const STUDIO_API = "/__studio";

/** The folders the studio may edit, by the name in the address. */
const KINDS = { patterns: "patterns", naturals: "naturals" } as const;

const MAX_BYTES = 256 * 1024;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * The authoring studio's file access, on the dev server only (never in a build), for
 * patterns/ and naturals/ (<kind> is "patterns" or "naturals"):
 *   GET  /__studio/<kind>          the file names
 *   GET  /__studio/<kind>/<file>   one file's text
 *   PUT  /__studio/<kind>/<file>   save it (with ?create=1, only if it doesn't exist yet)
 * Requests must come to a local host name, carry the X-Flybench-Studio header, and come from
 * the studio page itself: Vite grants cross-origin requests to any localhost port, so a page
 * served by another local process is turned away by its Origin header.
 */
export function studioPlugin(root: string): Plugin {
  return {
    name: "flybench-studio",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(STUDIO_API, (req, res) => {
        handle(root, req, res).catch((e: unknown) => send(res, 500, String(e)));
      });
    },
  };
}

async function handle(root: string, req: IncomingMessage, res: ServerResponse) {
  const host = (req.headers.host ?? "").replace(/:\d+$/, "");
  // The Host header is the client's word; the connection's address is not (vite --host).
  const peer = req.socket.remoteAddress ?? "";
  const loopback = peer === "::1" || peer.startsWith("127.") || peer.startsWith("::ffff:127.");
  if (!loopback || !LOCAL_HOSTS.has(host) || req.headers["x-flybench-studio"] !== "1") return send(res, 403, "studio requests only from this machine");
  // Browsers send Origin on cross-origin requests and on writes; it must be this server.
  const origin = req.headers.origin;
  if (origin !== undefined && origin !== `http://${req.headers.host}`) return send(res, 403, "studio requests only from the studio page");

  const url = new URL(req.url ?? "/", "http://localhost");
  const [kind, ...rest] = url.pathname.replace(/^\//, "").split("/");
  if (kind !== "patterns" && kind !== "naturals") return send(res, 404, "patterns or naturals");
  const dir = path.join(root, KINDS[kind]);
  const name = decodeURIComponent(rest.join("/"));
  if (name === "") {
    if (req.method !== "GET") return send(res, 405, "GET only");
    const files = (await readdir(dir)).filter(isPatternFile).sort();
    return send(res, 200, JSON.stringify(files), "application/json");
  }
  if (!isPatternFile(name)) return send(res, 400, `not a recipe file name: ${name}`);
  const file = path.join(dir, name);

  if (req.method === "GET") {
    try {
      return send(res, 200, await readFile(file, "utf8"), "text/plain; charset=utf-8");
    } catch {
      return send(res, 404, `no such file: ${kind}/${name}`);
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
