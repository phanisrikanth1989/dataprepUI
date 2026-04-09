import { useState, useMemo } from 'react';
import { X, Settings, Info, Link } from 'lucide-react';
import { useDesigner } from '../context/DesignerContext';
import PropertyRenderer from './PropertyRenderer';

export default function PropertiesPanel() {
  const {
    registry,
    selectedNode,
    selectedNodeId,
    nodeProperties,
    updateNodeProperty,
    setSelectedNodeId,
  } = useDesigner();

  const [activeTab, setActiveTab] = useState('basic');

  const componentDef = useMemo(() => {
    if (!selectedNode) return null;
    return registry[selectedNode.data.componentType] || null;
  }, [selectedNode, registry]);

  const propertyValues = selectedNodeId ? nodeProperties[selectedNodeId] || {} : {};

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
    // Group filter
    if (prop.group !== activeTab) return false;
    // Conditional visibility
    if (prop.visibleWhen) {
      const depValue = propertyValues[prop.visibleWhen.key];
      if (depValue !== prop.visibleWhen.eq) return false;
    }
    return true;
  });

  // Connectors summary
  const connectors = selectedNode.data.connectors || {};
  const inputs = connectors.inputs || [];
  const outputs = connectors.outputs || [];
  const triggerIn = connectors.triggers?.incoming || [];
  const triggerOut = connectors.triggers?.outgoing || [];

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

      {/* Properties form */}
      {activeTab !== 'connectors' ? (
        <div className="panel-body">
          {visibleProperties.length > 0 ? (
            visibleProperties.map((prop) => (
              <PropertyRenderer
                key={prop.key}
                property={prop}
                value={propertyValues[prop.key]}
                onChange={(val) =>
                  updateNodeProperty(selectedNodeId, prop.key, val)
                }
              />
            ))
          ) : (
            <div className="panel-body__empty">
              <Info size={16} />
              <span>No properties in this group</span>
            </div>
          )}
        </div>
      ) : (
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
      )}
    </div>
  );
}
