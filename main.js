const { app, BrowserWindow, shell, Menu, ipcMain } = require('electron');
const path = require('path');

Menu.setApplicationMenu(null);

let mainWindow;

const ALLOWED_PROTOCOLS = ['http:', 'https:', 'roblox:', 'roblox-player:', 'mailto:'];

function openExternalSafe(url) {
  try {
    const parsed = new URL(url);
    if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) return false;
    shell.openExternal(url).catch((err) => console.error('openExternal failed:', err));
    return true;
  } catch (e) {
    return false;
  }
}

ipcMain.handle('open-external', (_event, url) => openExternalSafe(url));

/* Roblox's public APIs send no Access-Control-Allow-Origin, so a fetch() from the renderer
   (file:// origin) is blocked by the browser. Route these JSON lookups through the main
   process, which has no CORS restriction. Only the hosts below are reachable. */
const ALLOWED_JSON_HOSTS = new Set([
  'users.roblox.com',
  'groups.roblox.com',
  'thumbnails.roblox.com',
  'users.roproxy.com',
  'groups.roproxy.com',
  'thumbnails.roproxy.com',
  'users.ff-roproxy.com',
  'groups.ff-roproxy.com',
  'thumbnails.ff-roproxy.com',
  'users.rotunnel.com',
  'groups.rotunnel.com',
  'thumbnails.rotunnel.com'
]);

ipcMain.handle('roblox-json', async (_event, url, options) => {
  const opts = options || {};
  const parsed = new URL(String(url || ''));
  if (parsed.protocol !== 'https:' || !ALLOWED_JSON_HOSTS.has(parsed.hostname)) {
    throw new Error('blocked host: ' + parsed.hostname);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeout || 8000);
  try {
    const res = await fetch(parsed.toString(), {
      method: opts.method || 'GET',
      headers: Object.assign({ 'User-Agent': 'Andrux/1.0' }, opts.headers || {}),
      body: opts.body,
      signal: controller.signal
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Andrux',
    transparent: true,
    frame: false,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile('andrux-dashboard.html');

  mainWindow.webContents.on('dom-ready', () => {
    mainWindow.webContents.insertCSS(`
      html, body {
        border-radius: 10px !important;
      }
      body {
        overflow: hidden !important;
        border: 1px solid rgba(0,0,0,0.05) !important;
        box-shadow: 0 10px 40px rgba(0,0,0,0.13), 0 2px 8px rgba(0,0,0,0.06) !important;
      }
      .app-shell { height: 100vh !important; overflow: hidden !important; }
      .sidebar { padding-top: 52px !important; overflow-y: auto !important; }
      .content { padding-top: 52px !important; overflow-y: auto !important; height: 100vh !important; }
      .auth-shell { padding-top: 52px !important; overflow-y: auto !important; height: 100vh !important; }
      .side-head { margin-top: 4px !important; }
      #andrux-titlebar {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        z-index: 999999;
        -webkit-app-region: drag;
        background: rgba(255, 250, 241, 0.78);
        backdrop-filter: blur(24px) saturate(180%);
        -webkit-backdrop-filter: blur(24px) saturate(180%);
        border-bottom: 1px solid rgba(0, 0, 0, 0.04);
        border-radius: 10px 10px 0 0;
        pointer-events: auto;
        user-select: none;
      }
      #andrux-titlebar .tb-brand {
        display: flex;
        align-items: center;
        gap: 8px;
        padding-left: 16px;
        pointer-events: none;
      }
      #andrux-titlebar .tb-logo {
        width: 22px;
        height: 22px;
        border-radius: 6px;
        background: linear-gradient(135deg, #e8a849, #d4881a);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-weight: 700;
        font-size: 10px;
        font-family: system-ui;
        letter-spacing: -0.5px;
        box-shadow: 0 1px 3px rgba(212, 136, 26, 0.3);
      }
      #andrux-titlebar .tb-name {
        font-size: 12px;
        font-weight: 600;
        color: #5a544a;
        letter-spacing: 0.3px;
        font-family: system-ui;
      }
      #andrux-titlebar .tb-controls {
        display: flex;
        -webkit-app-region: no-drag;
        height: 40px;
      }
      #andrux-titlebar .tb-btn {
        width: 46px;
        height: 40px;
        border: none;
        background: transparent;
        cursor: pointer;
        color: #746d61;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.12s ease;
        font-family: system-ui;
      }
      #andrux-titlebar .tb-btn:hover {
        background: rgba(0, 0, 0, 0.05);
      }
      #andrux-titlebar .tb-btn-close:hover {
        background: #e23c2c;
        color: #fff;
      }
    `);

    mainWindow.webContents.executeJavaScript(`
      if (!document.getElementById('andrux-titlebar')) {
        var tb = document.createElement('div');
        tb.id = 'andrux-titlebar';

        var brand = document.createElement('div');
        brand.className = 'tb-brand';
        brand.innerHTML = '<div class="tb-logo">AX</div><span class="tb-name">Andrux</span>';

        var controls = document.createElement('div');
        controls.className = 'tb-controls';

        var btnMin = document.createElement('button');
        btnMin.className = 'tb-btn';
        btnMin.innerHTML = '<svg width="11" height="11" viewBox="0 0 11 11"><rect x="1" y="5" width="9" height="1" fill="currentColor"/></svg>';
        btnMin.onclick = function() { window.andruxDesktop.minimize(); };

        var btnMax = document.createElement('button');
        btnMax.className = 'tb-btn';
        btnMax.id = 'andrux-btn-max';
        btnMax.innerHTML = '<svg width="11" height="11" viewBox="0 0 11 11"><rect x="1.5" y="1.5" width="8" height="8" stroke="currentColor" stroke-width="1" fill="none" rx="1"/></svg>';
        btnMax.onclick = function() { window.andruxDesktop.maximize(); };

        var btnClose = document.createElement('button');
        btnClose.className = 'tb-btn tb-btn-close';
        btnClose.innerHTML = '<svg width="11" height="11" viewBox="0 0 11 11"><path d="M2,2 L9,9 M9,2 L2,9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>';
        btnClose.onclick = function() { window.andruxDesktop.close(); };

        controls.appendChild(btnMin);
        controls.appendChild(btnMax);
        controls.appendChild(btnClose);
        tb.appendChild(brand);
        tb.appendChild(controls);
        document.body.appendChild(tb);
      }
    `);
  });

  mainWindow.on('maximize', () => {
    mainWindow.webContents.insertCSS(`
      html, body { border-radius: 0 !important; border: none !important; box-shadow: none !important; }
      #andrux-titlebar { border-radius: 0 !important; }
    `);
    mainWindow.webContents.executeJavaScript(`
      var btn = document.getElementById('andrux-btn-max');
      if (btn) btn.innerHTML = '<svg width="11" height="11" viewBox="0 0 11 11"><rect x="2.5" y="1.5" width="6" height="7" stroke="currentColor" stroke-width="1" fill="none" rx="1"/><path d="M3.5,3.5 L3.5,2.5 L9.5,2.5 L9.5,8.5 L8.5,8.5" stroke="currentColor" stroke-width="1" fill="none"/></svg>';
    `);
  });

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.insertCSS(`
      html, body { border-radius: 10px !important; border: 1px solid rgba(0,0,0,0.05) !important; box-shadow: 0 10px 40px rgba(0,0,0,0.13), 0 2px 8px rgba(0,0,0,0.06) !important; }
      #andrux-titlebar { border-radius: 10px 10px 0 0 !important; }
    `);
    mainWindow.webContents.executeJavaScript(`
      var btn = document.getElementById('andrux-btn-max');
      if (btn) btn.innerHTML = '<svg width="11" height="11" viewBox="0 0 11 11"><rect x="1.5" y="1.5" width="8" height="8" stroke="currentColor" stroke-width="1" fill="none" rx="1"/></svg>';
    `);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternalSafe(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault();
      openExternalSafe(url);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
