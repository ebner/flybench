import { Component, type ReactNode } from "react";
import { t } from "../i18n/ui";

/**
 * Round the pages whose code is fetched when they are opened: if it can't be fetched (offline,
 * or a new version has replaced the files), the page says so and offers to reload, and the rest
 * of the site stays as it is.
 */
export class PageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="reading">
        <p>{t.site.pageFailed}</p>
        <p>
          <button className="box-toggle" onClick={() => location.reload()}>
            {t.site.reload}
          </button>
        </p>
      </main>
    );
  }
}
