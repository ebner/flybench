export interface SourceLocation {
  line: number;
  column: number;
}

export interface RecipeError {
  message: string;
  /** Path into the recipe object, e.g. ["steps", 3, "to"]. Empty for syntax errors. */
  path: (string | number)[];
  line?: number;
  column?: number;
  /** A tying rule's key and parameters (rules.ts), for saying it in another language. */
  rule?: string;
  params?: Record<string, unknown>;
}

export function formatError(e: RecipeError): string {
  const where = e.line !== undefined ? `line ${e.line}:${e.column}: ` : "";
  const path = e.path.length > 0 ? `${e.path.join(".")}: ` : "";
  return `${where}${path}${e.message}`;
}
