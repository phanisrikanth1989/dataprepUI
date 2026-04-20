import { Component } from 'react';
import { DesignerProvider } from './context/DesignerContext';
import ComponentPalette from './components/ComponentPalette';
import DesignerCanvas from './components/DesignerCanvas';
import PropertiesPanel from './components/PropertiesPanel';
import JobDesignerPanel from './components/JobDesignerPanel';
import MetadataPanel from './components/MetadataPanel';
import GitHubPanel from './components/GitHubPanel';
import { useDesigner } from './context/DesignerContext';
import { Sun, Moon, Layers, LayoutList, Database, Github } from 'lucide-react';
import './App.css';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('DataPrep Studio crashed:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
          <h2>Something went wrong</h2>
          <p style={{ color: '#888' }}>{this.state.error?.message || 'An unexpected error occurred.'}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{ marginTop: '1rem', padding: '0.5rem 1rem', cursor: 'pointer' }}
          >
            Try Again
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: '1rem', marginLeft: '0.5rem', padding: '0.5rem 1rem', cursor: 'pointer' }}
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppLayout() {
  const { selectedNode, theme, toggleTheme, leftTab, setLeftTab, saveError, setSaveError } = useDesigner();

  return (
    <div className="app" data-theme={theme}>
      {/* Save error banner */}
      {saveError && (
        <div style={{
          background: '#d32f2f', color: '#fff', padding: '0.5rem 1rem',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem'
        }}>
          <span>⚠ {saveError}</span>
          <button onClick={() => setSaveError(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
        </div>
      )}
      {/* Header */}
      <header className="app-header">
        <div className="app-header__brand">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="4" fill="#4a90d9" />
            <path d="M6 8h12M6 12h12M6 16h8" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className="app-header__title">DataPrep Studio</span>
        </div>
        <div className="app-header__right">
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      {/* Main layout */}
      <div className="app-body">
        {/* Left sidebar with tabs */}
        <aside className="app-sidebar">
          <div className="sidebar-tabs">
            <button
              className={`sidebar-tab ${leftTab === 'palette' ? 'sidebar-tab--active' : ''}`}
              onClick={() => setLeftTab('palette')}
              title="Components"
            >
              <Layers size={16} />
            </button>
            <button
              className={`sidebar-tab ${leftTab === 'designer' ? 'sidebar-tab--active' : ''}`}
              onClick={() => setLeftTab('designer')}
              title="Job Designer"
            >
              <LayoutList size={16} />
            </button>
            <button
              className={`sidebar-tab ${leftTab === 'metadata' ? 'sidebar-tab--active' : ''}`}
              onClick={() => setLeftTab('metadata')}
              title="Metadata"
            >
              <Database size={16} />
            </button>
            <button
              className={`sidebar-tab ${leftTab === 'repository' ? 'sidebar-tab--active' : ''}`}
              onClick={() => setLeftTab('repository')}
              title="GitHub Repository"
            >
              <Github size={16} />
            </button>
          </div>
          <div className="sidebar-content">
            {leftTab === 'palette' && <ComponentPalette />}
            {leftTab === 'designer' && <JobDesignerPanel />}
            {leftTab === 'metadata' && <MetadataPanel />}
            {leftTab === 'repository' && <GitHubPanel />}
          </div>
        </aside>

        <main className="app-main">
          <DesignerCanvas />
        </main>

        {selectedNode && (
          <aside className="app-properties">
            <PropertiesPanel />
          </aside>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <DesignerProvider>
        <AppLayout />
      </DesignerProvider>
    </ErrorBoundary>
  );
}
