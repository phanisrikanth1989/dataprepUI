import { useState, useMemo, useCallback, useEffect } from 'react';
import { X, Settings, Info, Link, Database, Pencil, Shuffle } from 'lucide-react';
import { useDesigner } from '../context/DesignerContext';
import PropertyRenderer from './PropertyRenderer';
import SchemaDialog from './SchemaDialog';
import MapEditorDialog from './MapEditorDialog';

export default function PropertiesPanel() {
  const {
    registry,
    selectedNode,
    selectedNodeId,
    nodeProperties,
    updateNodeProperty,
    setSelectedNodeId,
    edges,
    nodes,
    metadataRepo,
  } = useDesigner();

  const [activeTab, setActiveTab] = useState('basic');
  const [schemaOpen, setSchemaOpen] = useState(false);
  const [mapEditorOpen, setMapEditorOpen] = useState(false);

  const componentDef = useMemo(() => {
    if (!selectedNode) return null;
    return registry[selectedNode.data.componentType] || null;
  }, [selectedNode, registry]);

  const isMapComponent = selectedNode?.data.componentType === 'tMap' || selectedNode?.data.componentType === 'tXmlMap';

  const propertyValues = selectedNodeId ? nodeProperties[selectedNodeId] || {} : {};

  // Determine if component has inputs (intermediate/target) or is source-only
  const connectors = selectedNode?.data.connectors || {};
  const hasInputs = (connectors.inputs || []).length > 0;
  const hasOutputs = (connectors.outputs || []).length > 0;

  // Get input schema from upstream connected nodes (via row/iterate edges)
  const inputSchema = useMemo(() => {
    if (!selectedNodeId || !hasInputs) return [];
    const incomingEdges = edges.filter(
      (e) => e.target === selectedNodeId && e.data?.category !== 'trigger'
    );
    if (incomingEdges.length === 0) return [];
    // Collect schema from all upstream sources
    const combined = [];
    for (const edge of incomingEdges) {
      const sourceProps = nodeProperties[edge.source];
      if (sourceProps?.__schema && Array.isArray(sourceProps.__schema)) {
        combined.push(...sourceProps.__schema);
      }
    }
    return combined;
  }, [selectedNodeId, hasInputs, edges, nodeProperties]);

  // Build per-connection input tables for map editor (main + lookups)
  const inputTables = useMemo(() => {
    if (!selectedNodeId || !isMapComponent) return [];
    const incomingEdges = edges.filter(
      (e) => e.target === selectedNodeId && e.data?.category !== 'trigger'
    );
    return incomingEdges.map((edge) => {
      const sourceNode = nodes.find((n) => n.id === edge.source);
      const sourceProps = nodeProperties[edge.source];
      const schema = sourceProps?.__schema || [];
      const label = edge.label || sourceNode?.data?.label || edge.source;
      const isLookup = edge.targetHandle && edge.targetHandle !== 'in-main';
      return { name: label, schema, type: isLookup ? 'lookup' : 'main' };
    });
  }, [selectedNodeId, isMapComponent, edges, nodes, nodeProperties]);

  const handleMapConfigChange = useCallback(
    (val) => updateNodeProperty(selectedNodeId, '__mapConfig', val),
    [selectedNodeId, updateNodeProperty]
  );

  const handleSchemaChange = useCallback(
    (val) => updateNodeProperty(selectedNodeId, '__schema', val),
    [selectedNodeId, updateNodeProperty]
  );

  if (!selectedNode || !componentDef) {
    return (
      <div className="properties-panel properties-panel--empty">
        <div className="panel-empty-state">
          <Settings size={32} className="empty-icon" />
          <p>Select a component to view its properties</p>
        </div>
      </div>
    );
  }

  const groups = componentDef.groups || [{ id: 'basic', label: 'Basic Settings' }];

  // Filter properties by active tab and visibility
  const visibleProperties = (componentDef.properties || []).filter((prop) => {
    if (prop.group !== activeTab) return false;
    if (prop.visibleWhen) {
      const depValue = propertyValues[prop.visibleWhen.key];
      if (depValue !== prop.visibleWhen.eq) return false;
    }
    return true;
  });

  const inputs = connectors.inputs || [];
  const outputs = connectors.outputs || [];
  const triggerIn = connectors.triggers?.incoming || [];
  const triggerOut = connectors.triggers?.outgoing || [];

  const schemaColumns = propertyValues.__schema || [];
  const schemaCount = schemaColumns.length;

  // Auto-populate trim_select table from schema columns
  useEffect(() => {
    if (!selectedNodeId || !componentDef) return;
    const trimSelectProp = (componentDef.properties || []).find(
      (p) => p.key === 'trim_select' && p.type === 'table'
    );
    if (!trimSelectProp || schemaColumns.length === 0) return;

    const schemaNames = schemaColumns.map((col) => col.name);
    const currentRows = Array.isArray(propertyValues.trim_select)
      ? propertyValues.trim_select
      : [];

    // Build a map of existing trim selections by column name
    const existingMap = {};
    for (const row of currentRows) {
      if (row.column) existingMap[row.column] = !!row.trim;
    }

    // Check if rows already match schema
    const currentNames = currentRows.map((r) => r.column);
    const alreadySynced =
      schemaNames.length === currentNames.length &&
      schemaNames.every((name, i) => name === currentNames[i]);
    if (alreadySynced) return;

    // Build new rows from schema, preserving existing trim selections
    const newRows = schemaNames.map((name) => ({
      column: name,
      trim: existingMap[name] ?? false,
    }));
    updateNodeProperty(selectedNodeId, 'trim_select', newRows);
  }, [selectedNodeId, componentDef, schemaColumns, propertyValues.trim_select, updateNodeProperty]);

  return (
    <div className="properties-panel">
      {/* Header */}
      <div className="panel-header">
        <div className="panel-header__title">
          <Settings size={16} />
          <span>{componentDef.label}</span>
        </div>
        <button
          className="panel-close"
          onClick={() => setSelectedNodeId(null)}
          title="Close"
        >
          <X size={16} />
        </button>
      </div>

      {/* Node ID */}
      <div className="panel-node-id">
        <span className="node-id-label">ID:</span>
        <code>{selectedNodeId}</code>
      </div>

      {/* Tabs */}
      <div className="panel-tabs">
        {groups.map((group) => (
          <button
            key={group.id}
            className={`panel-tab ${activeTab === group.id ? 'panel-tab--active' : ''}`}
            onClick={() => setActiveTab(group.id)}
          >
            {group.label}
          </button>
        ))}
        <button
          className={`panel-tab ${activeTab === 'connectors' ? 'panel-tab--active' : ''}`}
          onClick={() => setActiveTab('connectors')}
        >
          <Link size={12} /> Connectors
        </button>
      </div>

      {/* Content */}
      {activeTab === 'connectors' ? (
        /* Connectors tab */
        <div className="panel-body">
          <div className="connectors-section">
            <h4>Inputs ({inputs.length})</h4>
            {inputs.length > 0 ? (
              <ul className="connector-list">
                {inputs.map((inp) => (
                  <li key={inp.name}>
                    <span className="connector-badge connector-badge--input">
                      {inp.type}
                    </span>
                    {inp.label}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="connector-none">No inputs (source component)</p>
            )}
          </div>

          <div className="connectors-section">
            <h4>Outputs ({outputs.length})</h4>
            {outputs.length > 0 ? (
              <ul className="connector-list">
                {outputs.map((out) => (
                  <li key={out.name}>
                    <span
                      className={`connector-badge connector-badge--${out.type}`}
                    >
                      {out.type}
                    </span>
                    {out.label}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="connector-none">No outputs</p>
            )}
          </div>

          <div className="connectors-section">
            <h4>Triggers</h4>
            <div className="trigger-group">
              <strong>Incoming:</strong>
              {triggerIn.length > 0 ? (
                <div className="trigger-tags">
                  {triggerIn.map((t) => (
                    <span key={t} className="trigger-tag">{t}</span>
                  ))}
                </div>
              ) : (
                <span className="connector-none">None</span>
              )}
            </div>
            <div className="trigger-group">
              <strong>Outgoing:</strong>
              {triggerOut.length > 0 ? (
                <div className="trigger-tags">
                  {triggerOut.map((t) => (
                    <span key={t} className="trigger-tag">{t}</span>
                  ))}
                </div>
              ) : (
                <span className="connector-none">None</span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="panel-body">
          {/* Schema row - Talend style, shown at top of basic tab */}
          {activeTab === 'basic' && (
            <div className="prop-field schema-prop-row">
              <label className="prop-label">
                <Database size={12} /> Schema
              </label>
              <div className="schema-prop-row__controls">
                <select className="prop-select schema-prop-row__type" disabled>
                  <option>Built-In</option>
                </select>
                <button
                  className="schema-prop-row__edit"
                  onClick={() => setSchemaOpen(true)}
                  title="Edit Schema"
                >
                  <Pencil size={12} />
                  Edit Schema
                  {schemaCount > 0 && (
                    <span className="schema-prop-row__badge">{schemaCount}</span>
                  )}
                </button>
              </div>
            </div>
          )}
          {/* Map Editor button for tMap / tXmlMap */}
          {activeTab === 'basic' && isMapComponent && (
            <div className="prop-field map-editor-row">
              <button
                className="map-editor-row__btn map-editor-row__btn--icon"
                onClick={() => setMapEditorOpen(true)}
                title="Open Map Editor"
              >
                <Shuffle size={16} />
              </button>
            </div>
          )}
          {visibleProperties.length > 0 ? (
            visibleProperties.map((prop) => (
              <PropertyRenderer
                key={prop.key}
                property={prop}
                value={propertyValues[prop.key]}
                onChange={(val) =>
                  updateNodeProperty(selectedNodeId, prop.key, val)
                }
                schemaLinked={prop.key === 'trim_select' && schemaCount > 0}
              />
            ))
          ) : (
            activeTab !== 'basic' && (
              <div className="panel-body__empty">
                <Info size={16} />
                <span>No properties in this group</span>
              </div>
            )
          )}
        </div>
      )}

      {/* Schema Dialog */}
      {schemaOpen && (
        <SchemaDialog
          componentLabel={componentDef.label}
          hasInputs={hasInputs}
          inputSchema={inputSchema}
          outputSchema={schemaColumns}
          onOutputChange={handleSchemaChange}
          onClose={() => setSchemaOpen(false)}
          metadataRepo={metadataRepo}
        />
      )}

      {/* Map Editor Dialog */}
      {mapEditorOpen && isMapComponent && (
        <MapEditorDialog
          componentLabel={componentDef.label}
          nodeId={selectedNodeId}
          inputTables={inputTables}
          outputSchema={schemaColumns}
          mapConfig={propertyValues.__mapConfig}
          onMapConfigChange={handleMapConfigChange}
          onClose={() => setMapEditorOpen(false)}
        />
      )}
    </div>
  );
}
