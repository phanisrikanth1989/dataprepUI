/**
 * Engine Service — calls the Python backend engine to run a job
 * and streams log output back via Server-Sent Events (SSE).
 *
 * Backend contract:
 *   POST /api/v1/jobs/run
 *     Body: { job_definition: <job JSON object> }
 *     Response: 200 with Content-Type: text/event-stream
 *       Each SSE event has:
 *         data: { "type": "info"|"warn"|"error"|"success"|"debug"|"metric", "message": "...", "timestamp": "...", "component"?: "..." }
 *       Final event:
 *         data: { "type": "end", "status": "completed"|"failed", "message": "...", "timestamp": "..." }
 *
 *   POST /api/v1/jobs/stop
 *     Body: { run_id: <string> }
 *     Response: 200 { "status": "stopped" }
 */

const API_BASE = import.meta.env.VITE_ENGINE_API_BASE || 'http://localhost:8000';

/**
 * Run a job on the backend engine and stream logs back.
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
  const controller = new AbortController();
  const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const startTime = new Date().toISOString();

  onStatusChange('connecting');
  onLog({
    type: 'info',
    message: 'Connecting to engine...',
    timestamp: startTime,
  });

  const jobDef = JSON.parse(jobJsonString);

  fetch(`${API_BASE}/api/v1/jobs/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ job_definition: jobDef, run_id: runId }),
    signal: controller.signal,
  })
    .then((response) => {
      if (!response.ok) {
        return response.text().then((body) => {
          let detail = body;
          try {
            const parsed = JSON.parse(body);
            detail = parsed.detail || parsed.message || body;
          } catch { /* use raw body */ }
          throw new Error(`Engine returned ${response.status}: ${detail}`);
        });
      }

      onStatusChange('running');
      onLog({
        type: 'info',
        message: 'Connected to engine. Job execution started.',
        timestamp: new Date().toISOString(),
      });

      // Parse SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      function processStream() {
        return reader.read().then(({ done, value }) => {
          if (done) {
            // Stream ended — if we haven't received an explicit "end" event, treat as completed
            const endTime = new Date().toISOString();
            onComplete({
              status: 'completed',
              startTime,
              endTime,
              duration: new Date(endTime) - new Date(startTime),
            });
            onStatusChange('completed');
            return;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop(); // keep incomplete line in buffer

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(':')) continue; // SSE comment or empty

            if (trimmed.startsWith('data:')) {
              const jsonStr = trimmed.slice(5).trim();
              if (!jsonStr) continue;
              try {
                const event = JSON.parse(jsonStr);

                if (event.type === 'end') {
                  const endTime = event.timestamp || new Date().toISOString();
                  const finalStatus = event.status === 'failed' ? 'failed' : 'completed';

                  onLog({
                    type: finalStatus === 'failed' ? 'error' : 'success',
                    message: event.message || `Job ${finalStatus}.`,
                    timestamp: endTime,
                    component: event.component,
                  });

                  onComplete({
                    status: finalStatus,
                    startTime,
                    endTime,
                    duration: new Date(endTime) - new Date(startTime),
                    rowsProcessed: event.rows_processed,
                  });
                  onStatusChange(finalStatus);
                  return; // stop reading
                }

                onLog({
                  type: event.type || 'info',
                  message: event.message || '',
                  timestamp: event.timestamp || new Date().toISOString(),
                  component: event.component,
                });

                // If the event has a status hint, forward it
                if (event.status) {
                  onStatusChange(event.status);
                }
              } catch {
                // Not valid JSON — treat as plain text log
                onLog({
                  type: 'info',
                  message: jsonStr,
                  timestamp: new Date().toISOString(),
                });
              }
            } else {
              // Plain text line (non-SSE) — some backends may send raw lines
              onLog({
                type: 'info',
                message: trimmed,
                timestamp: new Date().toISOString(),
              });
            }
          }

          return processStream();
        });
      }

      return processStream();
    })
    .catch((err) => {
      if (err.name === 'AbortError') {
        onLog({
          type: 'warn',
          message: 'Job execution aborted by user.',
          timestamp: new Date().toISOString(),
        });
        onStatusChange('stopped');
        onComplete({
          status: 'stopped',
          startTime,
          endTime: new Date().toISOString(),
          duration: Date.now() - new Date(startTime).getTime(),
        });
        return;
      }

      const errorMsg = err.message || 'Failed to connect to engine';
      onLog({
        type: 'error',
        message: errorMsg,
        timestamp: new Date().toISOString(),
      });
      onError(errorMsg);
      onStatusChange('failed');
      onComplete({
        status: 'failed',
        startTime,
        endTime: new Date().toISOString(),
        duration: Date.now() - new Date(startTime).getTime(),
      });
    });

  return {
    runId,
    abort: () => controller.abort(),
  };
}

/**
 * Send a stop signal to the backend for a running job.
 * @param {string} runId
 * @returns {Promise<void>}
 */
export async function stopJobOnEngine(runId) {
  try {
    const response = await fetch(`${API_BASE}/api/v1/jobs/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ run_id: runId }),
    });
    if (!response.ok) {
      console.warn('Stop request returned:', response.status);
    }
  } catch (err) {
    console.warn('Failed to send stop signal:', err.message);
  }
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
