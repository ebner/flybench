import { lang, type Lang } from "./lang";

/**
 * One object per language, read as the current language's at the moment a property is used:
 * `TYPE_LABELS.dry` is "Dry fly" on an English page and "Torrfluga" on a Swedish one, and code
 * that reads it needs no language of its own. Keys and nesting are the same in every language
 * (the type of `by` says so).
 */
export function localized<T extends object>(by: Record<Lang, T>): T {
  return new Proxy({} as T, {
    get: (_, key) => Reflect.get(by[lang()], key),
    has: (_, key) => Reflect.has(by[lang()], key),
    ownKeys: () => Reflect.ownKeys(by[lang()]),
    getOwnPropertyDescriptor: (_, key) => {
      const d = Reflect.getOwnPropertyDescriptor(by[lang()], key);
      return d && { ...d, configurable: true };
    },
  });
}
