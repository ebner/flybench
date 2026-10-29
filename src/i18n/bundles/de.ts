import { registerLanguage } from "../register";
import { registerRules } from "../rules";
import { RULES_DE } from "../rules/de";

/** The German glossary and prose: a chunk of its own, loaded only for German pages. */
registerLanguage("de", {
  glossary: import.meta.glob("../../../glossary/de.kdl", { query: "?raw", import: "default", eager: true }) as Record<string, string>,
  patterns: import.meta.glob("../../../translations/de/patterns/*.kdl", { query: "?raw", import: "default", eager: true }) as Record<string, string>,
  naturals: import.meta.glob("../../../translations/de/naturals/*.kdl", { query: "?raw", import: "default", eager: true }) as Record<string, string>,
});
registerRules("de", RULES_DE);
