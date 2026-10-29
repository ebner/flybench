import { ARG, NAME } from "./kdlEdit";
import type { Field, FormSection } from "./schemaForm";

/**
 * Writes a recipe (a pattern or a natural, as parsed) as KDL text in the files' style: sections
 * in their order, list items one to a line, values left out where they are the schema's
 * default. A visitor's own fly is kept and shared in this form, and loads back as it was.
 */
export function writeKdl(value: Record<string, unknown>, sections: FormSection[]): string {
  const lines: string[] = [];
  for (const section of sections) {
    const v = value[section.key];
    if (v === undefined || (Array.isArray(v) && v.length === 0 && section.shape !== "scalar")) continue;
    switch (section.shape) {
      case "scalar":
        lines.push(`${section.node} ${scalar(v, section.fields[0]!)}`);
        break;
      case "values":
        lines.push(`${section.node} ${(v as unknown[]).map((x) => literal(x)).join(" ")}`);
        break;
      case "record":
        lines.push([section.node, ...entries(v as Record<string, unknown>, section.fields)].join(" "));
        break;
      case "list": {
        const nameKey = section.nameKey!;
        const union = section.items!.length > 1;
        lines.push(`${section.node} {`);
        for (const item of v as Record<string, unknown>[]) {
          const kind = union ? section.items!.find((k) => k.name === item[nameKey]) : section.items![0];
          const fields = kind?.fields ?? [];
          lines.push(`    ${[literal(item[nameKey]), ...entries(item, fields.filter((f) => f.kdl !== NAME))].join(" ")}`);
        }
        lines.push("}");
        break;
      }
    }
  }
  return `${lines.join("\n")}\n`;
}

/** A record's or list item's values: its argument first, then properties, defaults left out. */
function entries(v: Record<string, unknown>, fields: Field[]): string[] {
  const arg = fields.find((f) => f.kdl === ARG);
  const out: string[] = [];
  if (arg && v[arg.key] !== undefined) out.push(literal(v[arg.key]));
  for (const f of fields) {
    if (f.kdl === ARG || f.kdl === NAME) continue;
    const x = v[f.key];
    if (x === undefined || (f.default !== undefined && same(x, f.default))) continue;
    out.push(`${f.kdl}=${literal(x)}`);
  }
  return out;
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** A scalar section's value; long prose in a multi-line string, as the files have it. */
function scalar(v: unknown, field: Field): string {
  if (typeof v === "string" && field.type === "text" && v.includes("\n")) {
    const body = v
      .split("\n")
      // Every quote escaped: a run of them must not close the string.
      .map((l) => (l ? `    ${l.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}` : ""))
      .join("\n");
    return `"""\n${body}\n    """`;
  }
  return literal(v);
}

const KEYWORD = /^(true|false|null|inf|-inf|nan)$/;

/** A value as KDL: numbers and #true/#false as they are, an id-like word bare, other text quoted. */
export function literal(v: unknown): string {
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "#true" : "#false";
  const s = String(v);
  return /^[a-z][a-z0-9-]*$/.test(s) && !KEYWORD.test(s) ? s : JSON.stringify(s);
}
