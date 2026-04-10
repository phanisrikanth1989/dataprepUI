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
  GitBranch,
} from 'lucide-react';
import { useDesigner } from '../context/DesignerContext';
import ContextMenu from './ContextMenu';
import GitHubJobDialog from './GitHubJobDialog';

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
    getExportJsonString,
    jobMetadata,
    folders,
    createFolder,
    renameFolder,
    deleteFolder,
    addJobToFolder,
    removeJobFromFolder,
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
  const [renamingFolderId, setRenamingFolderId] = useState(null);
  const [folderRenameValue, setFolderRenameValue] = useState('');
  const [expandedFolders, setExpandedFolders] = useState({});
  const [importTargetFolderId, setImportTargetFolderId] = useState(null);
  const importFileRef = useRef(null);
  const folderImportFileRef = useRef(null);

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

  // Folder import handler — imports a job into a specific folder
  const handleFolderImportJob = useCallback((folderId) => {
    setImportTargetFolderId(folderId);
    folderImportFileRef.current?.click();
  }, []);

  const handleFolderImportFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const jsonStr = ev.target.result;
        const newJobId = importJobFromJson(jsonStr);
        if (importTargetFolderId && newJobId) {
          addJobToFolder(importTargetFolderId, newJobId);
        }
      } catch (err) {
        alert('Invalid job JSON file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
    setImportTargetFolderId(null);
  };

  const toggleFolder = useCallback((folderId) => {
    setExpandedFolders((prev) => ({ ...prev, [folderId]: !prev[folderId] }));
  }, []);

  const startFolderRename = useCallback((folderId) => {
    const folder = folders.find((f) => f.id === folderId);
    if (!folder) return;
    setRenamingFolderId(folderId);
    setFolderRenameValue(folder.name);
  }, [folders]);

  const commitFolderRename = useCallback(() => {
    if (renamingFolderId && folderRenameValue.trim()) {
      renameFolder(renamingFolderId, folderRenameValue.trim());
    }
    setRenamingFolderId(null);
    setFolderRenameValue('');
  }, [renamingFolderId, folderRenameValue, renameFolder]);

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

  const handleFolderContextMenu = useCallback((e, folderId) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'folder', folderId });
  }, []);

  const handleJobContextMenu = useCallback((e, jobId) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'job', jobId });
  }, []);

  const handleNodeContextMenu = useCallback((e, nodeId) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'node', nodeId });
  }, []);

  const handleNewJob = useCallback(() => {
    const count = jobs.length + 1;
    createJob(`New_Job_${count}`);
  }, [jobs.length, createJob]);

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
          onClick: () => {
            const id = createFolder('New Folder');
            setExpandedFolders((prev) => ({ ...prev, [id]: true }));
            setTimeout(() => startFolderRename(id), 50);
          },
        },
        { separator: true },
        {
          label: 'Import from GitHub',
          icon: <Download size={12} />,
          onClick: () => setGithubDialog({ mode: 'pull' }),
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
          label: 'Push to GitHub',
          icon: <Upload size={12} />,
          onClick: () => {
            // Switch to this job first so export captures it
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
        { separator: true },
        {
          label: 'Delete Job',
          icon: <Trash2 size={12} />,
          danger: true,
          onClick: () => closeJob(contextMenu.jobId),
        },
      ];
    }

    if (contextMenu.type === 'folder') {
      return [
        {
          label: 'Import Repository',
          icon: <GitBranch size={12} />,
          onClick: () => setGithubDialog({ mode: 'pull', targetFolderId: contextMenu.folderId }),
        },
        {
          label: 'Import Job',
          icon: <Upload size={12} />,
          onClick: () => handleFolderImportJob(contextMenu.folderId),
        },
        { separator: true },
        {
          label: 'Create Job in Folder',
          icon: <Workflow size={12} />,
          onClick: () => {
            const count = jobs.length + 1;
            const jobId = createJob(`New_Job_${count}`);
            addJobToFolder(contextMenu.folderId, jobId);
            setExpandedFolders((prev) => ({ ...prev, [contextMenu.folderId]: true }));
          },
        },
        {
          label: 'Rename Folder',
          icon: <Edit3 size={12} />,
          onClick: () => startFolderRename(contextMenu.folderId),
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
  }, [contextMenu, jobs, activeJobId, handleNewJob, startRename, duplicateJob, closeJob, setActiveJobId, copyNodeToClipboard, pasteFromClipboard, setSelectedNodeId, deleteSelectedNode, createFolder, startFolderRename, deleteFolder, handleFolderImportJob, createJob, addJobToFolder, folders]);

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
          <button
            className="jdp-section__action"
            onClick={(e) => {
              e.stopPropagation();
              const id = createFolder('New Folder');
              setExpandedFolders((prev) => ({ ...prev, [id]: true }));
              setTimeout(() => startFolderRename(id), 50);
            }}
            title="Create Folder"
          >
            <FolderPlus size={13} />
          </button>
          <input
            type="file"
            ref={importFileRef}
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleImportFileChange}
          />
          <input
            type="file"
            ref={folderImportFileRef}
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleFolderImportFileChange}
          />
        </div>

        {expandedSections.jobs && (
          <div className="jdp-section__body">
            {/* ── Folders ── */}
            {folders.map((folder) => {
              const isExpanded = expandedFolders[folder.id];
              const folderJobs = folder.jobIds
                .map((jid) => jobs.find((j) => j.id === jid))
                .filter(Boolean);
              return (
                <div key={folder.id} className="jdp-folder">
                  <div
                    className="jdp-folder__header"
                    onClick={() => toggleFolder(folder.id)}
                    onContextMenu={(e) => handleFolderContextMenu(e, folder.id)}
                    onDoubleClick={() => startFolderRename(folder.id)}
                    title="Right-click for Import Repository / Import Job"
                  >
                    {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    {isExpanded ? <FolderOpen size={12} /> : <Folder size={12} />}
                    {renamingFolderId === folder.id ? (
                      <input
                        className="jdp-job-rename"
                        value={folderRenameValue}
                        onChange={(e) => setFolderRenameValue(e.target.value)}
                        onBlur={commitFolderRename}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitFolderRename();
                          if (e.key === 'Escape') { setRenamingFolderId(null); setFolderRenameValue(''); }
                        }}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="jdp-folder__name">{folder.name}</span>
                    )}
                    <span className="jdp-badge">{folderJobs.length}</span>
                  </div>
                  {isExpanded && (
                    <div className="jdp-folder__body">
                      {folderJobs.map((job) => (
                        <div
                          key={job.id}
                          className={`jdp-job-item jdp-job-item--nested ${activeJobId === job.id ? 'jdp-job-item--active' : ''}`}
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
                            <span className="jdp-job-item__name">{job.metadata.name}</span>
                          )}
                          <span className={`jdp-job-item__status jdp-job-item__status--${job.metadata.status}`}>
                            {job.metadata.status}
                          </span>
                        </div>
                      ))}
                      {folderJobs.length === 0 && (
                        <div className="jdp-folder__empty">No jobs — right-click folder to import</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* ── Unfoldered jobs ── */}
            {(() => {
              const folderedJobIds = new Set(folders.flatMap((f) => f.jobIds));
              return jobs
                .filter((job) => !folderedJobIds.has(job.id))
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
                  <span className="jdp-job-item__name">{job.metadata.name}</span>
                )}
                <span className={`jdp-job-item__status jdp-job-item__status--${job.metadata.status}`}>
                  {job.metadata.status}
                </span>
              </div>
            ));
            })()}
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
          onImport={(json) => {
            const newJobId = importJobFromJson(json);
            if (githubDialog.targetFolderId && newJobId) {
              addJobToFolder(githubDialog.targetFolderId, newJobId);
            }
          }}
          pushJson={githubDialog.mode === 'push' ? getExportJsonString() : null}
          pushFileName={githubDialog.mode === 'push'
            ? `${jobMetadata.name || 'Job'}_${jobMetadata.version || '0.1'}.json`
            : null
          }
        />
      )}
    </div>
  );
}
