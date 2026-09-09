import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Card failed to render:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="card">
          <h2>{this.props.title}</h2>
          <p className="empty">
            This section could not be displayed.{' '}
            <button type="button" className="link" onClick={() => this.setState({ error: null })}>
              Try again
            </button>
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
