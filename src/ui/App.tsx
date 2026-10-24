import { useEffect } from "react";
import { PATTERN_ERRORS } from "../patterns";
import { Gallery } from "./Gallery";
import { Header } from "./Header";
import { PatternPage } from "./PatternPage";
import { href, useRoute } from "./router";
import { useTheme } from "./theme";

export function App() {
  const route = useRoute();
  const { choice, theme, setChoice } = useTheme();

  useEffect(() => {
    if (route.page === "gallery") document.title = "Flybench";
    window.scrollTo(0, 0);
  }, [route.page, route.page === "fly" ? route.id : null]);

  return (
    <>
      {import.meta.env.DEV && PATTERN_ERRORS.length > 0 && (
        <details className="load-errors">
          <summary>{PATTERN_ERRORS.length} problem(s) in pattern files</summary>
          <ul>
            {PATTERN_ERRORS.map((e, i) => (
              <li key={i}>
                <code>{e}</code>
              </li>
            ))}
          </ul>
        </details>
      )}
      {/* Not an #anchor link: the hash is the route. */}
      <button className="skip-link" onClick={() => document.getElementById("content")?.focus()}>
        Skip to content
      </button>
      <Header theme={choice} onTheme={setChoice} />
      <div id="content" tabIndex={-1}>
        {route.page === "gallery" && <Gallery query={route.query} />}
        {route.page === "fly" && <PatternPage id={route.id} step={route.step} theme={theme} />}
        {route.page === "not-found" && (
          <main className="not-found">
            <h1>There is nothing at this address</h1>
            <p>
              <a href={href.gallery()}>Browse all patterns</a>
            </p>
          </main>
        )}
      </div>
    </>
  );
}
