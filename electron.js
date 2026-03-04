const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const http = require('http');

const PORT = 3001;
let mainWindow = null;

// ── 0. Point Prisma to the unpacked engine binary ─────────────────────────────
// In a packaged app, native .dll.node files are placed in app.asar.unpacked/
// by electron-builder's asarUnpack config. We must set the env var BEFORE
// any require() that loads @prisma/client so Prisma finds the engine.
(function setPrismaEnginePath() {
  const enginePath = path.join(
    __dirname,
    'server',
    'node_modules',
    '.prisma',
    'client',
    'query_engine-windows.dll.node'
  );
  // Rewrite asar path to asar.unpacked path if running packaged
  const unpacked = enginePath.replace('app.asar', 'app.asar.unpacked');
  if (!process.env.PRISMA_QUERY_ENGINE_LIBRARY) {
    process.env.PRISMA_QUERY_ENGINE_LIBRARY = unpacked;
  }
})();

// ── 1. Load environment variables from server/.env ────────────────────────────
// Must happen before any require() that touches PrismaClient or dotenv.
function loadEnv() {
  const envPath = path.join(__dirname, 'server', '.env');
  try {
    const fs = require('fs');
    if (!fs.existsSync(envPath)) return;
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx < 0) continue;
      const key = trimmed.substring(0, eqIdx).trim();
      const val = trimmed.substring(eqIdx + 1).trim();
      // Don't overwrite vars already set in the environment
      if (key && process.env[key] === undefined) {
        process.env[key] = val;
      }
    }
  } catch (e) {
    console.error('[electron] Failed to load .env:', e.message);
  }
}

// ── 2. Poll localhost until Express is accepting requests ─────────────────────
function waitForServer(timeout = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    function attempt() {
      http.get(`http://localhost:${PORT}/`, (res) => {
        resolve();
      }).on('error', () => {
        if (Date.now() - start > timeout) {
          reject(new Error('Express server did not start within 30 s'));
          return;
        }
        setTimeout(attempt, 300);
      });
    }
    attempt();
  });
}

// ── 3. Start the Express server in-process ────────────────────────────────────
// server/index.js exports { serverReady } — a Promise that resolves once
// app.listen() fires. All server node_modules live in server/node_modules and
// are resolved correctly because Node walks up from __dirname.
function startServer() {
  try {
    const { serverReady } = require('./server/index.js');
    return serverReady;
  } catch (e) {
    console.error('[electron] Failed to load server:', e);
    return Promise.reject(e);
  }
}

// ── 4. Create the Electron window ─────────────────────────────────────────────
async function createWindow() {
  // In packaged Electron, store the DB in %APPDATA%\zgreens\ so it survives app updates.
  // Must be set BEFORE loadEnv() — loadEnv() won't overwrite already-set vars.
  if (!process.env.DATABASE_URL) {
    const dbPath = path.join(app.getPath('userData'), 'zgreens.db');
    process.env.DATABASE_URL = `file:${dbPath}`;

    // First-run: copy the pre-migrated base.db so Prisma tables exist immediately.
    const fs = require('fs');
    if (!fs.existsSync(dbPath)) {
      const baseInAsar = path.join(__dirname, 'server', 'prisma', 'base.db');
      // electron-builder extracts asarUnpack files to app.asar.unpacked/
      const baseUnpacked = baseInAsar.replace('app.asar', 'app.asar.unpacked');
      const src = fs.existsSync(baseUnpacked) ? baseUnpacked : baseInAsar;
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
      fs.copyFileSync(src, dbPath);
      console.log('[electron] First run — copied base.db to', dbPath);
    }
  }

  // Must load env BEFORE requiring server (Prisma reads DATABASE_URL at import time)
  loadEnv();

  // Start Express in the same process
  await startServer().catch((e) => {
    console.error('[electron] Server startup error:', e.message);
  });

  // Extra safety: poll until the port is actually open
  await waitForServer(30000).catch((e) => {
    console.error('[electron] Timeout waiting for server:', e.message);
  });

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: 'ZGreens',
    autoHideMenuBar: true,
  });

  // External links open in the system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.loadURL(`http://localhost:${PORT}`);

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});
