import type { Lang } from "../lang";
import { localized } from "../localized";
import { de } from "./de";
import { en } from "./en";
import { sv } from "./sv";

export type { Link } from "./en";

/** The interface's words in the current language. */
export const t = localized({ en, sv, de });

/** Languages whose translation is a draft, not yet reviewed by a native speaker who ties flies. */
export const DRAFT: Record<Lang, boolean> = { en: false, sv: true, de: true };
