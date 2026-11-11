import type { Lang } from "../lang";
import { localized } from "../localized";
import { de } from "./de";
import { en } from "./en";
import { sv } from "./sv";

export type { Link } from "./en";

/** The interface's words in the current language. */
export const t = localized({ en, sv, de });

/** Languages whose translation is a draft, not yet reviewed by a native speaker who ties flies. */
// (Swedish and German: reviewed by the site's author, 2026-11-11.)
export const DRAFT: Record<Lang, boolean> = { en: false, sv: false, de: false };
