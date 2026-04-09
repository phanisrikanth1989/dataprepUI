import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Github,
  Key,
  ChevronRight,
  ChevronDown,
  FolderOpen,
  FileJson,
  FileText,
  GitBranch,
  Download,
  Upload,
  RefreshCw,
  Check,
  X,
  AlertCircle,
  Loader2,
  Eye,
  ArrowLeft,
} from 'lucide-react';
import { useDesigner } from '../context/DesignerContext';
import {
  validateToken,
  listRepos,
  listContents,
  getFileContent,
  listBranches,
  pushFile,
} from '../api/github';

const TOKEN_KEY = 'dataprep-github-token';

export default function GitHubPanel() {
  const { importJobFromJson, getExportJsonString, jobMetadata } = useDesigner();

  // ── Auth state ──
  const [token, setToken] = useState(() => {
    try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
  });
  const [tokenInput, setTokenInput] = useState('');
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // ── Repo browser state ──
  const [repos, setRepos] = useState([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('main');
  const [currentPath, setCurrentPath] = useState('');
  const [contents, setContents] = useState([]);
  const [contentsLoading, setContentsLoading] = useState(false);

  // ── File preview state ──
  const [previewFile, setPreviewFile] = useState(null);
  const [previewContent, setPreviewContent] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // ── Push state ──
  const [pushMessage, setPushMessage] = useState('');
  const [pushPath, setPushPath] = useState('');
  const [pushLoading, setPushLoading] = useState(false);
  const [pushStatus, setPushStatus] = useState(null);

  // ── Section expand state ──
  const [expandedSections, setExpandedSections] = useState({
    settings: !token,
    browser: true,
    push: false,
  });

  // ── Status messages ──
  const [statusMsg, setStatusMsg] = useState(null);

  const toggleSection = (key) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // ── Auto-validate stored token on mount ──
  useEffect(() => {
    if (token && !user) {
      setAuthLoading(true);
      validateToken(token)
        .then((u) => {
          setUser(u);
          setTokenInput('');
        })
        .catch(() => {
          setToken('');
          try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
        })
        .finally(() => setAuthLoading(false));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Connect handler ──
  const handleConnect = useCallback(async () => {
    const t = tokenInput.trim();
    if (!t) return;
    setAuthLoading(true);
    setAuthError('');
    try {
      const u = await validateToken(t);
      setUser(u);
      setToken(t);
      setTokenInput('');
      try { localStorage.setItem(TOKEN_KEY, t); } catch { /* ignore */ }
      setExpandedSections((prev) => ({ ...prev, settings: false, browser: true }));
    } catch {
      setAuthError('Invalid token. Check your PAT and try again.');
    } finally {
      setAuthLoading(false);
    }
  }, [tokenInput]);

  // ── Disconnect handler ──
  const handleDisconnect = useCallback(() => {
    setToken('');
    setUser(null);
    setRepos([]);
    setSelectedRepo(null);
    setBranches([]);
    setContents([]);
    setPreviewFile(null);
    setPreviewContent(null);
    try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
    setExpandedSections((prev) => ({ ...prev, settings: true }));
  }, []);

  // ── Load repos ──
  const loadRepos = useCallback(async () => {
    if (!token) return;
    setReposLoading(true);
    try {
      const data = await listRepos(token, { perPage: 100 });
      setRepos(data);
    } catch {
      setStatusMsg({ type: 'error', text: 'Failed to load repositories' });
    } finally {
      setReposLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (user && token) loadRepos();
  }, [user, token, loadRepos]);

  // ── Select repo ──
  const handleSelectRepo = useCallback(async (repo) => {
    setSelectedRepo(repo);
    setCurrentPath('');
    setPreviewFile(null);
    setPreviewContent(null);
    setContentsLoading(true);
    try {
      const br = await listBranches(token, repo.owner.login, repo.name);
      setBranches(br.map((b) => b.name));
      const defaultBranch = repo.default_branch || 'main';
      setSelectedBranch(defaultBranch);
      const data = await listContents(token, repo.owner.login, repo.name, '', defaultBranch);
      setContents(Array.isArray(data) ? data : []);
    } catch {
      setContents([]);
    } finally {
      setContentsLoading(false);
    }
  }, [token]);

  // ── Navigate to folder ──
  const navigateTo = useCallback(async (path) => {
    if (!selectedRepo) return;
    setCurrentPath(path);
    setPreviewFile(null);
    setPreviewContent(null);
    setContentsLoading(true);
    try {
      const data = await listContents(token, selectedRepo.owner.login, selectedRepo.name, path, selectedBranch);
      setContents(Array.isArray(data) ? data : []);
    } catch {
      setContents([]);
    } finally {
      setContentsLoading(false);
    }
  }, [token, selectedRepo, selectedBranch]);

  // ── Change branch ──
  const handleBranchChange = useCallback(async (branch) => {
    setSelectedBranch(branch);
    setPreviewFile(null);
    setPreviewContent(null);
    setContentsLoading(true);
    try {
      const data = await listContents(token, selectedRepo.owner.login, selectedRepo.name, currentPath, branch);
      setContents(Array.isArray(data) ? data : []);
    } catch {
      setContents([]);
    } finally {
      setContentsLoading(false);
    }
  }, [token, selectedRepo, currentPath]);

  // ── Preview / import file ──
  const handleFileClick = useCallback(async (item) => {
    if (item.type === 'dir') {
      navigateTo(item.path);
      return;
    }
    if (!item.name.endsWith('.json')) return;
    setPreviewFile(item);
    setPreviewLoading(true);
    try {
      const result = await getFileContent(token, selectedRepo.owner.login, selectedRepo.name, item.path, selectedBranch);
      setPreviewContent(result.content);
    } catch {
      setPreviewContent(null);
      setStatusMsg({ type: 'error', text: 'Failed to load file' });
    } finally {
      setPreviewLoading(false);
    }
  }, [token, selectedRepo, selectedBranch, navigateTo]);

  // ── Import job ──
  const handleImport = useCallback(() => {
    if (!previewContent) return;
    try {
      importJobFromJson(previewContent);
      setStatusMsg({ type: 'success', text: `Imported "${previewFile?.name}" successfully` });
      setPreviewFile(null);
      setPreviewContent(null);
    } catch (err) {
      setStatusMsg({ type: 'error', text: `Import failed: ${err.message}` });
    }
  }, [previewContent, previewFile, importJobFromJson]);

  // ── Push current job ──
  const handlePush = useCallback(async () => {
    if (!selectedRepo || !token) return;
    setPushLoading(true);
    setPushStatus(null);
    try {
      const jsonStr = getExportJsonString();
      if (!jsonStr) throw new Error('No active job to push');

      const filePath = pushPath.trim() || `jobs/${jobMetadata.name || 'Untitled'}_${jobMetadata.version || '0.1'}.json`;
      const message = pushMessage.trim() || `Update ${filePath}`;

      // Check if file exists (to get SHA for update)
      let sha = null;
      try {
        const existing = await getFileContent(token, selectedRepo.owner.login, selectedRepo.name, filePath, selectedBranch);
        sha = existing.sha;
      } catch { /* file doesn't exist yet, create new */ }

      await pushFile(token, selectedRepo.owner.login, selectedRepo.name, filePath, jsonStr, message, selectedBranch, sha);
      setPushStatus({ type: 'success', text: `Pushed to ${filePath}` });
      setPushMessage('');
    } catch (err) {
      setPushStatus({ type: 'error', text: err.message });
    } finally {
      setPushLoading(false);
    }
  }, [selectedRepo, token, selectedBranch, pushPath, pushMessage, getExportJsonString, jobMetadata]);

  // Auto-clear status messages
  useEffect(() => {
    if (statusMsg) {
      const t = setTimeout(() => setStatusMsg(null), 4000);
      return () => clearTimeout(t);
    }
  }, [statusMsg]);

  // ── Sorted contents ──
  const sortedContents = useMemo(() => {
    if (!contents.length) return [];
    const dirs = contents.filter((c) => c.type === 'dir').sort((a, b) => a.name.localeCompare(b.name));
    const files = contents.filter((c) => c.type !== 'dir').sort((a, b) => a.name.localeCompare(b.name));
    return [...dirs, ...files];
  }, [contents]);

  // ── Breadcrumbs ──
  const breadcrumbs = useMemo(() => {
    if (!currentPath) return [];
    return currentPath.split('/').filter(Boolean);
  }, [currentPath]);

  // ── Default push path ──
  useEffect(() => {
    if (!pushPath && jobMetadata?.name) {
      setPushPath(`jobs/${jobMetadata.name}_${jobMetadata.version || '0.1'}.json`);
    }
  }, [jobMetadata]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="github-panel">
      {/* Status toast */}
      {statusMsg && (
        <div className={`github-toast github-toast--${statusMsg.type}`}>
          {statusMsg.type === 'success' ? <Check size={12} /> : <AlertCircle size={12} />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* ─── Settings Section ─── */}
      <div className="github-section">
        <div className="github-section__header" onClick={() => toggleSection('settings')}>
          {expandedSections.settings ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          <Key size={13} />
          <span className="github-section__title">Settings</span>
          {user && (
            <span className="github-badge github-badge--connected">
              <Check size={10} /> Connected
            </span>
          )}
        </div>

        {expandedSections.settings && (
          <div className="github-section__body">
            {user ? (
              <div className="github-user-info">
                {user.avatar_url && (
                  <img src={user.avatar_url} alt="" className="github-avatar" />
                )}
                <div className="github-user-details">
                  <span className="github-user-name">{user.login}</span>
                  <span className="github-user-type">{user.name || 'GitHub User'}</span>
                </div>
                <button className="github-btn github-btn--sm github-btn--danger" onClick={handleDisconnect}>
                  Disconnect
                </button>
              </div>
            ) : (
              <div className="github-token-form">
                <label className="github-label">Personal Access Token</label>
                <div className="github-token-input-row">
                  <input
                    type="password"
                    className="github-input"
                    placeholder="ghp_xxxxxxxxxxxx"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
                  />
                  <button
                    className="github-btn github-btn--primary"
                    onClick={handleConnect}
                    disabled={authLoading || !tokenInput.trim()}
                  >
                    {authLoading ? <Loader2 size={12} className="spin" /> : 'Connect'}
                  </button>
                </div>
                {authError && (
                  <div className="github-error">
                    <AlertCircle size={11} /> {authError}
                  </div>
                )}
                <div className="github-hint">
                  Generate a PAT with <code>repo</code> scope at GitHub → Settings → Developer Settings
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Repository Browser Section ─── */}
      {user && (
        <div className="github-section">
          <div className="github-section__header" onClick={() => toggleSection('browser')}>
            {expandedSections.browser ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            <FolderOpen size={13} />
            <span className="github-section__title">Repository Browser</span>
          </div>

          {expandedSections.browser && (
            <div className="github-section__body">
              {/* Repo selector */}
              <div className="github-field">
                <label className="github-label">Repository</label>
                <div className="github-select-row">
                  <select
                    className="github-select"
                    value={selectedRepo?.full_name || ''}
                    onChange={(e) => {
                      const r = repos.find((r) => r.full_name === e.target.value);
                      if (r) handleSelectRepo(r);
                    }}
                  >
                    <option value="">Select a repository...</option>
                    {repos.map((r) => (
                      <option key={r.id} value={r.full_name}>{r.full_name}</option>
                    ))}
                  </select>
                  <button
                    className="github-btn github-btn--icon"
                    onClick={loadRepos}
                    disabled={reposLoading}
                    title="Refresh repositories"
                  >
                    <RefreshCw size={12} className={reposLoading ? 'spin' : ''} />
                  </button>
                </div>
              </div>

              {/* Branch selector */}
              {selectedRepo && branches.length > 0 && (
                <div className="github-field">
                  <label className="github-label">
                    <GitBranch size={11} /> Branch
                  </label>
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

              {/* File browser */}
              {selectedRepo && (
                <div className="github-file-browser">
                  {/* Breadcrumbs */}
                  <div className="github-breadcrumbs">
                    <span
                      className="github-breadcrumb github-breadcrumb--link"
                      onClick={() => navigateTo('')}
                    >
                      {selectedRepo.name}
                    </span>
                    {breadcrumbs.map((part, i) => (
                      <span key={i}>
                        <span className="github-breadcrumb__sep">/</span>
                        <span
                          className="github-breadcrumb github-breadcrumb--link"
                          onClick={() => navigateTo(breadcrumbs.slice(0, i + 1).join('/'))}
                        >
                          {part}
                        </span>
                      </span>
                    ))}
                  </div>

                  {/* Go back */}
                  {currentPath && (
                    <div
                      className="github-file-item github-file-item--back"
                      onClick={() => {
                        const parts = currentPath.split('/').filter(Boolean);
                        parts.pop();
                        navigateTo(parts.join('/'));
                      }}
                    >
                      <ArrowLeft size={12} />
                      <span>..</span>
                    </div>
                  )}

                  {contentsLoading ? (
                    <div className="github-loading">
                      <Loader2 size={14} className="spin" /> Loading...
                    </div>
                  ) : (
                    <div className="github-file-list">
                      {sortedContents.map((item) => (
                        <div
                          key={item.sha || item.name}
                          className={`github-file-item ${item.type === 'dir' ? 'github-file-item--dir' : ''} ${item.name.endsWith('.json') ? 'github-file-item--json' : ''} ${previewFile?.path === item.path ? 'github-file-item--active' : ''}`}
                          onClick={() => handleFileClick(item)}
                        >
                          {item.type === 'dir' ? (
                            <FolderOpen size={12} />
                          ) : item.name.endsWith('.json') ? (
                            <FileJson size={12} />
                          ) : (
                            <FileText size={12} />
                          )}
                          <span className="github-file-name">{item.name}</span>
                          {item.type !== 'dir' && item.name.endsWith('.json') && (
                            <Eye size={11} className="github-file-peek" title="Click to preview" />
                          )}
                        </div>
                      ))}
                      {sortedContents.length === 0 && (
                        <div className="github-empty">No files in this directory</div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Preview pane */}
              {previewFile && (
                <div className="github-preview">
                  <div className="github-preview__header">
                    <FileJson size={12} />
                    <span className="github-preview__name">{previewFile.name}</span>
                    <button
                      className="github-btn github-btn--sm github-btn--icon"
                      onClick={() => { setPreviewFile(null); setPreviewContent(null); }}
                      title="Close preview"
                    >
                      <X size={12} />
                    </button>
                  </div>
                  {previewLoading ? (
                    <div className="github-loading">
                      <Loader2 size={14} className="spin" /> Loading preview...
                    </div>
                  ) : previewContent ? (
                    <>
                      <pre className="github-preview__code">{previewContent.slice(0, 2000)}{previewContent.length > 2000 ? '\n... (truncated)' : ''}</pre>
                      <button
                        className="github-btn github-btn--primary github-btn--full"
                        onClick={handleImport}
                      >
                        <Download size={12} /> Import as Job
                      </button>
                    </>
                  ) : (
                    <div className="github-empty">Could not load file content</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── Push to Repo Section ─── */}
      {user && selectedRepo && (
        <div className="github-section">
          <div className="github-section__header" onClick={() => toggleSection('push')}>
            {expandedSections.push ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            <Upload size={13} />
            <span className="github-section__title">Push to Repository</span>
          </div>

          {expandedSections.push && (
            <div className="github-section__body">
              <div className="github-field">
                <label className="github-label">File Path</label>
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
                  value={pushMessage}
                  onChange={(e) => setPushMessage(e.target.value)}
                />
              </div>
              <div className="github-push-info">
                Pushing to <strong>{selectedRepo.full_name}</strong> → <code>{selectedBranch}</code>
              </div>
              <button
                className="github-btn github-btn--primary github-btn--full"
                onClick={handlePush}
                disabled={pushLoading || !pushPath.trim()}
              >
                {pushLoading ? (
                  <><Loader2 size={12} className="spin" /> Pushing...</>
                ) : (
                  <><Upload size={12} /> Push Current Job</>
                )}
              </button>
              {pushStatus && (
                <div className={`github-push-status github-push-status--${pushStatus.type}`}>
                  {pushStatus.type === 'success' ? <Check size={11} /> : <AlertCircle size={11} />}
                  {pushStatus.text}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
