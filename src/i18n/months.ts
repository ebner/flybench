import { localized } from "./localized";

/** The months, January first, as written in a heading or a list ("June", "juni", "Juni"). */
export const MONTH_NAMES = localized({
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  // Swedish writes months small, also first in a list item; a heading capitalises its first word itself.
  sv: ["januari", "februari", "mars", "april", "maj", "juni", "juli", "augusti", "september", "oktober", "november", "december"],
  de: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
});
