import { useEffect, useMemo, useState } from "react";
import { isLogEntry, newestFirst, progress, tiedCounts, today, type LogEntry } from "../catalog/log";
import { technique } from "../catalog/techniques";
import { PATTERNS } from "../patterns";
import { href } from "./router";
import { LOG_KEY, useStoredList } from "./storage";
import { BenchNav, storedNote } from "./Personal";
import { t } from "../i18n/ui";
import { linkTo } from "./linkTo";

const recipes = () => PATTERNS.map((p) => p.recipe);

export function useLog() {
  return useStoredList<LogEntry>(LOG_KEY, isLogEntry);
}

/** "29 October 2026", in the page's language. */
function dateText(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString(t.log.locale, { day: "numeric", month: "long", year: "numeric" });
}

export function Log() {
  const log = useLog();
  useEffect(() => {
    document.title = t.site.titled(t.log.title);
  }, []);
  const all = recipes();
  const p = useMemo(() => progress(log.items, all), [log.items]);
  const counts = useMemo(() => tiedCounts(log.items, all), [log.items]);
  const flies = [...counts.values()].reduce((a, b) => a + b, 0);
  const tiedOnPath = p.path.filter((s) => s.tied).length;
  const nextOnPath = p.path.find((s) => !s.tied);
  const practised = [...p.practised.keys()].flatMap((id) => technique(id) ?? []).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <main className="reading log-page">
      <BenchNav current="log" />
      <h1>{t.log.heading}</h1>
      <p className="lede">{t.log.intro}</p>
      <p className="stored-note">{storedNote()}</p>
      {log.items.length === 0 ? (
        <p>{t.log.empty(linkTo(href.learn()))}</p>
      ) : (
        <>
          <p className="summary">{t.log.summary(flies, counts.size)}</p>

          <h2>{t.log.progress}</h2>
          <p>
            <a href={href.learn()}>{t.log.path}</a>
            {t.log.pathTied(tiedOnPath, p.path.length)}
            {nextOnPath
              ? t.log.next(
                  <a key="next" href={href.fly(nextOnPath.recipe.id)}>
                    {nextOnPath.recipe.name}
                  </a>,
                )
              : t.log.whole}
          </p>
          <p>
            {t.log.practised(p.practised.size, p.techniques)}
            {practised.length > 0 && (
              <>
                {" "}
                (
                {practised.map((t, i) => (
                  <span key={t.id}>
                    {i > 0 && ", "}
                    <a href={href.technique(t.id)}>{t.name.toLowerCase()}</a>
                  </span>
                ))}
                )
              </>
            )}
            .
          </p>

          <h2>{t.log.flies}</h2>
          <ul className="log-entries">
            {newestFirst(log.items).map((e) => {
              const recipe = all.find((r) => r.id === e.id);
              const name = recipe ? `${recipe.name}${recipe.variant ? ` (${recipe.variant})` : ""}` : e.id;
              return (
                <li key={e.key}>
                  <span className="log-date">{dateText(e.date)}</span>
                  <span className="log-fly">
                    {e.count} × {recipe ? <a href={href.fly(e.id, undefined, e.size, e.colours)}>{name}</a> : name}
                    {e.size !== undefined && t.log.size(e.size)}
                    {e.colours && t.log.yourColours}
                  </span>
                  {e.note && <span className="log-note">{e.note}</span>}
                  <button
                    className="link-button"
                    onClick={() => log.save(log.items.filter((x) => x.key !== e.key))}
                    aria-label={t.log.removeLabel(e.count, name, dateText(e.date))}
                  >
                    {t.log.remove}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </main>
  );
}

/** "I tied this": a form that adds a sitting at the vise to the log. */
export function LogForm({
  id,
  sizes,
  size,
  colours,
  onClose,
}: {
  id: string;
  /** Hook sizes to choose from; none for tubes. */
  sizes: number[];
  size?: number;
  colours?: string;
  onClose: (logged: boolean) => void;
}) {
  const log = useLog();
  const [date, setDate] = useState(today);
  // As typed, so the field can be cleared while typing; a whole number from 1 to 999 is kept.
  const [count, setCount] = useState("1");
  const [chosenSize, setChosenSize] = useState(size);
  const [note, setNote] = useState("");
  return (
    <form
      className="log-form"
      onSubmit={(e) => {
        e.preventDefault();
        const entry: LogEntry = {
          key: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          date: DATE_INPUT.test(date) ? date : today(),
          id,
          count: Math.min(999, Math.max(1, Math.round(Number(count)) || 1)),
          ...(chosenSize !== undefined ? { size: chosenSize } : {}),
          ...(colours ? { colours } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
        };
        log.save([...log.items, entry]);
        onClose(true);
      }}
    >
      <label>
        {t.log.howMany}
        <input type="number" min={1} max={999} value={count} onChange={(e) => setCount(e.target.value)} autoFocus />
      </label>
      {sizes.length > 0 && (
        <label>
          {t.log.hookSize}
          <select value={chosenSize} onChange={(e) => setChosenSize(Number(e.target.value))}>
            {sizes.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        {t.log.day}
        <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
      </label>
      <label className="log-form-note">
        {t.log.note}
        <input type="text" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder={t.log.notePlaceholder} />
      </label>
      <div className="log-form-buttons">
        <button type="submit" className="box-toggle">
          {t.log.add}
        </button>
        <button type="button" className="link-button" onClick={() => onClose(false)}>
          {t.log.cancel}
        </button>
      </div>
    </form>
  );
}

const DATE_INPUT = /^\d{4}-\d{2}-\d{2}$/;
