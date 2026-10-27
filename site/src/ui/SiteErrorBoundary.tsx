import { Component } from 'react';
import type { ReactNode } from 'react';
import { hrefOf } from '../routes.js';

interface State {
  failed: boolean;
}

/** Catches a render error in the site view, so the visitor gets a way back rather than a blank page. */
export class SiteErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="page-frame">
        <article className="page" role="alert">
          <h1>Something went wrong showing the model site</h1>
          <p>
            <a href={hrefOf('welcome')}>Back to the welcome page</a>
          </p>
        </article>
      </main>
    );
  }
}
