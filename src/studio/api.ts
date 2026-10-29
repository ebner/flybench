/** The dev server's pattern and natural files (see scripts/studio-plugin.ts). */
export type FileKind = "patterns" | "naturals";

const API = "/__studio";
const HEADERS = { "X-Flybench-Studio": "1" };

async function ok(res: Response): Promise<Response> {
  if (!res.ok) throw new Error((await res.text()) || `${res.status} ${res.statusText}`);
  return res;
}

export async function listFiles(kind: FileKind): Promise<string[]> {
  return (await ok(await fetch(`${API}/${kind}`, { headers: HEADERS }))).json() as Promise<string[]>;
}

export async function readFile(kind: FileKind, file: string): Promise<string> {
  return (await ok(await fetch(`${API}/${kind}/${encodeURIComponent(file)}`, { headers: HEADERS }))).text();
}

/** Saves a file; `create` refuses to overwrite one that already exists. */
export async function saveFile(kind: FileKind, file: string, text: string, create = false): Promise<void> {
  await ok(
    await fetch(`${API}/${kind}/${encodeURIComponent(file)}${create ? "?create=1" : ""}`, {
      method: "PUT",
      headers: { ...HEADERS, "Content-Type": "text/plain; charset=utf-8" },
      body: text,
    }),
  );
}
