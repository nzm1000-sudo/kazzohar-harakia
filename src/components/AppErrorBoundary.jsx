import { Component } from 'react';

export default class AppErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="app-fallback" role="alert" dir="rtl">
      <h1>משהו השתבש</h1>
      <p>אפשר לנסות שוב או לרענן את האפליקציה.</p>
      <button type="button" onClick={() => window.location.reload()}>נסה שוב</button>
    </main>;
  }
}