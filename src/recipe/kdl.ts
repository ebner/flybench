import { getLocation, InvalidKdlError, parse, type Node } from "@bgotink/kdl";
import type { RecipeError, SourceLocation } from "./errors";

/**
 * Maps a recipe KDL document onto a plain object for schema validation.
 *
 * Top-level node shapes:
 *   scalar  `name "Red Tag"`                 -> name: "Red Tag"
 *   values  `aliases "Worcester Gem" "X"`    -> aliases: ["Worcester Gem", "X"]
 *   record  `hook dry-standard size=14`      -> hook: { model: "dry-standard", size: 14 }
 *   list    `steps { wind herl to=0.8 }`     -> steps: [{ op: "wind", material: "herl", to: 0.8 }]
 *
 * For records the single argument (if the shape has an `arg`) fills `arg`. For
 * list children the node name fills `nameKey` and the optional single argument
 * fills `arg`. `key` renames a node whose KDL name isn't a good property name.
 *
 * Alongside the object, every path ("steps.3.to") gets the source location it
 * came from, so later validation errors can point at a line.
 */

type Shape = { key?: string } & (
  | { kind: "scalar" }
  | { kind: "values" }
  | { kind: "record"; arg: string | null }
  | { kind: "list"; nameKey: string; arg: string | null }
);

const TOP_LEVEL: Record<string, Shape> = {
  id: { kind: "scalar" },
  name: { kind: "scalar" },
  aliases: { kind: "values" },
  "variant-of": { kind: "scalar", key: "variantOf" },
  variant: { kind: "scalar" },
  type: { kind: "scalar" },
  imitates: { kind: "values" },
  difficulty: { kind: "scalar" },
  species: { kind: "values" },
  season: { kind: "values" },
  origin: { kind: "record", arg: null },
  description: { kind: "scalar" },
  history: { kind: "scalar" },
  fishing: { kind: "scalar" },
  sources: { kind: "list", nameKey: "title", arg: null },
  references: { kind: "list", nameKey: "image", arg: null },
  hook: { kind: "record", arg: "model" },
  thread: { kind: "record", arg: "color" },
  materials: { kind: "list", nameKey: "id", arg: "kind" },
  steps: { kind: "list", nameKey: "op", arg: "material" },
};

export interface KdlMapping {
  value: Record<string, unknown>;
  locations: Map<string, SourceLocation>;
}

export class KdlMappingError extends Error {
  constructor(readonly errors: RecipeError[]) {
    super(errors.map((e) => e.message).join("\n"));
  }
}

export function kdlToObject(text: string): KdlMapping {
  let doc;
  try {
    doc = parse(text, { storeLocations: true });
  } catch (e) {
    if (e instanceof InvalidKdlError) {
      throw new KdlMappingError(
        [...e.flat()].map((d) => ({
          // The parser appends " at line:column"; we report the location separately.
          message: d.message.replace(/ at \d+:\d+$/, ""),
          path: [],
          ...(d.start && { line: d.start.line, column: d.start.column }),
        })),
      );
    }
    throw e;
  }

  const value: Record<string, unknown> = {};
  const locations = new Map<string, SourceLocation>();
  const errors: RecipeError[] = [];

  const locate = (path: (string | number)[], el: Parameters<typeof getLocation>[0]) => {
    const loc = getLocation(el);
    if (loc) locations.set(path.join("."), { line: loc.start.line, column: loc.start.column });
  };
  const fail = (message: string, path: (string | number)[], el: Parameters<typeof getLocation>[0]) => {
    const loc = getLocation(el);
    errors.push({ message, path, ...(loc && { line: loc.start.line, column: loc.start.column }) });
  };

  /** Reads arguments and properties of `node` into `target`. */
  const readEntries = (
    node: Node,
    path: (string | number)[],
    target: Record<string, unknown>,
    argKey: string | null,
  ) => {
    const args = node.getArgumentEntries();
    if (args.length > 1 || (args.length === 1 && argKey === null)) {
      fail(`"${node.getName()}" takes ${argKey ? "at most one argument" : "no arguments"}`, path, node);
    } else if (args[0] && argKey) {
      target[argKey] = args[0].getValue();
      locate([...path, argKey], args[0]);
    }
    for (const entry of node.entries) {
      const key = entry.getName();
      if (key === null) continue;
      if (key in target) {
        fail(`"${key}" is given more than once`, [...path, key], entry);
        continue;
      }
      target[key] = entry.getValue();
      locate([...path, key], entry);
    }
  };

  for (const node of doc.nodes) {
    const name = node.getName();
    const shape = TOP_LEVEL[name];
    if (!shape) {
      fail(`unknown section "${name}" (expected one of: ${Object.keys(TOP_LEVEL).join(", ")})`, [name], node);
      continue;
    }
    const key = shape.key ?? name;
    if (key in value) {
      fail(`"${name}" is given more than once`, [key], node);
      continue;
    }
    locate([key], node);

    if (shape.kind === "scalar") {
      if (node.entries.length !== 1 || node.getArgumentEntries().length !== 1 || node.children) {
        fail(`"${name}" takes exactly one value`, [key], node);
        continue;
      }
      value[key] = node.getArgument(0);
    } else if (shape.kind === "values") {
      if (node.getArgumentEntries().length !== node.entries.length || node.children) {
        fail(`"${name}" takes a list of values only`, [key], node);
        continue;
      }
      node.getArgumentEntries().forEach((entry, i) => locate([key, i], entry));
      value[key] = node.getArguments();
    } else if (shape.kind === "record") {
      if (node.children) fail(`"${name}" does not take a children block`, [key], node);
      const record: Record<string, unknown> = {};
      readEntries(node, [key], record, shape.arg);
      value[key] = record;
    } else {
      if (node.entries.length > 0) fail(`"${name}" takes a children block only`, [key], node);
      const list: Record<string, unknown>[] = [];
      for (const [i, child] of (node.children?.nodes ?? []).entries()) {
        const path = [key, i];
        locate(path, child);
        const item: Record<string, unknown> = { [shape.nameKey]: child.getName() };
        locate([...path, shape.nameKey], child);
        if (child.children) fail(`"${child.getName()}" does not take a children block`, path, child);
        readEntries(child, path, item, shape.arg);
        list.push(item);
      }
      value[key] = list;
    }
  }

  if (errors.length > 0) throw new KdlMappingError(errors);
  return { value, locations };
}
