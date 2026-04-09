import { Plus, Trash2, ArrowUp, ArrowDown, Copy } from 'lucide-react';

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

export default function SchemaEditor({ schema, onChange }) {
  const columns = Array.isArray(schema) ? schema : [];

  const addColumn = () => {
    onChange([...columns, newColumn(columns.length)]);
  };

  const removeColumn = (index) => {
    onChange(columns.filter((_, i) => i !== index));
  };

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
    onChange(
      columns.map((col, i) =>
        i === index ? { ...col, [field]: value } : col
      )
    );
  };

  return (
    <div className="schema-editor">
      <div className="schema-editor__toolbar">
        <button className="schema-editor__add" onClick={addColumn}>
          <Plus size={12} /> Add Column
        </button>
        <span className="schema-editor__count">{columns.length} column{columns.length !== 1 ? 's' : ''}</span>
      </div>

      {columns.length === 0 ? (
        <div className="schema-editor__empty">
          No schema columns defined. Click "Add Column" to start.
        </div>
      ) : (
        <div className="schema-editor__table">
          <div className="schema-editor__header">
            <div className="schema-col schema-col--name">Column</div>
            <div className="schema-col schema-col--type">Type</div>
            <div className="schema-col schema-col--len">Length</div>
            <div className="schema-col schema-col--prec">Precision</div>
            <div className="schema-col schema-col--null">Nullable</div>
            <div className="schema-col schema-col--key">Key</div>
            <div className="schema-col schema-col--default">Default</div>
            <div className="schema-col schema-col--comment">Comment</div>
            <div className="schema-col schema-col--actions"></div>
          </div>
          <div className="schema-editor__body">
            {columns.map((col, idx) => (
              <div key={idx} className="schema-editor__row">
                <div className="schema-col schema-col--name">
                  <input
                    type="text"
                    className="schema-input"
                    value={col.name}
                    onChange={(e) => updateColumn(idx, 'name', e.target.value)}
                    placeholder="column_name"
                  />
                </div>
                <div className="schema-col schema-col--type">
                  <select
                    className="schema-select"
                    value={col.type}
                    onChange={(e) => updateColumn(idx, 'type', e.target.value)}
                  >
                    {SCHEMA_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="schema-col schema-col--len">
                  <input
                    type="number"
                    className="schema-input schema-input--num"
                    value={col.length ?? ''}
                    onChange={(e) => updateColumn(idx, 'length', e.target.value ? Number(e.target.value) : null)}
                    placeholder="—"
                  />
                </div>
                <div className="schema-col schema-col--prec">
                  <input
                    type="number"
                    className="schema-input schema-input--num"
                    value={col.precision ?? ''}
                    onChange={(e) => updateColumn(idx, 'precision', e.target.value ? Number(e.target.value) : null)}
                    placeholder="—"
                  />
                </div>
                <div className="schema-col schema-col--null">
                  <input
                    type="checkbox"
                    checked={!!col.nullable}
                    onChange={(e) => updateColumn(idx, 'nullable', e.target.checked)}
                  />
                </div>
                <div className="schema-col schema-col--key">
                  <input
                    type="checkbox"
                    checked={!!col.key}
                    onChange={(e) => updateColumn(idx, 'key', e.target.checked)}
                  />
                </div>
                <div className="schema-col schema-col--default">
                  <input
                    type="text"
                    className="schema-input"
                    value={col.defaultValue ?? ''}
                    onChange={(e) => updateColumn(idx, 'defaultValue', e.target.value)}
                    placeholder="—"
                  />
                </div>
                <div className="schema-col schema-col--comment">
                  <input
                    type="text"
                    className="schema-input"
                    value={col.comment ?? ''}
                    onChange={(e) => updateColumn(idx, 'comment', e.target.value)}
                    placeholder="—"
                  />
                </div>
                <div className="schema-col schema-col--actions">
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
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
