import { useMemo, useState, useCallback, useRef, useEffect, memo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Panel,
  useViewport,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useDesigner } from '../context/DesignerContext';
import TalendComponentNode from './TalendComponentNode';
import JobTabs from './JobTabs';
import ContextVariablesPanel from './ContextVariablesPanel';
import ContextMenu from './ContextMenu';
import {
  Save,
  Play,
  Pause,
  Square,
  Variable,
  Loader2,
  Terminal,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  Zap,
  Repeat,
  Trash2,
  Search,
} from 'lucide-react';

const SubjobGroupNode = memo(function SubjobGroupNode({ data, onRename, onMoveSubjob, onSelect, isActive, zoom }) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(data.label);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);
  const dragStart = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    setEditValue(data.label);
  }, [data.label]);

  const commitRename = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== data.label) {
      onRename(data.rootId, trimmed);
    } else {
      setEditValue(data.label);
    }
    setEditing(false);
  };

  // Subjob drag via mousedown/mousemove/mouseup on the header
  const handleMouseDown = useCallback((e) => {
    if (editing) return;
    e.stopPropagation();
    e.preventDefault();
    onSelect(data.rootId);
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };

    const handleMouseMove = (ev) => {
      if (!dragStart.current) return;
      const dx = (ev.clientX - dragStart.current.x) / zoom;
      const dy = (ev.clientY - dragStart.current.y) / zoom;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        onMoveSubjob(data.nodeIds, dx, dy);
        dragStart.current = { x: ev.clientX, y: ev.clientY };
      }
    };

    const handleMouseUp = () => {
      setDragging(false);
      dragStart.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [editing, zoom, data.nodeIds, onMoveSubjob]);

  const borderColor = isActive || dragging
    ? 'rgba(74, 144, 217, 0.85)'
    : 'rgba(74, 144, 217, 0.4)';
  const bgColor = isActive || dragging
    ? 'rgba(74, 144, 217, 0.12)'
    : 'rgba(74, 144, 217, 0.06)';

  return (
    <div
      style={{
        position: 'absolute',
        left: data.x,
        top: data.y,
        width: data.width,
        height: data.height,
        borderRadius: 8,
        border: `2px ${isActive || dragging ? 'solid' : 'dashed'} ${borderColor}`,
        backgroundColor: bgColor,
        pointerEvents: 'none',
        transition: 'border-color 0.15s, background-color 0.15s',
      }}
    >
      {/* Subjob header bar — draggable & double-click to rename */}
      <div
        style={{
          pointerEvents: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 8px',
          cursor: editing ? 'text' : dragging ? 'grabbing' : 'grab',
          borderRadius: '6px 6px 0 0',
          userSelect: 'none',
        }}
        onMouseDown={handleMouseDown}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(data.rootId);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          setEditValue(data.label);
          setEditing(true);
        }}
        title="Drag to move subjob · Double-click to rename"
      >
        {editing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitRename}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') { setEditValue(data.label); setEditing(false); }
            }}
            style={{
              fontSize: 10,
              fontWeight: 600,
              background: 'var(--bg-primary, #0f172a)',
              color: 'var(--text-primary, #e2e8f0)',
              border: '1px solid #4a90d9',
              borderRadius: 3,
              padding: '1px 4px',
              outline: 'none',
              width: Math.max(60, editValue.length * 7),
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span style={{ fontSize: 10, color: isActive || dragging ? '#4a90d9' : 'var(--text-secondary, #94a3b8)', fontWeight: 600 }}>
            {data.label}
          </span>
        )}
      </div>
    </div>
  );
});

function SubjobOverlay({ groups, onRename, onMoveSubjob, activeSubjobId, onSelectSubjob }) {
  const { x, y, zoom } = useViewport();
  if (groups.length === 0) return null;
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5 }}>
      <div style={{ transform: `translate(${x}px, ${y}px) scale(${zoom})`, transformOrigin: '0 0' }}>
        {groups.map((g) => (
          <SubjobGroupNode
            key={g.id}
            data={g}
            onRename={onRename}
            onMoveSubjob={onMoveSubjob}
            onSelect={onSelectSubjob}
            isActive={activeSubjobId === g.rootId}
            zoom={zoom}
          />
        ))}
      </div>
    </div>
  );
}

const nodeTypes = { talendComponent: TalendComponentNode };

const defaultEdgeOptions = {
  type: 'smoothstep',
  style: { stroke: '#4a90d9', strokeWidth: 2 },
  markerEnd: { type: 'arrowclosed', color: '#4a90d9' },
};

export default function DesignerCanvas() {
  const {
    jobs,
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onNodeClick,
    onPaneClick,
    reactFlowWrapper,
    setReactFlowInstance,
    reactFlowInstance,
    onDragOver,
    onDrop,
    selectedNode,
    selectedNodeId,
    deleteSelectedNode,
    deleteSubjob,
    theme,
    clipboard,
    copyNodeToClipboard,
    copySubjobToClipboard,
    pasteFromClipboard,
    activeJobId,
    saveJob,
    exportJobAsJson,
    importJobFromJson,
    updateEdgeLabel,
    runJob,
    pauseJob,
    stopJob,
    runningJobId,
    jobMetadata,
    addEdgeManual,
    addComponentToCanvas,
    registry,
    undo,
    redo,
    subjobNames,
    updateSubjobName,
    onNodeDragStart,
    moveSubjobNodes,
  } = useDesigner();

  const [bottomTab, setBottomTab] = useState('run');
  const [bottomOpen, setBottomOpen] = useState(false);
  const [nodeContextMenu, setNodeContextMenu] = useState(null);
  const [connectingFrom, setConnectingFrom] = useState(null);
  const [activeSubjobId, setActiveSubjobId] = useState(null); // root id of selected subjob
  const justStartedConnecting = useRef(false);
  const importFileRef = useRef(null);

  // ── Quick-add component (type-to-search on canvas) ──
  const [quickSearch, setQuickSearch] = useState(null); // null or { term: string }
  const [quickSelectedIdx, setQuickSelectedIdx] = useState(0);
  const quickInputRef = useRef(null);

  const quickResults = useMemo(() => {
    if (!quickSearch || !quickSearch.term.trim()) return [];
    const term = quickSearch.term.toLowerCase();
    return Object.entries(registry)
      .filter(([key, comp]) =>
        comp.label.toLowerCase().includes(term) ||
        key.toLowerCase().includes(term) ||
        (comp.category || '').toLowerCase().includes(term)
      )
      .slice(0, 10);
  }, [quickSearch, registry]);

  const openQuickSearch = useCallback((initialChar) => {
    if (!activeJobId || jobs.length === 0) return;
    setQuickSearch({ term: initialChar || '' });
    setQuickSelectedIdx(0);
  }, [activeJobId, jobs.length]);

  const closeQuickSearch = useCallback(() => {
    setQuickSearch(null);
    setQuickSelectedIdx(0);
  }, []);

  const addQuickComponent = useCallback((componentKey) => {
    if (!reactFlowInstance) return;
    const viewport = reactFlowInstance.getViewport();
    const wrapper = reactFlowWrapper.current;
    if (!wrapper) return;
    const bounds = wrapper.getBoundingClientRect();
    const centerX = (bounds.width / 2 - viewport.x) / viewport.zoom;
    const centerY = (bounds.height / 2 - viewport.y) / viewport.zoom;
    // Offset slightly based on existing node count to avoid stacking
    const offset = (nodes.length % 5) * 40;
    addComponentToCanvas(componentKey, { x: centerX + offset, y: centerY + offset });
    closeQuickSearch();
  }, [reactFlowInstance, reactFlowWrapper, nodes.length, addComponentToCanvas, closeQuickSearch]);

  const proOptions = useMemo(() => ({ hideAttribution: true }), []);

  const isRunning = runningJobId != null && runningJobId === activeJobId;
  const isPaused = jobMetadata.status === 'paused';
  const status = jobMetadata.status || 'draft';

  /* ── Edge label editing on double-click ── */
  const handleEdgeDoubleClick = useCallback((evt, edge) => {
    evt.stopPropagation();
    const newLabel = prompt('Rename connection:', edge.label || '');
    if (newLabel !== null && newLabel !== edge.label) {
      updateEdgeLabel(edge.id, newLabel);
    }
  }, [updateEdgeLabel]);

  /* ── Import Job from file ── */
  const handleImportJob = useCallback(() => {
    importFileRef.current?.click();
  }, []);
  const handleImportFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        importJobFromJson(ev.target.result);
      } catch (err) {
        console.error('Import failed:', err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [importJobFromJson]);

  // ── Compute subjobs (connected components from row/iterate edges) ──
  const subjobGroups = useMemo(() => {
    if (edges.length === 0 || nodes.length < 2) return [];

    const parent = {};
    const find = (x) => {
      if (parent[x] === undefined) parent[x] = x;
      if (parent[x] !== x) parent[x] = find(parent[x]);
      return parent[x];
    };
    const union = (a, b) => { parent[find(a)] = find(b); };

    for (const edge of edges) {
      if (edge.data?.category !== 'trigger') {
        union(edge.source, edge.target);
      }
    }

    const groups = {};
    for (const node of nodes) {
      const root = find(node.id);
      if (!groups[root]) groups[root] = [];
      groups[root].push(node);
    }

    const NODE_W = 200;
    const NODE_H = 70;
    const PAD = 25;
    const HDR = 22;

    return Object.entries(groups)
      .filter(([, g]) => g.length >= 2)
      .map(([root, g], idx) => {
        const minX = Math.min(...g.map((n) => n.position.x));
        const minY = Math.min(...g.map((n) => n.position.y));
        const maxX = Math.max(...g.map((n) => n.position.x + (n.width || NODE_W)));
        const maxY = Math.max(...g.map((n) => n.position.y + (n.height || NODE_H)));
        return {
          id: `subjob_${root}`,
          rootId: root,
          x: minX - PAD,
          y: minY - PAD - HDR,
          width: maxX - minX + PAD * 2,
          height: maxY - minY + PAD * 2 + HDR,
          label: subjobNames[root] || `Subjob ${idx + 1}`,
          nodeIds: g.map((n) => n.id),
        };
      });
  }, [nodes, edges, subjobNames]);

  // ── Active subjob helper ──
  const activeSubjobGroup = useMemo(() => {
    if (!activeSubjobId) return null;
    return subjobGroups.find((g) => g.rootId === activeSubjobId) || null;
  }, [activeSubjobId, subjobGroups]);

  // ── Keyboard shortcuts (Ctrl+C / Ctrl+V / Ctrl+Z / Ctrl+Y / Delete) ────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Skip if user is typing in an input/textarea (except quick search)
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        saveJob();
      }
      if (e.ctrlKey && e.key === 'c') {
        e.preventDefault();
        if (activeSubjobGroup) {
          copySubjobToClipboard(activeSubjobGroup.nodeIds);
        } else if (selectedNodeId) {
          copyNodeToClipboard(selectedNodeId);
        }
      }
      if (e.ctrlKey && e.key === 'v' && clipboard) {
        e.preventDefault();
        pasteFromClipboard(activeJobId);
      }
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        undo();
      }
      if (e.ctrlKey && e.key === 'y') {
        e.preventDefault();
        redo();
      }
      if (e.key === 'Delete') {
        if (activeSubjobGroup) {
          e.preventDefault();
          deleteSubjob(activeSubjobGroup.nodeIds);
          setActiveSubjobId(null);
        }
      }

      // Open quick-add on regular letter/number key press (no modifier)
      if (!e.ctrlKey && !e.altKey && !e.metaKey && e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key) && !quickSearch && activeJobId) {
        e.preventDefault();
        openQuickSearch(e.key);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, clipboard, activeJobId, copyNodeToClipboard, copySubjobToClipboard, pasteFromClipboard, undo, redo, quickSearch, openQuickSearch, saveJob, activeSubjobGroup, deleteSubjob]);

  // Auto-focus quick search input
  useEffect(() => {
    if (quickSearch && quickInputRef.current) {
      quickInputRef.current.focus();
    }
  }, [quickSearch]);

  const toggleBottom = (tab) => {
    if (bottomOpen && bottomTab === tab) {
      setBottomOpen(false);
    } else {
      setBottomTab(tab);
      setBottomOpen(true);
    }
  };

  const StatusIcon = ({ s }) => {
    switch (s) {
      case 'running': return <Loader2 size={13} className="spin" />;
      case 'completed': return <CheckCircle2 size={13} />;
      case 'stopped': return <XCircle size={13} />;
      case 'paused': return <Pause size={13} />;
      default: return <Clock size={13} />;
    }
  };

  // ── Trigger icons for context menu ─────────────
  const TRIGGER_ICONS = {
    OnComponentOk: <CheckCircle2 size={12} style={{ color: '#27ae60' }} />,
    OnComponentError: <XCircle size={12} style={{ color: '#e74c3c' }} />,
    OnSubjobOk: <CheckCircle2 size={12} style={{ color: '#2ecc71' }} />,
    OnSubjobError: <XCircle size={12} style={{ color: '#c0392b' }} />,
    RunIf: <Zap size={12} style={{ color: '#f39c12' }} />,
  };

  // ── Node right-click handler ─────────────
  const handleNodeContextMenu = useCallback((e, node) => {
    e.preventDefault();
    setNodeContextMenu({ x: e.clientX, y: e.clientY, node });
  }, []);

  const startConnecting = useCallback((sourceNodeId, connectorName, connectorType, connectorLabel, category) => {
    setConnectingFrom({ nodeId: sourceNodeId, connectorName, connectorType, connectorLabel, category });
    justStartedConnecting.current = true;
    setTimeout(() => { justStartedConnecting.current = false; }, 300);
  }, []);

  const cancelConnecting = useCallback(() => {
    setConnectingFrom(null);
  }, []);

  // Handle node click — if connecting, complete connection; else normal click
  const handleNodeClick = useCallback((e, node) => {
    if (connectingFrom) {
      addEdgeManual(connectingFrom.nodeId, node.id, connectingFrom.connectorName, connectingFrom.connectorType, connectingFrom.connectorLabel, connectingFrom.category);
      setConnectingFrom(null);
      return;
    }
    setActiveSubjobId(null);
    onNodeClick(e, node);
  }, [connectingFrom, addEdgeManual, onNodeClick]);

  // Handle pane click — cancel connecting mode (but skip if just started)
  const handlePaneClick = useCallback((e) => {
    if (justStartedConnecting.current) return;
    if (connectingFrom) {
      cancelConnecting();
      return;
    }
    setActiveSubjobId(null);
    onPaneClick(e);
    setNodeContextMenu(null);
  }, [connectingFrom, cancelConnecting, onPaneClick]);

  // Build context menu items for a node
  const nodeMenuItems = useMemo(() => {
    if (!nodeContextMenu) return [];
    const { node } = nodeContextMenu;
    const connectors = node.data.connectors || {};
    const outputs = connectors.outputs || [];
    const triggers = connectors.triggers?.outgoing || [];
    const items = [];

    // Row / Iterate outputs as submenu
    if (outputs.length > 0) {
      items.push({
        label: 'Row',
        icon: <ArrowRight size={12} style={{ color: '#4a90d9' }} />,
        children: outputs.map((out) => {
          const cat = out.type === 'iterate' ? 'iterate' : 'row';
          return {
            label: out.label,
            icon: cat === 'iterate'
              ? <Repeat size={12} style={{ color: '#1abc9c' }} />
              : <ArrowRight size={12} style={{ color: '#4a90d9' }} />,
            onClick: () => startConnecting(node.id, out.name, out.type, out.label, cat),
          };
        }),
      });
    }

    // Trigger outputs as submenu
    if (triggers.length > 0) {
      items.push({
        label: 'Trigger',
        icon: <Zap size={12} style={{ color: '#e74c3c' }} />,
        children: triggers.map((trig) => ({
          label: trig,
          icon: TRIGGER_ICONS[trig] || <Zap size={12} />,
          onClick: () => startConnecting(node.id, trig, 'trigger', trig, 'trigger'),
        })),
      });
    }

    return items;
  }, [nodeContextMenu, startConnecting]);

  return (
    <div className={`designer-canvas-wrapper ${connectingFrom ? 'designer-canvas-wrapper--connecting' : ''}`}>
      {/* Connecting mode banner */}
      {connectingFrom && (
        <div className="connecting-banner">
          <Zap size={13} />
          <span>
            Click a target component to create <strong>{connectingFrom.connectorLabel}</strong> connection
          </span>
          <button className="connecting-banner__cancel" onClick={cancelConnecting}>Cancel</button>
        </div>
      )}
      <JobTabs />
      <div className="designer-canvas" ref={reactFlowWrapper} style={{ flex: 1 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          onNodeContextMenu={handleNodeContextMenu}
          onEdgeDoubleClick={handleEdgeDoubleClick}
          onNodeDragStart={onNodeDragStart}
          onInit={setReactFlowInstance}
          onDragOver={onDragOver}
          onDrop={onDrop}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          fitView
          snapToGrid
          snapGrid={[15, 15]}
          nodesDraggable
          nodeDragThreshold={2}
          proOptions={proOptions}
          deleteKeyCode="Delete"
          multiSelectionKeyCode="Control"
        >
          <Background variant="dots" gap={15} size={1} color={theme === 'dark' ? '#334155' : '#cbd5e1'} />
          <SubjobOverlay
            groups={subjobGroups}
            onRename={updateSubjobName}
            onMoveSubjob={moveSubjobNodes}
            activeSubjobId={activeSubjobId}
            onSelectSubjob={setActiveSubjobId}
          />
          <Controls
            position="bottom-right"
            style={{ background: '#1e293b', border: '1px solid #334155' }}
          />
          {/* Top-left toolbar (info, paste, delete) */}
          {jobs.length > 0 && (
            <Panel position="top-left" className="canvas-toolbar">
              <div className="toolbar-info">
                <span>{nodes.length} components</span>
                <span>{edges.length} connections</span>
              </div>
              {selectedNode && (
                <button
                  className="toolbar-btn toolbar-btn--danger"
                  onClick={deleteSelectedNode}
                  title="Delete selected component"
                >
                  Delete
                </button>
              )}
            </Panel>
          )}

          {/* Empty state - welcome */}
          {jobs.length === 0 && (
            <div className="canvas-welcome">
              <div className="canvas-welcome__icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                  <rect width="24" height="24" rx="4" fill="#4a90d9" />
                  <path d="M6 8h12M6 12h12M6 16h8" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <h2 className="canvas-welcome__title">Welcome to DataPrep Studio</h2>
              <p className="canvas-welcome__subtitle">Design and orchestrate your data pipelines visually</p>
              <div className="canvas-welcome__hint">
                <span>Right-click on <strong>Job Designer</strong> panel to create a new job or folder</span>
              </div>
            </div>
          )}
          {/* Empty state - no components */}
          {jobs.length > 0 && nodes.length === 0 && (
            <Panel position="top-center" className="canvas-empty">
              <div className="empty-message">
                <h3>Start typing to search components</h3>
                <p>Or drag them from the palette to build your data pipeline</p>
              </div>
            </Panel>
          )}

          {/* Quick-add component search */}
          {quickSearch && (
            <div className="quick-search-overlay">
              <div className="quick-search">
                <div className="quick-search__input-row">
                  <Search size={14} className="quick-search__icon" />
                  <input
                    ref={quickInputRef}
                    className="quick-search__input"
                    type="text"
                    value={quickSearch.term}
                    onChange={(e) => {
                      setQuickSearch({ term: e.target.value });
                      setQuickSelectedIdx(0);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        closeQuickSearch();
                      } else if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setQuickSelectedIdx((i) => Math.min(i + 1, quickResults.length - 1));
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setQuickSelectedIdx((i) => Math.max(i - 1, 0));
                      } else if (e.key === 'Enter' && quickResults.length > 0) {
                        e.preventDefault();
                        addQuickComponent(quickResults[quickSelectedIdx][0]);
                      }
                    }}
                    placeholder="Type to search components..."
                  />
                </div>
                {quickResults.length > 0 && (
                  <div className="quick-search__results">
                    {quickResults.map(([key, comp], idx) => (
                      <div
                        key={key}
                        className={`quick-search__item ${idx === quickSelectedIdx ? 'quick-search__item--selected' : ''}`}
                        onClick={() => addQuickComponent(key)}
                        onMouseEnter={() => setQuickSelectedIdx(idx)}
                      >
                        <span className="quick-search__item-label">{comp.label}</span>
                        <span className="quick-search__item-category">{comp.category}</span>
                      </div>
                    ))}
                  </div>
                )}
                {quickSearch.term.trim() && quickResults.length === 0 && (
                  <div className="quick-search__empty">No components found</div>
                )}
              </div>
            </div>
          )}
        </ReactFlow>
      </div>

      {/* Node right-click context menu */}
      {nodeContextMenu && (
        <ContextMenu
          x={nodeContextMenu.x}
          y={nodeContextMenu.y}
          items={nodeMenuItems}
          onClose={() => setNodeContextMenu(null)}
        />
      )}

      {/* ── Talend-style Bottom Panel ──────────────────── */}
      <div className="bottom-panel">
        {/* Tab strip */}
        <div className="bottom-panel__tabs">
          <button
            className={`bottom-panel__tab ${bottomTab === 'run' && bottomOpen ? 'bottom-panel__tab--active' : ''}`}
            onClick={() => toggleBottom('run')}
          >
            <Terminal size={13} />
            <span>Run</span>
            {isRunning && <Loader2 size={11} className="spin" />}
            {bottomTab === 'run' && bottomOpen ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          </button>
          <button
            className={`bottom-panel__tab ${bottomTab === 'context' && bottomOpen ? 'bottom-panel__tab--active' : ''}`}
            onClick={() => toggleBottom('context')}
          >
            <Variable size={13} />
            <span>Context</span>
            {bottomTab === 'context' && bottomOpen ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          </button>
          {/* Status indicator on the right side of tab strip */}
          <div className="bottom-panel__status">
            <StatusIcon s={status} />
            <span className={`bottom-panel__status-text bottom-panel__status-text--${status}`}>
              {status}
            </span>
          </div>
        </div>

        {/* Panel body */}
        {bottomOpen && (
          <div className="bottom-panel__body">
            {bottomTab === 'run' && (
              <div className="run-panel">
                <div className="run-panel__toolbar">
                  <button
                    className="run-panel__btn run-panel__btn--run"
                    onClick={runJob}
                    disabled={isRunning}
                    title="Run Job"
                  >
                    <Play size={14} />
                    Run
                  </button>
                  <button
                    className="run-panel__btn run-panel__btn--stop"
                    onClick={stopJob}
                    disabled={!isRunning && !isPaused}
                    title="Stop Job"
                  >
                    <Square size={14} />
                    Stop
                  </button>
                  <button
                    className="run-panel__btn"
                    onClick={() => {
                      if (isRunning || isPaused) stopJob();
                    }}
                    disabled={status === 'draft'}
                    title="Clear console"
                  >
                    <Trash2 size={14} />
                    Clear
                  </button>
                  <div className="run-panel__separator" />
                  <div className="run-panel__info">
                    <span className="run-panel__info-label">Status:</span>
                    <span className={`run-panel__info-value run-panel__info-value--${status}`}>
                      <StatusIcon s={status} />
                      {status}
                    </span>
                  </div>
                  <div className="run-panel__info">
                    <span className="run-panel__info-label">Components:</span>
                    <span className="run-panel__info-value">{nodes.length}</span>
                  </div>
                  <div className="run-panel__info">
                    <span className="run-panel__info-label">Connections:</span>
                    <span className="run-panel__info-value">{edges.length}</span>
                  </div>
                </div>
                <div className="run-panel__console">
                  <div className="run-panel__console-header">Console Output</div>
                  <div className="run-panel__console-body">
                    {status === 'draft' || status === 'saved' ? (
                      <span className="run-panel__console-msg">Click "Run" to execute the job.</span>
                    ) : status === 'running' ? (
                      <>
                        <span className="run-panel__console-line run-panel__console-line--info">[INFO] Job "{jobMetadata.name}" started...</span>
                        <span className="run-panel__console-line run-panel__console-line--info">[INFO] Initializing {nodes.length} components...</span>
                        <span className="run-panel__console-line"><Loader2 size={11} className="spin" /> Processing...</span>
                      </>
                    ) : status === 'paused' ? (
                      <>
                        <span className="run-panel__console-line run-panel__console-line--info">[INFO] Job "{jobMetadata.name}" started...</span>
                        <span className="run-panel__console-line run-panel__console-line--warn">[WARN] Job paused by user.</span>
                      </>
                    ) : status === 'stopped' ? (
                      <>
                        <span className="run-panel__console-line run-panel__console-line--info">[INFO] Job "{jobMetadata.name}" started...</span>
                        <span className="run-panel__console-line run-panel__console-line--error">[STOP] Job stopped by user.</span>
                      </>
                    ) : status === 'completed' ? (
                      <>
                        <span className="run-panel__console-line run-panel__console-line--info">[INFO] Job "{jobMetadata.name}" started...</span>
                        <span className="run-panel__console-line run-panel__console-line--info">[INFO] Initialized {nodes.length} components.</span>
                        <span className="run-panel__console-line run-panel__console-line--info">[INFO] Processing {edges.length} connections...</span>
                        <span className="run-panel__console-line run-panel__console-line--success">[OK] Job completed successfully.</span>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            )}

            {bottomTab === 'context' && (
              <ContextVariablesPanel />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
