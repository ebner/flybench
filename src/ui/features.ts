/** Features that are switched off for now, kept so they can be switched on again. */

// The "In the water" views (the drawn and the realistic river, and their path-traced stills) are
// off since 2026-10-31: flies and insects on the water never looked real enough. Their code, the
// stills (public/renders/water) and `pnpm render:water` stay, to come back to.
export const WATER_VIEWS = false;
