import { registerLanguage } from "../register";

/** The Swedish glossary and prose: a chunk of its own, loaded only for Swedish pages. */
registerLanguage("sv", {
  glossary: import.meta.glob("../../../glossary/sv.kdl", { query: "?raw", import: "default", eager: true }) as Record<string, string>,
  patterns: import.meta.glob("../../../translations/sv/patterns/*.kdl", { query: "?raw", import: "default", eager: true }) as Record<string, string>,
  naturals: import.meta.glob("../../../translations/sv/naturals/*.kdl", { query: "?raw", import: "default", eager: true }) as Record<string, string>,
});
