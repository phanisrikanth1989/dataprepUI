const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let fastapiProcess = null;

const isDev = !app.isPackaged;
const FASTAPI_PORT = 8000;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'ReCTran - Data Pipeline Designer',
    icon: path.join(__dirname, '..', 'public', 'favicon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    // In dev mode, load from Vite dev server
    mainWindow.loadURL('http://localhost:4200/rectran/');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built files
    mainWindow.loadFile(path.join(__dirname, '..', 'static', 'rectran-ui', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── FastAPI backend management ─────────────────────
function startFastAPI() {
  // Attempt to start FastAPI backend if a main.py or app.py exists nearby
  // Adjust the path/command to match your FastAPI project location
  const backendDir = path.join(__dirname, '..', '..', 'rectran-engine');
  const fs = require('fs');

  if (!fs.existsSync(backendDir)) {
    console.log('[FastAPI] Backend directory not found:', backendDir);
    return;
  }

  try {
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    fastapiProcess = spawn(pythonCmd, ['-m', 'uvicorn', 'main:app', '--port', String(FASTAPI_PORT), '--reload'], {
      cwd: backendDir,
      stdio: 'pipe',
    });

    fastapiProcess.stdout.on('data', (data) => {
      console.log(`[FastAPI] ${data}`);
    });

    fastapiProcess.stderr.on('data', (data) => {
      console.error(`[FastAPI] ${data}`);
    });

    fastapiProcess.on('error', (err) => {
      console.warn('[FastAPI] Could not start backend:', err.message);
      fastapiProcess = null;
    });

    fastapiProcess.on('exit', (code) => {
      console.log(`[FastAPI] Process exited with code ${code}`);
      fastapiProcess = null;
    });
  } catch (err) {
    console.warn('[FastAPI] Backend not found or failed to start:', err.message);
  }
}

function stopFastAPI() {
  if (fastapiProcess) {
    fastapiProcess.kill();
    fastapiProcess = null;
  }
}

// ── IPC Handlers ───────────────────────────────────

// Native file picker — returns real filesystem paths
ipcMain.handle('dialog:openFile', async (_, options) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: options?.filters || [{ name: 'All Files', extensions: ['*'] }],
    title: options?.title || 'Select File',
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

// Native folder picker
ipcMain.handle('dialog:openFolder', async (_, options) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: options?.title || 'Select Folder',
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

// Save file dialog
ipcMain.handle('dialog:saveFile', async (_, options) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: options?.filters || [{ name: 'JSON', extensions: ['json'] }],
    title: options?.title || 'Save File',
    defaultPath: options?.defaultPath || '',
  });
  if (result.canceled) return null;
  return result.filePath;
});

// Read a local file
ipcMain.handle('fs:readFile', async (_, filePath) => {
  const fs = require('fs');
  return fs.readFileSync(filePath, 'utf-8');
});

// Write a local file
ipcMain.handle('fs:writeFile', async (_, filePath, content) => {
  const fs = require('fs');
  fs.writeFileSync(filePath, content, 'utf-8');
  return true;
});

// Run job via FastAPI backend
ipcMain.handle('job:run', async (_, jobJson) => {
  try {
    const http = require('http');
    return new Promise((resolve, reject) => {
      const postData = typeof jobJson === 'string' ? jobJson : JSON.stringify(jobJson);
      const req = http.request(
        {
          hostname: 'localhost',
          port: FASTAPI_PORT,
          path: '/run-job',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
          },
        },
        (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            try {
              resolve({ status: res.statusCode, data: JSON.parse(body) });
            } catch {
              resolve({ status: res.statusCode, data: body });
            }
          });
        }
      );
      req.on('error', (err) => resolve({ status: 0, error: err.message }));
      req.write(postData);
      req.end();
    });
  } catch (err) {
    return { status: 0, error: err.message };
  }
});

// Check if FastAPI backend is reachable
ipcMain.handle('backend:status', async () => {
  return new Promise((resolve) => {
    const http = require('http');
    const req = http.get(`http://localhost:${FASTAPI_PORT}/health`, (res) => {
      resolve({ running: res.statusCode === 200, port: FASTAPI_PORT });
    });
    req.on('error', () => resolve({ running: false, port: FASTAPI_PORT }));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve({ running: false, port: FASTAPI_PORT });
    });
  });
});

// ── App lifecycle ──────────────────────────────────
app.whenReady().then(() => {
  startFastAPI();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  stopFastAPI();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  stopFastAPI();
});
