import { Plus, Trash2 } from 'lucide-react';

/**
 * Renders a single property field based on its type definition from the registry.
 */
export default function PropertyRenderer({ property, value, onChange }) {
  const { type, label, placeholder, tooltip, options, allowCustom, columns, min, max, fileTypes, language } = property;

  switch (type) {
    case 'text':
      return (
        <div className="prop-field" title={tooltip}>
          <label className="prop-label">{label}</label>
          <input
            type="text"
            className="prop-input"
            value={value ?? ''}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );

    case 'number':
      return (
        <div className="prop-field" title={tooltip}>
          <label className="prop-label">{label}</label>
          <input
            type="number"
            className="prop-input"
            value={value ?? ''}
            min={min}
            max={max}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          />
        </div>
      );

    case 'checkbox':
      return (
        <div className="prop-field prop-field--checkbox" title={tooltip}>
          <label className="prop-checkbox-label">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => onChange(e.target.checked)}
            />
            <span>{label}</span>
          </label>
        </div>
      );

    case 'select':
      return (
        <div className="prop-field" title={tooltip}>
          <label className="prop-label">{label}</label>
          {allowCustom ? (
            <input
              type="text"
              className="prop-input"
              list={`dl-${property.key}`}
              value={value ?? ''}
              placeholder={placeholder}
              onChange={(e) => onChange(e.target.value)}
            />
          ) : (
            <select
              className="prop-select"
              value={value ?? ''}
              onChange={(e) => onChange(e.target.value)}
            >
              {(options || []).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
          {allowCustom && (
            <datalist id={`dl-${property.key}`}>
              {(options || []).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </datalist>
          )}
        </div>
      );

    case 'file':
      return (
        <div className="prop-field" title={tooltip}>
          <label className="prop-label">{label}</label>
          <div className="prop-file-group">
            <input
              type="text"
              className="prop-input"
              value={value ?? ''}
              placeholder={placeholder || 'Enter file path...'}
              onChange={(e) => onChange(e.target.value)}
            />
            {fileTypes && (
              <span className="prop-file-types">
                {fileTypes.join(', ')}
              </span>
            )}
          </div>
        </div>
      );

    case 'code':
      return (
        <div className="prop-field" title={tooltip}>
          <label className="prop-label">
            {label}
            {language && <span className="prop-lang-badge">{language}</span>}
          </label>
          <textarea
            className="prop-code"
            value={value ?? ''}
            placeholder={placeholder}
            rows={8}
            spellCheck={false}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );

    case 'table':
      return (
        <div className="prop-field" title={tooltip}>
          <label className="prop-label">{label}</label>
          <TableEditor
            columns={columns || []}
            value={Array.isArray(value) ? value : []}
            onChange={onChange}
          />
        </div>
      );

    default:
      return (
        <div className="prop-field" title={tooltip}>
          <label className="prop-label">{label}</label>
          <input
            type="text"
            className="prop-input"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
  }
}

function TableEditor({ columns, value, onChange }) {
  const addRow = () => {
    const newRow = {};
    for (const col of columns) {
      newRow[col.key] = col.default !== undefined ? col.default : '';
    }
    onChange([...value, newRow]);
  };

  const removeRow = (index) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const updateCell = (rowIndex, colKey, cellValue) => {
    const updated = value.map((row, i) =>
      i === rowIndex ? { ...row, [colKey]: cellValue } : row
    );
    onChange(updated);
  };

  return (
    <div className="prop-table">
      <div className="prop-table__header">
        {columns.map((col) => (
          <div key={col.key} className="prop-table__th">
            {col.label}
          </div>
        ))}
        <div className="prop-table__th prop-table__th--actions" />
      </div>
      <div className="prop-table__body">
        {value.map((row, rowIdx) => (
          <div key={rowIdx} className="prop-table__row">
            {columns.map((col) => (
              <div key={col.key} className="prop-table__td">
                {col.type === 'checkbox' ? (
                  <input
                    type="checkbox"
                    checked={!!row[col.key]}
                    onChange={(e) =>
                      updateCell(rowIdx, col.key, e.target.checked)
                    }
                  />
                ) : col.type === 'select' ? (
                  <select
                    className="prop-select prop-select--sm"
                    value={row[col.key] ?? ''}
                    onChange={(e) =>
                      updateCell(rowIdx, col.key, e.target.value)
                    }
                  >
                    {(col.options || []).map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={col.type === 'number' ? 'number' : 'text'}
                    className="prop-input prop-input--sm"
                    value={row[col.key] ?? ''}
                    onChange={(e) =>
                      updateCell(
                        rowIdx,
                        col.key,
                        col.type === 'number'
                          ? Number(e.target.value)
                          : e.target.value
                      )
                    }
                  />
                )}
              </div>
            ))}
            <div className="prop-table__td prop-table__td--actions">
              <button
                className="prop-table__btn"
                onClick={() => removeRow(rowIdx)}
                title="Remove row"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <button className="prop-table__add" onClick={addRow}>
        <Plus size={12} /> Add Row
      </button>
    </div>
  );
}
