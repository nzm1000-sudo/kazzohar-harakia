import { Component } from 'react';

export default class AppErrorBoundary extends Component {
  state = { failed: false, error: null, errorInfo: null };

  static getDerivedStateFromError(error) {
    return { failed: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('AppErrorBoundary caught:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const { error, errorInfo } = this.state;
    const errorMessage = error?.message || 'Unknown error';
    const errorStack = error?.stack || 'No stack';
    const componentStack = errorInfo?.componentStack || 'No component stack';
    return <main className="app-fallback" role="alert" dir="rtl" style={{ padding: 20, textAlign: 'right', direction: 'rtl' }}>
      <h1>משהו השתבש</h1>
      <p>אפשר לנסות שוב או לרענן את האפליקציה.</p>
      <button type="button" onClick={() => window.location.reload()}>נסה שוב</button>
      <details style={{ marginTop: 20, textAlign: 'left', direction: 'ltr', fontSize: '12px', fontFamily: 'monospace', background: '#f5f5f5', padding: 10, borderRadius: 4 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: 8 }}>Error Details (for debugging)</summary>
        <div><strong>Message:</strong> {errorMessage}</div>
        <div style={{ marginTop: 8, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}><strong>Stack:</strong> {errorStack}</div>
        <div style={{ marginTop: 8, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}><strong>Component Stack:</strong> {componentStack}</div>
      </details>
    </main>;
  }
}