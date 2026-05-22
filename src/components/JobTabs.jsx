import { useState, useCallback } from 'react';
import { X, Copy, Edit3, Trash2, FileCode, Code2 } from 'lucide-react';
import { useDesigner } from '../context/DesignerContext';
import ContextMenu from './ContextMenu';

export default function JobTabs() {
  const {
    jobs,
    activeJobId,
    setActiveJobId,
    closeJob,
    renameJob,
    duplicateJob,
    dirtyJobIds,
    openRoutineTabs,
    activeRoutineFilename,
    setActiveRoutineFilename,
    closeRoutineTab,
  } = useDesigner();

  const [contextMenu, setContextMenu] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  const handleContextMenu = useCallback((e, jobId) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, jobId });
  }, []);

  const startRename = useCallback((jobId) => {
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return;
    setRenamingId(jobId);
    setRenameValue(job.metadata.name);
  }, [jobs]);

  const commitRename = useCallback(() => {
    if (renamingId && renameValue.trim()) {
      renameJob(renamingId, renameValue.trim());
    }
    setRenamingId(null);
    setRenameValue('');
  }, [renamingId, renameValue, renameJob]);

  const contextMenuItems = contextMenu
    ? [
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
          label: 'Delete Job',
          icon: <Trash2 size={12} />,
          danger: true,
          onClick: () => closeJob(contextMenu.jobId),
        },
      ]
    : [];

  return (
    <div className="job-tabs">
      <div className="job-tabs__list">
        {jobs.map((job) => (
          <div
            key={job.id}
            className={`job-tab ${activeJobId === job.id && !activeRoutineFilename ? 'job-tab--active' : ''}`}
            onClick={() => { setActiveJobId(job.id); setActiveRoutineFilename(null); }}
            onContextMenu={(e) => handleContextMenu(e, job.id)}
            title={`${job.metadata.name} (right-click for options)`}
          >
            {renamingId === job.id ? (
              <input
                className="job-tab__rename"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') { setRenamingId(null); setRenameValue(''); }
                }}
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="job-tab__name">
                {dirtyJobIds.has(job.id) ? `*${job.metadata.name}` : job.metadata.name}
              </span>
            )}
            {!dirtyJobIds.has(job.id) && (
              <span className="job-tab__status">{job.metadata.status}</span>
            )}
            <button
              className="job-tab__close"
              onClick={(e) => {
                e.stopPropagation();
                closeJob(job.id);
              }}
              title="Delete job"
            >
              <X size={12} />
            </button>
          </div>
        ))}

        {/* Routine tabs */}
        {openRoutineTabs.map((tab) => (
          <div
            key={tab.filename}
            className={`job-tab job-tab--routine ${activeRoutineFilename === tab.filename ? 'job-tab--active' : ''}`}
            onClick={() => setActiveRoutineFilename(tab.filename)}
            title={tab.filename}
          >
            <FileCode size={12} style={{ flexShrink: 0, opacity: 0.7, color: tab.language === 'python' ? '#3b82f6' : '#f5a623' }} />
            <span className="job-tab__name">
              {tab.dirty ? `*${tab.name}` : tab.name}
            </span>
            <button
              className="job-tab__close"
              onClick={(e) => { e.stopPropagation(); closeRoutineTab(tab.filename); }}
              title="Close"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>

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
