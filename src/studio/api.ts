/** The dev server's pattern files (see scripts/studio-plugin.ts). */
const API = "/__studio/patterns";
const HEADERS = { "X-Flybench-Studio": "1" };

async function ok(res: Response): Promise<Response> {
  if (!res.ok) throw new Error((await res.text()) || `${res.status} ${res.statusText}`);
  return res;
}

export async function listPatterns(): Promise<string[]> {
  return (await ok(await fetch(API, { headers: HEADERS }))).json() as Promise<string[]>;
}

export async function readPattern(file: string): Promise<string> {
  return (await ok(await fetch(`${API}/${encodeURIComponent(file)}`, { headers: HEADERS }))).text();
}

/** Saves a pattern; `create` refuses to overwrite a file that already exists. */
export async function savePattern(file: string, text: string, create = false): Promise<void> {
  await ok(
    await fetch(`${API}/${encodeURIComponent(file)}${create ? "?create=1" : ""}`, {
      method: "PUT",
      headers: { ...HEADERS, "Content-Type": "text/plain; charset=utf-8" },
      body: text,
    }),
  );
}
