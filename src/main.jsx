import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class CrashBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error('CrashBoundary caught:', error);
  }

  render() {
    if (this.state?.error) {
      return (
        <div style={{ padding: 16, fontFamily: 'monospace', color: '#fff', background: '#100' }}>
          <h2 style={{ marginBottom: 8 }}>FirePilot crashed</h2>
          <p style={{ marginBottom: 8 }}>Please reinstall from Play internal testing.</p>
          <pre style={{ whiteSpace: 'pre-wrap' }}>
            {String(this.state.error?.message || this.state.error)}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}

window.addEventListener('error', (event) => {
  console.error('Global error:', event?.error || event?.message || event);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled rejection:', event?.reason || event);
});

try {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <CrashBoundary>
        <App />
      </CrashBoundary>
    </StrictMode>,
  );
} catch (error) {
  console.error('Root render failed:', error);
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `
      <div style="padding:16px;font-family:monospace;color:#fff;background:#300">
        <h2 style="margin:0 0 8px 0">FirePilot failed to start</h2>
        <pre style="white-space:pre-wrap;margin:0">${String(error?.message || error)}</pre>
      </div>
    `;
  }
}
