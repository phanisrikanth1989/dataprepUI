import { useState, useRef, useEffect } from 'react';
import { Save, Play, X, Coffee, Code2 } from 'lucide-react';
import { useDesigner } from '../context/DesignerContext';
import { updateRoutine, buildRoutines } from '../services/routinesApi';
import { updatePythonRoutine, buildPythonRoutines } from '../services/pythonRoutinesApi';

export default function RoutineEditorView() {
  const {
    openRoutineTabs,
    activeRoutineFilename,
    setActiveRoutineFilename,
    closeRoutineTab,
    updateRoutineTabContent,
    markRoutineTabClean,
  } = useDesigner();

  const tab = openRoutineTabs.find((t) => t.filename === activeRoutineFilename);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [buildLog, setBuildLog] = useState([]);
  const [building, setBuilding] = useState(false);
  const [showBuild, setShowBuild] = useState(false);
  const logEndRef = useRef(null);

  useEffect(() => {
    setError(null);
    setBuildLog([]);
    setShowBuild(false);
  }, [activeRoutineFilename]);

  useEffect(() => {
    if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [buildLog]);

  if (!tab) return null;

  const isPython = tab.language === 'python';
  const LangIcon = isPython ? Code2 : Coffee;
  const iconColor = isPython ? '#3b82f6' : '#f5a623';
  const logColor = isPython ? '#c8e6ff' : '#c8ffc8';
  const saveFn = isPython ? updatePythonRoutine : updateRoutine;
  const buildFn = isPython ? buildPythonRoutines : buildRoutines;

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await saveFn(tab.filename, tab.content);
      markRoutineTabClean(tab.filename);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleBuild() {
    setBuildLog([]);
    setShowBuild(true);
    setBuilding(true);
    setError(null);
    try {
      await buildFn((line) => setBuildLog((prev) => [...prev, line]));
    } catch (e) {
      setError(e.message);
    } finally {
      setBuilding(false);
    }
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'var(--bg-primary)', color: 'var(--text-primary)',
    }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '6px 12px', borderBottom: '1px solid var(--border-color)',
        background: 'var(--header-bg)', flexShrink: 0,
      }}>
        <LangIcon size={14} style={{ color: iconColor, flexShrink: 0 }} />
        <span style={{ fontWeight: 600, fontSize: '0.85rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {tab.filename}{tab.dirty ? ' •' : ''}
        </span>

        {error && (
          <span style={{ fontSize: '0.75rem', color: '#f28b82', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            ⚠ {error}
          </span>
        )}

        <button
          onClick={handleSave}
          disabled={saving || !tab.dirty}
          style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '3px 10px', fontSize: '0.78rem', cursor: tab.dirty ? 'pointer' : 'default',
            background: tab.dirty ? 'var(--accent, #4a90d9)' : 'var(--btn-disabled-bg, #2a2a2a)',
            color: tab.dirty ? '#fff' : 'var(--text-muted)',
            border: 'none', borderRadius: '4px',
          }}
          title="Save (Ctrl+S)"
        >
          <Save size={12} /> {saving ? 'Saving…' : 'Save'}
        </button>

        <button
          onClick={handleBuild}
          disabled={building}
          style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '3px 10px', fontSize: '0.78rem', cursor: 'pointer',
            background: '#2d5a27', color: '#c8ffc8',
            border: 'none', borderRadius: '4px',
          }}
          title={isPython ? 'Run/lint routines' : 'Build all routines (Maven)'}
        >
          <Play size={12} /> {building ? 'Building…' : 'Build'}
        </button>
      </div>

      {/* Editor + build log split */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <textarea
          value={tab.content}
          onChange={(e) => updateRoutineTabContent(tab.filename, e.target.value)}
          onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave(); } }}
          spellCheck={false}
          style={{
            flex: 1, resize: 'none', fontFamily: '"Cascadia Code", "Fira Code", "Consolas", monospace',
            fontSize: '0.82rem', lineHeight: 1.6, padding: '16px',
            background: 'var(--editor-bg, #1e1e1e)', color: 'var(--editor-text, #d4d4d4)',
            border: 'none', outline: 'none', tabSize: 4,
          }}
        />

        {showBuild && (
          <div style={{
            borderTop: '2px solid var(--border-color)',
            background: '#0d1117', color: logColor,
            fontFamily: '"Cascadia Code", "Consolas", monospace',
            fontSize: '0.72rem', lineHeight: 1.5,
            display: 'flex', flexDirection: 'column',
            height: '180px',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '3px 10px', background: '#161b22', color: '#aaa', flexShrink: 0,
            }}>
              <span style={{ fontWeight: 600 }}>Maven Build Output</span>
              {!building && <button onClick={() => setShowBuild(false)} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', padding: 0 }}><X size={12} /></button>}
            </div>
            <div style={{ overflowY: 'auto', flex: 1, padding: '6px 10px' }}>
              {buildLog.map((line, i) => {
                const color = line.includes('BUILD SUCCESS') ? '#89d185'
                  : line.includes('BUILD FAILURE') || line.includes('ERROR') ? '#f28b82'
                  : line.includes('WARNING') ? '#f5a623'
                  : '#c8ffc8';
                return <div key={i} style={{ color }}>{line}</div>;
              })}
              {building && <div style={{ color: '#888' }}>…</div>}
              <div ref={logEndRef} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
