import { createContext, useContext, useCallback, useState, useRef, useEffect } from 'react';
import { addEdge, applyNodeChanges, applyEdgeChanges } from 'reactflow';
import { v4 as uuidv4 } from 'uuid';
import registry from '../data/ui_registry.json';

const DesignerContext = createContext(null);

export function useDesigner() {
  const ctx = useContext(DesignerContext);
  if (!ctx) throw new Error('useDesigner must be used within DesignerProvider');
  return ctx;
}

/** Build default property values for a component */
function buildDefaults(componentType) {
  const def = registry[componentType];
  if (!def) return {};
  const vals = {};
  for (const prop of def.properties) {
    vals[prop.key] = prop.default !== undefined ? prop.default : '';
  }
  return vals;
}

function getInitialTheme() {
  try {
    const saved = localStorage.getItem('dataprep-theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* ignore */ }
  return 'dark';
}

function createNewJob(name) {
  const now = new Date().toISOString().slice(0, 10);
  return {
    id: uuidv4().slice(0, 8),
    nodes: [],
    edges: [],
    nodeProperties: {},
    selectedNodeId: null,
    metadata: {
      name: name || 'New_Job_1',
      description: '',
      author: '',
      version: '1.0.0',
      purpose: '',
      status: 'draft',
      created: now,
      modified: now,
      tags: [],
    },
  };
}

export function DesignerProvider({ children }) {
  // Multi-job state
  const [jobs, setJobs] = useState(() => {
    const first = createNewJob('New_Job_1');
    return [first];
  });
  const [activeJobId, setActiveJobId] = useState(() => jobs[0]?.id);

  const reactFlowWrapper = useRef(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);

  // Theme
  const [theme, setTheme] = useState(getInitialTheme);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('dataprep-theme', next); } catch { /* ignore */ }
      return next;
    });
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Left sidebar active tab
  const [leftTab, setLeftTab] = useState('palette');

  // Clipboard for cross-job copy
  const [clipboard, setClipboard] = useState(null);

  // ── Metadata Repository (Talend-style connections/schemas) ──
  const [metadataRepo, setMetadataRepo] = useState([]);

  // ── Run Job (simulated) ──
  const [runningJobId, setRunningJobId] = useState(null);

  const createMetadataItem = useCallback((category) => {
    const id = uuidv4().slice(0, 8);
    const now = new Date().toISOString().slice(0, 10);
    const templates = {
      'Db Connections': { name: 'New_DB_Connection', dbType: 'Oracle', host: '', port: '1521', database: '', schema: '', username: '', password: '' },
      'File Delimited': { name: 'New_Delimited', filePath: '', encoding: 'UTF-8', rowSeparator: '\\n', fieldSeparator: ',', headerRows: '1', escapeChar: '"', textEnclosure: '"' },
      'File XML': { name: 'New_XML', filePath: '', encoding: 'UTF-8', xpathLoop: '', xpathQuery: '' },
      'File Excel': { name: 'New_Excel', filePath: '', sheetName: 'Sheet1', headerRow: '1', firstDataRow: '2', lastDataRow: '' },
      'File JSON': { name: 'New_JSON', filePath: '', jsonPath: '$', encoding: 'UTF-8' },
      'File Positional': { name: 'New_Positional', filePath: '', encoding: 'UTF-8', headerRows: '0', fieldPositions: '' },
      'File LDIF': { name: 'New_LDIF', filePath: '' },
      'File Regex': { name: 'New_Regex', filePath: '', pattern: '', encoding: 'UTF-8' },
      'Generic Schemas': { name: 'New_Schema', columns: [{ name: 'id', type: 'String', length: '50', nullable: true, key: false, comment: '' }] },
      'LDAP': { name: 'New_LDAP', host: '', port: '389', baseDN: '', bindDN: '', bindPassword: '' },
      'Salesforce': { name: 'New_Salesforce', endpoint: '', username: '', password: '', securityToken: '', apiVersion: '52.0' },
      'Web Service': { name: 'New_WebService', wsdlUrl: '', endpoint: '', method: 'GET', contentType: 'application/json' },
    };
    const props = templates[category] || { name: `New_${category}` };
    const item = { id, category, created: now, modified: now, ...props };
    setMetadataRepo((prev) => [...prev, item]);
    return id;
  }, []);

  const updateMetadataItem = useCallback((itemId, key, value) => {
    setMetadataRepo((prev) =>
      prev.map((m) =>
        m.id === itemId
          ? { ...m, [key]: value, modified: new Date().toISOString().slice(0, 10) }
          : m
      )
    );
  }, []);

  const deleteMetadataItem = useCallback((itemId) => {
    setMetadataRepo((prev) => prev.filter((m) => m.id !== itemId));
  }, []);

  const duplicateMetadataItem = useCallback((itemId) => {
    setMetadataRepo((prev) => {
      const src = prev.find((m) => m.id === itemId);
      if (!src) return prev;
      const now = new Date().toISOString().slice(0, 10);
      return [...prev, { ...JSON.parse(JSON.stringify(src)), id: uuidv4().slice(0, 8), name: `${src.name}_copy`, created: now, modified: now }];
    });
  }, []);

  // ── Derived state from active job ──────────────────
  const activeJob = jobs.find((j) => j.id === activeJobId) || jobs[0];

  // ── Context Variables (per-job) ──
  const contextVariables = activeJob?.contextVariables || [];
  const nodes = activeJob?.nodes || [];
  const edges = activeJob?.edges || [];
  const nodeProperties = activeJob?.nodeProperties || {};
  const selectedNodeId = activeJob?.selectedNodeId || null;
  const jobMetadata = activeJob?.metadata || {};
  const jobName = jobMetadata.name || '';

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;

  // ── Helper: update current job ─────────────────────
  // (defined early so context vars / save / run can use it)
  const updateActiveJob = useCallback((updater) => {
    setJobs((prev) =>
      prev.map((j) =>
        j.id === activeJobId ? (typeof updater === 'function' ? updater(j) : { ...j, ...updater }) : j
      )
    );
  }, [activeJobId]);

  // ── Job management ─────────────────────────────────
  const createJob = useCallback((name) => {
    const newJob = createNewJob(name);
    setJobs((prev) => [...prev, newJob]);
    setActiveJobId(newJob.id);
    return newJob.id;
  }, []);

  const closeJob = useCallback((jobId) => {
    setJobs((prev) => {
      const next = prev.filter((j) => j.id !== jobId);
      if (next.length === 0) {
        const fallback = createNewJob('New_Job_1');
        setActiveJobId(fallback.id);
        return [fallback];
      }
      if (activeJobId === jobId) {
        setActiveJobId(next[0].id);
      }
      return next;
    });
  }, [activeJobId]);

  const renameJob = useCallback((jobId, newName) => {
    setJobs((prev) =>
      prev.map((j) =>
        j.id === jobId
          ? { ...j, metadata: { ...j.metadata, name: newName, modified: new Date().toISOString().slice(0, 10) } }
          : j
      )
    );
  }, []);

  const duplicateJob = useCallback((jobId) => {
    setJobs((prev) => {
      const src = prev.find((j) => j.id === jobId);
      if (!src) return prev;
      const newId = uuidv4().slice(0, 8);
      const now = new Date().toISOString().slice(0, 10);
      const dup = {
        ...JSON.parse(JSON.stringify(src)),
        id: newId,
        metadata: {
          ...src.metadata,
          name: `${src.metadata.name}_copy`,
          created: now,
          modified: now,
        },
      };
      setActiveJobId(newId);
      return [...prev, dup];
    });
  }, []);

  // ── Context variable operations ─────────────────────
  const addContextVariable = useCallback(() => {
    updateActiveJob((j) => ({
      ...j,
      contextVariables: [...(j.contextVariables || []), { name: 'new_variable', type: 'String', value: '', comment: '' }],
    }));
  }, [updateActiveJob]);

  const updateContextVariable = useCallback((index, key, value) => {
    updateActiveJob((j) => ({
      ...j,
      contextVariables: (j.contextVariables || []).map((v, i) => (i === index ? { ...v, [key]: value } : v)),
    }));
  }, [updateActiveJob]);

  const removeContextVariable = useCallback((index) => {
    updateActiveJob((j) => ({
      ...j,
      contextVariables: (j.contextVariables || []).filter((_, i) => i !== index),
    }));
  }, [updateActiveJob]);

  // ── Save Job (to localStorage) ──
  const saveJob = useCallback(() => {
    const job = jobs.find((j) => j.id === activeJobId);
    if (!job) return;
    try {
      const saved = JSON.parse(localStorage.getItem('dataprep-saved-jobs') || '{}');
      saved[job.id] = JSON.parse(JSON.stringify(job));
      localStorage.setItem('dataprep-saved-jobs', JSON.stringify(saved));
    } catch { /* ignore */ }
    updateActiveJob((j) => ({
      ...j,
      metadata: { ...j.metadata, status: 'saved', modified: new Date().toISOString().slice(0, 10) },
    }));
  }, [jobs, activeJobId, updateActiveJob]);

  // ── Run Job (simulated) ──
  const runJob = useCallback(() => {
    if (runningJobId) return;
    setRunningJobId(activeJobId);
    updateActiveJob((j) => ({
      ...j,
      metadata: { ...j.metadata, status: 'running', modified: new Date().toISOString().slice(0, 10) },
    }));
    setTimeout(() => {
      setRunningJobId(null);
      setJobs((prev) =>
        prev.map((j) =>
          j.id === activeJobId
            ? { ...j, metadata: { ...j.metadata, status: 'completed', modified: new Date().toISOString().slice(0, 10) } }
            : j
        )
      );
    }, 5000);
  }, [activeJobId, runningJobId, updateActiveJob]);

  const pauseJob = useCallback(() => {
    if (runningJobId !== activeJobId) return;
    updateActiveJob((j) => ({
      ...j,
      metadata: { ...j.metadata, status: 'paused', modified: new Date().toISOString().slice(0, 10) },
    }));
  }, [activeJobId, runningJobId, updateActiveJob]);

  const stopJob = useCallback(() => {
    if (!runningJobId) return;
    setRunningJobId(null);
    updateActiveJob((j) => ({
      ...j,
      metadata: { ...j.metadata, status: 'stopped', modified: new Date().toISOString().slice(0, 10) },
    }));
  }, [runningJobId, updateActiveJob]);

  // ── Node / edge operations on active job ───────────
  const setNodes = useCallback((setter) => {
    updateActiveJob((j) => ({
      ...j,
      nodes: typeof setter === 'function' ? setter(j.nodes) : setter,
    }));
  }, [updateActiveJob]);

  const setEdges = useCallback((setter) => {
    updateActiveJob((j) => ({
      ...j,
      edges: typeof setter === 'function' ? setter(j.edges) : setter,
    }));
  }, [updateActiveJob]);

  const setSelectedNodeId = useCallback((id) => {
    updateActiveJob((j) => ({ ...j, selectedNodeId: id }));
  }, [updateActiveJob]);

  const setNodeProperties = useCallback((setter) => {
    updateActiveJob((j) => ({
      ...j,
      nodeProperties: typeof setter === 'function' ? setter(j.nodeProperties) : setter,
    }));
  }, [updateActiveJob]);

  const onNodesChange = useCallback((changes) => {
    updateActiveJob((j) => ({
      ...j,
      nodes: applyNodeChanges(changes, j.nodes),
    }));
  }, [updateActiveJob]);

  const onEdgesChange = useCallback((changes) => {
    updateActiveJob((j) => ({
      ...j,
      edges: applyEdgeChanges(changes, j.edges),
    }));
  }, [updateActiveJob]);

  const addComponentToCanvas = useCallback(
    (componentType, position) => {
      const def = registry[componentType];
      if (!def) return;

      const id = `${componentType}_${uuidv4().slice(0, 8)}`;
      const newNode = {
        id,
        type: 'talendComponent',
        position,
        selected: true,
        data: {
          componentType,
          label: def.label,
          icon: def.icon,
          category: def.category,
          connectors: def.connectors,
        },
      };

      updateActiveJob((j) => ({
        ...j,
        nodes: [...j.nodes.map((n) => ({ ...n, selected: false })), newNode],
        nodeProperties: { ...j.nodeProperties, [id]: buildDefaults(componentType) },
        selectedNodeId: id,
      }));
    },
    [updateActiveJob]
  );

  const onConnect = useCallback(
    (connection) => {
      const edge = {
        ...connection,
        id: `e_${uuidv4().slice(0, 8)}`,
        type: 'smoothstep',
        animated: false,
        style: { stroke: '#4a90d9', strokeWidth: 2 },
        markerEnd: { type: 'arrowclosed', color: '#4a90d9' },
      };
      updateActiveJob((j) => ({
        ...j,
        edges: addEdge(edge, j.edges),
      }));
    },
    [updateActiveJob]
  );

  // ── Manual edge creation (used by canvas right-click connector menu) ─────
  const addEdgeManual = useCallback((sourceNodeId, targetNodeId, connectorName, connectorType, connectorLabel, category) => {
    if (sourceNodeId === targetNodeId) return;

    const EDGE_STYLES = {
      row: { stroke: '#4a90d9', strokeWidth: 2 },
      iterate: { stroke: '#1abc9c', strokeWidth: 2, strokeDasharray: '6 3' },
      trigger: { stroke: '#e74c3c', strokeWidth: 2, strokeDasharray: '5 5' },
    };
    const EDGE_COLORS = { row: '#4a90d9', iterate: '#1abc9c', trigger: '#e74c3c' };

    const cat = category;
    const sourceHandle = cat === 'trigger' ? 'trigger-out' : `out-${connectorName}`;
    const targetHandle = cat === 'trigger' ? 'trigger-in' : 'in-main';
    const edgeStyle = EDGE_STYLES[cat] || EDGE_STYLES.row;
    const edgeColor = EDGE_COLORS[cat] || '#4a90d9';

    const edge = {
      id: `e_${uuidv4().slice(0, 8)}`,
      source: sourceNodeId,
      target: targetNodeId,
      sourceHandle,
      targetHandle,
      type: 'smoothstep',
      animated: cat === 'trigger' || cat === 'iterate',
      style: edgeStyle,
      markerEnd: { type: 'arrowclosed', color: edgeColor },
      label: connectorLabel,
      labelStyle: { fontSize: 10, fontWeight: 600, fill: edgeColor },
      labelBgStyle: { fill: 'var(--bg-secondary)', fillOpacity: 0.9 },
      data: { connectorName, connectorType, category: cat },
    };

    updateActiveJob((j) => ({
      ...j,
      edges: addEdge(edge, j.edges),
    }));
  }, [updateActiveJob]);

  const updateNodeProperty = useCallback((nodeId, key, value) => {
    setNodeProperties((prev) => ({
      ...prev,
      [nodeId]: {
        ...(prev[nodeId] || {}),
        [key]: value,
      },
    }));
  }, [setNodeProperties]);

  const deleteSelectedNode = useCallback(() => {
    if (!selectedNodeId) return;
    updateActiveJob((j) => {
      const newProps = { ...j.nodeProperties };
      delete newProps[j.selectedNodeId];
      return {
        ...j,
        nodes: j.nodes.filter((n) => n.id !== j.selectedNodeId),
        edges: j.edges.filter((e) => e.source !== j.selectedNodeId && e.target !== j.selectedNodeId),
        nodeProperties: newProps,
        selectedNodeId: null,
      };
    });
  }, [updateActiveJob, selectedNodeId]);

  const onNodeClick = useCallback((_event, node) => {
    setSelectedNodeId(node.id);
  }, [setSelectedNodeId]);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, [setSelectedNodeId]);

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      const componentType = event.dataTransfer.getData(
        'application/talend-component'
      );
      if (!componentType || !reactFlowInstance) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      addComponentToCanvas(componentType, position);
    },
    [reactFlowInstance, addComponentToCanvas]
  );

  // ── Metadata ───────────────────────────────────────
  const updateJobMetadata = useCallback((key, value) => {
    updateActiveJob((j) => ({
      ...j,
      metadata: {
        ...j.metadata,
        [key]: value,
        modified: new Date().toISOString().slice(0, 10),
      },
    }));
  }, [updateActiveJob]);

  const setJobName = useCallback((name) => {
    updateJobMetadata('name', name);
  }, [updateJobMetadata]);

  // ── Cross-job copy ─────────────────────────────────
  const copyNodeToClipboard = useCallback((nodeId) => {
    const job = jobs.find((j) => j.id === activeJobId);
    if (!job) return;
    const node = job.nodes.find((n) => n.id === nodeId);
    const props = job.nodeProperties[nodeId];
    if (!node) return;
    setClipboard({ type: 'node', node: JSON.parse(JSON.stringify(node)), props: JSON.parse(JSON.stringify(props || {})) });
  }, [jobs, activeJobId]);

  const copySubjobToClipboard = useCallback((nodeIds) => {
    const job = jobs.find((j) => j.id === activeJobId);
    if (!job) return;
    const subjobNodes = job.nodes.filter((n) => nodeIds.includes(n.id));
    const subjobEdges = job.edges.filter((e) => nodeIds.includes(e.source) && nodeIds.includes(e.target));
    const subjobProps = {};
    for (const id of nodeIds) {
      if (job.nodeProperties[id]) {
        subjobProps[id] = JSON.parse(JSON.stringify(job.nodeProperties[id]));
      }
    }
    setClipboard({
      type: 'subjob',
      nodes: JSON.parse(JSON.stringify(subjobNodes)),
      edges: JSON.parse(JSON.stringify(subjobEdges)),
      nodeProperties: subjobProps,
    });
  }, [jobs, activeJobId]);

  const pasteFromClipboard = useCallback((targetJobId) => {
    if (!clipboard) return;

    if (clipboard.type === 'subjob') {
      const idMap = {};
      const newNodes = clipboard.nodes.map((node) => {
        const newId = `${node.data.componentType}_${uuidv4().slice(0, 8)}`;
        idMap[node.id] = newId;
        return {
          ...node,
          id: newId,
          position: { x: node.position.x + 60, y: node.position.y + 60 },
          selected: false,
        };
      });
      const newEdges = clipboard.edges.map((edge) => ({
        ...edge,
        id: `e_${uuidv4().slice(0, 8)}`,
        source: idMap[edge.source],
        target: idMap[edge.target],
      }));
      const newProps = {};
      for (const [oldId, props] of Object.entries(clipboard.nodeProperties)) {
        if (idMap[oldId]) {
          newProps[idMap[oldId]] = { ...props };
        }
      }
      setJobs((prev) =>
        prev.map((j) =>
          j.id === targetJobId
            ? {
                ...j,
                nodes: [...j.nodes, ...newNodes],
                edges: [...j.edges, ...newEdges],
                nodeProperties: { ...j.nodeProperties, ...newProps },
              }
            : j
        )
      );
    } else {
      const { node, props } = clipboard;
      const newId = `${node.data.componentType}_${uuidv4().slice(0, 8)}`;
      const newNode = {
        ...node,
        id: newId,
        position: { x: node.position.x + 40, y: node.position.y + 40 },
        selected: false,
      };
      setJobs((prev) =>
        prev.map((j) =>
          j.id === targetJobId
            ? {
                ...j,
                nodes: [...j.nodes, newNode],
                nodeProperties: { ...j.nodeProperties, [newId]: { ...props } },
                selectedNodeId: newId,
              }
            : j
        )
      );
    }
  }, [clipboard]);

  const value = {
    // Registry
    registry,
    // Theme
    theme,
    toggleTheme,
    // Left sidebar tab
    leftTab,
    setLeftTab,
    // Multi-job
    jobs,
    activeJobId,
    setActiveJobId,
    createJob,
    closeJob,
    renameJob,
    duplicateJob,
    // Nodes & edges (active job)
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    // Selection
    selectedNodeId,
    selectedNode,
    setSelectedNodeId,
    onNodeClick,
    onPaneClick,
    // Properties
    nodeProperties,
    updateNodeProperty,
    // Actions
    addComponentToCanvas,
    deleteSelectedNode,
    // Job
    jobName,
    setJobName,
    // Job metadata
    jobMetadata,
    updateJobMetadata,
    // Cross-job copy
    clipboard,
    copyNodeToClipboard,
    copySubjobToClipboard,
    pasteFromClipboard,
    // Connector linking (Talend-style)
    addEdgeManual,
    // Metadata repository (Talend-style)
    metadataRepo,
    createMetadataItem,
    updateMetadataItem,
    deleteMetadataItem,
    duplicateMetadataItem,
    // Context variables
    contextVariables,
    addContextVariable,
    updateContextVariable,
    removeContextVariable,
    // Job actions
    saveJob,
    runJob,
    pauseJob,
    stopJob,
    runningJobId,
    // ReactFlow setup
    reactFlowWrapper,
    reactFlowInstance,
    setReactFlowInstance,
    onDragOver,
    onDrop,
  };

  return (
    <DesignerContext.Provider value={value}>
      {children}
    </DesignerContext.Provider>
  );
}
