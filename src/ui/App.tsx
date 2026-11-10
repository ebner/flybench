import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useUpdated } from "./update";
import { PageBoundary } from "./PageBoundary";
import { siteTitle } from "../catalog/pages";
import { PATTERN_ERRORS } from "../patterns";
import { About, AUTHOR, REPO_URL } from "./About";
import { Gallery } from "./Gallery";
import { Header } from "./Header";
import { Learn } from "./Learn";
import { Log } from "./Log";
import { Trip } from "./Trip";
import { NotFound } from "./NotFound";
import { FlyBox, Materials } from "./Personal";

// The pages with a 3D view bring three.js and the renderer: fetched when one is opened, so the
// gallery and the reading pages don't wait for them.
const PatternPage = lazy(() => import("./PatternPage").then((m) => ({ default: m.PatternPage })));
const Build = lazy(() => import("./Build").then((m) => ({ default: m.Build })));
const NaturalsIndex = lazy(() => import("./Naturals").then((m) => ({ default: m.NaturalsIndex })));
const NaturalPage = lazy(() => import("./Naturals").then((m) => ({ default: m.NaturalPage })));
const TechniquesIndex = lazy(() => import("./Techniques").then((m) => ({ default: m.TechniquesIndex })));
const TechniquePage = lazy(() => import("./Techniques").then((m) => ({ default: m.TechniquePage })));
import { href, restoresScroll, routeHrefIn, useRoute } from "./router";
import { useTheme } from "./theme";
import { lang } from "../i18n/lang";
import { isLoaded, loadLanguage } from "../i18n/load";
import { DRAFT, t } from "../i18n/ui";

export function App() {
  const route = useRoute();
  const { choice, setChoice } = useTheme();
  // Switching to Swedish or German the first time fetches that language's words; the pages
  // wait for them (the header and footer need only the interface's, which are always here).
  const language = lang();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const ready = isLoaded(language);
  useEffect(() => {
    if (isLoaded(language)) return;
    setFailed(false);
    loadLanguage(language).then(
      () => setAttempt((n) => n + 1),
      () => setFailed(true),
    );
  }, [language, attempt]);

  // The stages fill the screen below the header: tell them how much the notes above them take.
  const noteRef = useRef<HTMLDivElement>(null);
  const updated = useUpdated();
  useEffect(() => {
    const note = noteRef.current!;
    const root = document.documentElement;
    const measure = () => root.style.setProperty("--note", `${note.offsetHeight}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(note);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--note");
    };
  }, []);

  const arrived = useRef(true);
  useEffect(() => {
    if (route.page === "gallery") document.title = siteTitle();
    if (!restoresScroll()) window.scrollTo(0, 0);
    // Another page of the site: the keyboard and screen readers start at its content, as they
    // would after a page load (not on arrival, where the browser has done so).
    if (!arrived.current) document.getElementById("content")?.focus({ preventScroll: true });
    arrived.current = false;
  }, [route.page, route.page === "fly" || route.page === "technique" || route.page === "natural" ? route.id : null, lang()]);

  return (
    <>
      {import.meta.env.DEV && PATTERN_ERRORS.length > 0 && (
        <details className="load-errors">
          <summary>{t.site.loadErrors(PATTERN_ERRORS.length)}</summary>
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
        {t.site.skip}
      </button>
      <Header theme={choice} onTheme={setChoice} route={route} />
      <div ref={noteRef}>
        {updated && (
          <p className="draft-note" role="status">
            {t.site.updated}{" "}
            <button className="link" onClick={() => location.reload()}>
              {t.site.reload}
            </button>
          </p>
        )}
        {DRAFT[lang()] && (
          <p className="draft-note" lang={lang()}>
            {t.header.draft}
          </p>
        )}
      </div>
      <div id="content" tabIndex={-1}>
        {!ready && failed && (
          <main className="reading">
            <p>{t.site.loadFailed}</p>
            <p>
              <button className="box-toggle" onClick={() => setAttempt((n) => n + 1)}>
                {t.site.retry}
              </button>{" "}
              <a href={routeHrefIn("en", route)}>{t.site.inEnglish}</a>
            </p>
          </main>
        )}
        {ready && (
          // (Keyed by page, so going to another page tries afresh.)
          <PageBoundary key={route.page}>
          <Suspense fallback={null}>
            {route.page === "gallery" && <Gallery query={route.query} />}
            {route.page === "fly" && <PatternPage id={route.id} step={route.step} size={route.size} colours={route.colours} />}
            {route.page === "techniques" && <TechniquesIndex />}
            {route.page === "technique" && <TechniquePage id={route.id} />}
            {route.page === "learn" && <Learn />}
            {route.page === "box" && <FlyBox />}
            {route.page === "materials" && <Materials />}
            {route.page === "log" && <Log />}
            {route.page === "trip" && <Trip query={route.query} />}
            {route.page === "build" && <Build query={route.query} />}
            {route.page === "about" && <About />}
            {route.page === "naturals" && <NaturalsIndex />}
            {route.page === "natural" && <NaturalPage id={route.id} />}
            {route.page === "not-found" && (
              <NotFound heading={t.notFound.heading}>
                <p>
                  <a href={href.gallery()}>{t.notFound.browse}</a>
                </p>
              </NotFound>
            )}
          </Suspense>
          </PageBoundary>
        )}
      </div>
      <footer className="site-footer">
        <nav aria-label={t.footer.nav}>
          <a href={href.about()}>{t.footer.about}</a>
          <a href={REPO_URL}>{t.footer.source}</a>
          <a href={`${REPO_URL}/issues`}>{t.footer.report}</a>
        </nav>
        <p>
          {t.footer.madeBy(<a key="author" href={AUTHOR.url}>{AUTHOR.name}</a>)}
          <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>
          {t.footer.licence}
        </p>
      </footer>
    </>
  );
}
