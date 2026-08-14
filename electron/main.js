const { app, BrowserWindow, ipcMain, clipboard, screen, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const Store = require('electron-store');

const store = new Store({
  name: 'kiro-settings',
  defaults: {
    provider: 'openai', // 'openai' | 'anthropic'
    apiKey: '',
    model: '' // optional override
  }
});

let catWindow = null;
let panelWindow = null;
let tray = null;

const CAT_SIZE = 140;

function createCatWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  catWindow = new BrowserWindow({
    width: CAT_SIZE,
    height: CAT_SIZE,
    x: width - CAT_SIZE - 40,
    y: height - CAT_SIZE - 40,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  catWindow.setAlwaysOnTop(true, 'screen-saver');
  catWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  catWindow.loadFile(path.join(__dirname, 'cat-overlay.html'));

  catWindow.on('closed', () => {
    catWindow = null;
  });
}

function createPanelWindow() {
  if (panelWindow) {
    panelWindow.show();
    panelWindow.focus();
    return;
  }

  const catBounds = catWindow ? catWindow.getBounds() : null;
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  const panelW = 420;
  const panelH = 560;
  const x = catBounds ? Math.max(20, catBounds.x - panelW + CAT_SIZE) : sw - panelW - 40;
  const y = catBounds ? Math.max(20, catBounds.y - panelH - 20) : sh - panelH - 40;

  panelWindow = new BrowserWindow({
    width: panelW,
    height: panelH,
    x,
    y,
    minWidth: 340,
    minHeight: 420,
    alwaysOnTop: true,
    frame: false,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  panelWindow.loadFile(path.join(__dirname, 'panel.html'));

  panelWindow.on('closed', () => {
    panelWindow = null;
  });
}

function createTray() {
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  const menu = Menu.buildFromTemplate([
    { label: 'Open Kiro Panel', click: () => createPanelWindow() },
    { label: 'Show/Hide Cat', click: () => {
        if (!catWindow) return;
        catWindow.isVisible() ? catWindow.hide() : catWindow.show();
      } },
    { type: 'separator' },
    { label: 'Quit Kiro', click: () => app.quit() }
  ]);
  tray.setToolTip('Kiro');
  tray.setContextMenu(menu);
}

app.whenReady().then(() => {
  createCatWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createCatWindow();
  });
});

app.on('window-all-closed', () => {
  // Keep running in tray on all platforms for a "lives on your screen" companion.
  // Comment this out if you want it to quit like a normal app on Win/Linux.
});

// ---------- IPC ----------

ipcMain.on('cat:toggle-panel', () => {
  if (panelWindow) {
    panelWindow.isVisible() ? panelWindow.hide() : panelWindow.show();
  } else {
    createPanelWindow();
  }
});

ipcMain.on('cat:move', (event, { dx, dy }) => {
  if (!catWindow) return;
  const b = catWindow.getBounds();
  catWindow.setBounds({ x: b.x + dx, y: b.y + dy, width: b.width, height: b.height });
});

ipcMain.handle('settings:get', () => store.store);
ipcMain.handle('settings:set', (event, partial) => {
  store.set(partial);
  return store.store;
});

ipcMain.handle('clipboard:read', () => clipboard.readText());
ipcMain.handle('clipboard:write', (event, text) => {
  clipboard.writeText(text);
  return true;
});

ipcMain.handle('panel:close', () => {
  if (panelWindow) panelWindow.hide();
});

// ---------- AI bridge ----------
// All AI calls happen here in the main process so the API key never touches
// a renderer devtools console and CORS is never a factor.

ipcMain.handle('ai:ask', async (event, { systemPrompt, userPrompt, code }) => {
  const { provider, apiKey, model } = store.store;

  if (!apiKey) {
    return { error: 'No API key set. Open Settings and add your OpenAI or Anthropic key.' };
  }

  const fullUserPrompt = code
    ? `${userPrompt}\n\n\`\`\`\n${code}\n\`\`\``
    : userPrompt;

  try {
    if (provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: model || 'claude-sonnet-4-6',
          max_tokens: 2000,
          system: systemPrompt,
          messages: [{ role: 'user', content: fullUserPrompt }]
        })
      });
      const data = await res.json();
      if (!res.ok) return { error: data?.error?.message || `Anthropic API error (${res.status})` };
      const text = (data.content || []).map(b => b.text || '').join('\n');
      return { text };
    }

    // default: OpenAI-compatible
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: fullUserPrompt }
        ]
      })
    });
    const data = await res.json();
    if (!res.ok) return { error: data?.error?.message || `OpenAI API error (${res.status})` };
    const text = data.choices?.[0]?.message?.content || '';
    return { text };
  } catch (err) {
    return { error: err.message || String(err) };
  }
});
