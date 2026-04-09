import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Panel,
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
  Copy,
  Trash2,
  Clipboard,
} from 'lucide-react';

function SubjobGroupNode({ data }) {
  return (
    <div
      style={{
        width: data.width,
        height: data.height,
        borderRadius: 8,
        border: '2px dashed rgba(74, 144, 217, 0.4)',
        backgroundColor: 'rgba(74, 144, 217, 0.06)',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: 'var(--text-secondary, #94a3b8)',
          fontWeight: 600,
          padding: '2px 8px',
          opacity: 0.7,
        }}
      >
        {data.label}
      </div>
    </div>
  );
}

const nodeTypes = { talendComponent: TalendComponentNode, subjobGroup: SubjobGroupNode };

const defaultEdgeOptions = {
  type: 'smoothstep',
  style: { stroke: '#4a90d9', strokeWidth: 2 },
  markerEnd: { type: 'arrowclosed', color: '#4a90d9' },
};

export default function DesignerCanvas() {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onNodeClick,
    onPaneClick,
    reactFlowWrapper,
    setReactFlowInstance,
    onDragOver,
    onDrop,
    selectedNode,
    selectedNodeId,
    deleteSelectedNode,
    theme,
    clipboard,
    copyNodeToClipboard,
    copySubjobToClipboard,
    pasteFromClipboard,
    activeJobId,
    saveJob,
    runJob,
    pauseJob,
    stopJob,
    runningJobId,
    jobMetadata,
    addEdgeManual,
  } = useDesigner();

  const [bottomTab, setBottomTab] = useState('run');
  const [bottomOpen, setBottomOpen] = useState(false);
  const [nodeContextMenu, setNodeContextMenu] = useState(null);
  const [connectingFrom, setConnectingFrom] = useState(null);
  const justStartedConnecting = useRef(false);

  const proOptions = useMemo(() => ({ hideAttribution: true }), []);

  const isRunning = runningJobId === activeJobId;
  const isPaused = jobMetadata.status === 'paused';
  const status = jobMetadata.status || 'draft';

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
          type: 'subjobGroup',
          position: { x: minX - PAD, y: minY - PAD - HDR },
          data: {
            width: maxX - minX + PAD * 2,
            height: maxY - minY + PAD * 2 + HDR,
            label: `Subjob ${idx + 1}`,
            nodeIds: g.map((n) => n.id),
          },
          selectable: false,
          draggable: false,
          focusable: false,
          zIndex: -1,
        };
      });
  }, [nodes, edges]);

  // Merge subjob group nodes (rendered behind) with real nodes
  const allNodes = useMemo(() => [...subjobGroups, ...nodes], [subjobGroups, nodes]);

  // Filter out subjob group changes from onNodesChange
  const handleNodesChange = useCallback(
    (changes) => {
      const real = changes.filter((c) => !c.id?.startsWith('subjob_'));
      if (real.length > 0) onNodesChange(real);
    },
    [onNodesChange]
  );

  // ── Keyboard shortcuts (Ctrl+C / Ctrl+V) ────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === 'c' && selectedNodeId) {
        e.preventDefault();
        copyNodeToClipboard(selectedNodeId);
      }
      if (e.ctrlKey && e.key === 'v' && clipboard) {
        e.preventDefault();
        pasteFromClipboard(activeJobId);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, clipboard, activeJobId, copyNodeToClipboard, pasteFromClipboard]);

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
    onNodeClick(e, node);
  }, [connectingFrom, addEdgeManual, onNodeClick]);

  // Handle pane click — cancel connecting mode (but skip if just started)
  const handlePaneClick = useCallback((e) => {
    if (justStartedConnecting.current) return;
    if (connectingFrom) {
      cancelConnecting();
      return;
    }
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

    // Row / Iterate outputs
    if (outputs.length > 0) {
      items.push({ separator: true, label: 'Row' });
      for (const out of outputs) {
        const cat = out.type === 'iterate' ? 'iterate' : 'row';
        items.push({
          label: out.label,
          icon: cat === 'iterate'
            ? <Repeat size={12} style={{ color: '#1abc9c' }} />
            : <ArrowRight size={12} style={{ color: '#4a90d9' }} />,
          onClick: () => startConnecting(node.id, out.name, out.type, out.label, cat),
        });
      }
    }

    // Trigger outputs
    if (triggers.length > 0) {
      items.push({ separator: true, label: 'Trigger' });
      for (const trig of triggers) {
        items.push({
          label: trig,
          icon: TRIGGER_ICONS[trig] || <Zap size={12} />,
          onClick: () => startConnecting(node.id, trig, 'trigger', trig, 'trigger'),
        });
      }
    }

    // Standard actions
    items.push({ separator: true });
    items.push({
      label: 'Copy Component',
      icon: <Copy size={12} />,
      onClick: () => copyNodeToClipboard(node.id),
    });

    // Check if node belongs to a subjob — offer Copy Subjob
    const nodeSubjob = subjobGroups.find((sg) => sg.data.nodeIds.includes(node.id));
    if (nodeSubjob) {
      items.push({
        label: 'Copy Subjob',
        icon: <Copy size={12} />,
        onClick: () => copySubjobToClipboard(nodeSubjob.data.nodeIds),
      });
    }

    if (clipboard) {
      items.push({
        label: clipboard.type === 'subjob' ? 'Paste Subjob' : 'Paste Component',
        icon: <Clipboard size={12} />,
        onClick: () => pasteFromClipboard(activeJobId),
      });
    }
    items.push({ separator: true });
    items.push({
      label: 'Delete Component',
      icon: <Trash2 size={12} />,
      danger: true,
      onClick: () => {
        onNodeClick(null, node);
        setTimeout(() => deleteSelectedNode(), 0);
      },
    });

    return items;
  }, [nodeContextMenu, startConnecting, copyNodeToClipboard, copySubjobToClipboard, subjobGroups, clipboard, pasteFromClipboard, activeJobId, deleteSelectedNode, onNodeClick]);

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
          nodes={allNodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          onNodeContextMenu={handleNodeContextMenu}
          onInit={setReactFlowInstance}
          onDragOver={onDragOver}
          onDrop={onDrop}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          fitView
          snapToGrid
          snapGrid={[15, 15]}
          proOptions={proOptions}
          deleteKeyCode="Delete"
          multiSelectionKeyCode="Control"
        >
          <Background variant="dots" gap={15} size={1} color={theme === 'dark' ? '#334155' : '#cbd5e1'} />
          <Controls
            position="bottom-right"
            style={{ background: '#1e293b', border: '1px solid #334155' }}
          />
          {/* Top-left toolbar (info, paste, delete) */}
          <Panel position="top-left" className="canvas-toolbar">
            <div className="toolbar-info">
              <span>{nodes.length} components</span>
              <span>{edges.length} connections</span>
            </div>
            {clipboard && (
              <button
                className="toolbar-btn"
                onClick={() => pasteFromClipboard(activeJobId)}
                title={clipboard.type === 'subjob' ? 'Paste copied subjob' : 'Paste copied component'}
              >
                Paste: {clipboard.type === 'subjob' ? `Subjob (${clipboard.nodes.length})` : clipboard.node.data.label}
              </button>
            )}
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

          {/* Top-right: Save */}
          <Panel position="top-right" className="canvas-toolbar">
            <button className="toolbar-btn toolbar-btn--primary" onClick={saveJob} title="Save Job (Ctrl+S)">
              <Save size={14} />
              Save
            </button>
          </Panel>

          {/* Empty state */}
          {nodes.length === 0 && (
            <Panel position="top-center" className="canvas-empty">
              <div className="empty-message">
                <h3>Drag components from the palette</h3>
                <p>Drop them here to start building your data pipeline</p>
              </div>
            </Panel>
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
                    className="run-panel__btn run-panel__btn--pause"
                    onClick={pauseJob}
                    disabled={!isRunning || isPaused}
                    title="Pause Job"
                  >
                    <Pause size={14} />
                    Pause
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
