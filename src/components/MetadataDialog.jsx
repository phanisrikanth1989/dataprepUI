import { useState, useCallback, useEffect, useRef } from 'react';
import {
  X,
  Save,
  Trash2,
  Database,
  FileText,
  FileSpreadsheet,
  FileCode,
  FileJson,
  Globe,
  Table2,
  Server,
  Cloud,
  AlignJustify,
  CheckCircle2,
  XCircle,
  Loader2,
  FolderOpen,
  Eye,
} from 'lucide-react';
import { useDesigner } from '../context/DesignerContext';

const DB_TYPES = ['Oracle', 'MySQL', 'MSSQL', 'PostgreSQL', 'Sybase', 'DB2', 'Teradata', 'Netezza', 'Snowflake', 'Redshift', 'SQLite', 'H2', 'HSQL'];

const CATEGORY_FIELDS = {
  'Db Connections': [
    { key: 'name', label: 'Connection Name', type: 'text' },
    { key: 'dbType', label: 'DB Type', type: 'select', options: DB_TYPES },
    { key: 'host', label: 'Host', type: 'text', placeholder: 'localhost' },
    { key: 'port', label: 'Port', type: 'text', placeholder: '1521' },
    { key: 'database', label: 'Database / SID', type: 'text' },
    { key: 'schema', label: 'Schema', type: 'text' },
    { key: 'username', label: 'Username', type: 'text' },
    { key: 'password', label: 'Password', type: 'password' },
  ],
  'File Delimited': [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'filePath', label: 'File Path', type: 'file' },
    { key: 'encoding', label: 'Encoding', type: 'select', options: ['UTF-8', 'ISO-8859-1', 'US-ASCII', 'UTF-16', 'Windows-1252'] },
    { key: 'rowSeparator', label: 'Row Separator', type: 'text', placeholder: '\\n' },
    { key: 'fieldSeparator', label: 'Field Separator', type: 'text', placeholder: ',' },
    { key: 'headerRows', label: 'Header Rows', type: 'text', placeholder: '1' },
    { key: 'escapeChar', label: 'Escape Character', type: 'text', placeholder: '"' },
    { key: 'textEnclosure', label: 'Text Enclosure', type: 'text', placeholder: '"' },
  ],
  'File XML': [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'filePath', label: 'File Path', type: 'file' },
    { key: 'encoding', label: 'Encoding', type: 'select', options: ['UTF-8', 'ISO-8859-1', 'US-ASCII', 'UTF-16'] },
    { key: 'xpathLoop', label: 'XPath Loop Expression', type: 'text', placeholder: '/root/record' },
    { key: 'xpathQuery', label: 'XPath Query', type: 'text' },
  ],
  'File Excel': [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'filePath', label: 'File Path', type: 'file' },
    { key: 'sheetName', label: 'Sheet Name', type: 'text', placeholder: 'Sheet1' },
    { key: 'headerRow', label: 'Header Row', type: 'text', placeholder: '1' },
    { key: 'firstDataRow', label: 'First Data Row', type: 'text', placeholder: '2' },
    { key: 'lastDataRow', label: 'Last Data Row', type: 'text', placeholder: '' },
  ],
  'File JSON': [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'filePath', label: 'File Path', type: 'file' },
    { key: 'jsonPath', label: 'JSON Path Expression', type: 'text', placeholder: '$' },
    { key: 'encoding', label: 'Encoding', type: 'select', options: ['UTF-8', 'ISO-8859-1', 'US-ASCII'] },
  ],
  'File Positional': [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'filePath', label: 'File Path', type: 'file' },
    { key: 'encoding', label: 'Encoding', type: 'select', options: ['UTF-8', 'ISO-8859-1', 'US-ASCII'] },
    { key: 'headerRows', label: 'Header Rows', type: 'text', placeholder: '0' },
    { key: 'fieldPositions', label: 'Field Positions', type: 'text', placeholder: '0,10,25,40' },
  ],
  'File Regex': [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'filePath', label: 'File Path', type: 'file' },
    { key: 'pattern', label: 'Regex Pattern', type: 'text' },
    { key: 'encoding', label: 'Encoding', type: 'select', options: ['UTF-8', 'ISO-8859-1', 'US-ASCII'] },
  ],
  'Generic Schemas': [
    { key: 'name', label: 'Schema Name', type: 'text' },
  ],
  'LDAP': [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'host', label: 'Host', type: 'text' },
    { key: 'port', label: 'Port', type: 'text', placeholder: '389' },
    { key: 'baseDN', label: 'Base DN', type: 'text' },
    { key: 'bindDN', label: 'Bind DN', type: 'text' },
    { key: 'bindPassword', label: 'Bind Password', type: 'password' },
  ],
  'Salesforce': [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'endpoint', label: 'Endpoint', type: 'text', placeholder: 'https://login.salesforce.com' },
    { key: 'username', label: 'Username', type: 'text' },
    { key: 'password', label: 'Password', type: 'password' },
    { key: 'securityToken', label: 'Security Token', type: 'password' },
    { key: 'apiVersion', label: 'API Version', type: 'text', placeholder: '52.0' },
  ],
  'Web Service': [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'wsdlUrl', label: 'WSDL URL', type: 'text' },
    { key: 'endpoint', label: 'Endpoint URL', type: 'text' },
    { key: 'method', label: 'Method', type: 'select', options: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] },
    { key: 'contentType', label: 'Content Type', type: 'select', options: ['application/json', 'application/xml', 'text/xml', 'text/plain'] },
  ],
};

const CATEGORY_ICONS = {
  'Db Connections': Database,
  'File Delimited': FileText,
  'File XML': FileCode,
  'File Excel': FileSpreadsheet,
  'File JSON': FileJson,
  'File Positional': AlignJustify,
  'File Regex': FileText,
  'Generic Schemas': Table2,
  'LDAP': Server,
  'Salesforce': Cloud,
  'Web Service': Globe,
};

const COLUMN_TYPES = ['String', 'Integer', 'Long', 'Float', 'Double', 'Boolean', 'Date', 'Byte', 'Short', 'BigDecimal', 'Object'];

const isFileCategory = (cat) => cat && cat.startsWith('File ');

/** Generate sample preview data based on file type */
function generatePreviewData(category) {
  if (category === 'File Delimited') {
    return {
      headers: ['id', 'name', 'email', 'age', 'city'],
      rows: [
        ['1', 'John Doe', 'john@example.com', '32', 'New York'],
        ['2', 'Jane Smith', 'jane@example.com', '28', 'Los Angeles'],
        ['3', 'Bob Johnson', 'bob@example.com', '45', 'Chicago'],
        ['4', 'Alice Brown', 'alice@example.com', '35', 'Houston'],
        ['5', 'Charlie Wilson', 'charlie@example.com', '29', 'Phoenix'],
      ],
    };
  }
  if (category === 'File Excel') {
    return {
      headers: ['Product', 'Category', 'Price', 'Quantity', 'Total'],
      rows: [
        ['Widget A', 'Hardware', '$12.99', '100', '$1,299.00'],
        ['Widget B', 'Software', '$24.50', '50', '$1,225.00'],
        ['Widget C', 'Hardware', '$8.75', '200', '$1,750.00'],
        ['Widget D', 'Services', '$150.00', '10', '$1,500.00'],
      ],
    };
  }
  if (category === 'File JSON') {
    return {
      headers: ['key', 'value', 'type'],
      rows: [
        ['name', 'DataPrep Studio', 'string'],
        ['version', '2.1.0', 'string'],
        ['enabled', 'true', 'boolean'],
        ['maxRetries', '3', 'number'],
      ],
    };
  }
  if (category === 'File XML') {
    return {
      headers: ['element', 'attribute', 'value'],
      rows: [
        ['record', 'id=1', 'John Doe'],
        ['record', 'id=2', 'Jane Smith'],
        ['record', 'id=3', 'Bob Johnson'],
      ],
    };
  }
  return {
    headers: ['col1', 'col2', 'col3'],
    rows: [
      ['data1', 'data2', 'data3'],
      ['data4', 'data5', 'data6'],
    ],
  };
}

export default function MetadataDialog({ item, onClose, onSave, onDelete }) {
  const fileInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState('settings');
  const [testStatus, setTestStatus] = useState(null); // null | 'testing' | 'success' | 'error'
  const [showPreview, setShowPreview] = useState(false);

  const category = item?.category;
  const fields = CATEGORY_FIELDS[category] || [];
  const IconComp = CATEGORY_ICONS[category] || FileText;
  const isDb = category === 'Db Connections';
  const isFile = isFileCategory(category);
  const isSchema = category === 'Generic Schemas';

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleTestConnection = useCallback(() => {
    setTestStatus('testing');
    // Simulate connection test
    setTimeout(() => {
      const hasHost = item.host && item.host.trim();
      const hasDb = item.database && item.database.trim();
      if (hasHost && hasDb) {
        setTestStatus('success');
      } else {
        setTestStatus('error');
      }
    }, 1500);
  }, [item]);

  const handleBrowse = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelected = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) {
      onSave('filePath', file.name);
    }
  }, [onSave]);

  if (!item) return null;

  const previewData = isFile ? generatePreviewData(category) : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog modal-dialog--lg" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-header__title">
            <IconComp size={18} />
            <span>{isDb ? 'Database Connection' : category}</span>
            <span className="modal-header__subtitle">— {item.name}</span>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Tab bar for file types */}
        {(isFile || isSchema) && (
          <div className="modal-tabs">
            <button
              className={`modal-tab ${activeTab === 'settings' ? 'modal-tab--active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              Settings
            </button>
            {isSchema && (
              <button
                className={`modal-tab ${activeTab === 'schema' ? 'modal-tab--active' : ''}`}
                onClick={() => setActiveTab('schema')}
              >
                Schema
              </button>
            )}
            {isFile && (
              <button
                className={`modal-tab ${activeTab === 'preview' ? 'modal-tab--active' : ''}`}
                onClick={() => setActiveTab('preview')}
              >
                Preview Data
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div className="modal-body">
          {activeTab === 'settings' && (
            <div className="modal-form">
              {fields.map((field) => (
                <div key={field.key} className="modal-field">
                  <label className="modal-label">{field.label}</label>
                  <div className="modal-field__input-row">
                    {field.type === 'select' ? (
                      <select
                        className="modal-select"
                        value={item[field.key] || ''}
                        onChange={(e) => onSave(field.key, e.target.value)}
                      >
                        {field.options.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : field.type === 'file' ? (
                      <div className="modal-file-row">
                        <input
                          type="text"
                          className="modal-input"
                          value={item[field.key] || ''}
                          placeholder={field.placeholder || '/path/to/file'}
                          onChange={(e) => onSave(field.key, e.target.value)}
                        />
                        <button className="modal-btn modal-btn--secondary" onClick={handleBrowse}>
                          <FolderOpen size={13} />
                          Browse
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          style={{ display: 'none' }}
                          onChange={handleFileSelected}
                        />
                      </div>
                    ) : (
                      <input
                        type={field.type === 'password' ? 'password' : 'text'}
                        className="modal-input"
                        value={item[field.key] || ''}
                        placeholder={field.placeholder || ''}
                        onChange={(e) => onSave(field.key, e.target.value)}
                      />
                    )}
                  </div>
                </div>
              ))}

              {/* Test Connection for DB */}
              {isDb && (
                <div className="modal-test-section">
                  <button
                    className={`modal-btn modal-btn--test ${testStatus === 'testing' ? 'modal-btn--loading' : ''}`}
                    onClick={handleTestConnection}
                    disabled={testStatus === 'testing'}
                  >
                    {testStatus === 'testing' ? (
                      <><Loader2 size={14} className="spin" /> Testing...</>
                    ) : (
                      <><Database size={14} /> Test Connection</>
                    )}
                  </button>
                  {testStatus === 'success' && (
                    <span className="test-result test-result--success">
                      <CheckCircle2 size={14} /> Connection successful
                    </span>
                  )}
                  {testStatus === 'error' && (
                    <span className="test-result test-result--error">
                      <XCircle size={14} /> Connection failed — check host and database
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'schema' && isSchema && item.columns && (
            <SchemaEditor
              columns={item.columns}
              onChange={(cols) => onSave('columns', cols)}
            />
          )}

          {activeTab === 'preview' && isFile && previewData && (
            <div className="modal-preview">
              <div className="modal-preview__header">
                <Eye size={14} />
                <span>Sample Data Preview</span>
                <span className="modal-preview__info">{previewData.rows.length} rows</span>
              </div>
              <div className="modal-preview__table-wrap">
                <table className="modal-preview__table">
                  <thead>
                    <tr>
                      <th className="modal-preview__th modal-preview__th--row">#</th>
                      {previewData.headers.map((h) => (
                        <th key={h} className="modal-preview__th">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.rows.map((row, ri) => (
                      <tr key={ri} className="modal-preview__tr">
                        <td className="modal-preview__td modal-preview__td--row">{ri + 1}</td>
                        {row.map((cell, ci) => (
                          <td key={ci} className="modal-preview__td">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <div className="modal-footer__left">
            <span className="modal-footer__dates">
              Created: {item.created} · Modified: {item.modified}
            </span>
          </div>
          <div className="modal-footer__right">
            <button className="modal-btn modal-btn--danger" onClick={() => { onDelete(item.id); onClose(); }}>
              <Trash2 size={13} />
              Delete
            </button>
            <button className="modal-btn modal-btn--secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="modal-btn modal-btn--primary" onClick={onClose}>
              <Save size={13} />
              Save &amp; Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Schema column editor for Generic Schemas */
function SchemaEditor({ columns, onChange }) {
  const addColumn = () => {
    onChange([...columns, { name: '', type: 'String', length: '', nullable: true, key: false, comment: '' }]);
  };

  const removeColumn = (index) => {
    onChange(columns.filter((_, i) => i !== index));
  };

  const updateColumn = (index, key, value) => {
    onChange(columns.map((col, i) => (i === index ? { ...col, [key]: value } : col)));
  };

  return (
    <div className="modal-schema">
      <div className="modal-schema__header">
        <span>Schema Columns</span>
        <button className="modal-btn modal-btn--secondary modal-btn--sm" onClick={addColumn}>
          + Add Column
        </button>
      </div>
      <div className="modal-schema__table-wrap">
        <table className="modal-schema__table">
          <thead>
            <tr>
              <th>Column Name</th>
              <th>Type</th>
              <th>Length</th>
              <th>Nullable</th>
              <th>Key</th>
              <th>Comment</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {columns.map((col, i) => (
              <tr key={i}>
                <td>
                  <input
                    className="modal-input modal-input--sm"
                    value={col.name}
                    placeholder="column_name"
                    onChange={(e) => updateColumn(i, 'name', e.target.value)}
                  />
                </td>
                <td>
                  <select
                    className="modal-select modal-select--sm"
                    value={col.type}
                    onChange={(e) => updateColumn(i, 'type', e.target.value)}
                  >
                    {COLUMN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </td>
                <td>
                  <input
                    className="modal-input modal-input--sm modal-input--narrow"
                    value={col.length}
                    placeholder="—"
                    onChange={(e) => updateColumn(i, 'length', e.target.value)}
                  />
                </td>
                <td><input type="checkbox" checked={col.nullable} onChange={(e) => updateColumn(i, 'nullable', e.target.checked)} /></td>
                <td><input type="checkbox" checked={col.key} onChange={(e) => updateColumn(i, 'key', e.target.checked)} /></td>
                <td>
                  <input
                    className="modal-input modal-input--sm"
                    value={col.comment || ''}
                    placeholder=""
                    onChange={(e) => updateColumn(i, 'comment', e.target.value)}
                  />
                </td>
                <td>
                  <button className="modal-btn modal-btn--icon modal-btn--danger-icon" onClick={() => removeColumn(i)}>
                    <X size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
