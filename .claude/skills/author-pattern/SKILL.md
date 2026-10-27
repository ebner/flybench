---
name: author-pattern
description: Add, research or change a fly pattern recipe in patterns/*.kdl (new flies, variants, dressing or proportion fixes, refcheck passes). Use whenever a task touches a pattern's dressing, steps, proportions, sources or reference photos.
---

# Authoring a fly pattern

Read these before writing or changing a recipe, and follow them:

1. `docs/authoring-patterns.md`: the procedure (research, choosing the dressing,
   translating steps, gape conversions, refcheck, finish).
2. `docs/recipe-schema.md`: the recipe format and validation rules.
3. "Recipe conventions" in `AGENTS.md`.

The essentials, in case you're tempted to skip ahead:

- Read `.cache/research/<id>.md` first if it exists; otherwise research from at least three
  sources and write that note before the recipe.
- Tie the dressing most tyers tie today; record disagreements between sources, and mark
  your own judgement with `// Assumption:` comments.
- Base the proportions on sources and reference photos, not on guesses. Run
  `pnpm refcheck <id>` and read `.cache/refcheck/<id>.png` before reporting done.
- Need a technique the schema can't express? Extend the engine in a general way; don't
  fake it.
- Finish with `pnpm test`, `pnpm typecheck` and `pnpm render:catalog`. Report the
  assumptions and any proportions you left off-reference.
