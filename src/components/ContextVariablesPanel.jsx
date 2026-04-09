import { useDesigner } from '../context/DesignerContext';
import { Trash2, Plus } from 'lucide-react';

const VAR_TYPES = ['String', 'Integer', 'Long', 'Float', 'Double', 'Boolean', 'Date', 'Object'];

export default function ContextVariablesPanel() {
  const {
    contextVariables,
    addContextVariable,
    updateContextVariable,
    removeContextVariable,
  } = useDesigner();

  return (
    <div className="ctx-vars">
      <div className="ctx-vars__table-wrap">
        <table className="ctx-vars__table">
          <thead>
            <tr>
              <th>Variable Name</th>
              <th>Type</th>
              <th>Value</th>
              <th>Comment</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {contextVariables.length === 0 ? (
              <tr>
                <td colSpan={5} className="ctx-vars__empty">No context variables defined</td>
              </tr>
            ) : (
              contextVariables.map((v, i) => (
                <tr key={i}>
                  <td>
                    <input
                      className="ctx-vars__input"
                      value={v.name}
                      placeholder="variable_name"
                      onChange={(e) => updateContextVariable(i, 'name', e.target.value)}
                    />
                  </td>
                  <td>
                    <select
                      className="ctx-vars__select"
                      value={v.type}
                      onChange={(e) => updateContextVariable(i, 'type', e.target.value)}
                    >
                      {VAR_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </td>
                  <td>
                    <input
                      className="ctx-vars__input"
                      value={v.value}
                      placeholder=""
                      onChange={(e) => updateContextVariable(i, 'value', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      className="ctx-vars__input"
                      value={v.comment || ''}
                      placeholder=""
                      onChange={(e) => updateContextVariable(i, 'comment', e.target.value)}
                    />
                  </td>
                  <td>
                    <button className="ctx-vars__remove" onClick={() => removeContextVariable(i)} title="Remove">
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <button className="ctx-vars__add" onClick={addContextVariable}>
        <Plus size={12} />
        Add Variable
      </button>
    </div>
  );
}
