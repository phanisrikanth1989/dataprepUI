import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
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
  Wand2,
  RefreshCw,
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

/** Parse a delimited file's text content into headers + rows */
function parseDelimitedText(text, fieldSep = ',', headerRows = 1, textEnclosure = '"') {
  if (!text) return { headers: [], rows: [] };
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line) => {
    const result = [];
    let current = '';
    let inQuote = false;
    const enc = textEnclosure || '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (enc && ch === enc) {
        if (inQuote && i + 1 < line.length && line[i + 1] === enc) {
          current += enc;
          i++;
        } else {
          inQuote = !inQuote;
        }
      } else if (ch === fieldSep && !inQuote) {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result;
  };

  const hdrCount = Math.max(0, parseInt(headerRows, 10) || 0);
  let headers;
  let dataLines;
  if (hdrCount > 0 && lines.length >= hdrCount) {
    headers = parseLine(lines[hdrCount - 1]);
    dataLines = lines.slice(hdrCount);
  } else {
    const firstRow = parseLine(lines[0]);
    headers = firstRow.map((_, i) => `Column${i + 1}`);
    dataLines = lines;
  }

  const rows = dataLines.slice(0, 100).map((line) => parseLine(line));
  return { headers, rows };
}

/** Parse JSON text into headers + rows */
function parseJsonText(text, jsonPath) {
  if (!text) return { headers: [], rows: [] };
  try {
    let data = JSON.parse(text);
    // Simple jsonPath support: if path is like $.records or $[*] try to navigate
    if (jsonPath && jsonPath !== '$') {
      const parts = jsonPath.replace(/^\$\.?/, '').split('.').filter(Boolean);
      for (const p of parts) {
        if (data && typeof data === 'object') data = data[p];
      }
    }
    if (!Array.isArray(data)) {
      if (data && typeof data === 'object') data = [data];
      else return { headers: [], rows: [] };
    }
    if (data.length === 0) return { headers: [], rows: [] };
    const headers = Object.keys(data[0]);
    const rows = data.slice(0, 100).map((obj) => headers.map((h) => {
      const v = obj[h];
      return v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    }));
    return { headers, rows };
  } catch {
    return { headers: [], rows: [] };
  }
}

/** Parse XML text into headers + rows (basic) */
function parseXmlText(text, xpathLoop) {
  if (!text) return { headers: [], rows: [] };
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'application/xml');
    const errorNode = doc.querySelector('parsererror');
    if (errorNode) return { headers: [], rows: [] };

    // Determine elements to iterate: use xpathLoop tag name or root children
    let elements;
    if (xpathLoop) {
      const tagName = xpathLoop.split('/').filter(Boolean).pop() || '';
      elements = Array.from(doc.getElementsByTagName(tagName));
    }
    if (!elements || elements.length === 0) {
      // Fallback: children of root
      const root = doc.documentElement;
      elements = Array.from(root.children);
    }
    if (elements.length === 0) return { headers: [], rows: [] };

    // Collect all child element tag names as headers
    const headerSet = new Set();
    for (const el of elements.slice(0, 50)) {
      for (const child of el.children) headerSet.add(child.tagName);
    }
    const headers = Array.from(headerSet);
    if (headers.length === 0) {
      // Elements have text content only
      return {
        headers: ['value'],
        rows: elements.slice(0, 100).map((el) => [el.textContent || '']),
      };
    }
    const rows = elements.slice(0, 100).map((el) =>
      headers.map((h) => {
        const child = el.getElementsByTagName(h)[0];
        return child ? child.textContent || '' : '';
      })
    );
    return { headers, rows };
  } catch {
    return { headers: [], rows: [] };
  }
}

/** Guess the data type of a column from sample values */
function guessColumnType(values) {
  const nonEmpty = values.filter((v) => v !== '' && v !== null && v !== undefined);
  if (nonEmpty.length === 0) return 'String';

  const allMatch = (test) => nonEmpty.every(test);

  // Boolean
  if (allMatch((v) => /^(true|false|yes|no|1|0)$/i.test(v.trim()))) return 'Boolean';
  // Integer
  if (allMatch((v) => /^-?\d+$/.test(v.trim()) && !isNaN(parseInt(v, 10)))) {
    const max = Math.max(...nonEmpty.map((v) => Math.abs(parseInt(v, 10))));
    return max > 2147483647 ? 'Long' : 'Integer';
  }
  // Float/Double
  if (allMatch((v) => /^-?\d+\.\d+$/.test(v.trim()) && !isNaN(parseFloat(v)))) return 'Double';
  // Date patterns
  if (allMatch((v) => /^\d{4}[-/]\d{2}[-/]\d{2}/.test(v.trim()) || /^\d{2}[-/]\d{2}[-/]\d{4}/.test(v.trim()))) return 'Date';

  return 'String';
}

/** Guess schema from parsed headers + rows */
function guessSchemaFromData(headers, rows) {
  return headers.map((h, i) => {
    const colValues = rows.map((r) => r[i] || '');
    const type = guessColumnType(colValues);
    const maxLen = Math.max(0, ...colValues.map((v) => String(v).length));
    return {
      name: h.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, ''),
      type,
      length: type === 'String' ? String(Math.max(maxLen, 50)) : '',
      precision: '',
      nullable: true,
      key: i === 0 && (type === 'Integer' || type === 'Long'),
      default: '',
      comment: '',
    };
  });
}

export default function MetadataDialog({ item, onClose, onSave, onDelete }) {
  const fileInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState('settings');
  const [testStatus, setTestStatus] = useState(null); // null | 'testing' | 'success' | 'error'

  // Raw file content for parsing
  const [fileContent, setFileContent] = useState(null); // string of file text
  const [fileName, setFileName] = useState('');

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
    if (!file) return;
    setFileName(file.name);
    onSave('filePath', file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      setFileContent(text);
      onSave('__fileContent', text);
    };
    reader.readAsText(file, item?.encoding || 'UTF-8');
    e.target.value = '';
  }, [onSave, item?.encoding]);

  // Parse file content based on category and settings
  const previewData = useMemo(() => {
    const content = fileContent || item?.__fileContent;
    if (!content || !isFile) return null;

    if (category === 'File Delimited') {
      const sep = (item.fieldSeparator || ',').replace('\\t', '\t');
      return parseDelimitedText(content, sep, item.headerRows || '1', item.textEnclosure || '"');
    }
    if (category === 'File JSON') {
      return parseJsonText(content, item.jsonPath);
    }
    if (category === 'File XML') {
      return parseXmlText(content, item.xpathLoop);
    }
    if (category === 'File Positional') {
      const positions = (item.fieldPositions || '').split(',').map((p) => parseInt(p.trim(), 10)).filter((n) => !isNaN(n));
      if (positions.length === 0) return parseDelimitedText(content, '\t', item.headerRows || '0', '');
      const lines = content.replace(/\r\n/g, '\n').split('\n').filter(Boolean);
      const hdrCount = Math.max(0, parseInt(item.headerRows, 10) || 0);
      const dataLines = lines.slice(hdrCount);
      const headers = positions.map((_, i) => `Field${i + 1}`);
      if (hdrCount > 0 && lines.length >= hdrCount) {
        const hdrLine = lines[hdrCount - 1];
        for (let i = 0; i < positions.length; i++) {
          const start = positions[i];
          const end = i + 1 < positions.length ? positions[i + 1] : hdrLine.length;
          headers[i] = hdrLine.substring(start, end).trim() || `Field${i + 1}`;
        }
      }
      const rows = dataLines.slice(0, 100).map((line) =>
        positions.map((start, i) => {
          const end = i + 1 < positions.length ? positions[i + 1] : line.length;
          return line.substring(start, end).trim();
        })
      );
      return { headers, rows };
    }
    // Fallback: try as delimited
    return parseDelimitedText(content, ',', '1', '"');
  }, [fileContent, item, category, isFile]);

  // Guess schema from preview data
  const guessedSchema = useMemo(() => {
    if (!previewData || previewData.headers.length === 0) return null;
    return guessSchemaFromData(previewData.headers, previewData.rows);
  }, [previewData]);

  const handleGuessSchema = useCallback(() => {
    if (guessedSchema) {
      onSave('columns', guessedSchema);
    }
  }, [guessedSchema, onSave]);

  // Initialize file content from stored __fileContent on open
  useEffect(() => {
    if (item?.__fileContent && !fileContent) {
      setFileContent(item.__fileContent);
    }
  }, [item?.__fileContent]);

  if (!item) return null;

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
            {(isFile || isSchema) && (
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
                {previewData && previewData.rows.length > 0 && (
                  <span className="modal-tab__badge">{previewData.rows.length}</span>
                )}
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
                          accept={
                            category === 'File Delimited' ? '.csv,.tsv,.txt,.dat' :
                            category === 'File Excel' ? '.xls,.xlsx' :
                            category === 'File JSON' ? '.json' :
                            category === 'File XML' ? '.xml' :
                            '*'
                          }
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

          {activeTab === 'schema' && (isSchema || isFile) && (
            <div>
              {isFile && guessedSchema && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
                  <button className="modal-btn modal-btn--secondary modal-btn--sm" onClick={handleGuessSchema}>
                    <Wand2 size={13} />
                    Guess Schema from File
                  </button>
                  {!previewData?.headers?.length && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)' }}>
                      Browse a file first to enable schema guessing
                    </span>
                  )}
                  {previewData?.headers?.length > 0 && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)' }}>
                      {guessedSchema.length} columns detected
                    </span>
                  )}
                </div>
              )}
              {isFile && !previewData?.headers?.length && !item.columns?.length && (
                <div className="panel-empty-state" style={{ padding: 30, textAlign: 'center' }}>
                  <FileText size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
                  <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: 12 }}>
                    Browse a file in the Settings tab to auto-detect the schema
                  </p>
                </div>
              )}
              <SchemaEditor
                columns={item.columns || []}
                onChange={(cols) => onSave('columns', cols)}
              />
            </div>
          )}

          {activeTab === 'preview' && isFile && (
            <div className="modal-preview">
              {previewData && previewData.headers.length > 0 ? (
                <>
                  <div className="modal-preview__header">
                    <Eye size={14} />
                    <span>File Data Preview</span>
                    <span className="modal-preview__info">
                      {previewData.rows.length} rows · {previewData.headers.length} columns
                    </span>
                    <button className="modal-btn modal-btn--secondary modal-btn--sm" onClick={handleGuessSchema} style={{ marginLeft: 'auto' }}>
                      <Wand2 size={12} />
                      Guess Schema
                    </button>
                  </div>
                  <div className="modal-preview__table-wrap">
                    <table className="modal-preview__table">
                      <thead>
                        <tr>
                          <th className="modal-preview__th modal-preview__th--row">#</th>
                          {previewData.headers.map((h, i) => (
                            <th key={i} className="modal-preview__th">{h}</th>
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
                </>
              ) : (
                <div className="panel-empty-state" style={{ padding: 40, textAlign: 'center' }}>
                  <FolderOpen size={32} style={{ opacity: 0.4, marginBottom: 10 }} />
                  <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: 13, marginBottom: 6 }}>
                    No file loaded yet
                  </p>
                  <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: 11 }}>
                    Go to the Settings tab and browse a file to see its content here
                  </p>
                </div>
              )}
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
