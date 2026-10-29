import type { RecipeError } from "../../recipe/errors";
import type { RuleKey, RuleParams } from "../../recipe/rules";
import { lang, type Lang } from "../lang";
import { RULES_EN } from "./en";

/** A language's tying-rule messages, one for every rule in src/recipe/rules.ts. */
export type RuleCatalog = { [K in RuleKey]: (p: RuleParams<K>) => string };

const catalogs = new Map<Lang, RuleCatalog>([["en", RULES_EN]]);

/** Registered with the language's chunk (bundles/sv.ts, de.ts); English is always there. */
export function registerRules(l: Lang, catalog: RuleCatalog) {
  catalogs.set(l, catalog);
}

/** An error's message for a visitor in the page's language, where it is a tying rule's; otherwise as it is. */
export function ruleMessage(e: RecipeError, l: Lang = lang()): string {
  const catalog = catalogs.get(l);
  if (!catalog || !e.rule || !(e.rule in catalog)) return e.message;
  return (catalog[e.rule as RuleKey] as (p: unknown) => string)(e.params ?? {});
}
