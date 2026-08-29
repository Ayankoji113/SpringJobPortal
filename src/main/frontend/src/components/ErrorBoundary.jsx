import React from 'react';
import { Button } from './ui';

/* Route-level boundary. A render error in one page must not blank the app. */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled render error', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="jp-container jp-page">
        <div className="jp-empty">
          <p className="jp-empty__title">This page stopped working</p>
          <p className="jp-empty__body">
            The rest of the app is fine. Reloading usually clears it; if it keeps happening the details are in the
            browser console.
          </p>
          <div className="jp-row">
            <Button variant="primary" onClick={() => this.setState({ error: null })}>
              Try again
            </Button>
            <Button onClick={() => window.location.reload()}>Reload page</Button>
          </div>
        </div>
      </div>
    );
  }
}
