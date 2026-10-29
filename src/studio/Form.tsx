import { useEffect, useId, useMemo, useState } from "react";
import { kdlToObject, KdlMappingError, type Shape } from "../recipe/kdl";
import { resolveColor } from "../recipe/schema";
import { ARG, NAME, type Edit, type KdlValue } from "../edit/kdlEdit";
import { newItemText, type Field, type FormSection } from "../edit/schemaForm";

/**
 * The recipe as a form: every value with a control fitting its type, lists with their items to
 * add, remove and reorder. Each change becomes an edit of the KDL text in place (kdlEdit.ts),
 * which stays the source of truth.
 */
export function Form({ text, sections, shapes, onEdit }: { text: string; sections: FormSection[]; shapes: Record<string, Shape>; onEdit: (edit: Edit) => void }) {
  const parsed = useMemo(() => {
    try {
      return kdlToObject(text, shapes).value;
    } catch (e) {
      if (e instanceof KdlMappingError) return null;
      throw e;
    }
  }, [text, shapes]);
  if (!parsed) return <p className="studio-form-blocked">The text doesn't parse as KDL: fix it in the text first (see the problems below it).</p>;
  return (
    <div className="studio-form">
      {sections.map((s) => (
        <FormSectionView key={s.node} section={s} value={parsed[s.key]} onEdit={onEdit} />
      ))}
    </div>
  );
}

function FormSectionView({ section, value, onEdit }: { section: FormSection; value: unknown; onEdit: (edit: Edit) => void }) {
  if (section.shape === "scalar") {
    const f = section.fields[0]!;
    return (
      <div className="studio-form-row">
        <FieldInput label={section.node} field={f} value={value} onSet={(v) => onEdit(v === undefined ? { type: "args", section: section.node, values: [] } : { type: "set", path: [section.node, ARG], value: v })} />
      </div>
    );
  }
  if (section.shape === "values") {
    const f = section.fields[0]!;
    return (
      <div className="studio-form-row">
        <ValuesInput label={section.node} field={f} value={(value as unknown[] | undefined) ?? []} onSet={(values) => onEdit({ type: "args", section: section.node, values })} />
      </div>
    );
  }
  if (section.shape === "record") {
    const record = (value as Record<string, unknown> | undefined) ?? {};
    return (
      <fieldset className="studio-form-group">
        <legend>{section.node}</legend>
        {section.fields.map((f) => (
          <div className="studio-form-row" key={f.key}>
            <FieldInput label={f.key} field={f} value={record[f.key]} onSet={(v) => onEdit(v === undefined ? { type: "delete", path: [section.node, f.kdl] } : { type: "set", path: [section.node, f.kdl], value: v })} />
          </div>
        ))}
      </fieldset>
    );
  }
  return <ListView section={section} items={(value as Record<string, unknown>[] | undefined) ?? []} onEdit={onEdit} />;
}

function ListView({ section, items, onEdit }: { section: FormSection; items: Record<string, unknown>[]; onEdit: (edit: Edit) => void }) {
  const union = section.items!.length > 1;
  const [adding, setAdding] = useState(section.items![0]!.name);
  const [open, setOpen] = useState<number | null>(null);
  return (
    <fieldset className="studio-form-group">
      <legend>
        {section.node} <span className="studio-form-count">({items.length})</span>
      </legend>
      <ol className="studio-form-items">
        {items.map((item, i) => {
          const name = section.nameKey ? String(item[section.nameKey] ?? "") : "";
          const kind = union ? section.items!.find((k) => k.name === name) : section.items![0];
          const summary = Object.entries(item)
            .filter(([k]) => k !== section.nameKey)
            .slice(0, 4)
            .map(([k, v]) => `${k}=${typeof v === "object" ? "…" : String(v)}`)
            .join(" ");
          return (
            <li key={i} className={open === i ? "open" : undefined}>
              <div className="studio-form-item-head">
                <button className="studio-form-item-name" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
                  <strong>{name || `#${i + 1}`}</strong> <span>{summary}</span>
                </button>
                <button
                  title="Move up"
                  disabled={i === 0}
                  onClick={() => {
                    onEdit({ type: "move", section: section.node, index: i, to: i - 1 });
                    if (open === i) setOpen(i - 1);
                  }}
                >
                  ↑
                </button>
                <button
                  title="Move down"
                  disabled={i === items.length - 1}
                  onClick={() => {
                    onEdit({ type: "move", section: section.node, index: i, to: i + 1 });
                    if (open === i) setOpen(i + 1);
                  }}
                >
                  ↓
                </button>
                <button
                  title="Remove"
                  onClick={() => {
                    if (!confirm(`Remove ${name || `item ${i + 1}`} (and the comments above it)?`)) return;
                    onEdit({ type: "remove", section: section.node, index: i });
                    setOpen(null);
                  }}
                >
                  ✕
                </button>
              </div>
              {open === i && kind && (
                <div className="studio-form-item-fields">
                  {kind.fields.map((f) => (
                    <div className="studio-form-row" key={f.key}>
                      <FieldInput
                        label={f.key}
                        field={f}
                        value={item[f.key]}
                        onSet={(v) =>
                          onEdit(v === undefined ? { type: "delete", path: [section.node, i, f.kdl] } : { type: "set", path: [section.node, i, f.kdl], value: v })
                        }
                      />
                    </div>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <div className="studio-form-add">
        {union && (
          <select value={adding} onChange={(e) => setAdding(e.target.value)} aria-label={`Kind of ${section.node} to add`}>
            {section.items!.map((k) => (
              <option key={k.name} value={k.name}>
                {k.name}
              </option>
            ))}
          </select>
        )}
        <button
          onClick={() => {
            const kind = section.items!.find((k) => k.name === adding) ?? section.items![0]!;
            onEdit({ type: "add", section: section.node, node: newItemText(kind, union ? adding : undefined) });
            setOpen(items.length);
          }}
        >
          Add {union ? adding : "item"}
        </button>
      </div>
    </fieldset>
  );
}

/** One value: `onSet(undefined)` removes it (back to its default). */
function FieldInput({ label, field, value, onSet }: { label: string; field: Field; value: unknown; onSet: (v: KdlValue | undefined) => void }) {
  const id = useId();
  const placeholder = field.default !== undefined ? String(field.default) : field.optional ? "(none)" : "";
  const control = (() => {
    switch (field.type) {
      case "number":
      case "integer": {
        const n = typeof value === "number" ? value : undefined;
        const ranged = field.min !== undefined && field.max !== undefined && field.max - field.min <= 200;
        const step = field.type === "integer" ? 1 : ranged ? Math.max(0.001, (field.max! - field.min!) / 400) : 0.01;
        return (
          <span className="studio-form-number">
            {ranged && (
              <input
                type="range"
                min={field.min}
                max={field.max}
                step={step}
                value={n ?? (typeof field.default === "number" ? field.default : field.min)}
                onChange={(e) => onSet(Number(e.target.value))}
                aria-label={`${label} slider`}
              />
            )}
            <NumberText id={id} value={n} step={step} placeholder={placeholder} optional={field.optional} onSet={onSet} />
          </span>
        );
      }
      case "boolean": {
        // Shows what applies (written or the default); a change away from the default is written.
        const on = typeof value === "boolean" ? value : field.default === true;
        return (
          <input
            id={id}
            type="checkbox"
            checked={on}
            onChange={(e) => onSet(e.target.checked === (field.default === true) && field.optional ? undefined : e.target.checked)}
          />
        );
      }
      case "enum":
        return (
          <select id={id} value={value === undefined ? "" : String(value)} onChange={(e) => onSet(e.target.value === "" ? undefined : field.numeric ? Number(e.target.value) : e.target.value)}>
            {(field.optional || value === undefined) && <option value="">{placeholder || "(none)"}</option>}
            {field.options!.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        );
      case "color": {
        const s = typeof value === "string" ? value : "";
        let hex = "#000000";
        try {
          hex = s ? resolveColor(s) : hex;
        } catch {
          // An unknown name: the text shows it, the swatch stays black.
        }
        return (
          <span className="studio-form-color">
            <input type="color" value={hex} onChange={(e) => onSet(e.target.value)} aria-label={`${label} colour`} />
            <input id={id} value={s} placeholder={placeholder} onChange={(e) => onSet(e.target.value === "" ? undefined : e.target.value)} />
          </span>
        );
      }
      case "text":
        return <textarea id={id} rows={3} value={typeof value === "string" ? value : ""} placeholder={placeholder} onChange={(e) => onSet(e.target.value === "" && field.optional ? undefined : e.target.value)} />;
      default:
        return <input id={id} value={value === undefined ? "" : String(value)} placeholder={placeholder} onChange={(e) => onSet(e.target.value === "" && field.optional ? undefined : e.target.value)} />;
    }
  })();
  return (
    <>
      <label htmlFor={id}>{label}</label>
      {control}
    </>
  );
}

function ValuesInput({ label, field, value, onSet }: { label: string; field: Field; value: unknown[]; onSet: (v: KdlValue[]) => void }) {
  if (field.options) {
    const on = new Set(value.map(String));
    return (
      <>
        <span className="studio-form-label">{label}</span>
        <span className="studio-form-values">
          {field.options.map((o) => (
            <label key={o}>
              <input type="checkbox" checked={on.has(o)} onChange={(e) => onSet(field.options!.filter((x) => (x === o ? e.target.checked : on.has(x))))} /> {o}
            </label>
          ))}
        </span>
      </>
    );
  }
  return (
    <>
      <span className="studio-form-label">{label}</span>
      <ValuesText value={value} label={label} onSet={onSet} />
    </>
  );
}

/** One box per value (a value may hold spaces or commas: an alias), each written when it is left. */
function ValuesText({ value, label, onSet }: { value: unknown[]; label: string; onSet: (v: KdlValue[]) => void }) {
  const values = value.map(String);
  return (
    <span className="studio-form-list">
      {values.map((v, i) => (
        <span key={`${i}:${v}`}>
          <ValueBox value={v} label={`${label} ${i + 1}`} onCommit={(next) => onSet(next === "" ? values.filter((_, k) => k !== i) : values.map((x, k) => (k === i ? next : x)))} />
          <button title="Remove" onClick={() => onSet(values.filter((_, k) => k !== i))}>
            ✕
          </button>
        </span>
      ))}
      <ValueBox value="" label={`${label}, new`} placeholder="add…" onCommit={(next) => next !== "" && onSet([...values, next])} />
    </span>
  );
}

function ValueBox({ value, label, placeholder, onCommit }: { value: string; label: string; placeholder?: string; onCommit: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    if (draft.trim() !== value) onCommit(draft.trim());
    if (value === "") setDraft("");
  };
  return <input value={draft} placeholder={placeholder} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && commit()} aria-label={label} />;
}

/**
 * A number as typed: written as soon as it is a number, never half-typed ("", "-", "0."); left
 * empty, an optional value goes back to its default when the field is left.
 */
function NumberText({ id, value, step, placeholder, optional, onSet }: { id: string; value: number | undefined; step: number; placeholder: string; optional: boolean; onSet: (v: KdlValue | undefined) => void }) {
  const [draft, setDraft] = useState(value === undefined ? "" : String(value));
  useEffect(() => {
    if (value === undefined ? draft !== "" : Number(draft) !== value) setDraft(value === undefined ? "" : String(value));
    // Only when the written value changes from outside (the slider, the text tab).
  }, [value]);
  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      value={draft}
      step={step}
      placeholder={placeholder}
      onChange={(e) => {
        setDraft(e.target.value);
        const n = Number(e.target.value);
        if (e.target.value.trim() !== "" && Number.isFinite(n) && !/[.]$/.test(e.target.value)) onSet(n);
      }}
      onBlur={() => {
        if (draft.trim() === "" && optional) onSet(undefined);
        else if (!Number.isFinite(Number(draft)) || draft.trim() === "") setDraft(value === undefined ? "" : String(value));
      }}
    />
  );
}
