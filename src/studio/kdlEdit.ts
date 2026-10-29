import { format, parse, type Document, type Entry, type Node } from "@bgotink/kdl";

/**
 * Edits a recipe's KDL text in place, keeping its comments, order and formatting: the studio's
 * form changes one value (or adds, removes or moves one node) and the rest of the file stays
 * exactly as written.
 *
 * A path names a value: the top-level node, for a list section the item's index, then the
 * property; `ARG` is a node's argument (a scalar's value, a material's kind) and `NAME` a list
 * item's node name (a body section's name, a step's op).
 *   ["name", ARG]             name "Red Tag"
 *   ["size", "max"]           size min=5 max=11
 *   ["parts", 3, "length"]    the fourth part's length
 *   ["materials", 0, ARG]     the first material's kind
 */
export const ARG = "@arg";
export const NAME = "@name";

export type KdlValue = string | number | boolean;
export type Path = (string | number)[];

export type Edit =
  | { type: "set"; path: Path; value: KdlValue }
  | { type: "delete"; path: Path }
  /** Adds `node` (KDL text of one node) at the end of a list section, made if missing. */
  | { type: "add"; section: string; node: string }
  | { type: "remove"; section: string; index: number }
  | { type: "move"; section: string; index: number; to: number }
  /** Replaces all arguments of a top-level node (`species trout grayling`); none removes it. */
  | { type: "args"; section: string; values: KdlValue[] };

const INDENT = "    ";

/** The top-level node `name`, if there is one. */
function top(doc: Document, name: string): Node | undefined {
  return doc.nodes.find((n) => n.getName() === name);
}

/** The children of a list section: what its index counts (comments aren't nodes). */
function items(node: Node | undefined): Node[] {
  return node?.children?.nodes ?? [];
}

/**
 * A new node at the end of `parent`, on a line of its own, indented like its last sibling (or the
 * file's four spaces). A node's leading text holds the comment lines above it too: only its last
 * line's indent is copied. In an empty block, or one written on one line, it starts a new line.
 */
function append(parent: Document, node: Node, indent: string) {
  const last = parent.nodes[parent.nodes.length - 1];
  if (last && last.trailing?.includes("\n")) {
    node.leading = last.leading?.split("\n").pop() ?? indent;
    node.trailing = last.trailing;
  } else {
    node.leading = `\n${indent}`;
    // In an empty block the line break before its `}` is already there.
    node.trailing = last ? "\n" : "";
  }
  parent.appendNode(node);
}

/**
 * After a list's order changed: the line break after the block's `{` belongs to the first
 * node's leading text, so it moves to whichever node is first now.
 */
function settleFirst(parent: Document, breakFirst: boolean) {
  parent.nodes.forEach((n, i) => {
    const leading = n.leading ?? "";
    if (i === 0 && breakFirst && !leading.startsWith("\n")) n.leading = `\n${leading}`;
    if (i > 0 && leading.startsWith("\n") && parent.nodes[i - 1]!.trailing?.endsWith("\n")) n.leading = leading.slice(1);
    // A node written last on a compact line (`a wool; b wool`) needs its `;` once something follows it.
    if (i < parent.nodes.length - 1) separate(n);
  });
}

/** Ends a node's line (or gives it a `;`) so that a node after it is a node of its own. */
function separate(n: Node, newline = false) {
  const trailing = n.trailing ?? "";
  if (trailing.includes("\n") || (!newline && trailing.includes(";"))) return;
  n.trailing = newline ? `${trailing}\n` : `;${trailing}`;
}

/** Where a missing top-level node goes: after the last one that comes before it in `order`, else at the end. */
function placeTop(doc: Document, node: Node, order?: string[]) {
  const at = order?.indexOf(node.getName()) ?? -1;
  const before = at < 0 ? [] : doc.nodes.filter((n) => {
    const i = order!.indexOf(n.getName());
    return i >= 0 && i < at;
  });
  const after = before[before.length - 1];
  if (after) {
    separate(after, true);
    node.leading = after.leading?.split("\n").pop() ?? "";
    node.trailing = "\n";
    doc.insertNodeAfter(node, after);
  } else {
    const last = doc.nodes[doc.nodes.length - 1];
    if (last) separate(last, true);
    node.leading = "\n";
    doc.appendNode(node);
  }
}

/**
 * A new value written as the old one was: a quoted string stays quoted (`name "Red Tag"`), a bare
 * word bare, and a multi-line string (a recipe's history) stays multi-line at its indent.
 */
function setKeepingQuotes(entry: Entry, value: KdlValue) {
  const old = entry.value.representation ?? "";
  entry.setValue(value);
  if (typeof value !== "string") return;
  if (old.startsWith('"""')) {
    const indent = old.match(/\n([ \t]*)"""$/)?.[1] ?? "";
    const lines = value.split("\n").map((l) => (l ? indent + l.replace(/\\/g, "\\\\").replace(/"""/g, '\\"""') : ""));
    entry.value.representation = `"""\n${lines.join("\n")}\n${indent}"""`;
  } else if (old.startsWith('"')) entry.value.representation = JSON.stringify(value);
}

/** `order`: the top-level nodes in the order the file keeps them (the recipe's sections), for a node not written yet. */
export function editKdl(text: string, edit: Edit, order?: string[]): string {
  const doc = parse(text);
  switch (edit.type) {
    case "set":
    case "delete": {
      const [section, ...rest] = edit.path;
      let node = top(doc, String(section));
      if (!node) {
        if (edit.type === "delete") return text;
        // A top-level value that isn't written yet: a new line where the sections' order puts it.
        node = parse(`${String(section)}`, { as: "node" });
        placeTop(doc, node, order);
      }
      let key = rest[0];
      if (typeof key === "number") {
        const item = items(node)[key];
        if (!item) throw new Error(`no item ${key} in ${String(section)}`);
        node = item;
        key = rest[1];
      }
      if (key === undefined) throw new Error(`a path names a value: ${edit.path.join(".")}`);
      if (key === NAME) {
        if (edit.type === "set") node.setName(String(edit.value));
      } else if (key === ARG) {
        if (edit.type === "delete") node.removeArgument(0);
        else if (node.hasArgument(0)) setKeepingQuotes(node.getArgumentEntry(0)!, edit.value);
        else node.addArgument(edit.value);
      } else if (edit.type === "delete") node.deleteProperty(String(key));
      else if (node.getPropertyEntry(String(key))) setKeepingQuotes(node.getPropertyEntry(String(key))!, edit.value);
      else node.setProperty(String(key), edit.value);
      break;
    }
    case "add": {
      const section = top(doc, edit.section);
      if (!section || !section.children) {
        // A section of its own with the one node in it, at the end of the file.
        const fresh = parse(`${edit.section} {\n${INDENT}${edit.node}\n}`, { as: "node" });
        if (section) doc.replaceNode(section, fresh);
        else placeTop(doc, fresh, order);
        break;
      }
      append(section.children, parse(edit.node, { as: "node" }), INDENT);
      break;
    }
    case "args": {
      let node = top(doc, edit.section);
      if (!node && edit.values.length === 0) return text;
      if (!node) {
        node = parse(edit.section, { as: "node" });
        placeTop(doc, node, order);
      }
      if (edit.values.length === 0) {
        doc.removeNode(node);
        break;
      }
      // Quoted as before: if the values were written in quotes, the new ones are too.
      const quoted = node.getArgumentEntries().some((e) => e.value.representation?.startsWith('"'));
      while (node.hasArgument(0)) node.removeArgument(0);
      for (const v of edit.values) node.addArgument(v);
      if (quoted) for (const e of node.getArgumentEntries()) if (typeof e.getValue() === "string") e.value.representation = JSON.stringify(e.getValue());
      break;
    }
    case "remove": {
      const section = top(doc, edit.section);
      const item = items(section)[edit.index];
      if (!section?.children || !item) return text;
      const breakFirst = section.children.nodes[0]?.leading?.startsWith("\n") ?? false;
      section.children.removeNode(item);
      settleFirst(section.children, breakFirst);
      break;
    }
    case "move": {
      const section = top(doc, edit.section);
      const list = items(section);
      const item = list[edit.index];
      const target = list[edit.to];
      if (!section?.children || !item || !target || edit.index === edit.to) return text;
      // Its comment lines and indentation travel with it (they are its leading text).
      const breakFirst = section.children.nodes[0]?.leading?.startsWith("\n") ?? false;
      section.children.removeNode(item);
      if (edit.to > edit.index) section.children.insertNodeAfter(item, target);
      else section.children.insertNodeBefore(item, target);
      settleFirst(section.children, breakFirst);
      break;
    }
  }
  return format(doc);
}
