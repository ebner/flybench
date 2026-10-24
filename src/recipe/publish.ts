/**
 * A recipe's text as the public site ships it: without the `references` block (photos
 * used only to check proportions while authoring, mostly copyrighted) and the comment
 * introducing it. The lines are blanked rather than removed, so line numbers still match.
 */
export function withoutReferences(text: string): string {
  const lines = text.split("\n");
  let inBlock = false;
  return lines
    .map((line, i) => {
      if (/^references\s*\{/.test(line)) inBlock = true;
      if (inBlock) {
        if (/^\}/.test(line)) inBlock = false;
        return "";
      }
      const next = lines[i + 1] ?? "";
      return /^\/\/.*refcheck/.test(line) && /^references\s*\{/.test(next) ? "" : line;
    })
    .join("\n");
}
