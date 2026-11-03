import { useEffect, useMemo, useRef, useState } from "react";
import {
  addMaterial,
  addPart,
  bareHook,
  compile,
  kindsFor,
  partsOf,
  removeMaterial,
  removePart,
  ROLES,
  setHow,
  setMaterial,
  setPart,
  startFrom,
  STYLES,
  type Part,
  type PartMaterial,
  type PartsFly,
  type Role,
  type Style,
} from "../edit/parts";
import { blankFly, copyOf, draftOf, overBudget, ownId, packFly, recipeText, sharable, unpackFly } from "../edit/own";
import { coverage } from "../catalog/inventory";
import { sampleColour } from "../catalog/swatch";
import type { RecipeError } from "../recipe/errors";
import { MATERIALS, type MaterialKind } from "../recipe/materials";
import type { Recipe } from "../recipe/schema";
import { kindName, partLabel } from "../tying/describe";
import { simulate, stepEnd, type Build as Built } from "../tying/simulate";
import { inPageLanguage } from "../i18n/prose";
import { ruleMessage } from "../i18n/rules";
import { t } from "../i18n/ui";
import { lang } from "../i18n/lang";
import { findPattern, NAMEABLE_PARTS } from "../patterns";
import { PartIcon } from "./build/PartIcon";
import { dotColour, FlyDetails, HookPanel, PartPanel, ThreadPanel } from "./build/Panels";
import { Stage } from "./build/Stage";
import { Start } from "./build/Start";
import { useOwnFlies } from "./ownFlies";
import { storedNote } from "./Personal";
import { href, replaceUrl } from "./router";
import { DRAFT_KEY, INVENTORY_KEY, useStoredSet } from "./storage";
import { usePlayer } from "./usePlayer";
import { useHookPictures, useSwatches } from "./renders";

const PARTS = NAMEABLE_PARTS;

/** The fly being built: its parts, the saved fly it is (if saved), and its text when last saved. */
interface Session {
  fly: PartsFly;
  id: string | null;
  saved: string | null;
}
type Note = "link" | "file" | "linkFailed" | "fileFailed" | "editFailed" | "shareFailed" | "tooBigToShare";

const meta = (name: string): PartsFly["meta"] => {
  const { materials: _m, steps: _s, ...rest } = blankFly(name);
  return rest;
};

/** The fly being built, kept in the browser between visits (flybench.draft). */
function readDraft(): Session | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (!s?.fly?.meta || !Array.isArray(s.fly.parts) || typeof s.fly.attach !== "number" || !s.fly.finish) return null;
    // A draft from an older version that no longer ties is dropped.
    compile(s.fly);
    return s;
  } catch {
    return null;
  }
}
function writeDraft(s: Session | null) {
  try {
    if (s) localStorage.setItem(DRAFT_KEY, JSON.stringify(s));
    else localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Storage full or off: the fly is still there until the page closes.
  }
}

/** A recipe (a saved fly, a link's, a file's) as parts, or null when it can't be shown as parts. */
const fromRecipe = (r: Recipe | null) => (r ? partsOf(r) : null);

// Assumption: a newly added part starts in the material and colour the patterns most often use for it.
const FIRST: Partial<Record<Role, { kind: MaterialKind; color?: string }>> = {
  tail: { kind: "hackle-fibres", color: "brown" },
  body: { kind: "dry-fly-dubbing", color: "grey" },
  rib: { kind: "gold-wire" },
  wing: { kind: "hackle-tips", color: "grizzly" },
  hackle: { kind: "cock-hackle", color: "brown" },
  tag: { kind: "oval-tinsel", color: "silver" },
  thorax: { kind: "peacock-herl" },
  back: { kind: "turkey-quill", color: "turkey" },
  bead: { kind: "brass-bead", color: "gold" },
  head: { kind: "peacock-herl" },
};

export function Build({ query }: { query: string }) {
  const own = useOwnFlies();
  const owned = useStoredSet(INVENTORY_KEY).values;
  const swatches = useSwatches();
  const hookPictures = useHookPictures();
  const [session, setSession] = useState<Session | null>(null);
  const [draft, setDraft] = useState<Session | null>(() => readDraft());
  const [note, setNote] = useState<Note | null>(null);
  const [past, setPast] = useState<PartsFly[]>([]);
  const [future, setFuture] = useState<PartsFly[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [whole, setWhole] = useState(true);
  const [guide, setGuide] = useState(false);
  const [watching, setWatching] = useState(false);
  const [palette, setPalette] = useState(false);
  const [link, setLink] = useState<{ url: string; copied: boolean } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = t.site.titled(t.workbench.title);
  }, [lang()]);

  // Counts the flies opened, so each is framed afresh.
  const [opened, setOpened] = useState(0);
  const open = (fly: PartsFly, id: string | null = null, saved: string | null = null) => {
    setOpened((n) => n + 1);
    typing.current = null;
    setSession({ fly, id, saved });
    setPast([]);
    setFuture([]);
    setSelected([]);
    setWhole(true);
    setWatching(false);
  };
  /** Starting another fly replaces the one being built, kept only as a draft: ask if it isn't saved. */
  const replacing = () => {
    const s = sessionRef.current;
    return !s || s.saved === recipeText({ ...compile(s.fly).recipe, id: s.id ?? "my-fly" }) || confirm(t.build.startOver(s.fly.meta.name));
  };
  // The fly as it is now, for listeners set up once (a shared link followed later).
  const sessionRef = useRef(session);
  sessionRef.current = session;
  /** A saved fly to edit: with its changes not yet saved, if the draft has them. */
  const openSaved = (id: string): boolean => {
    const stored = own.stored.find((f) => f.id === id);
    if (!stored) return false;
    if (draft?.id === id && draft.saved === stored.kdl) {
      open(draft.fly, id, stored.kdl);
      return true;
    }
    const fly = fromRecipe(draftOf(stored.kdl, PARTS));
    if (fly) open({ ...fly, meta: { ...fly.meta, id } }, id, stored.kdl);
    return !!fly;
  };

  // The address says where to start: a saved fly to edit, a pattern to copy; a shared link after the "#".
  const written = useRef<string | null>(null);
  useEffect(() => {
    if (query === written.current) return;
    written.current = query;
    const params = new URLSearchParams(query);
    const edit = params.get("edit");
    const from = params.get("from");
    if (edit) {
      if (!openSaved(edit)) setNote("editFailed");
    } else if (from) {
      const p = findPattern(from);
      const fly = p && startFrom(copyOf(inPageLanguage(p.recipe), t.build.copyName(inPageLanguage(p.recipe).name)), true);
      if (fly && replacing()) open(fly);
      // Used once: a reload goes on with the draft, it doesn't copy the pattern again.
      written.current = "";
      replaceUrl(href.build());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);
  useEffect(() => {
    let live = true;
    const read = () => {
      const packed = location.hash.startsWith("#fly=") ? location.hash.slice(5) : null;
      if (!packed) return;
      unpackFly(packed).then((kdl) => {
        if (!live) return;
        // Read: the link's fly mustn't come back with a reload.
        history.replaceState(null, "", location.pathname + location.search);
        const fly = kdl === null ? null : fromRecipe(draftOf(kdl, PARTS));
        if (fly && replacing()) {
          open({ ...fly, meta: { ...fly.meta, id: "my-fly" } });
          setNote("link");
        } else if (!fly) setNote("linkFailed");
      });
    };
    read();
    addEventListener("hashchange", read);
    return () => {
      live = false;
      removeEventListener("hashchange", read);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The fly being built is kept in the browser as it changes.
  useEffect(() => {
    if (!session) return;
    const id = setTimeout(() => {
      writeDraft(session);
      setDraft(session);
    }, 300);
    return () => clearTimeout(id);
  }, [session]);
  // Leaving the builder (a link in the header) keeps the very latest change too.
  useEffect(() => () => void (sessionRef.current && writeDraft(sessionRef.current)), []);

  const fly = session?.fly ?? null;
  const compiled = useMemo(() => (fly ? compile(fly) : null), [fly]);
  const language = lang();
  // Beyond the drawing budget (thousands of turns), the fly is drawn up to the step that passes it.
  const overAt = useMemo(() => (compiled ? overBudget(compiled.recipe) : -1), [compiled]);
  const built = useMemo<Built | null>(() => {
    if (!compiled) return null;
    try {
      return simulate(overAt >= 0 ? { ...compiled.recipe, steps: compiled.recipe.steps.slice(0, overAt) } : compiled.recipe);
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compiled, overAt, language]);
  const last = useRef<Built | null>(null);
  if (built) last.current = built;
  const build = built ?? last.current;
  const [stopAt, setStopAt] = useState<number | null>(null);
  const player = usePlayer(build?.duration ?? 0, stopAt);

  /** A change to the fly; `merge` folds it into the last change (the moves of one drag). */
  const typing = useRef<string | null>(null);
  const change = (fn: (f: PartsFly) => PartsFly, merge = false) => {
    if (!session) return;
    typing.current = null;
    setStopAt(null);
    player.pause();
    const next = fn(session.fly);
    if (!merge) setPast((p) => [...p.slice(-99), session.fly]);
    setFuture([]);
    setSession({ ...session, fly: next });
  };
  /** Typing in a field: the first change of a visit to it can be undone, the rest join it. */
  const typed = (field: string, fn: (f: PartsFly) => PartsFly) => {
    change(fn, typing.current === field);
    typing.current = field;
  };
  const undo = () => {
    typing.current = null;
    if (!session || !past.length) return;
    setFuture((f) => [session.fly, ...f]);
    setSession({ ...session, fly: past.at(-1)! });
    setPast((p) => p.slice(0, -1));
  };
  const redo = () => {
    typing.current = null;
    if (!session || !future.length) return;
    setPast((p) => [...p, session.fly]);
    setSession({ ...session, fly: future[0]! });
    setFuture((f) => f.slice(1));
  };
  useEffect(() => {
    const keys = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select")) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      if (e.key === "Escape" && selected.length && !document.querySelector(".wb-sheet")) choose(null);
      // Delete takes out the chosen part when the fly or the parts have the focus, not a field or a menu.
      const onFly = target === document.body || !!target.closest(".wb-rail, .wb-stage");
      if (onFly && (e.key === "Delete" || e.key === "Backspace") && primary && primary !== "hook" && primary !== "thread") {
        e.preventDefault();
        removeSelected();
      }
    };
    addEventListener("keydown", keys);
    return () => removeEventListener("keydown", keys);
  });

  /** Plays how a part is tied, on the fly as it is before it. */
  const replay = (id: string, b: Built | null = build) => {
    const span = compiled?.spans.get(id);
    const first = span && b?.steps[span[0]];
    const lastStep = span && b?.steps[span[1]];
    if (!first || !lastStep) return;
    setWatching(false);
    setStopAt(stepEnd(lastStep));
    player.playFrom(first.start);
  };
  // After a part's steps have played, the whole fly again.
  useEffect(() => {
    if (stopAt !== null && !player.playing && player.time >= stopAt - 1e-6) {
      const id = setTimeout(() => setStopAt(null), 800);
      return () => clearTimeout(id);
    }
  }, [player.playing, player.time, stopAt]);
  const justAdded = useRef<string | null>(null);
  useEffect(() => {
    if (justAdded.current && built) {
      replay(justAdded.current, built);
      justAdded.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [built]);

  const primary = selected.at(-1) ?? null;
  const part = fly?.parts.find((p) => p.id === primary) ?? null;
  /** Chooses a part (with `add`, one more); the chosen part again, or nothing, shows the whole fly. */
  const choose = (id: string | null, add = false) => {
    const next = id === null ? [] : add ? (selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]) : selected.length === 1 && selected[0] === id ? [] : [id];
    setSelected(next);
    setWhole(next.length === 0);
  };
  // The hook is always shown in full; the thread when it is chosen (Stage keeps its wraps).
  const focus = whole || !selected.length ? null : new Set(selected.filter((id) => id !== "hook"));
  const removeSelected = () => {
    if (!part) return;
    change((f) => removePart(f, part.id));
    setSelected((s) => s.filter((x) => x !== part.id));
  };
  const add = (role: Role) => {
    const first = FIRST[role] ?? { kind: kindsFor(role)[0]! };
    // Its own colour where it has one (natural herl, a gold wire), else a common one.
    const sample = sampleColour(first.kind);
    const color = first.color ?? ((MATERIALS[first.kind] as { defaultColor?: string }).defaultColor || sample === "natural" ? undefined : sample);
    let added: Part | null = null;
    change((f) => {
      const r = addPart(f, role, first.kind, color);
      added = r.part;
      return r.fly;
    });
    setPalette(false);
    if (added) {
      setSelected([(added as Part).id]);
      setWhole(false);
      justAdded.current = (added as Part).id;
    }
  };

  const problemsOf = (id: string): string[] =>
    (compiled?.problems ?? []).filter((e) => e.path[0] === "steps" && compiled!.owners[e.path[1] as number] === id).map(say);
  const otherProblems = [
    ...(compiled?.problems ?? []).filter((e) => !(e.path[0] === "steps" && compiled!.owners[e.path[1] as number])).map(say),
    ...(overAt >= 0 ? [say({ message: "", path: ["steps", overAt], rule: "tooMuchToDraw", params: {} })] : []),
  ];

  // ——— Saving, sharing, files ———
  const text = compiled ? recipeText({ ...compiled.recipe, id: session?.id ?? "my-fly" }) : "";
  const dirty = !!session && text !== session.saved;
  const save = () => {
    if (!session || !compiled) return;
    const taken = new Set(own.stored.map((f) => f.id));
    const id = session.id ?? ownId(taken);
    const kdl = recipeText({ ...compiled.recipe, id });
    own.save([...own.stored.filter((f) => f.id !== id), { id, kdl, saved: new Date().toISOString() }]);
    setSession({ fly: { ...session.fly, meta: { ...session.fly.meta, id } }, id, saved: kdl });
    written.current = `edit=${id}`;
    replaceUrl(href.build(`edit=${id}`));
  };
  const remove = () => {
    if (!session?.id || !confirm(t.build.deleteConfirm(session.fly.meta.name))) return;
    own.save(own.stored.filter((f) => f.id !== session.id));
    setSession({ ...session, id: null, saved: null });
    written.current = "";
    replaceUrl(href.build());
  };
  const share = async () => {
    if (!sharable(text)) return setNote("tooBigToShare");
    let url: string;
    try {
      url = `${location.origin}${href.build()}#fly=${await packFly(text)}`;
    } catch {
      return setNote("shareFailed");
    }
    let copied = false;
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
    } catch {
      // No clipboard: the link is shown to copy by hand.
    }
    setLink({ url, copied });
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${session?.id ?? "my-fly"}.kdl`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const openFile = async (file: File) => {
    // Generous for a recipe file, not for anything else.
    const kdl = file.size <= 1024 * 1024 ? await file.text() : "";
    const opened = fromRecipe(draftOf(kdl, PARTS));
    if (!opened) return setNote("fileFailed");
    if (!replacing()) return;
    open({ ...opened, meta: { ...opened.meta, id: "my-fly" } });
    setNote("file");
  };
  const startNew = () => {
    if (!replacing()) return;
    setSession(null);
    writeDraft(null);
    setDraft(null);
    written.current = "";
    replaceUrl(href.build());
  };

  const fromYours = compiled && owned.size > 0 && coverage(compiled.recipe, owned).missing.length === 0;

  const noteText = note && { link: t.build.fromLink, file: t.build.fromFile, linkFailed: t.build.linkFailed, fileFailed: t.build.fileFailed, editFailed: t.workbench.start.cantOpen, shareFailed: t.build.shareFailed, tooBigToShare: t.build.tooBigToShare }[note];

  if (!session || !fly || !compiled) {
    return (
      <>
        {noteText && (
          <p className="build-note problem reading" role="status">
            {noteText}
          </p>
        )}
        <Start
          draftName={draft?.fly.meta.name ?? null}
          flies={own.flies}
          onDraft={() => draft && open(draft.fly, draft.id, draft.saved)}
          onStyle={(style: Style) => {
            const p = findPattern(STYLES[style])!;
            const r = inPageLanguage(p.recipe);
            const fly = startFrom(copyOf(r, t.workbench.styleName[style]));
            if (fly) open({ ...fly, meta: { ...fly.meta, description: undefined } });
          }}
          onPattern={(id) => {
            const p = findPattern(id)!;
            const r = inPageLanguage(p.recipe);
            const fly = startFrom(copyOf(r, t.build.copyName(r.name)), true);
            if (fly) open(fly);
          }}
          onHook={(model) => open(bareHook({ ...meta(t.build.untitled), hook: model.startsWith("tube") || model === "waddington" ? { model, length: 25 } : { model, size: 12 } }))}
          onEdit={(id) => {
            written.current = `edit=${id}`;
            replaceUrl(href.build(`edit=${id}`));
            if (!openSaved(id)) setNote("editFailed");
          }}
        />
      </>
    );
  }

  // The parts in the order they are tied.
  const order = [...fly.parts].sort((a, b) => (compiled.spans.get(a.id)?.[0] ?? 0) - (compiled.spans.get(b.id)?.[0] ?? 0));
  const savedFly = session.id ? own.flies.find((f) => f.fly.id === session.id) : undefined;
  const w = t.workbench;

  return (
    <div className="workbench">
      <Stage
        build={build}
        compiled={compiled}
        fly={fly}
        focus={focus}
        selected={primary}
        guide={guide}
        watching={watching}
        player={player}
        onSelect={choose}
        onDrag={(id, patch, first) => change((f) => setPart(f, id, patch), !first)}
        onDragEnd={() => {}}
        framing={`${opened}:${fly.meta.hook.model}:${fly.meta.hook.size ?? fly.meta.hook.length}`}
        focused={focus !== null}
        tools={
          <>
            <button onClick={undo} disabled={!past.length}>
              {w.undo}
            </button>
            <button onClick={redo} disabled={!future.length}>
              {w.redo}
            </button>
            <button aria-pressed={guide} onClick={() => setGuide(!guide)}>
              {w.guide}
            </button>
            <button
              aria-pressed={watching}
              onClick={() => {
                if (watching) {
                  setWatching(false);
                  player.pause();
                } else {
                  setWatching(true);
                  setStopAt(null);
                  player.playFrom(0);
                }
              }}
            >
              {watching ? w.back : w.watch}
            </button>
          </>
        }
      />

      <aside className="wb-side">
        {noteText && (
          <p className={note === "link" || note === "file" ? "build-note" : "build-note problem"} role="status">
            {noteText}
          </p>
        )}
        <input
          className="wb-name"
          value={fly.meta.name}
          maxLength={80}
          aria-label={t.build.name}
          onChange={(e) => typed("name", (f) => ({ ...f, meta: { ...f.meta, name: e.target.value || t.build.untitled } }))}
          onBlur={() => (typing.current = null)}
        />
        <p className="stored-note">{storedNote()}</p>
        {fromYours && <p className="wb-yours">{w.fromYours}</p>}
        {otherProblems.length > 0 && (
          <div className="build-problems" role="alert">
            <p>{w.problem}</p>
            <ul>
              {otherProblems.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
        )}

        <h2 className="wb-heading">{w.parts}</h2>
        <ul className="wb-rail">
          <Tile id="hook" icon="hook" name={w.hookTile} detail={`${hookName(fly.meta.hook)}`} selected={selected} onChoose={choose} />
          <Tile id="thread" icon="thread" name={w.threadTile} detail={`${fly.meta.thread.size}`} dot={dotColour({ id: "thread", kind: "rib-thread", color: fly.meta.thread.color })} selected={selected} onChoose={choose} />
          {order.map((p) => (
            <Tile
              key={p.id}
              id={p.id}
              icon={p.role}
              name={partName(p)}
              detail={p.mats.map((m) => kindName(m.kind)).join(" + ") || w.way[p.how]}
              dot={p.mats[0] ? dotColour(p.mats[0]) : undefined}
              selected={selected}
              problem={problemsOf(p.id).length > 0}
              onChoose={choose}
              onRemove={() => {
                change((f) => removePart(f, p.id));
                setSelected((s) => s.filter((x) => x !== p.id));
              }}
            />
          ))}
          <li>
            <button className="wb-part wb-add" onClick={() => setPalette(true)}>
              <span aria-hidden="true" className="wb-plus">
                +
              </span>
              <span className="wb-part-name">{w.addPart}</span>
            </button>
          </li>
        </ul>

        {primary === "hook" && <HookPanel hook={fly.meta.hook} pictures={hookPictures} onChange={(hook) => change((f) => ({ ...f, meta: { ...f.meta, hook } }))} />}
        {primary === "thread" && <ThreadPanel thread={fly.meta.thread} owned={owned} onChange={(thread) => change((f) => ({ ...f, meta: { ...f.meta, thread } }))} />}
        {part && (
          <PartPanel
            key={part.id}
            fly={fly}
            part={part}
            swatches={swatches}
            owned={owned}
            problems={problemsOf(part.id)}
            onChange={(patch) => change((f) => setPart(f, part.id, patch))}
            onHow={(how) => change((f) => setHow(f, part.id, how))}
            onMaterial={(i, patch: Partial<PartMaterial>) => change((f) => setMaterial(f, part.id, i, patch))}
            onMix={(kind, color) => change((f) => addMaterial(f, part.id, kind, color))}
            onUnmix={(i) => change((f) => removeMaterial(f, part.id, i))}
            onReplay={() => replay(part.id)}
            onRemove={removeSelected}
          />
        )}

        <FlyDetails
          meta={fly.meta}
          onChange={(m, field) => (field === "description" ? typed("description", (f) => ({ ...f, meta: m })) : change((f) => ({ ...f, meta: m })))}
        />

        <div className="pattern-actions build-actions">
          <button className="box-toggle" aria-pressed={!dirty} onClick={save} disabled={!dirty}>
            {!dirty ? t.build.saved : session.id ? t.build.saveChanges : t.build.save}
          </button>
          {session.id && savedFly?.recipe && !dirty && <a href={href.fly(session.id)}>{t.build.open}</a>}
        </div>
        <div className="pattern-actions build-actions">
          <button className="link-button" onClick={share}>
            {t.build.share}
          </button>
          <button className="link-button" onClick={download}>
            {t.build.download}
          </button>
          <button className="link-button" onClick={() => fileInput.current?.click()}>
            {t.build.openFile}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".kdl,text/plain"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void openFile(f);
            }}
          />
          {session.id && (
            <button className="link-button danger" onClick={remove}>
              {t.build.delete}
            </button>
          )}
          <button className="link-button" onClick={startNew}>
            {w.start.newFly}
          </button>
        </div>
        {link && (
          <p className="build-link" aria-live="polite">
            {link.copied ? t.build.copied : t.build.copyThis}
            <input readOnly value={link.url} onFocus={(e) => e.target.select()} aria-label={t.build.share} />
          </p>
        )}
      </aside>

      {palette && (
        <Sheet title={w.whichPart} onClose={() => setPalette(false)}>
          <ul className="wb-palette">
            {ROLES.filter((r) => r !== "other").map((role) => (
              <li key={role}>
                <button onClick={() => add(role)}>
                  <PartIcon role={role} large />
                  <span className="wb-part-name">{w.role[role]}</span>
                  <span className="wb-palette-hint">{w.roleHint[role]}</span>
                </button>
              </li>
            ))}
          </ul>
        </Sheet>
      )}
    </div>
  );
}

function hookName(hook: Recipe["hook"]): string {
  return "size" in hook && hook.size ? `#${hook.size}` : "length" in hook && hook.length ? `${hook.length} mm` : "";
}

/** A part's name as the dressing gives it ("Hackle", or "Hackle front" for a second one). */
function partName(p: Part): string {
  return p.mats.length === 1 && p.mats[0]!.id !== p.role ? safeLabel(p.mats[0]!.id, t.workbench.role[p.role]) : t.workbench.role[p.role];
}

/** A part's name, or `fallback` where the page's glossary has no words for it. */
function safeLabel(id: string, fallback = id): string {
  try {
    return partLabel(id);
  } catch {
    return fallback;
  }
}

/** A tying rule's problem in the page's language, with parts by their names. */
function say(e: RecipeError): string {
  // The recipe's form (a value out of range): in the page's language, by what it is about.
  if (!e.rule) {
    const where = e.path[0];
    const what = where === "materials" ? t.build.materials : where === "hook" ? t.build.hook : where === "thread" ? t.build.thread : where === "steps" ? t.build.steps : t.workbench.details;
    return t.build.invalid(what);
  }
  const params = { ...e.params };
  for (const k of ["m", "post"]) if (typeof params[k] === "string") params[k] = safeLabel(params[k] as string);
  return ruleMessage({ ...e, params });
}

function Tile({
  id,
  icon,
  name,
  detail,
  dot,
  selected,
  problem,
  onChoose,
  onRemove,
}: {
  id: string;
  icon: Role | "hook" | "thread";
  name: string;
  detail: string;
  dot?: string;
  selected: string[];
  problem?: boolean;
  onChoose: (id: string, add: boolean) => void;
  onRemove?: () => void;
}) {
  const on = selected.includes(id);
  const hold = useRef<{ timer?: number; fired: boolean }>({ fired: false });
  return (
    <li className="wb-tile">
      <button
        className={`wb-part${on ? " on" : ""}${problem ? " problem" : ""}`}
        aria-pressed={on}
        onPointerDown={() => {
          // A long press adds the part to those chosen.
          hold.current.fired = false;
          hold.current.timer = window.setTimeout(() => {
            hold.current.fired = true;
            onChoose(id, true);
          }, 450);
        }}
        onPointerUp={() => clearTimeout(hold.current.timer)}
        onPointerLeave={() => clearTimeout(hold.current.timer)}
        onContextMenu={(e) => e.preventDefault()}
        onClick={(e) => {
          if (hold.current.fired) return void (hold.current.fired = false);
          onChoose(id, e.shiftKey || e.ctrlKey || e.metaKey);
        }}
      >
        <PartIcon role={icon} />
        <span className="wb-part-name">{name}</span>
        <span className="wb-part-material">
          {dot && <i className="wb-dot" style={{ background: dot }} />}
          <span>{detail}</span>
        </span>
      </button>
      {onRemove && (
        <button className="wb-tile-remove" onClick={onRemove} aria-label={t.workbench.removeLabel(name)} title={t.workbench.removeLabel(name)}>
          ×
        </button>
      )}
    </li>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [onClose]);
  // The keyboard goes into the sheet, and back to where it was when the sheet closes.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>("li button")?.focus();
    return () => before?.focus();
  }, []);
  return (
    <div className="wb-sheet-backdrop" onClick={onClose}>
      <div ref={box} className="wb-sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="wb-panel-head">
          <h2>{title}</h2>
          <button className="link" onClick={onClose}>
            {t.workbench.close}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
