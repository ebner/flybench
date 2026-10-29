# The glossary

The Swedish and German texts that Flybench writes itself (step instructions, the dressing,
step titles, hook names) are built from words in a glossary, one file per language:
`glossary/sv.kdl` and `glossary/de.kdl`. The glossary holds every word with the forms the
grammar needs, so "shank" is the same word in every step, and a translator's choices
(which word, which one not, and why) are written down once.

`pnpm test` checks every file: each entry needs its forms, and every material, colour,
part, tying word, hook and step the site uses must be there.

## A file

```kdl
language sv
// "draft" until a native speaker who ties flies has reviewed it; then "reviewed".
status draft

materials {
    noun cock-hackle "tupphackel" gender=ett definite="tupphacklet" plural="tupphackel" plural-definite="tupphacklen" {
        note "Why this word, which others not, and why."
        source "Title of the page or book" url="https://…"
    }
    noun wool "ull" gender=en definite="ullen" mass=#true { … }
}
colours {
    adjective red "röd" neuter="rött" plural="röda"
    adjective grizzly "grizzly" compound=#true
}
parts { … }
words { … }
hooks {
    phrase dry-standard "Torrflugekrok, normalt skaft"
}
steps {
    phrase tie-in "Bind in"
}
```

Each entry is `noun`, `adjective` or `phrase`, then the English id (a material kind, a colour,
a part word, …), then the word in the language. Children: `note` (why this word: the
preferred term, alternatives rejected and why) and `source` (where the term is used that way,
with `url=` when it is online). Materials and tying words need at least one source: they are
the jargon where translators disagree.

## Sections

- `materials`: every material kind in `src/recipe/materials.ts`, as a noun (the name a tyer
  buys and calls it). Phrases are fine ("Brustfeder der Stockentenhenne"); give the forms of
  the whole phrase.
- `colours`: every named colour in `src/recipe/schema.ts`, as an adjective. Colours that
  aren't inflected ("rosa", "lila") are `invariable=#true` and go before the noun as they
  are ("den rosa ullen", "die rosa Wolle"). Shades named after a feather or fur rather than
  an adjective (grizzly, badger, coch) are `compound=#true`: joined to the noun with a hyphen
  ("grizzly-tupphackel", "Grizzly-Hahnenhechel").
- `parts`: the words recipes name their parts with (`tail`, `wing`, `case`, `rear`…), as
  nouns or adjectives; a part named `wing-case` shows as both words.
- `words`: the tying words the step texts use (`src/i18n/terms.ts` says what each is).
- `hooks`: the hook models' names, as phrases.
- `steps`: the steps' titles, as phrases ("Bind in", "Einbinden").

## Forms

Swedish nouns: `gender=en|ett`, `definite=` (always), `plural=` and `plural-definite=` (not
for `mass=#true`, an uncountable noun like "ull"). A noun that starts with an adjective
("oval tinsel") has `article=#true`: its definite form needs den/det before it.

A material whose English name is plural (hackle fibres, dumbbell eyes, rubber legs) is used
in the plural: give it as a noun with its plural forms, and the texts take those.

`parts` may also hold a whole part id (`larva-case`, `tail-flash`) where the words one by
one don't say it; it is used before the words are. Swedish adjectives: `neuter=` and
`plural=` (the plural is also the definite form), unless `invariable=#true`.

German nouns: `gender=m|f|n`, `plural=` (not for `mass=#true`), and where the form differs
from the base: `accusative=`, `dative=`, `genitive=` (singular) and `dative-plural=`.
German adjectives give the stem ("rot"); the endings follow the rules. Colours that aren't
declined ("rosa", "lila") are `invariable=#true`; where a declinable form is the standard one
("orangefarben", "olivgrün"), use it.

The English source is the code and the recipes; the glossary only translates.
