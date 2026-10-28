import { useEffect } from "react";
import { SITE_TITLE } from "../catalog/pages";
import { PATTERN_ERRORS } from "../patterns";
import { About, AUTHOR, REPO_URL } from "./About";
import { Gallery } from "./Gallery";
import { Header } from "./Header";
import { Learn } from "./Learn";
import { NotFound } from "./NotFound";
import { FlyBox, Materials } from "./Personal";
import { TechniquePage, TechniquesIndex } from "./Techniques";
import { PatternPage } from "./PatternPage";
import { href, restoresScroll, useRoute } from "./router";
import { useTheme } from "./theme";

export function App() {
  const route = useRoute();
  const { choice, setChoice } = useTheme();

  useEffect(() => {
    if (route.page === "gallery") document.title = SITE_TITLE;
    if (!restoresScroll()) window.scrollTo(0, 0);
  }, [route.page, route.page === "fly" || route.page === "technique" ? route.id : null]);

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
      {/* Moves focus too, which following an #anchor doesn't do everywhere. */}
      <button className="skip-link" onClick={() => document.getElementById("content")?.focus()}>
        Skip to content
      </button>
      <Header theme={choice} onTheme={setChoice} page={route.page} />
      <div id="content" tabIndex={-1}>
        {route.page === "gallery" && <Gallery query={route.query} />}
        {route.page === "fly" && <PatternPage id={route.id} step={route.step} size={route.size} />}
        {route.page === "techniques" && <TechniquesIndex />}
        {route.page === "technique" && <TechniquePage id={route.id} />}
        {route.page === "learn" && <Learn />}
        {route.page === "box" && <FlyBox />}
        {route.page === "materials" && <Materials />}
        {route.page === "about" && <About />}
        {route.page === "not-found" && (
          <NotFound heading="There is nothing at this address">
            <p>
              <a href={href.gallery()}>Browse all patterns</a>
            </p>
          </NotFound>
        )}
      </div>
      <footer className="site-footer">
        <nav aria-label="About this site">
          <a href={href.about()}>About Flybench</a>
          <a href={REPO_URL}>Source on GitHub</a>
          <a href={`${REPO_URL}/issues`}>Report a mistake</a>
        </nav>
        <p>
          Made by <a href={AUTHOR.url}>{AUTHOR.name}</a>. Patterns and pictures{" "}
          <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>, code MIT.
        </p>
      </footer>
    </>
  );
}
