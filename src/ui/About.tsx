import { useEffect } from "react";
import { PATTERNS } from "../patterns";
import { href } from "./router";

export const REPO_URL = "https://github.com/ebner/flybench";

export function About() {
  useEffect(() => {
    document.title = "About, Flybench";
  }, []);
  return (
    <main className="reading about">
      <h1>About Flybench</h1>
      <p className="lede">
        Flybench is a field guide to tying flies. Each of its {PATTERNS.length} patterns is tied in front of you in 3D, one
        step at a time, and comes with its materials, its history and how to fish it.
      </p>

      <h2>How it works</h2>
      <p>
        Every fly is a recipe: a short text file with the hook, the thread, the materials and the tying steps, with their
        proportions. The 3D model, the animation, the written instructions and the materials list are all made from that
        recipe, so they always agree with each other. Proportions are measured against the hook gape, the way tyers
        measure them, so a pattern looks right on any hook size.
      </p>

      <h2>Where the dressings come from</h2>
      <p>
        Each pattern follows published dressings, which are listed on its page. Tyers dress the same fly differently and
        the sources do not always agree; where they differ, the pattern says so. Proportions are checked against photos
        of tied flies. If something looks wrong to you, please{" "}
        <a href={`${REPO_URL}/issues`}>report it on GitHub</a>.
      </p>

      <h2>Your fly box stays with you</h2>
      <p>
        There are no accounts and no tracking. Your <a href={href.box()}>fly box</a> and{" "}
        <a href={href.materials()}>materials</a> are kept in your browser and never leave it. Pages you have visited also
        work offline.
      </p>

      <h2>Adding a pattern</h2>
      <p>
        Flybench is open source. A new fly is a new recipe, not new code: the{" "}
        <a href={`${REPO_URL}/blob/main/docs/recipe-schema.md`}>recipe format</a> and the{" "}
        <a href={`${REPO_URL}/blob/main/docs/authoring-patterns.md`}>authoring guide</a> explain how to write one. The
        source is on <a href={REPO_URL}>GitHub</a>.
      </p>

      <h2>Licence and credits</h2>
      <p>
        The pattern texts, the pictures of the flies and the logo are licensed under{" "}
        <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>: share and adapt them, with credit. The code
        is under the <a href={`${REPO_URL}/blob/main/LICENSE`}>MIT licence</a>. Cited sources and reference photos belong
        to their authors. Type is set in IM Fell English and Spectral; the flies are drawn with three.js.
      </p>
    </main>
  );
}
