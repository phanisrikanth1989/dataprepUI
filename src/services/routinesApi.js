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

/** GET /api/routines/java — returns array of {filename, name, size_bytes, last_modified} */
export async function listRoutines() {
  return apiFetch(`${API_BASE}/api/routines/java`);
}

/** GET /api/routines/java/{filename} — returns {filename, name, content, ...} */
export async function getRoutine(filename) {
  return apiFetch(`${API_BASE}/api/routines/java/${encodeURIComponent(filename)}`);
}

/** POST /api/routines/java — body {filename, content} */
export async function createRoutine(filename, content) {
  return apiFetch(`${API_BASE}/api/routines/java`, {
    method: 'POST',
    body: JSON.stringify({ filename, content }),
  });
}

/** PUT /api/routines/java/{filename} — body {content} */
export async function updateRoutine(filename, content) {
  return apiFetch(`${API_BASE}/api/routines/java/${encodeURIComponent(filename)}`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
}

/** DELETE /api/routines/java/{filename} */
export async function deleteRoutine(filename) {
  return apiFetch(`${API_BASE}/api/routines/java/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
  });
}

/**
 * POST /api/routines/java/build — streams SSE response.
 * Calls onLine(line) for each line of Maven build output received.
 */
export async function buildRoutines(onLine) {
  const response = await fetch(`${API_BASE}/api/routines/java/build`, {
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
    buffer = lines.pop(); // keep incomplete last line
    for (const line of lines) {
      // SSE lines start with "data: "; strip prefix if present
      const text = line.startsWith('data: ') ? line.slice(6) : line;
      if (text.trim()) onLine(text);
    }
  }
  if (buffer.trim()) {
    const text = buffer.startsWith('data: ') ? buffer.slice(6) : buffer;
    if (text.trim()) onLine(text);
  }
}
