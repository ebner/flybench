import { getLocation, parse } from "@bgotink/kdl";

/**
 * A recipe's text as the public site ships it: without the `references` block (photos
 * used only to check proportions while authoring, mostly copyrighted) and the comment
 * introducing it. The parser finds the block wherever and however it is written; its
 * characters are removed but its line breaks kept, so line numbers still match. Text that
 * doesn't parse is returned unchanged, for the loader to report.
 */
export function withoutReferences(text: string): string {
  let doc;
  try {
    // A commented-out block (`/-references`) is no node, but its text would still ship:
    // parse with the slashdash blanked, which keeps every offset the same.
    doc = parse(text.replace(/\/-(\s*references\b)/g, "  $1"), { storeLocations: true });
  } catch {
    return text;
  }
  let out = text;
  // From the end, so earlier offsets stay valid.
  for (const node of [...doc.nodes].reverse()) {
    if (node.getName() !== "references") continue;
    const loc = getLocation(node);
    if (!loc) continue;
    let start = loc.start.offset;
    // Take a slashdash in front of it along.
    start -= out.slice(0, start).match(/\/-\s*$/)?.[0].length ?? 0;
    // The comment introducing the block, on the line just before it.
    const lineStart = out.lastIndexOf("\n", start - 1) + 1;
    const previousStart = out.lastIndexOf("\n", lineStart - 2) + 1;
    if (lineStart > 0 && /^\s*\/\/.*refcheck/.test(out.slice(previousStart, lineStart - 1))) start = previousStart;
    out = out.slice(0, start) + out.slice(start, loc.end.offset).replace(/[^\n]/g, "") + out.slice(loc.end.offset);
  }
  return out;
}
