const API_BASE = 'https://api.github.com';

function getHeaders(token) {
  return {
    Accept: 'application/vnd.github.v3+json',
    ...(token ? { Authorization: `token ${token}` } : {}),
  };
}

/** Validate token and get authenticated user */
export async function validateToken(token) {
  const res = await fetch(`${API_BASE}/user`, { headers: getHeaders(token) });
  if (!res.ok) throw new Error('Invalid token');
  return res.json();
}

/** List repos for the authenticated user */
export async function listRepos(token, { page = 1, perPage = 30 } = {}) {
  const res = await fetch(
    `${API_BASE}/user/repos?sort=updated&per_page=${perPage}&page=${page}`,
    { headers: getHeaders(token) }
  );
  if (!res.ok) throw new Error('Failed to list repos');
  return res.json();
}

/** List contents of a directory in a repo */
export async function listContents(token, owner, repo, path = '', branch = 'main') {
  const encoded = encodeURIComponent(path).replace(/%2F/g, '/');
  const url = `${API_BASE}/repos/${owner}/${repo}/contents/${encoded}?ref=${branch}`;
  const res = await fetch(url, { headers: getHeaders(token) });
  if (!res.ok) throw new Error(`Failed to list: ${path}`);
  return res.json();
}

/** Get file content (decoded) from a repo */
export async function getFileContent(token, owner, repo, path, branch = 'main') {
  const encoded = encodeURIComponent(path).replace(/%2F/g, '/');
  const url = `${API_BASE}/repos/${owner}/${repo}/contents/${encoded}?ref=${branch}`;
  const res = await fetch(url, { headers: getHeaders(token) });
  if (!res.ok) throw new Error(`Failed to get: ${path}`);
  const data = await res.json();
  if (data.encoding === 'base64') {
    return { content: atob(data.content), sha: data.sha, path: data.path };
  }
  return { content: data.content, sha: data.sha, path: data.path };
}

/** List branches of a repo */
export async function listBranches(token, owner, repo) {
  const res = await fetch(
    `${API_BASE}/repos/${owner}/${repo}/branches?per_page=100`,
    { headers: getHeaders(token) }
  );
  if (!res.ok) throw new Error('Failed to list branches');
  return res.json();
}

/** Push (create or update) a file in a repo */
export async function pushFile(token, owner, repo, path, content, message, branch = 'main', sha = null) {
  const encoded = encodeURIComponent(path).replace(/%2F/g, '/');
  const url = `${API_BASE}/repos/${owner}/${repo}/contents/${encoded}`;
  const body = {
    message,
    content: btoa(unescape(encodeURIComponent(content))),
    branch,
  };
  if (sha) body.sha = sha; // update existing file
  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...getHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to push file');
  }
  return res.json();
}
