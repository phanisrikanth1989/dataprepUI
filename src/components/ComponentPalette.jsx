import { useState, useMemo } from 'react';
import {
  Search,
  ChevronRight,
  ChevronDown,
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
import { useDesigner } from '../context/DesignerContext';

/** Map icon string names from registry to Lucide components */
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

function getIcon(iconName) {
  return ICON_MAP[iconName] || Box;
}

/** Category color mapping */
const CATEGORY_COLORS = {
  'File / Input': '#4a90d9',
  'File / Output': '#e67e22',
  'File / Utility': '#8e44ad',
  'Database / Oracle': '#c0392b',
  'Database / MSSQL': '#2980b9',
  Transform: '#27ae60',
  'Transform / Code': '#16a085',
  Aggregate: '#f39c12',
  Control: '#e74c3c',
  Context: '#9b59b6',
  Iterate: '#1abc9c',
};

function getCategoryColor(category) {
  return CATEGORY_COLORS[category] || '#7f8c8d';
}

export default function ComponentPalette() {
  const { registry } = useDesigner();
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCategories, setExpandedCategories] = useState({});

  // Group components by category
  const grouped = useMemo(() => {
    const groups = {};
    for (const [key, comp] of Object.entries(registry)) {
      const cat = comp.category || 'Other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push({ key, ...comp });
    }
    // Sort categories
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [registry]);

  // Filter by search
  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return grouped;
    const term = searchTerm.toLowerCase();
    return grouped
      .map(([cat, comps]) => [
        cat,
        comps.filter(
          (c) =>
            c.label.toLowerCase().includes(term) ||
            c.key.toLowerCase().includes(term) ||
            cat.toLowerCase().includes(term)
        ),
      ])
      .filter(([, comps]) => comps.length > 0);
  }, [grouped, searchTerm]);

  const toggleCategory = (cat) => {
    setExpandedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const onDragStart = (event, componentType) => {
    event.dataTransfer.setData('application/talend-component', componentType);
    event.dataTransfer.effectAllowed = 'move';
  };

  // Expand all when searching
  const isExpanded = (cat) =>
    searchTerm.trim() ? true : expandedCategories[cat] !== false;

  return (
    <div className="component-palette">
      <div className="palette-header">
        <h3>Components</h3>
        <span className="component-count">
          {Object.keys(registry).length}
        </span>
      </div>

      <div className="palette-search">
        <Search size={14} className="search-icon" />
        <input
          type="text"
          placeholder="Search components..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="palette-list">
        {filtered.map(([category, components]) => (
          <div key={category} className="palette-category">
            <div
              className="category-header"
              onClick={() => toggleCategory(category)}
            >
              {isExpanded(category) ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )}
              <span
                className="category-dot"
                style={{ backgroundColor: getCategoryColor(category) }}
              />
              <span className="category-name">{category}</span>
              <span className="category-count">{components.length}</span>
            </div>

            {isExpanded(category) && (
              <div className="category-components">
                {components.map((comp) => {
                  const Icon = getIcon(comp.icon);
                  return (
                    <div
                      key={comp.key}
                      className="palette-item"
                      draggable
                      onDragStart={(e) => onDragStart(e, comp.key)}
                      title={comp.label}
                    >
                      <Icon
                        size={16}
                        style={{ color: getCategoryColor(category) }}
                      />
                      <span className="item-label">{comp.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="palette-empty">No components found</div>
        )}
      </div>
    </div>
  );
}
