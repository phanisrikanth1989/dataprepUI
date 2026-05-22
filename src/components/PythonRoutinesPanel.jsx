import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, RefreshCw, Play, FileCode, X, Save } from 'lucide-react';
import { useDesigner } from '../context/DesignerContext';
import {
  listPythonRoutines,
  getPythonRoutine,
  createPythonRoutine,
  deletePythonRoutine,
  buildPythonRoutines,
} from '../services/pythonRoutinesApi';

export default function PythonRoutinesPanel() {
  const { openRoutineTab } = useDesigner();
  const [routines, setRoutines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  const [showNew, setShowNew] = useState(false);
  const [newFilename, setNewFilename] = useState('');

  const [buildLog, setBuildLog] = useState([]);
  const [building, setBuilding] = useState(false);
  const logEndRef = useRef(null);

  useEffect(() => { fetchRoutines(); }, []);

  useEffect(() => {
    if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [buildLog]);

  async function fetchRoutines() {
    setLoading(true);
    setError(null);
    try {
      const data = await listPythonRoutines();
      setRoutines(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function openRoutineInMainPanel(filename) {
    setError(null);
    try {
      const data = await getPythonRoutine(filename);
      openRoutineTab({ ...data, language: 'python' });
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleCreate() {
    const fn = newFilename.trim();
    if (!fn) return;
    setError(null);
    try {
      const filename = fn.endsWith('.py') ? fn : `${fn}.py`;
      const template = `# ${fn.replace(/\.py$/, '')} routine\n\ndef main():\n    pass\n`;
      await createPythonRoutine(filename, template);
      setShowNew(false);
      setNewFilename('');
      await fetchRoutines();
      openRoutineInMainPanel(filename);
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleDelete(filename, e) {
    e.stopPropagation();
    if (!window.confirm(`Delete ${filename}?`)) return;
    setError(null);
    try {
      await deletePythonRoutine(filename);
      if (selectedFile === filename) setSelectedFile(null);
      await fetchRoutines();
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleBuild() {
    setBuildLog([]);
    setBuilding(true);
    setError(null);
    try {
      await buildPythonRoutines((line) => setBuildLog((prev) => [...prev, line]));
    } catch (e) {
      setError(e.message);
    } finally {
      setBuilding(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontSize: '0.8rem' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '4px',
        padding: '6px 8px', borderBottom: '1px solid var(--border-color)',
      }}>
        <span style={{ fontWeight: 600, flex: 1, color: 'var(--text-primary)' }}>Python Routines</span>
        <button className="icon-btn" title="Refresh" onClick={fetchRoutines} disabled={loading}>
          <RefreshCw size={13} />
        </button>
        <button className="icon-btn" title="New Routine" onClick={() => setShowNew(true)}>
          <Plus size={13} />
        </button>
        <button className="icon-btn" title="Build All" onClick={handleBuild} disabled={building}>
          <Play size={13} />
        </button>
      </div>

      {error && (
        <div style={{
          background: 'var(--error-bg, #3c1f1f)', color: 'var(--error-text, #f28b82)',
          padding: '4px 8px', fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between',
        }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}><X size={12} /></button>
        </div>
      )}

      {showNew && (
        <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '4px' }}>
          <input
            autoFocus
            value={newFilename}
            onChange={(e) => setNewFilename(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowNew(false); }}
            placeholder="routine_name.py"
            style={{
              flex: 1, fontSize: '0.78rem', padding: '2px 6px',
              background: 'var(--input-bg)', border: '1px solid var(--border-color)',
              borderRadius: '3px', color: 'var(--text-primary)',
            }}
          />
          <button className="icon-btn" onClick={handleCreate}><Save size={12} /></button>
          <button className="icon-btn" onClick={() => setShowNew(false)}><X size={12} /></button>
        </div>
      )}

      <div style={{ overflowY: 'auto', borderBottom: '1px solid var(--border-color)', maxHeight: '160px' }}>
        {loading && <div style={{ padding: '8px', color: 'var(--text-muted)' }}>Loading…</div>}
        {!loading && routines.length === 0 && (
          <div style={{ padding: '8px', color: 'var(--text-muted)' }}>No routines yet. Click + to create one.</div>
        )}
        {routines.map((r) => (
          <div
            key={r.filename}
            onClick={() => setSelectedFile(r.filename)}
            onDoubleClick={() => openRoutineInMainPanel(r.filename)}
            title="Double-click to open"
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '4px 8px', cursor: 'pointer',
              background: selectedFile === r.filename ? 'var(--selected-bg, rgba(74,144,217,0.15))' : 'transparent',
            }}
            onMouseEnter={(e) => { if (selectedFile !== r.filename) e.currentTarget.style.background = 'var(--hover-bg, rgba(255,255,255,0.05))'; }}
            onMouseLeave={(e) => { if (selectedFile !== r.filename) e.currentTarget.style.background = 'transparent'; }}
          >
            <FileCode size={13} style={{ color: '#3b82f6', flexShrink: 0 }} />
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
              {r.name || r.filename}
            </span>
            <button
              className="icon-btn"
              title="Delete"
              onClick={(e) => handleDelete(r.filename, e)}
              style={{ opacity: 0.6 }}
            >
              <Trash2 size={11} />
            </button>
          </div>
        ))}
      </div>

      {(building || buildLog.length > 0) && (
        <div style={{
          borderTop: '1px solid var(--border-color)',
          background: 'var(--log-bg, #111)', color: '#c8e6ff',
          fontFamily: 'monospace', fontSize: '0.7rem',
          padding: '6px 8px', maxHeight: '120px', overflowY: 'auto',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', color: '#aaa' }}>
            <span>Build Output</span>
            {!building && <button onClick={() => setBuildLog([])} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer' }}><X size={11} /></button>}
          </div>
          {buildLog.map((line, i) => <div key={i}>{line}</div>)}
          {building && <div style={{ color: '#aaa' }}>…</div>}
          <div ref={logEndRef} />
        </div>
      )}

      <div style={{ padding: '6px 8px', color: 'var(--text-muted)', fontSize: '0.72rem', borderTop: '1px solid var(--border-color)' }}>
        Double-click a routine to open in editor
      </div>
    </div>
  );
}
