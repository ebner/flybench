# Translating Flybench

Flybench is in English, Swedish and German. English is at the site's root, the others under
`/sv/` and `/de/`. Four kinds of text are translated, each in its own place:

| What | Where | Notes |
|---|---|---|
| The interface (buttons, headings, page texts) | `src/i18n/ui/sv.ts`, `de.ts` | Typed: a missing or misnamed string fails `pnpm typecheck`. |
| Catalog words (fly types, fish, regions, months, natural groups) | `src/catalog/describe.ts`, `naturals.ts`, `trip.ts`, `src/i18n/months.ts` | `localized({ en, sv, de })` records. |
| Generated texts (step instructions, titles, the dressing) | written by `src/tying/describe-sv.ts` and `describe-de.ts` | Their words, with all their forms, come from the glossary: see [glossary.md](glossary.md). |
| Prose people wrote (a pattern's description, history, how to fish it, labels, step notes and mistakes; naturals; techniques) | `translations/<lang>/patterns/<id>.kdl`, `translations/<lang>/naturals/<id>.kdl`, `src/catalog/techniques-sv.ts`, `-de.ts` | Below. |

Every translation is a draft until a native speaker who ties flies has reviewed it: the
glossary and prose files say `status draft`, and `src/i18n/ui/index.ts` marks a language as a
draft (pages say so at the top). Where a text has no translation, the English one shows.

## A pattern's prose

`translations/sv/patterns/red-tag.kdl`:

```kdl
id red-tag
status draft
// Only for a variant: the variant's name ("Tube", "Double").
variant "Tub"
description "…"
history """
    First paragraph.

    Second paragraph.
    """
fishing """
    …
    """
// The recipe's material labels, by material id, as the dressing shows them.
labels {
    hackle "…"
}
// Step notes and the steps' own mistakes, by step number as the page shows them (1 is the first).
notes {
    step 3 "…"
}
mistakes {
    step 5 "…"
}
```

Leave out what isn't translated yet. `pnpm test` checks every file still fits its pattern: a
note for a step that has none, or a label for a material without one, fails. When a recipe's
English prose changes, its translations should change with it.

Use the glossary's words for materials and tying terms, so the prose and the generated steps
agree. Pattern names stay as they are, unless the pattern has a name in that language.

## A natural's prose

`translations/de/naturals/mayfly-dun.kdl`:

```kdl
id mayfly-dun
status draft
name "Eintagsfliege, Subimago"
description "…"
examples "…"
hatches {
    british-isles time="abends" note="…"
}
```
