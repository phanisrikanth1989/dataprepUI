import { useState, useRef, useMemo, useCallback } from 'react';
import {
  Layers,
  ChevronRight,
  ChevronDown,
  Workflow,
  Trash2,
  Eye,
  Box,
  Copy,
  Clipboard,
  FolderOpen,
  FolderPlus,
  Folder,
  Edit3,
  X,
  Upload,
  Download,
  Search,
  FileText,
} from 'lucide-react';
import { useDesigner } from '../context/DesignerContext';
import ContextMenu from './ContextMenu';
import GitHubJobDialog from './GitHubJobDialog';
import { exportJobAsPdf } from '../services/exportPdf';

export default function JobDesignerPanel() {
  const {
    nodes,
    edges,
    jobs,
    activeJobId,
    setActiveJobId,
    createJob,
    closeJob,
    renameJob,
    duplicateJob,
    selectedNodeId,
    setSelectedNodeId,
    deleteSelectedNode,
    clipboard,
    copyNodeToClipboard,
    pasteFromClipboard,
    importJobFromJson,
    exportJobAsJson,
    getExportJsonString,
    jobMetadata,
    dirtyJobIds,
    reactFlowWrapper,
    registry,
  } = useDesigner();

  const [expandedSections, setExpandedSections] = useState({
    jobs: true,
    components: true,
    connections: false,
  });

  const [contextMenu, setContextMenu] = useState(null);
  const [renamingJobId, setRenamingJobId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [githubDialog, setGithubDialog] = useState(null); // { mode: 'push' | 'pull', jobId? }
  const importFileRef = useRef(null);

  // ── Folder state ──
  const [folders, setFolders] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState({});
  const [renamingFolderId, setRenamingFolderId] = useState(null);
  const [renameFolderValue, setRenameFolderValue] = useState('');
  const [jobSearchTerm, setJobSearchTerm] = useState('');
  // ── Create Job dialog ──
  const [createJobDialog, setCreateJobDialog] = useState(null); // null or { folderId?: string }
  const [newJobName, setNewJobName] = useState('');
  const [newJobDesc, setNewJobDesc] = useState('');

  const toggleSection = (key) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleImportJob = () => importFileRef.current?.click();
  const handleImportFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        importJobFromJson(ev.target.result);
      } catch (err) {
        alert('Invalid job JSON file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Group nodes by category
  const grouped = useMemo(() => {
    const groups = {};
    for (const node of nodes) {
      const cat = node.data.category || 'Other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(node);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [nodes]);

  // ── Job tree context menus ─────────────────────────
  const handleJobsHeaderContextMenu = useCallback((e) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'jobsHeader' });
  }, []);

  const handleJobContextMenu = useCallback((e, jobId) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'job', jobId });
  }, []);

  const handleFolderContextMenu = useCallback((e, folderId) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'folder', folderId });
  }, []);

  const handleNodeContextMenu = useCallback((e, nodeId) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'node', nodeId });
  }, []);

  const handleNewJob = useCallback(() => {
    setNewJobName(`New_Job_${jobs.length + 1}`);
    setNewJobDesc('');
    setCreateJobDialog({});
  }, [jobs.length]);

  const handleNewFolder = useCallback(() => {
    const count = folders.length + 1;
    const id = `folder_${Date.now()}`;
    setFolders((prev) => [...prev, { id, name: `New_Folder_${count}`, jobIds: [] }]);
    setExpandedFolders((prev) => ({ ...prev, [id]: true }));
  }, [folders.length]);

  const handleNewJobInFolder = useCallback((folderId) => {
    setNewJobName(`New_Job_${jobs.length + 1}`);
    setNewJobDesc('');
    setCreateJobDialog({ folderId });
  }, [jobs.length]);

  const commitCreateJob = useCallback(() => {
    if (!newJobName.trim()) return;
    const jobId = createJob(newJobName.trim(), newJobDesc.trim());
    if (createJobDialog?.folderId) {
      setFolders((prev) =>
        prev.map((f) => f.id === createJobDialog.folderId ? { ...f, jobIds: [...f.jobIds, jobId] } : f)
      );
    }
    setCreateJobDialog(null);
    setNewJobName('');
    setNewJobDesc('');
  }, [newJobName, newJobDesc, createJob, createJobDialog]);

  const cancelCreateJob = useCallback(() => {
    setCreateJobDialog(null);
    setNewJobName('');
    setNewJobDesc('');
  }, []);

  const toggleFolder = useCallback((folderId) => {
    setExpandedFolders((prev) => ({ ...prev, [folderId]: !prev[folderId] }));
  }, []);

  const startRenameFolder = useCallback((folderId) => {
    const folder = folders.find((f) => f.id === folderId);
    if (!folder) return;
    setRenamingFolderId(folderId);
    setRenameFolderValue(folder.name);
  }, [folders]);

  const commitRenameFolder = useCallback(() => {
    if (renamingFolderId && renameFolderValue.trim()) {
      setFolders((prev) =>
        prev.map((f) => f.id === renamingFolderId ? { ...f, name: renameFolderValue.trim() } : f)
      );
    }
    setRenamingFolderId(null);
    setRenameFolderValue('');
  }, [renamingFolderId, renameFolderValue]);

  const deleteFolder = useCallback((folderId) => {
    setFolders((prev) => prev.filter((f) => f.id !== folderId));
  }, []);

  const startRename = useCallback((jobId) => {
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return;
    setRenamingJobId(jobId);
    setRenameValue(job.metadata.name);
  }, [jobs]);

  const commitRename = useCallback(() => {
    if (renamingJobId && renameValue.trim()) {
      renameJob(renamingJobId, renameValue.trim());
    }
    setRenamingJobId(null);
    setRenameValue('');
  }, [renamingJobId, renameValue, renameJob]);

  const contextMenuItems = useMemo(() => {
    if (!contextMenu) return [];

    if (contextMenu.type === 'jobsHeader') {
      return [
        {
          label: 'Create Job',
          icon: <Workflow size={12} />,
          onClick: handleNewJob,
        },
        {
          label: 'Create Folder',
          icon: <FolderPlus size={12} />,
          onClick: handleNewFolder,
        },
        { separator: true },
        {
          label: 'Import Job (JSON)',
          icon: <Upload size={12} />,
          onClick: handleImportJob,
        },
        {
          label: 'Import from GitHub',
          icon: <Download size={12} />,
          onClick: () => setGithubDialog({ mode: 'pull' }),
        },
      ];
    }

    if (contextMenu.type === 'folder') {
      return [
        {
          label: 'Create Job in Folder',
          icon: <Workflow size={12} />,
          onClick: () => handleNewJobInFolder(contextMenu.folderId),
        },
        {
          label: 'Rename Folder',
          icon: <Edit3 size={12} />,
          onClick: () => startRenameFolder(contextMenu.folderId),
        },
        { separator: true },
        {
          label: 'Delete Folder',
          icon: <Trash2 size={12} />,
          danger: true,
          onClick: () => deleteFolder(contextMenu.folderId),
        },
      ];
    }

    if (contextMenu.type === 'job') {
      return [
        {
          label: 'Open Job',
          icon: <FolderOpen size={12} />,
          onClick: () => setActiveJobId(contextMenu.jobId),
        },
        {
          label: 'Rename Job',
          icon: <Edit3 size={12} />,
          onClick: () => startRename(contextMenu.jobId),
        },
        {
          label: 'Duplicate Job',
          icon: <Copy size={12} />,
          onClick: () => duplicateJob(contextMenu.jobId),
        },
        { separator: true },
        {
          label: 'Export as JSON',
          icon: <Download size={12} />,
          onClick: () => {
            setActiveJobId(contextMenu.jobId);
            setTimeout(() => exportJobAsJson(), 0);
          },
        },
        {
          label: 'Export as PDF',
          icon: <FileText size={12} />,
          onClick: () => {
            const job = jobs.find((j) => j.id === contextMenu.jobId);
            if (!job) return;
            const canvasEl = reactFlowWrapper?.current?.querySelector('.react-flow__viewport');
            exportJobAsPdf({
              job: {
                nodes: job.nodes || [],
                edges: job.edges || [],
                nodeProperties: job.nodeProperties || {},
                metadata: job.metadata || {},
                contextVariables: job.contextVariables || [],
              },
              registry,
              canvasElement: contextMenu.jobId === activeJobId ? canvasEl : null,
            });
          },
        },
        {
          label: 'Import Job (JSON)',
          icon: <Upload size={12} />,
          onClick: handleImportJob,
        },
        { separator: true },
        {
          label: 'Push to GitHub',
          icon: <Upload size={12} />,
          onClick: () => {
            setActiveJobId(contextMenu.jobId);
            setGithubDialog({ mode: 'push', jobId: contextMenu.jobId });
          },
        },
        {
          label: 'Import from GitHub',
          icon: <Download size={12} />,
          onClick: () => setGithubDialog({ mode: 'pull' }),
        },
        { separator: true },
        {
          label: 'Create Job',
          icon: <Workflow size={12} />,
          onClick: handleNewJob,
        },
        {
          label: 'Create Folder',
          icon: <FolderPlus size={12} />,
          onClick: handleNewFolder,
        },
        { separator: true },
        {
          label: 'Delete Job',
          icon: <Trash2 size={12} />,
          danger: true,
          onClick: () => closeJob(contextMenu.jobId),
        },
      ];
    }

    if (contextMenu.type === 'node') {
      const otherJobs = jobs.filter((j) => j.id !== activeJobId);
      const items = [
        {
          label: 'Copy Component',
          icon: <Copy size={12} />,
          onClick: () => copyNodeToClipboard(contextMenu.nodeId),
          shortcut: 'Ctrl+C',
        },
      ];
      if (otherJobs.length > 0) {
        items.push({ separator: true });
        for (const job of otherJobs) {
          items.push({
            label: `Copy to "${job.metadata.name}"`,
            icon: <Clipboard size={12} />,
            onClick: () => {
              copyNodeToClipboard(contextMenu.nodeId);
              setTimeout(() => pasteFromClipboard(job.id), 0);
            },
          });
        }
      }
      items.push({ separator: true });
      items.push({
        label: 'Delete Component',
        icon: <Trash2 size={12} />,
        danger: true,
        onClick: () => {
          setSelectedNodeId(contextMenu.nodeId);
          setTimeout(() => deleteSelectedNode(), 0);
        },
      });
      return items;
    }

    return [];
  }, [contextMenu, jobs, activeJobId, handleNewJob, handleNewFolder, handleNewJobInFolder, startRename, startRenameFolder, deleteFolder, duplicateJob, closeJob, setActiveJobId, copyNodeToClipboard, pasteFromClipboard, setSelectedNodeId, deleteSelectedNode, exportJobAsJson, registry, reactFlowWrapper, handleImportJob]);

  return (
    <div className="job-designer-panel">
      {/* ── Job Designs tree ──────────────────────────── */}
      <div className="jdp-section">
        <div
          className="jdp-section__header"
          onClick={() => toggleSection('jobs')}
          onContextMenu={handleJobsHeaderContextMenu}
          title="Right-click to create a new job"
        >
          {expandedSections.jobs ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <FolderOpen size={13} />
          <span>Job Designer</span>
          <span className="jdp-badge">{jobs.length}</span>
          <button
            className="jdp-section__action"
            onClick={(e) => { e.stopPropagation(); handleImportJob(); }}
            title="Import Job from JSON file"
          >
            <Upload size={13} />
          </button>
          <input
            type="file"
            ref={importFileRef}
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleImportFileChange}
          />
        </div>

        {expandedSections.jobs && (
          <div className="jdp-section__body">
            {/* Job search */}
            <div className="jdp-search">
              <Search size={12} className="jdp-search__icon" />
              <input
                className="jdp-search__input"
                type="text"
                placeholder="Search jobs..."
                value={jobSearchTerm}
                onChange={(e) => setJobSearchTerm(e.target.value)}
              />
              {jobSearchTerm && (
                <button className="jdp-search__clear" onClick={() => setJobSearchTerm('')}>
                  <X size={11} />
                </button>
              )}
            </div>
            {/* Folders */}
            {folders.map((folder) => {
              const folderJobs = folder.jobIds
                .map((jid) => jobs.find((j) => j.id === jid))
                .filter(Boolean)
                .filter((job) => !jobSearchTerm.trim() || job.metadata.name.toLowerCase().includes(jobSearchTerm.toLowerCase()));
              if (jobSearchTerm.trim() && folderJobs.length === 0 && !folder.name.toLowerCase().includes(jobSearchTerm.toLowerCase())) return null;
              return (
                <div key={folder.id} className="jdp-folder">
                  <div
                    className="jdp-folder__header"
                    onClick={() => toggleFolder(folder.id)}
                    onContextMenu={(e) => handleFolderContextMenu(e, folder.id)}
                    onDoubleClick={() => startRenameFolder(folder.id)}
                    title="Right-click for options · Double-click to rename"
                  >
                    {expandedFolders[folder.id] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    {expandedFolders[folder.id] ? <FolderOpen size={12} /> : <Folder size={12} />}
                    {renamingFolderId === folder.id ? (
                      <input
                        className="jdp-job-rename"
                        value={renameFolderValue}
                        onChange={(e) => setRenameFolderValue(e.target.value)}
                        onBlur={commitRenameFolder}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRenameFolder();
                          if (e.key === 'Escape') { setRenamingFolderId(null); setRenameFolderValue(''); }
                        }}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="jdp-folder__name">{folder.name}</span>
                    )}
                    <span className="jdp-badge">{folderJobs.length}</span>
                  </div>
                  {expandedFolders[folder.id] && (
                    <div className="jdp-folder__body">
                      {folderJobs.map((job) => (
                        <div
                          key={job.id}
                          className={`jdp-job-item ${activeJobId === job.id ? 'jdp-job-item--active' : ''}`}
                          onClick={() => setActiveJobId(job.id)}
                          onContextMenu={(e) => handleJobContextMenu(e, job.id)}
                          onDoubleClick={() => startRename(job.id)}
                          title="Right-click for options · Double-click to rename"
                        >
                          <Workflow size={12} />
                          {renamingJobId === job.id ? (
                            <input
                              className="jdp-job-rename"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onBlur={commitRename}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') commitRename();
                                if (e.key === 'Escape') { setRenamingJobId(null); setRenameValue(''); }
                              }}
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <span className="jdp-job-item__name">
                              {dirtyJobIds.has(job.id) ? `*${job.metadata.name}` : job.metadata.name}
                            </span>
                          )}
                          <span className={`jdp-job-item__status jdp-job-item__status--${job.metadata.status}`}>
                            {job.metadata.status}
                          </span>
                        </div>
                      ))}
                      {folderJobs.length === 0 && (
                        <div className="jdp-empty-hint">Empty folder</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {/* Loose jobs (not in any folder) */}
            {jobs
              .filter((job) => !folders.some((f) => f.jobIds.includes(job.id)))
              .filter((job) => !jobSearchTerm.trim() || job.metadata.name.toLowerCase().includes(jobSearchTerm.toLowerCase()))
              .map((job) => (
              <div
                key={job.id}
                className={`jdp-job-item ${activeJobId === job.id ? 'jdp-job-item--active' : ''}`}
                onClick={() => setActiveJobId(job.id)}
                onContextMenu={(e) => handleJobContextMenu(e, job.id)}
                onDoubleClick={() => startRename(job.id)}
                title="Right-click for options · Double-click to rename"
              >
                <Workflow size={12} />
                {renamingJobId === job.id ? (
                  <input
                    className="jdp-job-rename"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename();
                      if (e.key === 'Escape') { setRenamingJobId(null); setRenameValue(''); }
                    }}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="jdp-job-item__name">
                    {dirtyJobIds.has(job.id) ? `*${job.metadata.name}` : job.metadata.name}
                  </span>
                )}
                <span className={`jdp-job-item__status jdp-job-item__status--${job.metadata.status}`}>
                  {job.metadata.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}

      {githubDialog && (
        <GitHubJobDialog
          mode={githubDialog.mode}
          onClose={() => setGithubDialog(null)}
          onImport={(json) => importJobFromJson(json)}
          pushJson={githubDialog.mode === 'push' ? getExportJsonString() : null}
          pushFileName={githubDialog.mode === 'push'
            ? `${jobMetadata.name || 'Job'}_${jobMetadata.version || '0.1'}.json`
            : null
          }
        />
      )}

      {/* Create Job Dialog */}
      {createJobDialog !== null && (
        <div className="dialog-overlay" onClick={cancelCreateJob}>
          <div className="create-job-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="create-job-dialog__header">
              <h3>Create New Job</h3>
              <button className="create-job-dialog__close" onClick={cancelCreateJob}>
                <X size={14} />
              </button>
            </div>
            <div className="create-job-dialog__body">
              <label className="create-job-dialog__label">
                Job Name <span className="create-job-dialog__required">*</span>
              </label>
              <input
                className="create-job-dialog__input"
                type="text"
                value={newJobName}
                onChange={(e) => setNewJobName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') commitCreateJob(); if (e.key === 'Escape') cancelCreateJob(); }}
                placeholder="Enter job name"
                autoFocus
              />
              <label className="create-job-dialog__label">Description</label>
              <textarea
                className="create-job-dialog__textarea"
                value={newJobDesc}
                onChange={(e) => setNewJobDesc(e.target.value)}
                placeholder="Enter job description (optional)"
                rows={3}
              />
            </div>
            <div className="create-job-dialog__footer">
              <button className="create-job-dialog__btn create-job-dialog__btn--cancel" onClick={cancelCreateJob}>
                Cancel
              </button>
              <button
                className="create-job-dialog__btn create-job-dialog__btn--create"
                onClick={commitCreateJob}
                disabled={!newJobName.trim()}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
