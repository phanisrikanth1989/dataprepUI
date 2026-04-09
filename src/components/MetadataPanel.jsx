import { useState, useCallback, useMemo } from 'react';
import {
  Database,
  FileText,
  FileSpreadsheet,
  FileCode,
  FileJson,
  Globe,
  Table2,
  Server,
  Cloud,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Trash2,
  Copy,
  Edit3,
  AlignJustify,
} from 'lucide-react';
import { useDesigner } from '../context/DesignerContext';
import ContextMenu from './ContextMenu';
import MetadataDialog from './MetadataDialog';

const METADATA_CATEGORIES = [
  { key: 'Db Connections', label: 'Db Connections', icon: Database },
  { key: 'File Delimited', label: 'File Delimited', icon: FileText },
  { key: 'File XML', label: 'File XML', icon: FileCode },
  { key: 'File Excel', label: 'File Excel', icon: FileSpreadsheet },
  { key: 'File JSON', label: 'File JSON', icon: FileJson },
  { key: 'File Positional', label: 'File Positional', icon: AlignJustify },
  { key: 'File Regex', label: 'File Regex', icon: FileText },
  { key: 'Generic Schemas', label: 'Generic Schemas', icon: Table2 },
  { key: 'LDAP', label: 'LDAP', icon: Server },
  { key: 'Salesforce', label: 'Salesforce', icon: Cloud },
  { key: 'Web Service', label: 'Web Service', icon: Globe },
];

export default function MetadataPanel() {
  const {
    metadataRepo,
    createMetadataItem,
    updateMetadataItem,
    deleteMetadataItem,
    duplicateMetadataItem,
  } = useDesigner();

  const [expanded, setExpanded] = useState({});
  const [dialogItemId, setDialogItemId] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);

  const grouped = useMemo(() => {
    const groups = {};
    for (const item of metadataRepo) {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    }
    return groups;
  }, [metadataRepo]);

  const toggleCategory = (key) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCategoryContextMenu = useCallback((e, categoryKey) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'category', categoryKey });
  }, []);

  const handleItemContextMenu = useCallback((e, itemId, categoryKey) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'item', itemId, categoryKey });
  }, []);

  const contextMenuItems = useMemo(() => {
    if (!contextMenu) return [];

    if (contextMenu.type === 'category') {
      return [
        {
          label: `Create ${contextMenu.categoryKey}`,
          icon: <Edit3 size={12} />,
          onClick: () => {
            const id = createMetadataItem(contextMenu.categoryKey);
            setExpanded((prev) => ({ ...prev, [contextMenu.categoryKey]: true }));
            setDialogItemId(id);
          },
        },
      ];
    }

    return [
      {
        label: 'Edit',
        icon: <Edit3 size={12} />,
        onClick: () => setDialogItemId(contextMenu.itemId),
      },
      {
        label: 'Duplicate',
        icon: <Copy size={12} />,
        onClick: () => duplicateMetadataItem(contextMenu.itemId),
      },
      { separator: true },
      {
        label: 'Delete',
        icon: <Trash2 size={12} />,
        danger: true,
        onClick: () => {
          deleteMetadataItem(contextMenu.itemId);
        },
      },
    ];
  }, [contextMenu, createMetadataItem, duplicateMetadataItem, deleteMetadataItem]);

  const dialogItem = dialogItemId ? metadataRepo.find((m) => m.id === dialogItemId) : null;

  return (
    <div className="metadata-panel">
      <div className="metadata-header">
        <FolderOpen size={14} />
        <span>Metadata</span>
      </div>

      <div className="metadata-tree">
        {METADATA_CATEGORIES.map(({ key, label, icon: Icon }) => {
          const items = grouped[key] || [];
          const isOpen = expanded[key];

          return (
            <div key={key} className="meta-tree-cat">
              <div
                className="meta-tree-cat__header"
                onClick={() => toggleCategory(key)}
                onContextMenu={(e) => handleCategoryContextMenu(e, key)}
                title="Right-click to create new"
              >
                {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                <Icon size={13} />
                <span className="meta-tree-cat__label">{label}</span>
                {items.length > 0 && (
                  <span className="meta-tree-cat__count">{items.length}</span>
                )}
              </div>

              {isOpen && (
                <div className="meta-tree-cat__children">
                  {items.length === 0 ? (
                    <div className="meta-tree-empty">
                      Right-click to create
                    </div>
                  ) : (
                    items.map((item) => (
                      <div
                        key={item.id}
                        className={`meta-tree-item ${dialogItemId === item.id ? 'meta-tree-item--active' : ''}`}
                        onClick={() => setDialogItemId(item.id)}
                        onContextMenu={(e) => handleItemContextMenu(e, item.id, key)}
                        title="Click to edit · Right-click for options"
                      >
                        <span className="meta-tree-item__name">{item.name}</span>
                        <span className="meta-tree-item__date">{item.modified}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal dialog for editing */}
      {dialogItem && (
        <MetadataDialog
          item={dialogItem}
          onClose={() => setDialogItemId(null)}
          onSave={(key, value) => updateMetadataItem(dialogItem.id, key, value)}
          onDelete={(id) => { deleteMetadataItem(id); setDialogItemId(null); }}
        />
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
