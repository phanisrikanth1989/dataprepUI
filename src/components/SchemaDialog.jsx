import { useState, useCallback, useRef } from 'react';
import { X, Plus, Trash2, ArrowUp, ArrowDown, Copy, ChevronsRight, Download, Upload, Database } from 'lucide-react';

const SCHEMA_TYPES = [
  { value: 'String', label: 'String' },
  { value: 'Integer', label: 'Integer' },
  { value: 'Long', label: 'Long' },
  { value: 'Float', label: 'Float' },
  { value: 'Double', label: 'Double' },
  { value: 'Boolean', label: 'Boolean' },
  { value: 'Date', label: 'Date' },
  { value: 'byte[]', label: 'byte[]' },
  { value: 'BigDecimal', label: 'BigDecimal' },
  { value: 'Character', label: 'Character' },
  { value: 'Short', label: 'Short' },
  { value: 'Object', label: 'Object' },
];

function newColumn(index) {
  return {
    name: `column${index}`,
    type: 'String',
    length: null,
    precision: null,
    nullable: true,
    key: false,
    defaultValue: '',
    comment: '',
  };
}

function SchemaTable({ columns, onChange, readOnly, title }) {
  const addColumn = () => onChange([...columns, newColumn(columns.length)]);

  const removeColumn = (index) => onChange(columns.filter((_, i) => i !== index));

  const duplicateColumn = (index) => {
    const copy = { ...columns[index], name: columns[index].name + '_copy' };
    const updated = [...columns];
    updated.splice(index + 1, 0, copy);
    onChange(updated);
  };

  const moveColumn = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= columns.length) return;
    const updated = [...columns];
    [updated[index], updated[target]] = [updated[target], updated[index]];
    onChange(updated);
  };

  const updateColumn = (index, field, value) => {
    onChange(columns.map((col, i) => (i === index ? { ...col, [field]: value } : col)));
  };

  return (
    <div className="schema-dialog__panel">
      <div className="schema-dialog__panel-header">
        <span className="schema-dialog__panel-title">{title}</span>
        <span className="schema-dialog__panel-count">
          {columns.length} column{columns.length !== 1 ? 's' : ''}
        </span>
        {!readOnly && (
          <button className="schema-dialog__add-btn" onClick={addColumn}>
            <Plus size={12} /> Add
          </button>
        )}
      </div>
      <div className="schema-dialog__table-wrap">
        <table className="schema-dialog__table">
          <thead>
            <tr>
              <th className="schema-th schema-th--name">Column</th>
              <th className="schema-th schema-th--type">Type</th>
              <th className="schema-th schema-th--len">Length</th>
              <th className="schema-th schema-th--prec">Precision</th>
              <th className="schema-th schema-th--null">Nullable</th>
              <th className="schema-th schema-th--key">Key</th>
              <th className="schema-th schema-th--default">Default</th>
              <th className="schema-th schema-th--comment">Comment</th>
              {!readOnly && <th className="schema-th schema-th--actions"></th>}
            </tr>
          </thead>
          <tbody>
            {columns.length === 0 ? (
              <tr>
                <td colSpan={readOnly ? 8 : 9} className="schema-dialog__empty-row">
                  {readOnly ? 'No input schema — connect an upstream component' : 'No columns defined. Click "Add" to start.'}
                </td>
              </tr>
            ) : (
              columns.map((col, idx) => (
                <tr key={idx} className="schema-dialog__row">
                  <td className="schema-td schema-td--name">
                    {readOnly ? (
                      <span className="schema-readonly">{col.name}</span>
                    ) : (
                      <input
                        type="text"
                        className="schema-input"
                        value={col.name}
                        onChange={(e) => updateColumn(idx, 'name', e.target.value)}
                        placeholder="column_name"
                      />
                    )}
                  </td>
                  <td className="schema-td schema-td--type">
                    {readOnly ? (
                      <span className="schema-readonly">{col.type}</span>
                    ) : (
                      <select
                        className="schema-select"
                        value={col.type}
                        onChange={(e) => updateColumn(idx, 'type', e.target.value)}
                      >
                        {SCHEMA_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="schema-td schema-td--len">
                    {readOnly ? (
                      <span className="schema-readonly schema-readonly--num">{col.length ?? '—'}</span>
                    ) : (
                      <input
                        type="number"
                        className="schema-input schema-input--num"
                        value={col.length ?? ''}
                        onChange={(e) => updateColumn(idx, 'length', e.target.value ? Number(e.target.value) : null)}
                        placeholder="—"
                      />
                    )}
                  </td>
                  <td className="schema-td schema-td--prec">
                    {readOnly ? (
                      <span className="schema-readonly schema-readonly--num">{col.precision ?? '—'}</span>
                    ) : (
                      <input
                        type="number"
                        className="schema-input schema-input--num"
                        value={col.precision ?? ''}
                        onChange={(e) => updateColumn(idx, 'precision', e.target.value ? Number(e.target.value) : null)}
                        placeholder="—"
                      />
                    )}
                  </td>
                  <td className="schema-td schema-td--null">
                    <input type="checkbox" checked={!!col.nullable} disabled={readOnly}
                      onChange={readOnly ? undefined : (e) => updateColumn(idx, 'nullable', e.target.checked)}
                    />
                  </td>
                  <td className="schema-td schema-td--key">
                    <input type="checkbox" checked={!!col.key} disabled={readOnly}
                      onChange={readOnly ? undefined : (e) => updateColumn(idx, 'key', e.target.checked)}
                    />
                  </td>
                  <td className="schema-td schema-td--default">
                    {readOnly ? (
                      <span className="schema-readonly">{col.defaultValue || '—'}</span>
                    ) : (
                      <input
                        type="text"
                        className="schema-input"
                        value={col.defaultValue ?? ''}
                        onChange={(e) => updateColumn(idx, 'defaultValue', e.target.value)}
                        placeholder="—"
                      />
                    )}
                  </td>
                  <td className="schema-td schema-td--comment">
                    {readOnly ? (
                      <span className="schema-readonly">{col.comment || '—'}</span>
                    ) : (
                      <input
                        type="text"
                        className="schema-input"
                        value={col.comment ?? ''}
                        onChange={(e) => updateColumn(idx, 'comment', e.target.value)}
                        placeholder="—"
                      />
                    )}
                  </td>
                  {!readOnly && (
                    <td className="schema-td schema-td--actions">
                      <button className="schema-btn" onClick={() => moveColumn(idx, -1)} title="Move up" disabled={idx === 0}>
                        <ArrowUp size={11} />
                      </button>
                      <button className="schema-btn" onClick={() => moveColumn(idx, 1)} title="Move down" disabled={idx === columns.length - 1}>
                        <ArrowDown size={11} />
                      </button>
                      <button className="schema-btn" onClick={() => duplicateColumn(idx)} title="Duplicate">
                        <Copy size={11} />
                      </button>
                      <button className="schema-btn schema-btn--danger" onClick={() => removeColumn(idx)} title="Remove">
                        <Trash2 size={11} />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SchemaDialog({
  componentLabel,
  hasInputs,
  inputSchema,
  outputSchema,
  onOutputChange,
  onClose,
  metadataRepo,
}) {
  const [localOutput, setLocalOutput] = useState(
    Array.isArray(outputSchema) ? outputSchema : []
  );
  const [metadataPickerOpen, setMetadataPickerOpen] = useState(false);
  const fileInputRef = useRef(null);

  const handleSave = useCallback(() => {
    onOutputChange(localOutput);
    onClose();
  }, [localOutput, onOutputChange, onClose]);

  // Copy input schema to output (sync)
  const syncFromInput = useCallback(() => {
    if (inputSchema.length > 0) {
      setLocalOutput(inputSchema.map((col) => ({ ...col })));
    }
  }, [inputSchema]);

  // Metadata items that have columns (Generic Schemas + any with columns)
  const metadataWithSchema = (metadataRepo || []).filter(
    (m) => Array.isArray(m.columns) && m.columns.length > 0
  );

  // Import from metadata
  const importFromMetadata = useCallback((item) => {
    const cols = item.columns.map((c) => ({
      name: c.name || '',
      type: c.type || 'String',
      length: c.length != null && c.length !== '' ? Number(c.length) : null,
      precision: c.precision != null && c.precision !== '' ? Number(c.precision) : null,
      nullable: c.nullable !== false,
      key: !!c.key,
      defaultValue: c.defaultValue || '',
      comment: c.comment || '',
    }));
    setLocalOutput(cols);
    setMetadataPickerOpen(false);
  }, []);

  // Export schema to JSON file
  const exportSchema = useCallback(() => {
    if (localOutput.length === 0) return;
    const json = JSON.stringify(localOutput, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `schema_${componentLabel.replace(/\s+/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [localOutput, componentLabel]);

  // Import schema from JSON file
  const importSchemaFromFile = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target.result);
        if (Array.isArray(parsed)) {
          const cols = parsed.map((c) => ({
            name: c.name || '',
            type: c.type || 'String',
            length: c.length != null && c.length !== '' ? Number(c.length) : null,
            precision: c.precision != null && c.precision !== '' ? Number(c.precision) : null,
            nullable: c.nullable !== false,
            key: !!c.key,
            defaultValue: c.defaultValue || '',
            comment: c.comment || '',
          }));
          setLocalOutput(cols);
        }
      } catch { /* ignore invalid JSON */ }
    };
    reader.readAsText(file);
    // Reset so same file can be re-imported
    e.target.value = '';
  }, []);

  return (
    <div className="schema-dialog__overlay" onClick={onClose}>
      <div className="schema-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="schema-dialog__header">
          <h3 className="schema-dialog__title">
            Schema — {componentLabel}
          </h3>
          <div className="schema-dialog__header-actions">
            {/* Import from Metadata Repository */}
            <div className="schema-dialog__dropdown-wrap">
              <button
                className="schema-dialog__action-btn"
                onClick={() => setMetadataPickerOpen(!metadataPickerOpen)}
                title="Import schema from Metadata Repository"
              >
                <Database size={13} />
                Repository
              </button>
              {metadataPickerOpen && (
                <div className="schema-dialog__dropdown">
                  <div className="schema-dialog__dropdown-title">Import from Metadata</div>
                  {metadataWithSchema.length === 0 ? (
                    <div className="schema-dialog__dropdown-empty">
                      No metadata with schema found.
                      <br />Create a Generic Schema in the Metadata panel first.
                    </div>
                  ) : (
                    metadataWithSchema.map((m) => (
                      <button
                        key={m.id}
                        className="schema-dialog__dropdown-item"
                        onClick={() => importFromMetadata(m)}
                      >
                        <Database size={11} />
                        <span className="schema-dialog__dropdown-name">{m.name}</span>
                        <span className="schema-dialog__dropdown-meta">
                          {m.category} · {m.columns.length} col{m.columns.length !== 1 ? 's' : ''}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            {/* Import from File */}
            <button
              className="schema-dialog__action-btn"
              onClick={() => fileInputRef.current?.click()}
              title="Import schema from JSON file"
            >
              <Upload size={13} />
              Import
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={importSchemaFromFile}
            />
            {/* Export to File */}
            <button
              className="schema-dialog__action-btn"
              onClick={exportSchema}
              disabled={localOutput.length === 0}
              title="Export schema as JSON file"
            >
              <Download size={13} />
              Export
            </button>
          </div>
          <button className="schema-dialog__close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className={`schema-dialog__body ${hasInputs ? 'schema-dialog__body--dual' : ''}`}>
          {hasInputs && (
            <>
              <SchemaTable
                columns={inputSchema}
                onChange={() => {}}
                readOnly
                title="Input Schema"
              />
              <div className="schema-dialog__sync">
                <button
                  className="schema-dialog__sync-btn"
                  onClick={syncFromInput}
                  title="Copy input schema to output"
                  disabled={inputSchema.length === 0}
                >
                  <ChevronsRight size={16} />
                </button>
              </div>
            </>
          )}
          <SchemaTable
            columns={localOutput}
            onChange={setLocalOutput}
            readOnly={false}
            title={hasInputs ? 'Output Schema' : 'Schema'}
          />
        </div>

        {/* Footer */}
        <div className="schema-dialog__footer">
          <button className="schema-dialog__btn schema-dialog__btn--cancel" onClick={onClose}>
            Cancel
          </button>
          <button className="schema-dialog__btn schema-dialog__btn--save" onClick={handleSave}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
