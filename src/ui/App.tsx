import { useEffect, useState } from "react";
import { siteTitle } from "../catalog/pages";
import { PATTERN_ERRORS } from "../patterns";
import { About, AUTHOR, REPO_URL } from "./About";
import { Gallery } from "./Gallery";
import { Header } from "./Header";
import { Learn } from "./Learn";
import { Log } from "./Log";
import { Trip } from "./Trip";
import { NaturalPage, NaturalsIndex } from "./Naturals";
import { NotFound } from "./NotFound";
import { FlyBox, Materials } from "./Personal";
import { TechniquePage, TechniquesIndex } from "./Techniques";
import { PatternPage } from "./PatternPage";
import { href, restoresScroll, useRoute } from "./router";
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
  const [, loaded] = useState(0);
  const ready = isLoaded(language);
  useEffect(() => {
    if (!isLoaded(language)) loadLanguage(language).then(() => loaded((n) => n + 1), () => loaded((n) => n + 1));
  }, [language]);

  useEffect(() => {
    if (route.page === "gallery") document.title = siteTitle();
    if (!restoresScroll()) window.scrollTo(0, 0);
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
      {DRAFT[lang()] && (
        <p className="draft-note" lang={lang()}>
          {t.header.draft}
        </p>
      )}
      <div id="content" tabIndex={-1}>
        {ready && (
          <>
            {route.page === "gallery" && <Gallery query={route.query} />}
            {route.page === "fly" && <PatternPage id={route.id} step={route.step} size={route.size} colours={route.colours} />}
            {route.page === "techniques" && <TechniquesIndex />}
            {route.page === "technique" && <TechniquePage id={route.id} />}
            {route.page === "learn" && <Learn />}
            {route.page === "box" && <FlyBox />}
            {route.page === "materials" && <Materials />}
            {route.page === "log" && <Log />}
            {route.page === "trip" && <Trip query={route.query} />}
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
          </>
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
          <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>
          {t.footer.licence}
        </p>
      </footer>
    </>
  );
}
