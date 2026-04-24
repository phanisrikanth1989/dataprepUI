import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  X, Plus, Trash2, ChevronDown, ChevronRight,
  Search, ArrowUp, ArrowDown, Copy, KeyRound,
  Download, Upload, Filter, Settings, Columns,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   Talend Expression Routines — available for expression builder
   ═══════════════════════════════════════════════════════════════ */

const EXPRESSION_ROUTINES = [
  {
    category: 'StringHandling',
    fns: [
      { name: 'StringHandling.TRIM', sig: 'TRIM(String)', desc: 'Trim whitespace' },
      { name: 'StringHandling.LTRIM', sig: 'LTRIM(String)', desc: 'Left trim' },
      { name: 'StringHandling.RTRIM', sig: 'RTRIM(String)', desc: 'Right trim' },
      { name: 'StringHandling.UPCASE', sig: 'UPCASE(String)', desc: 'Upper case' },
      { name: 'StringHandling.DOWNCASE', sig: 'DOWNCASE(String)', desc: 'Lower case' },
      { name: 'StringHandling.LEFT', sig: 'LEFT(String, int)', desc: 'Left substring' },
      { name: 'StringHandling.RIGHT', sig: 'RIGHT(String, int)', desc: 'Right substring' },
      { name: 'StringHandling.INDEX', sig: 'INDEX(String, String)', desc: 'Index of substring' },
      { name: 'StringHandling.LENGTH', sig: 'LENGTH(String)', desc: 'String length' },
      { name: 'StringHandling.CHANGE', sig: 'CHANGE(String, old, new)', desc: 'Replace' },
      { name: 'StringHandling.IS_ALPHA', sig: 'IS_ALPHA(String)', desc: 'All alphabetic' },
      { name: 'StringHandling.IS_NUMERIC', sig: 'IS_NUMERIC(String)', desc: 'All numeric' },
      { name: 'StringHandling.IS_ALPHA_NUMERIC', sig: 'IS_ALPHA_NUMERIC(String)', desc: 'Alphanumeric' },
    ],
  },
  {
    category: 'TalendDate',
    fns: [
      { name: 'TalendDate.getCurrentDate', sig: 'getCurrentDate()', desc: 'Current date' },
      { name: 'TalendDate.getDate', sig: 'getDate(String pattern)', desc: 'Format current date' },
      { name: 'TalendDate.parseDate', sig: 'parseDate(String pattern, String date)', desc: 'Parse date string' },
      { name: 'TalendDate.formatDate', sig: 'formatDate(String pattern, Date date)', desc: 'Format date' },
      { name: 'TalendDate.addDate', sig: 'addDate(Date date, int nb, String dateType)', desc: 'Add to date' },
      { name: 'TalendDate.diffDate', sig: 'diffDate(Date date1, Date date2, String dateType)', desc: 'Diff dates' },
      { name: 'TalendDate.getPartOfDate', sig: 'getPartOfDate(String part, Date date)', desc: 'Get part of date' },
      { name: 'TalendDate.compareDate', sig: 'compareDate(Date date1, Date date2)', desc: 'Compare dates' },
    ],
  },
  {
    category: 'Numeric',
    fns: [
      { name: 'Numeric.sequence', sig: 'sequence(String seqName, int start, int step)', desc: 'Auto-increment sequence' },
      { name: 'Numeric.random', sig: 'random()', desc: 'Random number 0-1' },
      { name: 'Numeric.randomInt', sig: 'randomInt(int min, int max)', desc: 'Random integer in range' },
    ],
  },
  {
    category: 'Relational',
    fns: [
      { name: 'Relational.ISNULL', sig: 'ISNULL(Object)', desc: 'Check null' },
      { name: 'Relational.NOT', sig: 'NOT(boolean)', desc: 'Negate' },
    ],
  },
  {
    category: 'TalendString',
    fns: [
      { name: 'TalendString.checkCDATAChars', sig: 'checkCDATAChars(String str)', desc: 'Validate CDATA' },
      { name: 'TalendString.replaceSpecialCharForXML', sig: 'replaceSpecialCharForXML(String str)', desc: 'Escape XML chars' },
      { name: 'TalendString.talpiStringConvert', sig: 'talpiStringConvert(String str)', desc: 'String conversion' },
    ],
  },
];

const SCHEMA_TYPES = [
  'String', 'Integer', 'Long', 'Float', 'Double', 'Boolean', 'Date',
  'byte[]', 'BigDecimal', 'Character', 'Short', 'Object',
];

function newSchemaCol(index) {
  return { name: `newColumn${index}`, type: 'String', length: null, precision: null, nullable: true, key: false };
}

/* ═══════════════════════════════════════════════════════════════
   Expression Builder Popup
   ═══════════════════════════════════════════════════════════════ */
function ExpressionBuilder({ value, onChange, onClose, inputTables, variables }) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState({});
  const toggle = (cat) => setExpanded((p) => ({ ...p, [cat]: !p[cat] }));

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    if (!term) return EXPRESSION_ROUTINES;
    return EXPRESSION_ROUTINES.map((g) => ({
      ...g,
      fns: g.fns.filter((f) => f.name.toLowerCase().includes(term) || f.desc.toLowerCase().includes(term)),
    })).filter((g) => g.fns.length > 0);
  }, [search]);

  const insert = (text) => {
    onChange(value ? `${value}${text}` : text);
  };

  return (
    <div className="me-expr-builder__overlay" onClick={onClose}>
      <div className="me-expr-builder" onClick={(e) => e.stopPropagation()}>
        <div className="me-expr-builder__header">
          <span>Expression Builder</span>
          <button className="map-editor__close" onClick={onClose}><X size={14} /></button>
        </div>

        {/* Current expression */}
        <div className="me-expr-builder__current">
          <textarea
            className="me-expr-builder__textarea"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            placeholder="Type expression here…"
          />
        </div>

        <div className="me-expr-builder__panels">
          {/* Left: available columns */}
          <div className="me-expr-builder__panel">
            <div className="me-expr-builder__panel-title">Columns / Variables</div>
            {(inputTables || []).map((tbl) => (
              <div key={tbl.name} className="me-expr-builder__group">
                <div className="me-expr-builder__group-name" onClick={() => toggle('col_' + tbl.name)}>
                  {expanded['col_' + tbl.name] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  {tbl.name}
                </div>
                {expanded['col_' + tbl.name] && (tbl.schema || []).map((col) => (
                  <div key={col.name} className="me-expr-builder__item" onClick={() => insert(`${tbl.name}.${col.name}`)}>
                    {col.name} <span className="me-expr-builder__item-type">{col.type}</span>
                  </div>
                ))}
              </div>
            ))}
            {(variables || []).length > 0 && (
              <div className="me-expr-builder__group">
                <div className="me-expr-builder__group-name" onClick={() => toggle('col_vars')}>
                  {expanded['col_vars'] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  Var
                </div>
                {expanded['col_vars'] && variables.map((v) => (
                  <div key={v.name} className="me-expr-builder__item" onClick={() => insert(`Var.${v.name}`)}>
                    {v.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: routine functions */}
          <div className="me-expr-builder__panel">
            <div className="me-expr-builder__panel-title">
              Routines
              <input
                className="me-expr-builder__search"
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {filtered.map((g) => (
              <div key={g.category} className="me-expr-builder__group">
                <div className="me-expr-builder__group-name" onClick={() => toggle(g.category)}>
                  {expanded[g.category] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  {g.category}
                </div>
                {expanded[g.category] && g.fns.map((f) => (
                  <div key={f.name} className="me-expr-builder__item" onClick={() => insert(f.name + '()')}>
                    <span className="me-expr-builder__fn-name">{f.sig}</span>
                    <span className="me-expr-builder__fn-desc">{f.desc}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="me-expr-builder__footer">
          <button className="map-editor__btn map-editor__btn--primary" onClick={onClose}>Apply</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Bottom Schema Editor (Talend-style — two panes)
   ═══════════════════════════════════════════════════════════════ */
function BottomSchemaEditor({ selectedInput, selectedOutput, inputTables, outputs, onUpdateOutputSchema, getInputSchema, onUpdateInputSchema }) {
  const [activeTab, setActiveTab] = useState('schema');

  const inputSchema = getInputSchema ? getInputSchema(selectedInput) : (inputTables?.find((t) => t.name === selectedInput)?.schema || []);
  const outputObj = outputs?.find((o) => o.name === selectedOutput);
  const outputSchema = outputObj?.schema || [];

  /* ── Output schema editing ── */
  const updateCol = (idx, field, val) => {
    const s = outputSchema.map((c, i) => (i === idx ? { ...c, [field]: val } : c));
    onUpdateOutputSchema(selectedOutput, s);
  };
  const addCol = () => onUpdateOutputSchema(selectedOutput, [...outputSchema, newSchemaCol(outputSchema.length)]);
  const removeCol = (idx) => onUpdateOutputSchema(selectedOutput, outputSchema.filter((_, i) => i !== idx));
  const moveCol = (idx, dir) => {
    const t = idx + dir;
    if (t < 0 || t >= outputSchema.length) return;
    const a = [...outputSchema];
    [a[idx], a[t]] = [a[t], a[idx]];
    onUpdateOutputSchema(selectedOutput, a);
  };
  const dupCol = (idx) => {
    const c = { ...outputSchema[idx], name: outputSchema[idx].name + '_copy' };
    const a = [...outputSchema];
    a.splice(idx + 1, 0, c);
    onUpdateOutputSchema(selectedOutput, a);
  };

  /* ── Input schema editing ── */
  const updateInputCol = (idx, field, val) => {
    if (!onUpdateInputSchema || !selectedInput) return;
    const s = inputSchema.map((c, i) => (i === idx ? { ...c, [field]: val } : c));
    onUpdateInputSchema(selectedInput, s);
  };
  const addInputCol = () => {
    if (!onUpdateInputSchema || !selectedInput) return;
    onUpdateInputSchema(selectedInput, [...inputSchema, newSchemaCol(inputSchema.length)]);
  };
  const removeInputCol = (idx) => {
    if (!onUpdateInputSchema || !selectedInput) return;
    onUpdateInputSchema(selectedInput, inputSchema.filter((_, i) => i !== idx));
  };
  const moveInputCol = (idx, dir) => {
    if (!onUpdateInputSchema || !selectedInput) return;
    const t = idx + dir;
    if (t < 0 || t >= inputSchema.length) return;
    const a = [...inputSchema];
    [a[idx], a[t]] = [a[t], a[idx]];
    onUpdateInputSchema(selectedInput, a);
  };
  const dupInputCol = (idx) => {
    if (!onUpdateInputSchema || !selectedInput) return;
    const c = { ...inputSchema[idx], name: inputSchema[idx].name + '_copy' };
    const a = [...inputSchema];
    a.splice(idx + 1, 0, c);
    onUpdateInputSchema(selectedInput, a);
  };

  const renderSchemaTable = (schema, side) => {
    const readOnly = false;
    const isInput = side === 'input';
    const colUpdate = isInput ? updateInputCol : updateCol;
    const colMove = isInput ? moveInputCol : moveCol;
    const colDup = isInput ? dupInputCol : dupCol;
    const colRemove = isInput ? removeInputCol : removeCol;
    const colAdd = isInput ? addInputCol : addCol;
    const hasTarget = isInput ? !!selectedInput : !!selectedOutput;

    return (
      <div className="tmap-schema__wrap">
        <table className="tmap-schema__table">
          <thead>
            <tr>
              <th className="tmap-schema__th--actions"></th>
              <th>Column</th>
              <th>Key</th>
              <th>Type</th>
              <th>✓</th>
              <th>N..</th>
              <th>Date Pattern</th>
              <th>Length</th>
              <th>Precision</th>
              <th>Default</th>
              <th>Comment</th>
              <th className="tmap-schema__th--actions"></th>
            </tr>
          </thead>
          <tbody>
            {schema.map((col, i) => (
              <tr key={i}>
                <td className="tmap-schema__actions">
                  <button onClick={() => colMove(i, -1)} disabled={i === 0}><ArrowUp size={10} /></button>
                  <button onClick={() => colMove(i, 1)} disabled={i === schema.length - 1}><ArrowDown size={10} /></button>
                </td>
                <td><input className="tmap-schema__input" value={col.name} onChange={(e) => colUpdate(i, 'name', e.target.value)} /></td>
                <td className="tmap-schema__center">
                  <input type="checkbox" checked={!!col.key} onChange={(e) => colUpdate(i, 'key', e.target.checked)} />
                </td>
                <td>
                  <select className="tmap-schema__select" value={col.type} onChange={(e) => colUpdate(i, 'type', e.target.value)}>
                    {SCHEMA_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </td>
                <td className="tmap-schema__center"><input type="checkbox" disabled /></td>
                <td className="tmap-schema__center">
                  <input type="checkbox" checked={col.nullable !== false} onChange={(e) => colUpdate(i, 'nullable', e.target.checked)} />
                </td>
                <td><input className="tmap-schema__input" value={col.datePattern || ''} onChange={(e) => colUpdate(i, 'datePattern', e.target.value)} /></td>
                <td><input type="number" className="tmap-schema__input tmap-schema__num" value={col.length ?? ''} onChange={(e) => colUpdate(i, 'length', e.target.value === '' ? null : Number(e.target.value))} /></td>
                <td><input type="number" className="tmap-schema__input tmap-schema__num" value={col.precision ?? ''} onChange={(e) => colUpdate(i, 'precision', e.target.value === '' ? null : Number(e.target.value))} /></td>
                <td><input className="tmap-schema__input" value={col.defaultValue || ''} onChange={(e) => colUpdate(i, 'defaultValue', e.target.value)} /></td>
                <td><input className="tmap-schema__input" value={col.comment || ''} onChange={(e) => colUpdate(i, 'comment', e.target.value)} /></td>
                <td className="tmap-schema__actions">
                  <button onClick={() => colDup(i)} title="Duplicate"><Copy size={10} /></button>
                  <button onClick={() => colRemove(i)} title="Remove"><Trash2 size={10} /></button>
                </td>
              </tr>
            ))}
            {schema.length === 0 && (
              <tr><td colSpan={12} className="tmap-schema__empty">No columns defined</td></tr>
            )}
          </tbody>
        </table>
        {hasTarget && (
          <div className="tmap-schema__toolbar">
            <button className="tmap-schema__add" onClick={colAdd}><Plus size={12} /> Add Column</button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="tmap-bottom">
      <div className="tmap-bottom__tabs">
        <button className={`tmap-bottom__tab ${activeTab === 'schema' ? 'tmap-bottom__tab--active' : ''}`}
          onClick={() => setActiveTab('schema')}>Schema editor</button>
        <button className={`tmap-bottom__tab ${activeTab === 'expression' ? 'tmap-bottom__tab--active' : ''}`}
          onClick={() => setActiveTab('expression')}>Expression editor</button>
      </div>
      {activeTab === 'schema' && (
        <div className="tmap-bottom__body">
          <div className="tmap-bottom__pane">
            <div className="tmap-bottom__pane-title">{selectedInput || '(select input)'}</div>
            {renderSchemaTable(inputSchema, 'input')}
          </div>
          <div className="tmap-bottom__pane">
            <div className="tmap-bottom__pane-title">{selectedOutput || '(select output)'}</div>
            {renderSchemaTable(outputSchema, 'output')}
          </div>
        </div>
      )}
      {activeTab === 'expression' && (
        <div className="tmap-bottom__body">
          <div className="tmap-bottom__expr-hint">Select an output mapping to edit its expression</div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Output Table Panel (Talend-style: filter bar + Expression | Column)
   ═══════════════════════════════════════════════════════════════ */
function OutputTablePanel({ output, onUpdate, onRemove, onMoveUp, onMoveDown, onSelect, isSelected, inputTables, variables }) {
  const [collapsed, setCollapsed] = useState(false);
  const [exprTarget, setExprTarget] = useState(null);
  const importRef = useRef(null);

  const schema = output.schema || [];
  const mappings = output.mappings || [];

  const syncedMappings = useMemo(() => {
    return schema.map((col) => {
      const found = mappings.find((m) => m.column === col.name);
      return found || { column: col.name, type: col.type, expression: '' };
    });
  }, [schema, mappings]);

  const setMappings = (newM) => onUpdate({ ...output, mappings: newM });
  const updateMapping = (idx, field, val) => {
    setMappings(syncedMappings.map((m, i) => (i === idx ? { ...m, [field]: val } : m)));
  };

  const exportSchema = (e) => {
    e.stopPropagation();
    const json = JSON.stringify(schema, null, 2);
    navigator.clipboard.writeText(json).catch(() => {});
  };
  const importSchema = (e) => {
    e.stopPropagation();
    const text = prompt('Paste schema JSON (array of {name, type, ...}):');
    if (!text) return;
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) onUpdate({ ...output, schema: parsed });
    } catch { /* ignore invalid JSON */ }
  };

  return (
    <div className={`tmap-output ${isSelected ? 'tmap-output--selected' : ''}`}
      onClick={() => onSelect?.()}>
      <div className="tmap-output__header">
        <input className="tmap-output__name-input" value={output.name}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onUpdate({ ...output, name: e.target.value })} />
        <div className="tmap-output__toolbar">
          <button className="tmap-output__tool-btn" onClick={(e) => { e.stopPropagation(); onUpdate({ ...output, schema: [...(output.schema || []), newSchemaCol((output.schema || []).length)] }); }}
            title="Add column"><Plus size={12} /></button>
          <button className="tmap-output__tool-btn" onClick={importSchema} title="Import schema"><Upload size={12} /></button>
          <button className="tmap-output__tool-btn" onClick={exportSchema} title="Export schema"><Download size={12} /></button>
          <button className="tmap-output__tool-btn" onClick={(e) => { e.stopPropagation(); setCollapsed((c) => !c); }}
            title={collapsed ? 'Expand' : 'Collapse'}>{collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}</button>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* ── Talend-style settings rows ── */}
          <div className="tmap-output__settings">
            <div className="tmap-output__settings-row">
              <span className="tmap-output__settings-lbl">Catch output reject</span>
              <select className="tmap-output__settings-bool"
                value={output.isReject ? 'true' : 'false'}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => { e.stopPropagation(); onUpdate({ ...output, isReject: e.target.value === 'true' }); }}>
                <option value="false">false</option>
                <option value="true">true</option>
              </select>
            </div>
            <div className="tmap-output__settings-row">
              <span className="tmap-output__settings-lbl">Catch lookup inner join reject</span>
              <select className="tmap-output__settings-bool"
                value={output.isInnerJoinReject ? 'true' : 'false'}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => { e.stopPropagation(); onUpdate({ ...output, isInnerJoinReject: e.target.value === 'true' }); }}>
                <option value="false">false</option>
                <option value="true">true</option>
              </select>
            </div>
          </div>

          {/* ── Expression filter row ── */}
          <div className="tmap-output__filter">
            <Filter size={11} className="tmap-output__filter-icon" />
            <input
              className="tmap-output__filter-input"
              value={output.filter || ''}
              placeholder="[Expression filter]"
              onChange={(e) => { e.stopPropagation(); onUpdate({ ...output, filter: e.target.value }); }}
              onClick={(e) => e.stopPropagation()}
            />
            <button className="tmap-output__expr-btn" title="Expression Builder"
              onClick={(e) => { e.stopPropagation(); setExprTarget({ idx: -1, isFilter: true }); }}>…</button>
          </div>

          {/* Expression | Column mapping table */}
          <table className="tmap-output__table">
            <thead>
              <tr><th>Expression</th><th>Column</th></tr>
            </thead>
            <tbody>
              {syncedMappings.map((m, idx) => (
                <tr key={m.column}>
                  <td className="tmap-output__expr-cell">
                    <input
                      className="tmap-output__expr-input"
                      value={m.expression}
                      placeholder=""
                      onChange={(e) => { e.stopPropagation(); updateMapping(idx, 'expression', e.target.value); }}
                      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); updateMapping(idx, 'expression', e.dataTransfer.getData('text/plain')); }}
                      onDragOver={(e) => e.preventDefault()}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button className="tmap-output__expr-btn" title="Expression Builder"
                      onClick={(e) => { e.stopPropagation(); setExprTarget({ idx }); }}>…</button>
                  </td>
                  <td className="tmap-output__col-cell">{m.column}</td>
                </tr>
              ))}
              {syncedMappings.length === 0 && (
                <tr><td colSpan={2} className="tmap-output__empty-row">Define columns in Schema Editor below</td></tr>
              )}
            </tbody>
          </table>
        </>
      )}

      {exprTarget !== null && (
        <ExpressionBuilder
          value={exprTarget.isFilter ? (output.filter || '') : (syncedMappings[exprTarget.idx]?.expression || '')}
          onChange={(val) => exprTarget.isFilter ? onUpdate({ ...output, filter: val }) : updateMapping(exprTarget.idx, 'expression', val)}
          onClose={() => setExprTarget(null)}
          inputTables={inputTables}
          variables={variables}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main Map Editor Dialog (Talend tMap layout)
   ═══════════════════════════════════════════════════════════════ */
export default function MapEditorDialog({
  componentLabel,
  nodeId,
  inputTables,
  outputSchema,
  mapConfig,
  onMapConfigChange,
  onOutputSchemaChange,
  onClose,
}) {
  const config = useMemo(
    () => mapConfig || { variables: [], outputs: [], lookupConfigs: {}, inputExpressions: {}, inputFilters: {} },
    [mapConfig]
  );
  const updateConfig = useCallback(
    (patch) => onMapConfigChange({ ...config, ...patch }),
    [config, onMapConfigChange]
  );

  /* ── Outputs (migrate old format) ── */
  const outputs = useMemo(() => {
    if (config.outputs && config.outputs.length > 0) return config.outputs;
    if (config.outputs && config.outputs.length === 0) return [];
    return [{
      name: 'out',
      schema: (outputSchema || []).map((c) => ({ ...c })),
      mappings: config.outputMappings || [],
      filter: config.outputFilter || '',
      isReject: false,
      isInnerJoinReject: false,
    }];
  }, [config.outputs, config.outputMappings, config.outputFilter, outputSchema]);

  const setOutputs = useCallback((outs) => updateConfig({ outputs: outs }), [updateConfig]);
  const updateOutput = (idx, val) => setOutputs(outputs.map((o, i) => (i === idx ? val : o)));
  const removeOutput = (idx) => setOutputs(outputs.filter((_, i) => i !== idx));
  const moveOutput = (idx, dir) => {
    const t = idx + dir;
    if (t < 0 || t >= outputs.length) return;
    const a = [...outputs];
    [a[idx], a[t]] = [a[t], a[idx]];
    setOutputs(a);
    setSelectedOutputIdx(t);
  };
  const addOutput = () => {
    const n = `out${outputs.length + 1}`;
    setOutputs([...outputs, { name: n, schema: [], mappings: [], filter: '', isReject: false, isInnerJoinReject: false }]);
  };

  /* ── Variables ── */
  const variables = config.variables || [];
  const setVariables = useCallback((vars) => updateConfig({ variables: vars }), [updateConfig]);
  const addVariable = () => setVariables([...variables, { name: `var${variables.length + 1}`, type: 'String', expression: '' }]);
  const updateVariable = (idx, field, val) => setVariables(variables.map((v, i) => (i === idx ? { ...v, [field]: val } : v)));
  const removeVariable = (idx) => setVariables(variables.filter((_, i) => i !== idx));
  const [varExprTarget, setVarExprTarget] = useState(null);

  /* ── Input expressions & filters ── */
  const inputExpressions = config.inputExpressions || {};
  const inputSchemaOverrides = config.inputSchemaOverrides || {};
  const updateInputExpr = useCallback(
    (tableName, colName, expr) => {
      const tbl = { ...(inputExpressions[tableName] || {}) };
      tbl[colName] = expr;
      updateConfig({ inputExpressions: { ...inputExpressions, [tableName]: tbl } });
    },
    [inputExpressions, updateConfig]
  );

  /* ── Lookup configs ── */
  const lookupConfigs = config.lookupConfigs || {};
  const updateLookup = useCallback(
    (tableName, patch) => {
      updateConfig({ lookupConfigs: { ...lookupConfigs, [tableName]: { ...(lookupConfigs[tableName] || {}), ...patch } } });
    },
    [lookupConfigs, updateConfig]
  );

  /* ── Input schema helpers (merged: source schema + overrides) ── */
  const getInputSchema = useCallback(
    (tableName) => {
      const base = inputTables?.find((t) => t.name === tableName)?.schema || [];
      const overrides = inputSchemaOverrides[tableName];
      return overrides || base;
    },
    [inputTables, inputSchemaOverrides]
  );
  const updateInputSchema = useCallback(
    (tableName, newSchema) => {
      updateConfig({ inputSchemaOverrides: { ...inputSchemaOverrides, [tableName]: newSchema } });
    },
    [inputSchemaOverrides, updateConfig]
  );
  const exportInputSchema = (tableName, e) => {
    e.stopPropagation();
    const schema = getInputSchema(tableName);
    navigator.clipboard.writeText(JSON.stringify(schema, null, 2)).catch(() => {});
  };
  const importInputSchema = (tableName, e) => {
    e.stopPropagation();
    const text = prompt('Paste schema JSON (array of {name, type, ...}):');
    if (!text) return;
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) updateInputSchema(tableName, parsed);
    } catch { /* ignore invalid JSON */ }
  };

  /* ── Bottom panel selection ── */
  const [selectedInput, setSelectedInput] = useState(() => inputTables?.[0]?.name || null);
  const [selectedOutput, setSelectedOutput] = useState(() => outputs[0]?.name || null);
  const [selectedOutputIdx, setSelectedOutputIdx] = useState(0);
  const [inputExprBuilderTarget, setInputExprBuilderTarget] = useState(null);

  // Keep component __schema in sync with the active/first map output so JSON export includes map-defined output schema.
  useEffect(() => {
    if (!onOutputSchemaChange) return;
    const active = outputs[selectedOutputIdx];
    const schema = active?.schema || outputs[0]?.schema || [];
    const currentOutputSchema = outputSchema || [];
    if (JSON.stringify(schema) === JSON.stringify(currentOutputSchema)) return;
    onOutputSchemaChange(schema);
  }, [outputs, selectedOutputIdx, outputSchema, onOutputSchemaChange]);

  const selectOutput = useCallback((name) => {
    setSelectedOutput(name);
    const idx = outputs.findIndex((o) => o.name === name);
    if (idx >= 0) setSelectedOutputIdx(idx);
  }, [outputs]);

  const updateOutputSchema = useCallback((outName, newSchema) => {
    setOutputs(outputs.map((o) => (o.name === outName ? { ...o, schema: newSchema } : o)));
  }, [outputs, setOutputs]);

  /* ── Auto-map: match input columns to output columns by name ── */
  const autoMap = useCallback(() => {
    const allInputCols = (inputTables || []).flatMap((tbl) => {
      const schema = getInputSchema(tbl.name);
      return schema.map((col) => ({ table: tbl.name, col: col.name }));
    });
    const newOutputs = outputs.map((out) => {
      const schema = out.schema || [];
      const existingMappings = out.mappings || [];
      const newMappings = schema.map((col) => {
        const existing = existingMappings.find((m) => m.column === col.name);
        if (existing && existing.expression) return existing;
        const match = allInputCols.find((ic) => ic.col.toLowerCase() === col.name.toLowerCase());
        if (match) return { column: col.name, type: col.type, expression: `${match.table}.${match.col}` };
        return existing || { column: col.name, type: col.type, expression: '' };
      });
      return { ...out, mappings: newMappings };
    });
    setOutputs(newOutputs);
  }, [outputs, inputTables, getInputSchema, setOutputs]);

  return (
    <div className="map-editor__overlay" onClick={onClose}>
      <div className="tmap" onClick={(e) => e.stopPropagation()}>

        {/* ── Top toolbar ── */}
        <div className="tmap__toolbar">
          <span className="tmap__title">{componentLabel} — {nodeId}</span>
          <div className="tmap__toolbar-right">
            <span className="tmap__find-label">Find&nbsp;:</span>
            <input className="tmap__find-input" placeholder="" />
            <button className="tmap__auto-map" title="Auto map!" onClick={autoMap}>Auto map!</button>
          </div>
        </div>

        {/* ── Main 3-column body ── */}
        <div className="tmap__body">

          {/* ═══ LEFT: Input Tables ═══ */}
          <div className="tmap__col tmap__col--left">
            {(inputTables || []).length === 0 && (
              <div className="tmap__empty">No inputs connected</div>
            )}
            {(inputTables || []).map((tbl) => {
              const isLookup = tbl.type === 'lookup';
              const lkCfg = lookupConfigs[tbl.name] || {};
              const tblExprs = inputExpressions[tbl.name] || {};

              return (
                <div key={tbl.name}
                  className={`tmap-input ${selectedInput === tbl.name ? 'tmap-input--selected' : ''}`}
                  onClick={() => setSelectedInput(tbl.name)}>

                  <div className="tmap-input__header">
                    <input className="tmap-input__name-input" value={tbl.name} readOnly title={tbl.name} />
                    <div className="tmap-input__icons">
                      <button className="tmap-output__tool-btn" onClick={(e) => importInputSchema(tbl.name, e)} title="Import schema"><Upload size={11} /></button>
                      <button className="tmap-output__tool-btn" onClick={(e) => exportInputSchema(tbl.name, e)} title="Export schema"><Download size={11} /></button>
                      <button className="tmap-output__tool-btn" onClick={(e) => { e.stopPropagation(); const s = getInputSchema(tbl.name); updateInputSchema(tbl.name, [...s, newSchemaCol(s.length)]); }} title="Add column"><Plus size={11} /></button>
                      {isLookup && <span className="tmap-input__badge" title="Lookup">LKP</span>}
                    </div>
                  </div>

                  {!isLookup && (
                    <div className="tmap-input__body">
                      <div className="tmap-input__col-hdr">Column</div>
                      {(getInputSchema(tbl.name)).map((col) => (
                        <div key={col.name} className="tmap-input__col-row" draggable
                          onDragStart={(e) => e.dataTransfer.setData('text/plain', `${tbl.name}.${col.name}`)}>
                          {col.name}
                        </div>
                      ))}
                      {(getInputSchema(tbl.name)).length === 0 && (
                        <div className="tmap-input__no-schema">No schema defined</div>
                      )}
                    </div>
                  )}

                  {isLookup && (
                    <div className="tmap-input__body">
                      {/* Property / Value table */}
                      <table className="tmap-input__prop-tbl">
                        <thead><tr><th>Property</th><th>Value</th></tr></thead>
                        <tbody>
                          <tr>
                            <td>Lookup Model</td>
                            <td>
                              <select className="tmap-input__sel" value={lkCfg.loadOnce ? 'load_once' : 'load_each'}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => updateLookup(tbl.name, { loadOnce: e.target.value === 'load_once' })}>
                                <option value="load_once">Load once</option>
                                <option value="load_each">Reload at each row</option>
                              </select>
                            </td>
                          </tr>
                          <tr className="tmap-input__row--hl">
                            <td>Match Model</td>
                            <td>
                              <select className="tmap-input__sel" value={lkCfg.matchModel || 'unique_match'}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => updateLookup(tbl.name, { matchModel: e.target.value })}>
                                <option value="unique_match">Unique match</option>
                                <option value="first_match">First match</option>
                                <option value="all_matches">All matches</option>
                                <option value="all_rows">All rows</option>
                              </select>
                            </td>
                          </tr>
                          <tr>
                            <td>Join Model</td>
                            <td>
                              <select className="tmap-input__sel" value={lkCfg.joinModel || 'left_outer'}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => updateLookup(tbl.name, { joinModel: e.target.value })}>
                                <option value="left_outer">Left Outer Join</option>
                                <option value="inner_join">Inner Join</option>
                              </select>
                            </td>
                          </tr>
                          <tr>
                            <td>Store temp data</td>
                            <td>
                              <select className="tmap-input__sel" value={lkCfg.storeTemp ? 'true' : 'false'}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => updateLookup(tbl.name, { storeTemp: e.target.value === 'true' })}>
                                <option value="false">false</option>
                                <option value="true">true</option>
                              </select>
                            </td>
                          </tr>
                        </tbody>
                      </table>

                      {/* Expr. key / Column */}
                      <table className="tmap-input__key-tbl">
                        <thead><tr><th>Expr. key</th><th>Column</th></tr></thead>
                        <tbody>
                          {(getInputSchema(tbl.name)).map((col) => {
                            const expr = tblExprs[col.name] || '';
                            return (
                              <tr key={col.name}>
                                <td className="tmap-input__key-cell">
                                  {expr && <KeyRound size={10} className="tmap-input__key-ico" />}
                                  <input
                                    className="tmap-input__key-inp"
                                    value={expr}
                                    placeholder=""
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => updateInputExpr(tbl.name, col.name, e.target.value)}
                                    onDrop={(e) => { e.preventDefault(); e.stopPropagation(); updateInputExpr(tbl.name, col.name, e.dataTransfer.getData('text/plain')); }}
                                    onDragOver={(e) => e.preventDefault()}
                                  />
                                  <button className="tmap-input__expr-btn" title="Expression Builder"
                                    onClick={(e) => { e.stopPropagation(); setInputExprBuilderTarget({ table: tbl.name, col: col.name }); }}>…</button>
                                </td>
                                <td className="tmap-input__colname" draggable
                                  onDragStart={(e) => e.dataTransfer.setData('text/plain', `${tbl.name}.${col.name}`)}>
                                  {col.name}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ═══ CENTER: Variables ═══ */}
          <div className="tmap__col tmap__col--center">
            <div className="tmap-var__header">
              <span>Var</span>
              <div className="tmap-var__icons">
                <button className="tmap-var__add" onClick={addVariable} title="Add variable"><Plus size={12} /></button>
              </div>
            </div>
            {variables.length > 0 ? (
              <table className="tmap-var__table">
                <thead><tr><th>Expression</th><th>Variable</th><th>Type</th><th></th></tr></thead>
                <tbody>
                  {variables.map((v, idx) => (
                    <tr key={idx}>
                      <td>
                        <input className="tmap-var__inp" value={v.expression} placeholder="row1.col"
                          onChange={(e) => updateVariable(idx, 'expression', e.target.value)}
                          onDrop={(e) => { e.preventDefault(); updateVariable(idx, 'expression', e.dataTransfer.getData('text/plain')); }}
                          onDragOver={(e) => e.preventDefault()} />
                      </td>
                      <td>
                        <input className="tmap-var__inp tmap-var__inp--name" value={v.name}
                          onChange={(e) => updateVariable(idx, 'name', e.target.value)} />
                      </td>
                      <td>
                        <select className="tmap-var__sel" value={v.type || 'String'}
                          onChange={(e) => updateVariable(idx, 'type', e.target.value)}>
                          {SCHEMA_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </td>
                      <td style={{ display: 'flex', gap: 2 }}>
                        <button className="tmap-var__expr-btn" title="Expression Builder"
                          onClick={() => setVarExprTarget(idx)}>…</button>
                        <button className="tmap-var__del" onClick={() => removeVariable(idx)}><Trash2 size={10} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </div>

          {/* ═══ RIGHT: Output Tables ═══ */}
          <div className="tmap__col tmap__col--right">
            <div className="tmap__output-bar">
              <button className="tmap__output-bar-btn" onClick={addOutput} title="Add output"><Plus size={13} /></button>
              <button className="tmap__output-bar-btn tmap__output-bar-btn--danger"
                onClick={() => {
                  if (outputs.length > 0) {
                    const newOutputs = outputs.filter((_, i) => i !== selectedOutputIdx);
                    setOutputs(newOutputs);
                    setSelectedOutputIdx(Math.max(0, Math.min(selectedOutputIdx, newOutputs.length - 1)));
                  }
                }}
                disabled={outputs.length === 0} title="Delete selected output"><X size={13} /></button>
              <button className="tmap__output-bar-btn"
                onClick={() => moveOutput(selectedOutputIdx, -1)}
                disabled={selectedOutputIdx <= 0} title="Move up"><ArrowUp size={13} /></button>
              <button className="tmap__output-bar-btn"
                onClick={() => moveOutput(selectedOutputIdx, 1)}
                disabled={selectedOutputIdx >= outputs.length - 1} title="Move down"><ArrowDown size={13} /></button>
              <button className="tmap__output-bar-btn" title="Columns"><Columns size={13} /></button>
            </div>
            {outputs.map((out, idx) => (
              <OutputTablePanel
                key={out.name + idx}
                output={out}
                onUpdate={(val) => updateOutput(idx, val)}
                onRemove={() => removeOutput(idx)}
                onMoveUp={idx > 0 ? () => moveOutput(idx, -1) : undefined}
                onMoveDown={idx < outputs.length - 1 ? () => moveOutput(idx, 1) : undefined}
                onSelect={() => { selectOutput(out.name); setSelectedOutputIdx(idx); }}
                isSelected={selectedOutputIdx === idx}
                inputTables={inputTables}
                variables={variables}
              />
            ))}
          </div>
        </div>

        {/* ── Bottom Schema Editor ── */}
        <BottomSchemaEditor
          selectedInput={selectedInput}
          selectedOutput={selectedOutput}
          inputTables={inputTables}
          outputs={outputs}
          onUpdateOutputSchema={updateOutputSchema}
          getInputSchema={getInputSchema}
          onUpdateInputSchema={updateInputSchema}
        />

        {/* ── Footer ── */}
        <div className="tmap__footer">
          <button className="tmap__btn tmap__btn--apply" onClick={onClose}>Apply</button>
          <button className="tmap__btn tmap__btn--ok" onClick={onClose}>Ok</button>
          <button className="tmap__btn tmap__btn--cancel" onClick={onClose}>Cancel</button>
        </div>
      </div>

      {/* Expression builder for input columns */}
      {inputExprBuilderTarget && (
        <ExpressionBuilder
          value={inputExpressions[inputExprBuilderTarget.table]?.[inputExprBuilderTarget.col] || ''}
          onChange={(val) => updateInputExpr(inputExprBuilderTarget.table, inputExprBuilderTarget.col, val)}
          onClose={() => setInputExprBuilderTarget(null)}
          inputTables={inputTables}
          variables={variables}
        />
      )}

      {/* Expression builder for variables */}
      {varExprTarget !== null && (
        <ExpressionBuilder
          value={variables[varExprTarget]?.expression || ''}
          onChange={(val) => updateVariable(varExprTarget, 'expression', val)}
          onClose={() => setVarExprTarget(null)}
          inputTables={inputTables}
          variables={variables}
        />
      )}
    </div>
  );
}
