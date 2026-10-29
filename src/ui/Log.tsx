import { useEffect, useMemo, useState } from "react";
import { isLogEntry, newestFirst, progress, tiedCounts, today, type LogEntry } from "../catalog/log";
import { technique } from "../catalog/techniques";
import { PATTERNS } from "../patterns";
import { href } from "./router";
import { LOG_KEY, useStoredList } from "./storage";
import { BenchNav, STORED_NOTE } from "./Personal";

const recipes = () => PATTERNS.map((p) => p.recipe);

export function useLog() {
  return useStoredList<LogEntry>(LOG_KEY, isLogEntry);
}

/** "29 October 2026" */
function dateText(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function Log() {
  const log = useLog();
  useEffect(() => {
    document.title = "Your tying log, Flybench";
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
      <h1>Your tying log</h1>
      <p className="lede">The flies you have tied. On a pattern's page, “I tied this” adds them here.</p>
      <p className="stored-note">{STORED_NOTE}</p>
      {log.items.length === 0 ? (
        <p>
          Nothing logged yet. <a href={href.learn()}>The learning path</a> is a good place to start.
        </p>
      ) : (
        <>
          <p className="summary">
            {flies} {flies === 1 ? "fly" : "flies"} of {counts.size} {counts.size === 1 ? "pattern" : "patterns"}.
          </p>

          <h2>Progress</h2>
          <p>
            <a href={href.learn()}>Learning path</a>: {tiedOnPath} of {p.path.length} flies tied
            {nextOnPath ? (
              <>
                ; next is the <a href={href.fly(nextOnPath.recipe.id)}>{nextOnPath.recipe.name}</a>.
              </>
            ) : (
              ", the whole path."
            )}
          </p>
          <p>
            Techniques practised: {p.practised.size} of {p.techniques}
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

          <h2>Flies tied</h2>
          <ul className="log-entries">
            {newestFirst(log.items).map((e) => {
              const recipe = all.find((r) => r.id === e.id);
              const name = recipe ? `${recipe.name}${recipe.variant ? ` (${recipe.variant})` : ""}` : e.id;
              return (
                <li key={e.key}>
                  <span className="log-date">{dateText(e.date)}</span>
                  <span className="log-fly">
                    {e.count} × {recipe ? <a href={href.fly(e.id, undefined, e.size, e.colours)}>{name}</a> : name}
                    {e.size !== undefined && <>, size {e.size}</>}
                    {e.colours && <>, in your colours</>}
                  </span>
                  {e.note && <span className="log-note">{e.note}</span>}
                  <button
                    className="link-button"
                    onClick={() => log.save(log.items.filter((x) => x.key !== e.key))}
                    aria-label={`Remove ${e.count} ${name} from ${dateText(e.date)}`}
                  >
                    Remove
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
  const [count, setCount] = useState(1);
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
          count: Math.max(1, Math.round(count) || 1),
          ...(chosenSize !== undefined ? { size: chosenSize } : {}),
          ...(colours ? { colours } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
        };
        log.save([...log.items, entry]);
        onClose(true);
      }}
    >
      <label>
        How many
        <input type="number" min={1} max={999} value={count} onChange={(e) => setCount(Number(e.target.value))} />
      </label>
      {sizes.length > 0 && (
        <label>
          Hook size
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
        Day
        <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
      </label>
      <label className="log-form-note">
        Note
        <input type="text" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="What went well, what to try next time" />
      </label>
      <div className="log-form-buttons">
        <button type="submit" className="box-toggle">
          Add to your tying log
        </button>
        <button type="button" className="link-button" onClick={() => onClose(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

const DATE_INPUT = /^\d{4}-\d{2}-\d{2}$/;
