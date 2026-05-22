const API_BASE = import.meta.env.VITE_ENGINE_API_BASE || 'http://localhost:8000';

async function apiFetch(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!response.ok) {
    let detail;
    try {
      const body = await response.json();
      if (Array.isArray(body.detail)) {
        detail = body.detail.map((d) => `${(d.loc || []).join('.')}: ${d.msg}`).join('; ');
      } else {
        detail = body.detail || body.message || body.error || JSON.stringify(body);
      }
    } catch {
      detail = await response.text().catch(() => `HTTP ${response.status}`);
    }
    throw new Error(`API returned ${response.status}: ${detail}`);
  }
  return response.json();
}

/** GET /api/routines/python — returns array of {filename, name, size_bytes, last_modified} */
export async function listPythonRoutines() {
  return apiFetch(`${API_BASE}/api/routines/python`);
}

/** GET /api/routines/python/{filename} — returns {filename, name, content, ...} */
export async function getPythonRoutine(filename) {
  return apiFetch(`${API_BASE}/api/routines/python/${encodeURIComponent(filename)}`);
}

/** POST /api/routines/python — body {filename, content} */
export async function createPythonRoutine(filename, content) {
  return apiFetch(`${API_BASE}/api/routines/python`, {
    method: 'POST',
    body: JSON.stringify({ filename, content }),
  });
}

/** PUT /api/routines/python/{filename} — body {content} */
export async function updatePythonRoutine(filename, content) {
  return apiFetch(`${API_BASE}/api/routines/python/${encodeURIComponent(filename)}`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
}

/** DELETE /api/routines/python/{filename} */
export async function deletePythonRoutine(filename) {
  return apiFetch(`${API_BASE}/api/routines/python/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
  });
}

/**
 * POST /api/routines/python/build — streams SSE response.
 * Calls onLine(line) for each line of build output received.
 */
export async function buildPythonRoutines(onLine) {
  const response = await fetch(`${API_BASE}/api/routines/python/build`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => `HTTP ${response.status}`);
    throw new Error(`Build failed ${response.status}: ${text}`);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      const text = line.startsWith('data: ') ? line.slice(6) : line;
      if (text.trim()) onLine(text);
    }
  }
  if (buffer.trim()) {
    const text = buffer.startsWith('data: ') ? buffer.slice(6) : buffer;
    if (text.trim()) onLine(text);
  }
}
