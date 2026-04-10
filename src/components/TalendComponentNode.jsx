import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import {
  FileText,
  FileSpreadsheet,
  FileJson,
  FileCode,
  FileType,
  FileInput,
  FileOutput,
  Database,
  Filter,
  GitMerge,
  ArrowDownUp,
  Copy,
  Trash2,
  FolderArchive,
  List,
  Hash,
  Play,
  Square,
  RotateCcw,
  Repeat,
  Mail,
  Map,
  Columns,
  Shuffle,
  SplitSquareVertical,
  Table,
  Code,
  Rows3 as Rows,
  Replace,
  Settings,
  Layers,
  Zap,
  Box,
  Component,
} from 'lucide-react';

const ICON_MAP = {
  'file-text': FileText,
  'file-spreadsheet': FileSpreadsheet,
  'file-json': FileJson,
  'file-code': FileCode,
  'file-type': FileType,
  'file-input': FileInput,
  'file-output': FileOutput,
  database: Database,
  filter: Filter,
  'git-merge': GitMerge,
  'arrow-down-up': ArrowDownUp,
  copy: Copy,
  trash: Trash2,
  'folder-archive': FolderArchive,
  list: List,
  hash: Hash,
  play: Play,
  square: Square,
  'rotate-ccw': RotateCcw,
  repeat: Repeat,
  mail: Mail,
  map: Map,
  columns: Columns,
  shuffle: Shuffle,
  split: SplitSquareVertical,
  table: Table,
  code: Code,
  rows: Rows,
  replace: Replace,
  settings: Settings,
  layers: Layers,
  zap: Zap,
  box: Box,
  component: Component,
};

const CATEGORY_COLORS = {
  File: '#4a90d9',
  Database: '#c0392b',
  Transform: '#27ae60',
  Aggregate: '#f39c12',
  Control: '#e74c3c',
  Context: '#9b59b6',
};

function TalendComponentNode({ data, selected }) {
  const { label, icon, category, connectors } = data;
  const Icon = ICON_MAP[icon] || Box;
  const color = CATEGORY_COLORS[category] || '#7f8c8d';
  const inputs = connectors?.inputs || [];
  const outputs = connectors?.outputs || [];

  return (
    <div
      className={`talend-node ${selected ? 'talend-node--selected' : ''}`}
      style={{ '--node-color': color }}
    >
      {/* Input handles */}
      {inputs.length > 0
        ? inputs.map((inp, i) => (
            <Handle
              key={`in-${inp.name}`}
              type="target"
              position={Position.Left}
              id={`in-${inp.name}`}
              style={{
                top: `${((i + 1) * 100) / (inputs.length + 1)}%`,
                background: '#4a90d9',
                width: 10,
                height: 10,
                border: '2px solid #fff',
              }}
              title={inp.label}
            />
          ))
        : (
          <Handle
            type="target"
            position={Position.Left}
            id="in-default"
            style={{
              top: '50%',
              background: '#4a90d9',
              width: 10,
              height: 10,
              border: '2px solid #fff',
            }}
          />
        )}

      {/* Trigger input (top) */}
      {connectors?.triggers?.incoming?.length > 0 && (
        <Handle
          type="target"
          position={Position.Top}
          id="trigger-in"
          style={{
            background: '#e74c3c',
            width: 8,
            height: 8,
            border: '2px solid #fff',
          }}
          title="Trigger In"
        />
      )}

      {/* Node body */}
      <div className="talend-node__body">
        <div className="talend-node__icon" style={{ backgroundColor: color }}>
          <Icon size={18} color="#fff" />
        </div>
        <div className="talend-node__info">
          <div className="talend-node__label">{label}</div>
          <div className="talend-node__type">{category}</div>
        </div>
      </div>

      {/* Connector badges */}
      <div className="talend-node__ports">
        {outputs.map((out) => (
          <span
            key={out.name}
            className="port-badge"
            style={{
              backgroundColor:
                out.type === 'reject'
                  ? '#e74c3c'
                  : out.type === 'lookup'
                  ? '#f39c12'
                  : color,
            }}
          >
            {out.label}
          </span>
        ))}
      </div>

      {/* Output handles */}
      {outputs.length > 0
        ? outputs.map((out, i) => (
            <Handle
              key={`out-${out.name}`}
              type="source"
              position={Position.Right}
              id={`out-${out.name}`}
              style={{
                top: `${((i + 1) * 100) / (outputs.length + 1)}%`,
                background:
                  out.type === 'reject'
                    ? '#e74c3c'
                    : out.type === 'lookup'
                    ? '#f39c12'
                    : color,
                width: 10,
                height: 10,
                border: '2px solid #fff',
              }}
              title={out.label}
            />
          ))
        : (
          <Handle
            type="source"
            position={Position.Right}
            id="out-default"
            style={{
              top: '50%',
              background: color,
              width: 10,
              height: 10,
              border: '2px solid #fff',
            }}
          />
        )}

      {/* Trigger output (bottom) */}
      {connectors?.triggers?.outgoing?.length > 0 && (
        <Handle
          type="source"
          position={Position.Bottom}
          id="trigger-out"
          style={{
            background: '#e74c3c',
            width: 8,
            height: 8,
            border: '2px solid #fff',
          }}
          title="Trigger Out"
        />
      )}
    </div>
  );
}

export default memo(TalendComponentNode);
