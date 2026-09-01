import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import log from 'electron-log';

// ─── Configure logging ────────────────────────────────────────────────────────
const userDataPath = app.getPath('userData');
log.transports.file.level = 'info';
log.transports.console.level = 'debug';
log.transports.file.resolvePathFn = () => path.join(userDataPath, 'logs', 'main.log');
log.info('Application starting...');
log.info(`User data path: ${userDataPath}`);
log.info(`Resources path: ${app.isPackaged ? process.resourcesPath : 'unpackaged'}`);

// ─── Types ────────────────────────────────────────────────────────────────────
interface ServerProcess {
  proc: ChildProcess;
  port: number;
}

// ─── Global state ─────────────────────────────────────────────────────────────
let mainWindow: BrowserWindow | null = null;
let apiServer: ServerProcess | null = null;
let webServer: ServerProcess | null = null;

// ─── Paths ────────────────────────────────────────────────────────────────────
function getResourcePath(relative: string): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, relative);
  }
  return path.join(__dirname, '..', '..', '..', relative);
}

function getUserDataPath(): string {
  return app.getPath('userData');
}

// ─── Port allocation ──────────────────────────────────────────────────────────
async function findFreePort(start: number, end: number): Promise<number> {
  const net = await import('net');
  for (let port = start; port <= end; port++) {
    const available = await new Promise<boolean>((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => {
        server.close();
        resolve(true);
      });
      server.listen(port, '127.0.0.1');
    });
    if (available) return port;
  }
  throw new Error(`No free port found between ${start} and ${end}`);
}

// ─── Wait for server to be ready ─────────────────────────────────────────────
async function waitForServer(url: string, timeoutMs = 30000): Promise<void> {
  const http = await import('http');
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise<void>((resolve, reject) => {
        const req = http.get(url, (res) => {
          if (res.statusCode && res.statusCode < 500) {
            resolve();
          } else {
            reject(new Error(`Status ${res.statusCode}`));
          }
        });
        req.on('error', reject);
        req.setTimeout(1000, () => {
          req.destroy();
          reject(new Error('timeout'));
        });
      });
      log.info(`Server ready at ${url}`);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`);
}

// ─── Start API server ─────────────────────────────────────────────────────────
async function startApiServer(apiPort: number): Promise<ServerProcess> {
  const apiDistPath = getResourcePath('api');

  // Ensure data directory exists in userData for persistence
  const userDataPath = getUserDataPath();
  const dbDataDir = path.join(userDataPath, 'data');
  const attachmentsDir = path.join(userDataPath, 'data', 'attachments');
  if (!fs.existsSync(dbDataDir)) {
    fs.mkdirSync(dbDataDir, { recursive: true });
  }
  if (!fs.existsSync(attachmentsDir)) {
    fs.mkdirSync(attachmentsDir, { recursive: true });
  }

  const dbPath = path.join(userDataPath, 'data', 'steelcoil.db');
  const apiUrl = `http://127.0.0.1:${apiPort}`;

  log.info(`Starting API server on port ${apiPort}...`);
  log.info(`Database path: ${dbPath}`);
  log.info(`Attachments path: ${attachmentsDir}`);

  const apiEnv: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(apiPort),
    DATABASE_PATH: dbPath,
    ATTACHMENTS_DIR: attachmentsDir,
    UPLOADS_BASE_URL: `${apiUrl}/uploads`,
    SESSION_SECRET: `steelcoil-desktop-${app.getPath('userData')}`,
    DESKTOP_MODE: 'true',
    ALLOWED_ORIGIN: '*',
    INITIAL_ADMIN_PASSWORD: 'SteelCoil2026!',
  };

  const apiScriptPath = path.join(apiDistPath, 'main.js');
  log.info(`API script path: ${apiScriptPath}`);
  log.info(`API dist path: ${apiDistPath}`);

  const apiEnvWithElectronRun: NodeJS.ProcessEnv = {
    ...apiEnv,
    ELECTRON_RUN_AS_NODE: '1',
  };

  const apiProc = spawn(process.execPath, [apiScriptPath], {
    env: apiEnvWithElectronRun,
    cwd: apiDistPath,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
    windowsHide: true,
  });

  apiProc.stdout?.on('data', (chunk: Buffer) => {
    log.info(`[API] ${chunk.toString().trim()}`);
  });

  apiProc.stderr?.on('data', (chunk: Buffer) => {
    const text = chunk.toString().trim();
    if (text) log.error(`[API ERR] ${text}`);
  });

  apiProc.on('error', (err) => {
    log.error(`API process error: ${err.message}`);
  });

  apiProc.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      log.error(`API process exited with code ${code}`);
    }
  });

  await waitForServer(`${apiUrl}/api/v1/health`);

  return { proc: apiProc, port: apiPort };
}

// ─── Start Web server ─────────────────────────────────────────────────────────
async function startWebServer(webPort: number, apiUrl: string): Promise<ServerProcess> {
  const webPath = getResourcePath('web');
  const nextServerPath = path.join(webPath, '.next', 'standalone', 'apps', 'web', 'server.js');

  log.info(`Starting Next.js server on port ${webPort}...`);
  log.info(`Next.js standalone path: ${nextServerPath}`);

  const webEnv: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(webPort),
    NEXT_PUBLIC_API_URL: apiUrl,
    ELECTRON_RUN_AS_NODE: '1',
  };

  const webProc = spawn(process.execPath, [nextServerPath], {
    env: webEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
    windowsHide: true,
    cwd: path.dirname(nextServerPath),
  });

  webProc.stdout?.on('data', (chunk: Buffer) => {
    log.info(`[WEB] ${chunk.toString().trim()}`);
  });

  webProc.stderr?.on('data', (chunk: Buffer) => {
    const text = chunk.toString().trim();
    if (text) log.error(`[WEB ERR] ${text}`);
  });

  webProc.on('error', (err) => {
    log.error(`Web process error: ${err.message}`);
  });

  webProc.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      log.error(`Web process exited with code ${code}`);
    }
  });

  const webUrl = `http://127.0.0.1:${webPort}`;
  await waitForServer(webUrl, 60000);

  return { proc: webProc, port: webPort };
}

// ─── Create window ────────────────────────────────────────────────────────────
function createMainWindow(url: string): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: 'SteelCoil POS',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.once('ready-to-show', () => {
    win.show();
    log.info('Main window shown');
  });

  win.on('closed', () => {
    mainWindow = null;
  });

  // Load the URL
  win.loadURL(url);

  return win;
}

// ─── Shutdown ────────────────────────────────────────────────────────────────
function shutdown(): void {
  log.info('Shutting down...');

  const kill = (name: string, srv: ServerProcess | null) => {
    if (!srv) return;
    try {
      log.info(`Stopping ${name} (PID ${srv.proc.pid})...`);
      srv.proc.kill('SIGTERM');
    } catch (e) {
      log.error(`Error stopping ${name}: ${e}`);
    }
  };

  kill('webServer', webServer);
  kill('apiServer', apiServer);

  if (mainWindow) {
    mainWindow.close();
    mainWindow = null;
  }

  app.quit();
}

// ─── Single instance ─────────────────────────────────────────────────────────
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  log.warn('Another instance is already running. Quitting.');
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// ─── IPC: get server info ────────────────────────────────────────────────────
ipcMain.handle('get-server-info', () => {
  if (!apiServer || !webServer) return null;
  return {
    apiUrl: `http://127.0.0.1:${apiServer.port}`,
    webUrl: `http://127.0.0.1:${webServer.port}`,
  };
});

// ─── IPC: show error dialog ──────────────────────────────────────────────────
ipcMain.on('show-error', (_, title: string, message: string) => {
  dialog.showErrorBox(title, message);
});

// ─── App ready ───────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  log.info('App ready');

  try {
    // Allocate ports
    const [apiPort, webPort] = await Promise.all([
      findFreePort(4000, 4999),
      findFreePort(3000, 3999),
    ]);

    log.info(`Using API port: ${apiPort}, Web port: ${webPort}`);

    // Start API
    apiServer = await startApiServer(apiPort);
    const apiUrl = `http://127.0.0.1:${apiServer.port}`;

    // Start Web
    webServer = await startWebServer(webPort, apiUrl);
    const webUrl = `http://127.0.0.1:${webServer.port}`;

    // Create window
    mainWindow = createMainWindow(webUrl);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error(`Startup failed: ${msg}`);
    dialog.showErrorBox(
      'Startup Failed',
      `Could not start the application.\n\n${msg}\n\nThe application will now close.`,
    );
    shutdown();
  }
});

app.on('window-all-closed', () => {
  shutdown();
});

app.on('before-quit', () => {
  shutdown();
});

process.on('uncaughtException', (err) => {
  log.error(`Uncaught exception: ${err.message}\n${err.stack}`);
  dialog.showErrorBox('Unexpected Error', `An unexpected error occurred:\n\n${err.message}`);
  shutdown();
});

process.on('unhandledRejection', (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  log.error(`Unhandled rejection: ${msg}`);
});
