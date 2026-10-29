import type { z } from "zod";
import type { Shape } from "../recipe/kdl";
import { Color, GapeLength, MaterialRef, Position } from "../recipe/schema";
import { ARG, NAME } from "./kdlEdit";

/**
 * The studio's form, described from the recipe schemas: what each value is (a number with its
 * range, a choice, a colour, a yes/no, text) and where it is written in the KDL (a property, a
 * node's argument or a list item's name). Pure data, so it can be tested in Node.
 */
export type FieldType = "number" | "integer" | "boolean" | "enum" | "color" | "material" | "string" | "text" | "values";

export interface Field {
  /** The key in the parsed object. */
  key: string;
  /** Where it is written: a property name, ARG or NAME. */
  kdl: string;
  type: FieldType;
  min?: number;
  max?: number;
  options?: string[];
  optional: boolean;
  default?: unknown;
  /** A choice among numbers (a wing count of 2 or 4): written as a number. */
  numeric?: boolean;
  /** A web address. */
  url?: boolean;
  /** A number measured along the shank (0 the bend, 1 behind the eye), or in hook gapes. */
  measure?: "shank" | "gape";
}

export interface ItemKind {
  /** The node name that selects it (a part, a step's op), or "" for lists of one kind. */
  name: string;
  fields: Field[];
}

export interface FormSection {
  /** The top-level KDL node and the key in the parsed object. */
  node: string;
  key: string;
  shape: Shape["kind"];
  /** Scalars, values and records: their fields (a scalar's one field is written as ARG). */
  fields: Field[];
  /** Lists: the kinds of item, by node name for unions. */
  items?: ItemKind[];
  /** Lists: the key the node name fills (a union's discriminator, a body section's name). */
  nameKey?: string;
}

type Def = { type: string; [k: string]: unknown };
const def = (s: z.ZodType): Def => (s as unknown as { _zod: { def: Def } })._zod.def;

/** The schema under optional and default wrappers, with what they say. */
function unwrap(s: z.ZodType): { inner: z.ZodType; optional: boolean; default?: unknown } {
  let optional = false;
  let dflt: unknown;
  let cur = s;
  for (;;) {
    const d = def(cur);
    if (d.type === "optional") {
      optional = true;
      cur = d.innerType as z.ZodType;
    } else if (d.type === "default") {
      optional = true;
      dflt = typeof d.defaultValue === "function" ? (d.defaultValue as () => unknown)() : d.defaultValue;
      cur = d.innerType as z.ZodType;
    } else return { inner: cur, optional, default: dflt };
  }
}

// Assumption-free: the long prose fields are the ones edited in a text box.
const LONG_TEXT = new Set(["description", "history", "fishing", "note", "examples"]);

/** One value's field, or null for what the form doesn't edit (a fixed literal). */
export function fieldOf(key: string, kdl: string, schema: z.ZodType): Field | null {
  const { inner, optional, default: dflt } = unwrap(schema);
  const d = def(inner);
  const base = { key, kdl, optional, ...(dflt !== undefined && { default: dflt }) };
  if (inner === (Color as unknown as z.ZodType)) return { ...base, type: "color" };
  if (inner === (MaterialRef as unknown as z.ZodType)) return { ...base, type: "material" };
  const measure = inner === (Position as unknown as z.ZodType) ? "shank" : inner === (GapeLength as unknown as z.ZodType) ? "gape" : undefined;
  switch (d.type) {
    case "number": {
      const checks = ((d.checks as { _zod: { def: { check: string; value?: number; format?: string } } }[] | undefined) ?? []).map((c) => c._zod.def);
      const min = checks.find((c) => c.check === "greater_than")?.value;
      const max = checks.find((c) => c.check === "less_than")?.value;
      const integer = checks.some((c) => c.format === "safeint");
      return { ...base, type: integer ? "integer" : "number", ...(min !== undefined && { min }), ...(max !== undefined && { max }), ...(measure && { measure }) };
    }
    case "boolean":
      return { ...base, type: "boolean" };
    case "enum":
      return { ...base, type: "enum", options: Object.values(d.entries as Record<string, string>) };
    case "string":
      return { ...base, type: LONG_TEXT.has(key) ? "text" : "string", ...(d.format === "url" && { url: true }) };
    case "array": {
      const element = def(d.element as z.ZodType);
      return { ...base, type: "values", ...(element.type === "enum" && { options: Object.values(element.entries as Record<string, string>) }) };
    }
    case "union": {
      // A choice among literals (a wing count of 2 or 4).
      const options = (d.options as z.ZodType[]).map((o) => def(o));
      if (options.every((o) => o.type === "literal")) {
        const values = options.flatMap((o) => o.values as unknown[]);
        return { ...base, type: "enum", options: values.map(String), numeric: values.every((v) => typeof v === "number") };
      }
      return { ...base, type: "string" };
    }
    case "literal":
      return null;
    default:
      return { ...base, type: "string" };
  }
}

/** The fields of an object schema, the node name and argument keys written as NAME and ARG. */
function objectFields(schema: z.ZodType, nameKey?: string, arg?: string | null): Field[] {
  const shape = def(unwrap(schema).inner).shape as Record<string, z.ZodType> | undefined;
  if (!shape) return [];
  return Object.entries(shape).flatMap(([key, s]) => {
    const f = fieldOf(key, key === nameKey ? NAME : key === arg ? ARG : key, s);
    return f ? [f] : [];
  });
}

/** The form for a document: one section per top-level node the document may have. */
export function formSections(sections: Record<string, Shape>, schema: z.ZodType): FormSection[] {
  const shape = def(unwrap(schema).inner).shape as Record<string, z.ZodType>;
  return Object.entries(sections).flatMap(([node, s]): FormSection[] => {
    const key = s.key ?? node;
    const field = shape[key];
    if (!field) return [];
    switch (s.kind) {
      case "scalar":
      case "values": {
        const f = fieldOf(key, ARG, field);
        return f ? [{ node, key, shape: s.kind, fields: [f] }] : [];
      }
      case "record":
        return [{ node, key, shape: s.kind, fields: objectFields(field, undefined, s.arg) }];
      case "list": {
        const element = def(unwrap(field).inner).element as z.ZodType;
        const ed = def(unwrap(element).inner);
        if (ed.type === "union" && typeof ed.discriminator === "string") {
          // A union by node name (a natural's parts, a pattern's steps).
          const items = (ed.options as z.ZodType[]).map((o) => {
            const literal = def((def(o).shape as Record<string, z.ZodType>)[ed.discriminator as string]!);
            return { name: String((literal.values as unknown[])[0]), fields: objectFields(o, s.nameKey, s.arg).filter((f) => f.kdl !== NAME) };
          });
          return [{ node, key, shape: s.kind, fields: [], items, nameKey: s.nameKey }];
        }
        return [{ node, key, shape: s.kind, fields: [], items: [{ name: "", fields: objectFields(element, s.nameKey, s.arg) }], nameKey: s.nameKey }];
      }
    }
  });
}

/**
 * KDL text for a new list item: its required values filled with a start (a range's lower end,
 * the first choice, black, an example address). Many items load as they are; some don't until
 * filled in (a material's id, a step's place in the order, body lengths that add up), and the
 * problems list says what.
 */
export function newItemText(item: ItemKind, name?: string): string {
  const quote = (v: string) => (/^[a-z][a-z0-9-]*$/.test(v) ? v : JSON.stringify(v));
  const value = (f: Field): string => {
    switch (f.type) {
      case "number":
      case "integer":
        return String(f.min !== undefined && f.min > 0 ? f.min : f.type === "integer" ? 1 : 0.1);
      case "boolean":
        return "#false";
      case "enum":
        return f.numeric ? (f.options?.[0] ?? "0") : quote(f.options?.[0] ?? "");
      case "color":
        return "black";
      default:
        return JSON.stringify(f.url ? "https://example.com/" : "…");
    }
  };
  const named = item.fields.find((f) => f.kdl === NAME);
  const head = name ?? (named ? (named.type === "enum" || named.url ? value(named) : "new") : "item");
  const arg = item.fields.find((f) => f.kdl === ARG && !f.optional);
  const props = item.fields.filter((f) => !f.optional && f.kdl !== NAME && f.kdl !== ARG).map((f) => `${f.kdl}=${value(f)}`);
  return [named && name === undefined && (named.type === "enum" || named.url) ? head : quote(head), ...(arg ? [value(arg)] : []), ...props].join(" ");
}
