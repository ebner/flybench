import type { Link } from "../i18n/ui";

/** A link for a translated sentence that places it ("…, tell Flybench what you have."). */
export function linkTo(url: string): Link {
  return (text) => (
    <a key={`${url} ${text}`} href={url}>
      {text}
    </a>
  );
}
