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

  // ── Undo / Redo history (per-job snapshots of nodes, edges, nodeProperties) ──
  const undoStackRef = useRef({});   // { [jobId]: [ ...snapshots ] }
  const redoStackRef = useRef({});   // { [jobId]: [ ...snapshots ] }
  const skipSnapshotRef = useRef(false);
  const MAX_HISTORY = 50;

  const takeSnapshot = useCallback(() => {
    if (skipSnapshotRef.current) return;
    const job = jobs.find((j) => j.id === activeJobId);
    if (!job) return;
    const snap = JSON.parse(JSON.stringify({ nodes: job.nodes, edges: job.edges, nodeProperties: job.nodeProperties }));
    if (!undoStackRef.current[activeJobId]) undoStackRef.current[activeJobId] = [];
    undoStackRef.current[activeJobId].push(snap);
    if (undoStackRef.current[activeJobId].length > MAX_HISTORY) undoStackRef.current[activeJobId].shift();
    // clear redo when a new action happens
    redoStackRef.current[activeJobId] = [];
  }, [jobs, activeJobId]);

  // undo/redo are defined after updateActiveJob below

  const canUndo = (undoStackRef.current[activeJobId]?.length || 0) > 0;
  const canRedo = (redoStackRef.current[activeJobId]?.length || 0) > 0;

  // ── Row counter for auto-naming row edges ──
  const rowCounterRef = useRef({});  // { [jobId]: number }

  const getNextRowLabel = useCallback(() => {
    if (!rowCounterRef.current[activeJobId]) {
      // initialize from existing edges
      const job = jobs.find((j) => j.id === activeJobId);
      let max = 0;
      if (job) {
        for (const e of job.edges) {
          const m = e.label && typeof e.label === 'string' && e.label.match(/^row(\d+)$/);
          if (m) max = Math.max(max, parseInt(m[1], 10));
        }
      }
      rowCounterRef.current[activeJobId] = max;
    }
    rowCounterRef.current[activeJobId] += 1;
    return `row${rowCounterRef.current[activeJobId]}`;
  }, [jobs, activeJobId]);

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

  const undo = useCallback(() => {
    const stack = undoStackRef.current[activeJobId];
    if (!stack || stack.length === 0) return;
    const job = jobs.find((j) => j.id === activeJobId);
    if (!job) return;
    if (!redoStackRef.current[activeJobId]) redoStackRef.current[activeJobId] = [];
    redoStackRef.current[activeJobId].push(JSON.parse(JSON.stringify({ nodes: job.nodes, edges: job.edges, nodeProperties: job.nodeProperties })));
    const snap = stack.pop();
    skipSnapshotRef.current = true;
    updateActiveJob((j) => ({ ...j, ...snap }));
    skipSnapshotRef.current = false;
  }, [jobs, activeJobId, updateActiveJob]);

  const redo = useCallback(() => {
    const stack = redoStackRef.current[activeJobId];
    if (!stack || stack.length === 0) return;
    const job = jobs.find((j) => j.id === activeJobId);
    if (!job) return;
    if (!undoStackRef.current[activeJobId]) undoStackRef.current[activeJobId] = [];
    undoStackRef.current[activeJobId].push(JSON.parse(JSON.stringify({ nodes: job.nodes, edges: job.edges, nodeProperties: job.nodeProperties })));
    const snap = stack.pop();
    skipSnapshotRef.current = true;
    updateActiveJob((j) => ({ ...j, ...snap }));
    skipSnapshotRef.current = false;
  }, [jobs, activeJobId, updateActiveJob]);

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

  // ── Export Job as JSON download (Talend-style template) ──
  const exportJobAsJson = useCallback(() => {
    const job = jobs.find((j) => j.id === activeJobId);
    if (!job) return;

    const { nodes: jNodes, edges: jEdges, nodeProperties: jProps, metadata, contextVariables: ctxVars } = job;
    const jobName = metadata?.name || 'Untitled_Job';
    const jobVersion = metadata?.version || '0.1';

    // ── Build stable IDs: tFileInputDelimited_1, tLogRow_2, etc.
    const typeCounters = {};
    const idMap = {};
    for (const node of jNodes) {
      const cType = node.data.componentType;
      typeCounters[cType] = (typeCounters[cType] || 0) + 1;
      idMap[node.id] = `${cType}_${typeCounters[cType]}`;
    }

    // ── Compute input schema per node from upstream row/iterate edges
    const nodeInputSchema = {};
    for (const edge of jEdges) {
      if (edge.data?.category === 'trigger') continue;
      const srcSchema = jProps[edge.source]?.__schema;
      if (Array.isArray(srcSchema) && srcSchema.length > 0) {
        if (!nodeInputSchema[edge.target]) nodeInputSchema[edge.target] = [];
        nodeInputSchema[edge.target].push(...srcSchema);
      }
    }

    // ── Format schema columns to template style
    const fmtCols = (cols) =>
      (cols || []).map((c) => {
        const col = { name: c.name, type: c.type || 'String', nullable: c.nullable !== false, key: !!c.key };
        if (c.length != null && c.length !== '') col.length = Number(c.length);
        if (c.precision != null && c.precision !== '') col.precision = Number(c.precision);
        return col;
      });

    // ── Build components
    const components = jNodes.map((node) => {
      const cType = node.data.componentType;
      const stableId = idMap[node.id];
      const props = jProps[node.id] || {};

      // Config = all properties except __schema
      const config = {};
      for (const [k, v] of Object.entries(props)) {
        if (k === '__schema') continue;
        config[k] = v;
      }

      // Input/output connection labels
      const inputLabels = jEdges
        .filter((e) => e.target === node.id && e.data?.category !== 'trigger')
        .map((e) => e.label);
      const outputLabels = jEdges
        .filter((e) => e.source === node.id && e.data?.category !== 'trigger')
        .map((e) => e.label);

      return {
        id: stableId,
        type: cType.replace(/^t/, ''),
        original_type: cType,
        position: { x: Math.round(node.position.x), y: Math.round(node.position.y) },
        config,
        schema: {
          input: fmtCols(nodeInputSchema[node.id]),
          output: fmtCols(props.__schema),
        },
        inputs: inputLabels,
        outputs: outputLabels,
      };
    });

    // ── Build flows (row / iterate edges)
    const flows = jEdges
      .filter((e) => e.data?.category !== 'trigger')
      .map((e) => ({
        name: e.label,
        from: idMap[e.source] || e.source,
        to: idMap[e.target] || e.target,
        type: e.data?.category === 'iterate' ? 'iterate' : 'flow',
      }));

    // ── Build triggers
    const triggers = jEdges
      .filter((e) => e.data?.category === 'trigger')
      .map((e) => ({
        name: e.data?.connectorName || e.label,
        from: idMap[e.source] || e.source,
        to: idMap[e.target] || e.target,
        type: 'trigger',
      }));

    // ── Compute subjobs (union-find on non-trigger edges)
    const parent = {};
    const find = (x) => {
      if (parent[x] === undefined) parent[x] = x;
      if (parent[x] !== x) parent[x] = find(parent[x]);
      return parent[x];
    };
    const union = (a, b) => { parent[find(a)] = find(b); };
    for (const edge of jEdges) {
      if (edge.data?.category !== 'trigger') union(edge.source, edge.target);
    }
    const groups = {};
    for (const node of jNodes) {
      const root = find(node.id);
      if (!groups[root]) groups[root] = [];
      groups[root].push(idMap[node.id]);
    }
    const subjobs = {};
    let sjIdx = 0;
    for (const [, members] of Object.entries(groups)) {
      if (members.length >= 2) {
        sjIdx++;
        subjobs[`subjob_${sjIdx}`] = members;
      }
    }

    // ── Context variables
    const ctx = {};
    if (Array.isArray(ctxVars) && ctxVars.length > 0) {
      const vars = {};
      for (const v of ctxVars) vars[v.name] = v.value ?? '';
      ctx['Default'] = vars;
    } else {
      ctx['Default'] = {};
    }

    // ── Assemble final JSON
    const output = {
      job_name: `${jobName}_${jobVersion}`,
      job_type: 'Standard',
      default_context: 'Default',
      context: ctx,
      components,
      flows,
      triggers,
      subjobs,
    };

    const json = JSON.stringify(output, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${jobName}_${jobVersion}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [jobs, activeJobId]);

  // ── Import Job from JSON (reverse of export) ──
  const importJobFromJson = useCallback((jsonString) => {
    const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;

    // Parse job name and version from "JobName_0.1"
    const rawName = data.job_name || 'Imported_Job';
    const lastUnderscore = rawName.lastIndexOf('_');
    let jobNameParsed = rawName;
    let version = '0.1';
    if (lastUnderscore > 0) {
      const possibleVersion = rawName.slice(lastUnderscore + 1);
      if (/^\d+(\.\d+)?$/.test(possibleVersion)) {
        jobNameParsed = rawName.slice(0, lastUnderscore);
        version = possibleVersion;
      }
    }

    const now = new Date().toISOString().slice(0, 10);
    const newJobId = uuidv4().slice(0, 8);

    // Build ID mapping: template stable ID → new internal ID
    const idMap = {};
    const newNodes = [];
    const newProps = {};

    for (const comp of (data.components || [])) {
      const cType = comp.original_type || `t${comp.type}`;
      const internalId = `${cType}_${uuidv4().slice(0, 8)}`;
      idMap[comp.id] = internalId;

      const def = registry[cType];
      newNodes.push({
        id: internalId,
        type: 'talendComponent',
        position: comp.position || { x: 0, y: 0 },
        selected: false,
        data: {
          componentType: cType,
          label: def?.label || comp.type || cType,
          icon: def?.icon || '',
          category: def?.category || 'Custom',
          connectors: def?.connectors || [],
        },
      });

      // Config + schema → nodeProperties
      const props = { ...(comp.config || {}) };
      if (comp.schema?.output && comp.schema.output.length > 0) {
        props.__schema = comp.schema.output.map((c) => ({
          name: c.name,
          type: c.type || 'String',
          length: c.length != null ? String(c.length) : '',
          precision: c.precision != null ? String(c.precision) : '',
          nullable: c.nullable !== false,
          key: !!c.key,
          comment: c.comment || '',
        }));
      }
      newProps[internalId] = props;
    }

    // Edge style constants
    const EDGE_STYLES = {
      row: { stroke: '#4a90d9', strokeWidth: 2 },
      iterate: { stroke: '#1abc9c', strokeWidth: 2, strokeDasharray: '6 3' },
      trigger: { stroke: '#e74c3c', strokeWidth: 2, strokeDasharray: '5 5' },
    };
    const EDGE_COLORS = { row: '#4a90d9', iterate: '#1abc9c', trigger: '#e74c3c' };

    const newEdges = [];

    // Flow edges
    for (const flow of (data.flows || [])) {
      const cat = flow.type === 'iterate' ? 'iterate' : 'row';
      const sourceId = idMap[flow.from] || flow.from;
      const targetId = idMap[flow.to] || flow.to;
      const color = EDGE_COLORS[cat];
      newEdges.push({
        id: `e_${uuidv4().slice(0, 8)}`,
        source: sourceId,
        target: targetId,
        sourceHandle: `out-${flow.name}`,
        targetHandle: 'in-main',
        type: 'smoothstep',
        animated: cat === 'iterate',
        label: flow.name,
        labelStyle: { fontSize: 10, fontWeight: 600, fill: color },
        labelBgStyle: { fill: 'var(--bg-secondary)', fillOpacity: 0.9 },
        style: EDGE_STYLES[cat],
        markerEnd: { type: 'arrowclosed', color },
        data: { connectorName: flow.name, connectorType: cat, category: cat },
      });
    }

    // Trigger edges
    for (const trig of (data.triggers || [])) {
      const sourceId = idMap[trig.from] || trig.from;
      const targetId = idMap[trig.to] || trig.to;
      const color = EDGE_COLORS.trigger;
      newEdges.push({
        id: `e_${uuidv4().slice(0, 8)}`,
        source: sourceId,
        target: targetId,
        sourceHandle: 'trigger-out',
        targetHandle: 'trigger-in',
        type: 'smoothstep',
        animated: true,
        label: trig.name,
        labelStyle: { fontSize: 10, fontWeight: 600, fill: color },
        labelBgStyle: { fill: 'var(--bg-secondary)', fillOpacity: 0.9 },
        style: EDGE_STYLES.trigger,
        markerEnd: { type: 'arrowclosed', color },
        data: { connectorName: trig.name, connectorType: 'trigger', category: 'trigger' },
      });
    }

    // Context variables
    const ctxVars = [];
    const ctxGroup = data.context?.[data.default_context || 'Default'] || data.context?.Default || {};
    for (const [name, value] of Object.entries(ctxGroup)) {
      ctxVars.push({ name, type: 'String', value: String(value), comment: '' });
    }

    const newJob = {
      id: newJobId,
      nodes: newNodes,
      edges: newEdges,
      nodeProperties: newProps,
      selectedNodeId: null,
      metadata: {
        name: jobNameParsed,
        description: '',
        author: '',
        version,
        purpose: '',
        status: 'draft',
        created: now,
        modified: now,
        tags: [],
      },
      contextVariables: ctxVars,
    };

    setJobs((prev) => [...prev, newJob]);
    setActiveJobId(newJobId);
    return newJobId;
  }, []);

  // ── Get export JSON string (without downloading) ──
  const getExportJsonString = useCallback(() => {
    const job = jobs.find((j) => j.id === activeJobId);
    if (!job) return null;

    const { nodes: jNodes, edges: jEdges, nodeProperties: jProps, metadata, contextVariables: ctxVars } = job;
    const jName = metadata?.name || 'Untitled_Job';
    const jobVersion = metadata?.version || '0.1';

    const typeCounters = {};
    const idMap = {};
    for (const node of jNodes) {
      const cType = node.data.componentType;
      typeCounters[cType] = (typeCounters[cType] || 0) + 1;
      idMap[node.id] = `${cType}_${typeCounters[cType]}`;
    }

    const nodeInputSchema = {};
    for (const edge of jEdges) {
      if (edge.data?.category === 'trigger') continue;
      const srcSchema = jProps[edge.source]?.__schema;
      if (Array.isArray(srcSchema) && srcSchema.length > 0) {
        if (!nodeInputSchema[edge.target]) nodeInputSchema[edge.target] = [];
        nodeInputSchema[edge.target].push(...srcSchema);
      }
    }

    const fmtCols = (cols) =>
      (cols || []).map((c) => {
        const col = { name: c.name, type: c.type || 'String', nullable: c.nullable !== false, key: !!c.key };
        if (c.length != null && c.length !== '') col.length = Number(c.length);
        if (c.precision != null && c.precision !== '') col.precision = Number(c.precision);
        return col;
      });

    const components = jNodes.map((node) => {
      const cType = node.data.componentType;
      const stableId = idMap[node.id];
      const props = jProps[node.id] || {};
      const config = {};
      for (const [k, v] of Object.entries(props)) {
        if (k === '__schema') continue;
        config[k] = v;
      }
      const inputLabels = jEdges.filter((e) => e.target === node.id && e.data?.category !== 'trigger').map((e) => e.label);
      const outputLabels = jEdges.filter((e) => e.source === node.id && e.data?.category !== 'trigger').map((e) => e.label);
      return {
        id: stableId,
        type: cType.replace(/^t/, ''),
        original_type: cType,
        position: { x: Math.round(node.position.x), y: Math.round(node.position.y) },
        config,
        schema: { input: fmtCols(nodeInputSchema[node.id]), output: fmtCols(props.__schema) },
        inputs: inputLabels,
        outputs: outputLabels,
      };
    });

    const flows = jEdges.filter((e) => e.data?.category !== 'trigger').map((e) => ({
      name: e.label,
      from: idMap[e.source] || e.source,
      to: idMap[e.target] || e.target,
      type: e.data?.category === 'iterate' ? 'iterate' : 'flow',
    }));

    const triggers = jEdges.filter((e) => e.data?.category === 'trigger').map((e) => ({
      name: e.data?.connectorName || e.label,
      from: idMap[e.source] || e.source,
      to: idMap[e.target] || e.target,
      type: 'trigger',
    }));

    const parent = {};
    const find = (x) => { if (parent[x] === undefined) parent[x] = x; if (parent[x] !== x) parent[x] = find(parent[x]); return parent[x]; };
    const union = (a, b) => { parent[find(a)] = find(b); };
    for (const edge of jEdges) { if (edge.data?.category !== 'trigger') union(edge.source, edge.target); }
    const groups = {};
    for (const node of jNodes) { const root = find(node.id); if (!groups[root]) groups[root] = []; groups[root].push(idMap[node.id]); }
    const subjobs = {};
    let sjIdx = 0;
    for (const [, members] of Object.entries(groups)) { if (members.length >= 2) { sjIdx++; subjobs[`subjob_${sjIdx}`] = members; } }

    const ctx = {};
    if (Array.isArray(ctxVars) && ctxVars.length > 0) {
      const vars = {};
      for (const v of ctxVars) vars[v.name] = v.value ?? '';
      ctx['Default'] = vars;
    } else { ctx['Default'] = {}; }

    return JSON.stringify({
      job_name: `${jName}_${jobVersion}`,
      job_type: 'Standard',
      default_context: 'Default',
      context: ctx,
      components, flows, triggers, subjobs,
    }, null, 2);
  }, [jobs, activeJobId]);

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
    updateActiveJob((j) => {
      let updated = [...j.nodes];
      for (const change of changes) {
        if (change.type === 'position') {
          updated = updated.map((n) =>
            n.id === change.id
              ? { ...n, ...(change.position ? { position: change.position } : {}), dragging: change.dragging }
              : n
          );
        } else if (change.type === 'select') {
          updated = updated.map((n) =>
            n.id === change.id ? { ...n, selected: change.selected } : n
          );
        } else if (change.type === 'remove') {
          updated = updated.filter((n) => n.id !== change.id);
        } else if (change.type === 'dimensions' && change.dimensions) {
          updated = updated.map((n) =>
            n.id === change.id
              ? { ...n, width: change.dimensions.width, height: change.dimensions.height }
              : n
          );
        }
      }
      return { ...j, nodes: updated };
    });
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

      takeSnapshot();
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
    [updateActiveJob, takeSnapshot]
  );

  const onConnect = useCallback(
    (connection) => {
      takeSnapshot();
      const rowLabel = getNextRowLabel();
      const edge = {
        ...connection,
        id: `e_${uuidv4().slice(0, 8)}`,
        type: 'smoothstep',
        animated: false,
        label: rowLabel,
        labelStyle: { fontSize: 10, fontWeight: 600, fill: '#4a90d9' },
        labelBgStyle: { fill: 'var(--bg-secondary)', fillOpacity: 0.9 },
        style: { stroke: '#4a90d9', strokeWidth: 2 },
        markerEnd: { type: 'arrowclosed', color: '#4a90d9' },
        data: { connectorName: rowLabel, connectorType: 'row', category: 'row' },
      };
      updateActiveJob((j) => {
        const newEdges = addEdge(edge, j.edges);
        // Propagate schema from source to target if target has no schema
        let newProps = j.nodeProperties;
        const sourceSchema = newProps[connection.source]?.__schema;
        const targetSchema = newProps[connection.target]?.__schema;
        if (Array.isArray(sourceSchema) && sourceSchema.length > 0 && (!Array.isArray(targetSchema) || targetSchema.length === 0)) {
          newProps = {
            ...newProps,
            [connection.target]: {
              ...(newProps[connection.target] || {}),
              __schema: sourceSchema.map((col) => ({ ...col })),
            },
          };
        }
        return { ...j, edges: newEdges, nodeProperties: newProps };
      });
    },
    [updateActiveJob, takeSnapshot, getNextRowLabel]
  );

  // ── Manual edge creation (used by canvas right-click connector menu) ─────
  const addEdgeManual = useCallback((sourceNodeId, targetNodeId, connectorName, connectorType, connectorLabel, category) => {
    if (sourceNodeId === targetNodeId) return;

    takeSnapshot();
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

    // Auto-name row/iterate edges as row1, row2, etc.
    const edgeLabel = cat === 'trigger' ? connectorLabel : getNextRowLabel();

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
      label: edgeLabel,
      labelStyle: { fontSize: 10, fontWeight: 600, fill: edgeColor },
      labelBgStyle: { fill: 'var(--bg-secondary)', fillOpacity: 0.9 },
      data: { connectorName, connectorType, category: cat },
    };

    updateActiveJob((j) => {
      const newEdges = addEdge(edge, j.edges);
      // Propagate schema for row/iterate connections
      let newProps = j.nodeProperties;
      if (cat !== 'trigger') {
        const sourceSchema = newProps[sourceNodeId]?.__schema;
        const targetSchema = newProps[targetNodeId]?.__schema;
        if (Array.isArray(sourceSchema) && sourceSchema.length > 0 && (!Array.isArray(targetSchema) || targetSchema.length === 0)) {
          newProps = {
            ...newProps,
            [targetNodeId]: {
              ...(newProps[targetNodeId] || {}),
              __schema: sourceSchema.map((col) => ({ ...col })),
            },
          };
        }
      }
      return { ...j, edges: newEdges, nodeProperties: newProps };
    });
  }, [updateActiveJob, takeSnapshot, getNextRowLabel]);

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
    takeSnapshot();
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
  }, [updateActiveJob, selectedNodeId, takeSnapshot]);

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

    takeSnapshot();
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
      const newEdges = clipboard.edges.map((edge) => {
        const newSource = idMap[edge.source];
        const newTarget = idMap[edge.target];
        return {
          ...edge,
          id: `e_${uuidv4().slice(0, 8)}`,
          source: newSource,
          target: newTarget,
        };
      });
      const newProps = {};
      for (const [oldId, props] of Object.entries(clipboard.nodeProperties)) {
        if (idMap[oldId]) {
          newProps[idMap[oldId]] = JSON.parse(JSON.stringify(props));
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
                nodeProperties: { ...j.nodeProperties, [newId]: JSON.parse(JSON.stringify(props)) },
                selectedNodeId: newId,
              }
            : j
        )
      );
    }
  }, [clipboard, takeSnapshot]);

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
    exportJobAsJson,
    importJobFromJson,
    getExportJsonString,
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
    // Undo / Redo
    undo,
    redo,
    canUndo,
    canRedo,
  };

  return (
    <DesignerContext.Provider value={value}>
      {children}
    </DesignerContext.Provider>
  );
}
