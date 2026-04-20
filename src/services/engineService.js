/**
 * Engine Service — calls the Python backend engine to run a job
 * and polls for execution status.
 *
 * Backend contract:
 *   POST /api/jobs/upload
 *     Body: <job JSON object>
 *     Response: { job_id: <string> }
 *
 *   POST /api/jobs/{job_id}/run
 *     Response: { run_id: <string> }
 *
 *   GET /api/jobs/runs/{run_id}
 *     Response: { status: "pending"|"running"|"completed"|"failed", stats: {...}, error: <string|null> }
 */

const API_BASE = import.meta.env.VITE_ENGINE_API_BASE || 'http://localhost:8000';

/** How often to poll for run status (ms) */
const POLL_INTERVAL = 2000;

/** Maximum time to poll before giving up (ms) — 5 minutes */
const MAX_POLL_DURATION = 5 * 60 * 1000;

/**
 * Helper — make a fetch call and parse the JSON response.
 * Throws with a descriptive message on non-2xx responses.
 */
async function apiFetch(url, options = {}) {
  const { headers: customHeaders, ...rest } = options;
  // Only set default JSON Content-Type if no custom headers are provided
  const headers = customHeaders !== undefined
    ? customHeaders
    : { 'Content-Type': 'application/json' };

  const response = await fetch(url, { headers, ...rest });
  if (!response.ok) {
    let detail;
    try {
      const body = await response.json();
      // FastAPI 422 returns { detail: [ {loc, msg, type}, ... ] }
      if (Array.isArray(body.detail)) {
        detail = body.detail.map((d) => `${(d.loc || []).join('.')}: ${d.msg}`).join('; ');
      } else {
        detail = body.detail || body.message || body.error || JSON.stringify(body);
      }
    } catch {
      detail = await response.text().catch(() => `HTTP ${response.status}`);
    }
    throw new Error(`Engine returned ${response.status}: ${detail}`);
  }
  return response.json();
}

/**
 * Run a job on the backend engine and poll for status.
 *
 * Flow:
 *   1. POST /api/jobs/upload      → { job_id }
 *   2. POST /api/jobs/{job_id}/run → { run_id }
 *   3. GET  /api/jobs/runs/{run_id} (poll until terminal status)
 *
 * @param {string} jobJsonString - The exported job JSON string
 * @param {object} callbacks
 * @param {(log: {type: string, message: string, timestamp: string, component?: string}) => void} callbacks.onLog
 * @param {(status: string) => void} callbacks.onStatusChange
 * @param {(error: string) => void} callbacks.onError
 * @param {(summary: {status: string, startTime: string, endTime: string, duration: number, rowsProcessed?: number}) => void} callbacks.onComplete
 * @returns {{ abort: () => void, runId: string }}
 */
export function runJobOnEngine(jobJsonString, { onLog, onStatusChange, onError, onComplete }) {
  let aborted = false;
  let pollTimer = null;
  const handle = { runId: '', abort };

  const startTime = new Date().toISOString();

  function abort() {
    aborted = true;
    if (pollTimer) clearTimeout(pollTimer);
    onLog({ type: 'warn', message: '⛔ Job execution aborted by user.', timestamp: new Date().toISOString() });
    onStatusChange('stopped');
    onComplete({
      status: 'stopped',
      startTime,
      endTime: new Date().toISOString(),
      duration: Date.now() - new Date(startTime).getTime(),
    });
  }

  function failAtStep(step, err) {
    if (aborted) return;
    const errorMsg = err.message || 'Unknown error';
    onLog({ type: 'error', message: `✖ Step ${step} failed: ${errorMsg}`, timestamp: new Date().toISOString() });
    onError(errorMsg);
    onStatusChange('failed');
    onComplete({
      status: 'failed',
      startTime,
      endTime: new Date().toISOString(),
      duration: Date.now() - new Date(startTime).getTime(),
    });
  }

  const jobDef = JSON.parse(jobJsonString);
  const jobName = jobDef.job_name || 'Untitled';

  onStatusChange('connecting');
  onLog({ type: 'info', message: `━━━ Running job: ${jobName} ━━━`, timestamp: startTime });

  // ═══════════════════════════════════════════════════
  // STEP 1 — Upload job JSON to backend
  // ═══════════════════════════════════════════════════
  onLog({ type: 'info', message: `▶ Step 1/3 — Uploading job to engine (${API_BASE}/api/jobs/upload)...`, timestamp: new Date().toISOString() });

  const blob = new Blob([JSON.stringify(jobDef, null, 2)], { type: 'application/json' });
  const formData = new FormData();
  formData.append('file', blob, `${jobName}.json`);

  apiFetch(`${API_BASE}/api/jobs/upload`, {
    method: 'POST',
    body: formData,
    headers: {},
  })
    .then((uploadRes) => {
      if (aborted) return;
      const jobId = uploadRes.job_id;
      onLog({ type: 'success', message: `✔ Step 1/3 — Upload successful (job_id: ${jobId})`, timestamp: new Date().toISOString() });

      // ═══════════════════════════════════════════════
      // STEP 2 — Trigger execution on the engine
      // ═══════════════════════════════════════════════
      onLog({ type: 'info', message: `▶ Step 2/3 — Starting execution (POST /api/jobs/${jobId}/run)...`, timestamp: new Date().toISOString() });

      return apiFetch(`${API_BASE}/api/jobs/${encodeURIComponent(jobId)}/run`, {
        method: 'POST',
      });
    })
    .then((runRes) => {
      if (aborted || !runRes) return;
      const runId = runRes.run_id;
      handle.runId = runId;

      onStatusChange('running');
      onLog({ type: 'success', message: `✔ Step 2/3 — Execution started (run_id: ${runId})`, timestamp: new Date().toISOString() });

      // ═══════════════════════════════════════════════
      // STEP 3 — Poll for status & stream logs
      // ═══════════════════════════════════════════════
      onLog({ type: 'info', message: `▶ Step 3/3 — Monitoring execution (polling every ${POLL_INTERVAL / 1000}s)...`, timestamp: new Date().toISOString() });

      let lastStatus = '';
      let lastStats = null;
      let pollErrorCount = 0;
      const MAX_POLL_ERRORS = 5;
      const pollStartTime = Date.now();

      function poll() {
        if (aborted) return;

        // Timeout: stop polling after MAX_POLL_DURATION
        if (Date.now() - pollStartTime > MAX_POLL_DURATION) {
          const timeoutErr = new Error(`Polling timed out after ${MAX_POLL_DURATION / 1000}s — engine may still be running.`);
          failAtStep('3/3 (Monitoring)', timeoutErr);
          return;
        }

        apiFetch(`${API_BASE}/api/jobs/runs/${encodeURIComponent(runId)}`)
          .then((statusRes) => {
            if (aborted) return;
            pollErrorCount = 0; // reset on success

            const { status, stats, error, logs } = statusRes;

            // Log status transitions
            if (status !== lastStatus) {
              lastStatus = status;
              const icon = status === 'running' ? '⏳' : status === 'pending' ? '⏱' : '📊';
              onLog({ type: 'info', message: `${icon} Engine status: ${status}`, timestamp: new Date().toISOString() });
              onStatusChange(status);
            }

            // Stream any logs returned by the status endpoint
            if (Array.isArray(logs)) {
              for (const line of logs) {
                if (typeof line === 'string') {
                  onLog({ type: 'info', message: line, timestamp: new Date().toISOString() });
                } else if (line && line.message) {
                  onLog({
                    type: line.type || line.level || 'info',
                    message: line.message,
                    timestamp: line.timestamp || new Date().toISOString(),
                    component: line.component,
                  });
                }
              }
            }

            // Log stats updates
            if (stats && JSON.stringify(stats) !== JSON.stringify(lastStats)) {
              lastStats = stats;
              const ts = new Date().toISOString();

              // Extract and display component_stats as individual lines
              if (stats.component_stats && typeof stats.component_stats === 'object') {
                for (const [compId, compData] of Object.entries(stats.component_stats)) {
                  if (typeof compData === 'object') {
                    const details = Object.entries(compData).map(([k, v]) => `${k}: ${v}`).join(', ');
                    onLog({ type: 'info', message: `  📦 [${compId}] ${details}`, timestamp: ts, component: compId });
                  } else {
                    onLog({ type: 'info', message: `  📦 [${compId}] ${compData}`, timestamp: ts, component: compId });
                  }
                }
              }

              // Display top-level scalar stats (skip nested objects already shown above)
              const scalarParts = Object.entries(stats)
                .filter(([k, v]) => typeof v !== 'object' || v === null)
                .map(([k, v]) => `${k}: ${v}`);
              if (scalarParts.length > 0) {
                onLog({ type: 'metric', message: `📈 ${scalarParts.join(', ')}`, timestamp: ts });
              }
            }

            // ── Terminal: completed / success ──
            if (status === 'completed' || status === 'success') {
              const endTime = new Date().toISOString();
              const duration = new Date(endTime) - new Date(startTime);
              onLog({ type: 'success', message: `✔ Step 3/3 — Job completed successfully (${formatDuration(duration)})`, timestamp: endTime });
              onLog({ type: 'info', message: `━━━ Finished: ${jobName} ━━━`, timestamp: endTime });
              onComplete({
                status: 'completed',
                startTime,
                endTime,
                duration,
                rowsProcessed: stats?.rows_processed,
              });
              onStatusChange('completed');
              return;
            }

            // ── Terminal: failed ──
            if (status === 'failed') {
              const endTime = new Date().toISOString();
              const errorMsg = error || 'Job failed (no details from engine).';
              onLog({ type: 'error', message: `✖ Step 3/3 — Execution failed: ${errorMsg}`, timestamp: endTime });
              onLog({ type: 'info', message: `━━━ Failed: ${jobName} ━━━`, timestamp: endTime });
              onError(errorMsg);
              onComplete({
                status: 'failed',
                startTime,
                endTime,
                duration: new Date(endTime) - new Date(startTime),
                rowsProcessed: stats?.rows_processed,
              });
              onStatusChange('failed');
              return;
            }

            // Still running / pending — poll again
            pollTimer = setTimeout(poll, POLL_INTERVAL);
          })
          .catch((err) => {
            if (aborted) return;
            pollErrorCount++;
            if (pollErrorCount >= MAX_POLL_ERRORS) {
              onLog({ type: 'error', message: `✖ Step 3/3 — Lost connection to engine after ${MAX_POLL_ERRORS} retries: ${err.message}`, timestamp: new Date().toISOString() });
              failAtStep('3/3 (Monitoring)', err);
              return;
            }
            onLog({ type: 'warn', message: `⚠ Poll error (${pollErrorCount}/${MAX_POLL_ERRORS}): ${err.message}. Retrying...`, timestamp: new Date().toISOString() });
            pollTimer = setTimeout(poll, POLL_INTERVAL);
          });
      }

      poll();
    })
    .catch((err) => {
      // Determine which step failed based on the error context
      if (err.message?.includes('/upload') || err.message?.includes('Upload')) {
        failAtStep('1/3 (Upload)', err);
      } else if (err.message?.includes('/run')) {
        failAtStep('2/3 (Run)', err);
      } else {
        failAtStep('1/3 (Upload)', err);
      }
    });

  return handle;
}

/**
 * Send a stop signal to the backend for a running job.
 * Note: If your backend adds a stop endpoint, update the URL here.
 * @param {string} runId
 * @returns {Promise<void>}
 */
export async function stopJobOnEngine(runId) {
  // Backend does not have a stop endpoint yet — abort is handled client-side.
  // Uncomment below when the backend adds a stop route:
  //
  // try {
  //   await apiFetch(`${API_BASE}/api/jobs/runs/${encodeURIComponent(runId)}/stop`, {
  //     method: 'POST',
  //   });
  // } catch (err) {
  //   console.warn('Failed to send stop signal:', err.message);
  // }
  console.warn(`stopJobOnEngine(${runId}): backend stop endpoint not available yet.`);
}

/**
 * Format a duration in ms to a human-readable string.
 * @param {number} ms
 * @returns {string}
 */
export function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}.${String(ms % 1000).padStart(3, '0').slice(0, 1)}s`;
}
