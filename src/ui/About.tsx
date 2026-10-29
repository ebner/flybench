import { useEffect } from "react";
import { CATALOG } from "../patterns";
import { href } from "./router";
import { t } from "../i18n/ui";
import { linkTo } from "./linkTo";

export const REPO_URL = "https://github.com/ebner/flybench";
export const AUTHOR = { name: "Hannes Ebner", url: "https://github.com/ebner" };

export function About() {
  useEffect(() => {
    document.title = t.site.titled(t.about.title);
  }, []);
  return (
    <main className="reading about">
      <h1>{t.about.heading}</h1>
      <p className="lede">{t.about.lede(CATALOG.length)}</p>

      <h2>{t.about.howHeading}</h2>
      <p>{t.about.how}</p>

      <h2>{t.about.sourcesHeading}</h2>
      <p>{t.about.sources(linkTo(`${REPO_URL}/issues`))}</p>

      <h2>{t.about.privacyHeading}</h2>
      <p>{t.about.privacy(linkTo(href.box()), linkTo(href.materials()), linkTo(href.log()))}</p>
      <p>
        {t.about.hosting(
          linkTo("https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages#data-collection"),
          linkTo("https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement"),
        )}
      </p>

      <h2>{t.about.addingHeading}</h2>
      <p>
        {t.about.adding(
          linkTo(`${REPO_URL}/blob/main/docs/recipe-schema.md`),
          linkTo(`${REPO_URL}/blob/main/docs/authoring-patterns.md`),
          linkTo(REPO_URL),
        )}
      </p>

      <h2>{t.about.whoHeading}</h2>
      <p>
        {t.about.who(
          <a key="author" href={AUTHOR.url}>
            {AUTHOR.name}
          </a>,
          linkTo(REPO_URL),
        )}
      </p>
      <p>{t.about.translations}</p>

      <h2>{t.about.licenceHeading}</h2>
      <p>{t.about.licence(linkTo("https://creativecommons.org/licenses/by/4.0/"), linkTo(`${REPO_URL}/blob/main/LICENSE`))}</p>
    </main>
  );
}
