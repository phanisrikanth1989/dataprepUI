import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  X,
  Download,
  Upload,
  GitBranch,
  FolderOpen,
  FileJson,
  FileText,
  ChevronRight,
  ArrowLeft,
  Loader2,
  Check,
  AlertCircle,
  RefreshCw,
  Eye,
} from 'lucide-react';
import {
  validateToken,
  listRepos,
  listContents,
  getFileContent,
  listBranches,
  pushFile,
} from '../api/github';

const TOKEN_KEY = 'dataprep-github-token';

/**
 * Compact dialog for push/pull operations from Job Designer.
 * mode = 'push' | 'pull'
 */
export default function GitHubJobDialog({ mode, onClose, onImport, pushJson, pushFileName }) {
  const token = useMemo(() => {
    try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
  }, []);

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [authError, setAuthError] = useState('');

  // Repo state
  const [repos, setRepos] = useState([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('main');

  // Browser state (pull mode)
  const [currentPath, setCurrentPath] = useState('');
  const [contents, setContents] = useState([]);
  const [contentsLoading, setContentsLoading] = useState(false);
  const [previewContent, setPreviewContent] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Push state
  const [pushPath, setPushPath] = useState(pushFileName ? `jobs/${pushFileName}` : '');
  const [commitMsg, setCommitMsg] = useState('');
  const [pushLoading, setPushLoading] = useState(false);

  // Status
  const [status, setStatus] = useState(null);

  // Auto-validate stored token
  useEffect(() => {
    if (token) {
      setAuthLoading(true);
      validateToken(token)
        .then((u) => setUser(u))
        .catch(() => {})
        .finally(() => setAuthLoading(false));
    }
  }, [token]);

  // Load repos once authenticated
  useEffect(() => {
    if (!user) return;
    setReposLoading(true);
    const t = localStorage.getItem(TOKEN_KEY);
    listRepos(t, { perPage: 100 })
      .then(setRepos)
      .catch(() => {})
      .finally(() => setReposLoading(false));
  }, [user]);

  // Quick connect
  const handleConnect = useCallback(async () => {
    const t = tokenInput.trim();
    if (!t) return;
    setAuthLoading(true);
    setAuthError('');
    try {
      const u = await validateToken(t);
      setUser(u);
      try { localStorage.setItem(TOKEN_KEY, t); } catch { /* ignore */ }
    } catch {
      setAuthError('Invalid token');
    } finally {
      setAuthLoading(false);
    }
  }, [tokenInput]);

  // Select repo
  const handleSelectRepo = useCallback(async (repo) => {
    setSelectedRepo(repo);
    setCurrentPath('');
    setPreviewFile(null);
    setPreviewContent(null);
    const t = localStorage.getItem(TOKEN_KEY);
    try {
      const br = await listBranches(t, repo.owner.login, repo.name);
      setBranches(br.map((b) => b.name));
      const def = repo.default_branch || 'main';
      setSelectedBranch(def);
      if (mode === 'pull') {
        setContentsLoading(true);
        const data = await listContents(t, repo.owner.login, repo.name, '', def);
        setContents(Array.isArray(data) ? data : []);
        setContentsLoading(false);
      }
    } catch { /* ignore */ }
  }, [mode]);

  // Navigate folder (pull)
  const navigateTo = useCallback(async (path) => {
    setCurrentPath(path);
    setPreviewFile(null);
    setPreviewContent(null);
    setContentsLoading(true);
    const t = localStorage.getItem(TOKEN_KEY);
    try {
      const data = await listContents(t, selectedRepo.owner.login, selectedRepo.name, path, selectedBranch);
      setContents(Array.isArray(data) ? data : []);
    } catch { setContents([]); }
    finally { setContentsLoading(false); }
  }, [selectedRepo, selectedBranch]);

  // Change branch
  const handleBranchChange = useCallback(async (branch) => {
    setSelectedBranch(branch);
    if (mode === 'pull' && selectedRepo) {
      setContentsLoading(true);
      const t = localStorage.getItem(TOKEN_KEY);
      try {
        const data = await listContents(t, selectedRepo.owner.login, selectedRepo.name, currentPath, branch);
        setContents(Array.isArray(data) ? data : []);
      } catch { setContents([]); }
      finally { setContentsLoading(false); }
    }
  }, [mode, selectedRepo, currentPath]);

  // File click (pull)
  const handleFileClick = useCallback(async (item) => {
    if (item.type === 'dir') { navigateTo(item.path); return; }
    if (!item.name.endsWith('.json')) return;
    setPreviewFile(item);
    setPreviewLoading(true);
    const t = localStorage.getItem(TOKEN_KEY);
    try {
      const result = await getFileContent(t, selectedRepo.owner.login, selectedRepo.name, item.path, selectedBranch);
      setPreviewContent(result.content);
    } catch { setPreviewContent(null); }
    finally { setPreviewLoading(false); }
  }, [selectedRepo, selectedBranch, navigateTo]);

  // Import (pull)
  const handleImport = useCallback(() => {
    if (!previewContent) return;
    try {
      onImport(previewContent);
      onClose();
    } catch (err) {
      setStatus({ type: 'error', text: `Import failed: ${err.message}` });
    }
  }, [previewContent, onImport, onClose]);

  // Push
  const handlePush = useCallback(async () => {
    if (!selectedRepo || !pushJson) return;
    setPushLoading(true);
    setStatus(null);
    const t = localStorage.getItem(TOKEN_KEY);
    const filePath = pushPath.trim() || `jobs/${pushFileName || 'job.json'}`;
    const message = commitMsg.trim() || `Update ${filePath}`;
    try {
      let sha = null;
      try {
        const existing = await getFileContent(t, selectedRepo.owner.login, selectedRepo.name, filePath, selectedBranch);
        sha = existing.sha;
      } catch { /* new file */ }
      await pushFile(t, selectedRepo.owner.login, selectedRepo.name, filePath, pushJson, message, selectedBranch, sha);
      setStatus({ type: 'success', text: `Pushed to ${selectedRepo.full_name}/${filePath}` });
    } catch (err) {
      setStatus({ type: 'error', text: err.message });
    } finally {
      setPushLoading(false);
    }
  }, [selectedRepo, selectedBranch, pushPath, commitMsg, pushJson, pushFileName]);

  // Sorted contents
  const sortedContents = useMemo(() => {
    const dirs = contents.filter((c) => c.type === 'dir').sort((a, b) => a.name.localeCompare(b.name));
    const files = contents.filter((c) => c.type !== 'dir').sort((a, b) => a.name.localeCompare(b.name));
    return [...dirs, ...files];
  }, [contents]);

  const breadcrumbs = currentPath ? currentPath.split('/').filter(Boolean) : [];

  // Close on escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="ghd-overlay" onClick={onClose}>
      <div className="ghd-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="ghd-header">
          {mode === 'push' ? <Upload size={14} /> : <Download size={14} />}
          <span className="ghd-header__title">
            {mode === 'push' ? 'Push Job to GitHub' : 'Import Job from GitHub'}
          </span>
          <button className="ghd-close" onClick={onClose}><X size={14} /></button>
        </div>

        <div className="ghd-body">
          {/* Auth check */}
          {authLoading ? (
            <div className="github-loading"><Loader2 size={14} className="spin" /> Authenticating...</div>
          ) : !user ? (
            <div className="ghd-auth">
              <p className="ghd-auth__msg">Connect your GitHub account first.</p>
              <div className="github-token-input-row">
                <input
                  type="password"
                  className="github-input"
                  placeholder="ghp_xxxxxxxxxxxx"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
                />
                <button className="github-btn github-btn--primary" onClick={handleConnect} disabled={!tokenInput.trim()}>
                  Connect
                </button>
              </div>
              {authError && <div className="github-error"><AlertCircle size={11} /> {authError}</div>}
              <div className="github-hint">
                Or connect via the <strong>GitHub Repository</strong> tab in the sidebar, then come back here.
              </div>
            </div>
          ) : (
            <>
              {/* Repo + branch selectors */}
              <div className="ghd-row">
                <div className="ghd-field ghd-field--grow">
                  <label className="github-label">Repository</label>
                  <select
                    className="github-select"
                    value={selectedRepo?.full_name || ''}
                    onChange={(e) => {
                      const r = repos.find((r) => r.full_name === e.target.value);
                      if (r) handleSelectRepo(r);
                    }}
                  >
                    <option value="">Select repository...</option>
                    {repos.map((r) => (
                      <option key={r.id} value={r.full_name}>{r.full_name}</option>
                    ))}
                  </select>
                </div>
                {branches.length > 0 && (
                  <div className="ghd-field">
                    <label className="github-label"><GitBranch size={11} /> Branch</label>
                    <select
                      className="github-select"
                      value={selectedBranch}
                      onChange={(e) => handleBranchChange(e.target.value)}
                    >
                      {branches.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* ─── PULL MODE: file browser ─── */}
              {mode === 'pull' && selectedRepo && (
                <div className="ghd-browser">
                  {/* Breadcrumbs */}
                  <div className="github-breadcrumbs">
                    <span className="github-breadcrumb--link" onClick={() => navigateTo('')}>
                      {selectedRepo.name}
                    </span>
                    {breadcrumbs.map((part, i) => (
                      <span key={i}>
                        <span className="github-breadcrumb__sep">/</span>
                        <span
                          className="github-breadcrumb--link"
                          onClick={() => navigateTo(breadcrumbs.slice(0, i + 1).join('/'))}
                        >
                          {part}
                        </span>
                      </span>
                    ))}
                  </div>

                  {currentPath && (
                    <div
                      className="github-file-item github-file-item--back"
                      onClick={() => {
                        const parts = currentPath.split('/').filter(Boolean);
                        parts.pop();
                        navigateTo(parts.join('/'));
                      }}
                    >
                      <ArrowLeft size={12} /> <span>..</span>
                    </div>
                  )}

                  {contentsLoading ? (
                    <div className="github-loading"><Loader2 size={14} className="spin" /> Loading...</div>
                  ) : (
                    <div className="ghd-file-list">
                      {sortedContents.map((item) => (
                        <div
                          key={item.sha || item.name}
                          className={`github-file-item ${item.type === 'dir' ? 'github-file-item--dir' : ''} ${item.name.endsWith('.json') ? 'github-file-item--json' : ''} ${previewFile?.path === item.path ? 'github-file-item--active' : ''}`}
                          onClick={() => handleFileClick(item)}
                        >
                          {item.type === 'dir' ? <FolderOpen size={12} /> : item.name.endsWith('.json') ? <FileJson size={12} /> : <FileText size={12} />}
                          <span className="github-file-name">{item.name}</span>
                          {item.type !== 'dir' && item.name.endsWith('.json') && (
                            <Eye size={11} className="github-file-peek" />
                          )}
                        </div>
                      ))}
                      {sortedContents.length === 0 && (
                        <div className="github-empty">No files here</div>
                      )}
                    </div>
                  )}

                  {/* Preview */}
                  {previewFile && (
                    <div className="ghd-preview">
                      <div className="github-preview__header">
                        <FileJson size={12} />
                        <span className="github-preview__name">{previewFile.name}</span>
                      </div>
                      {previewLoading ? (
                        <div className="github-loading"><Loader2 size={14} className="spin" /></div>
                      ) : previewContent ? (
                        <pre className="github-preview__code">{previewContent.slice(0, 1500)}{previewContent.length > 1500 ? '\n...' : ''}</pre>
                      ) : (
                        <div className="github-empty">Could not load</div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ─── PUSH MODE: path + commit ─── */}
              {mode === 'push' && selectedRepo && (
                <div className="ghd-push-form">
                  <div className="github-field">
                    <label className="github-label">File Path in Repository</label>
                    <input
                      className="github-input"
                      placeholder="jobs/MyJob_0.1.json"
                      value={pushPath}
                      onChange={(e) => setPushPath(e.target.value)}
                    />
                  </div>
                  <div className="github-field">
                    <label className="github-label">Commit Message</label>
                    <input
                      className="github-input"
                      placeholder="Update job definition"
                      value={commitMsg}
                      onChange={(e) => setCommitMsg(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* Status */}
          {status && (
            <div className={`github-push-status github-push-status--${status.type}`}>
              {status.type === 'success' ? <Check size={11} /> : <AlertCircle size={11} />}
              {status.text}
            </div>
          )}
        </div>

        {/* Footer */}
        {user && selectedRepo && (
          <div className="ghd-footer">
            <button className="github-btn" onClick={onClose}>Cancel</button>
            {mode === 'pull' ? (
              <button
                className="github-btn github-btn--primary"
                onClick={handleImport}
                disabled={!previewContent}
              >
                <Download size={12} /> Import Job
              </button>
            ) : (
              <button
                className="github-btn github-btn--primary"
                onClick={handlePush}
                disabled={pushLoading || !pushPath.trim()}
              >
                {pushLoading ? <><Loader2 size={12} className="spin" /> Pushing...</> : <><Upload size={12} /> Push</>}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
