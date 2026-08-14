const { app, BrowserWindow, ipcMain, clipboard, screen, desktopCapturer, Tray, Menu, nativeImage, dialog } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const Store = require('electron-store');

const store = new Store({
  name: 'kiro-settings',
  defaults: {
    provider: 'openai', apiKey: '', model: '', character: { skin: 'violet' }, profile: { name: '' },
    project: { folder: null }, screenAssist: { enabled: false, intervalMs: 30000 }
  }
});
let catWindow = null, panelWindow = null, tray = null;
const CAT_SIZE = 140;

function createCatWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  catWindow = new BrowserWindow({ width: CAT_SIZE, height: CAT_SIZE, x: width - CAT_SIZE - 40, y: height - CAT_SIZE - 40, transparent: true, frame: false, alwaysOnTop: true, resizable: false, skipTaskbar: true, hasShadow: false, webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false } });
  catWindow.setAlwaysOnTop(true, 'screen-saver');
  catWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  catWindow.loadFile(path.join(__dirname, 'cat-overlay.html'));
  catWindow.on('closed', () => { catWindow = null; });
}
function createPanelWindow() {
  if (panelWindow) { panelWindow.show(); panelWindow.focus(); return; }
  const catBounds = catWindow ? catWindow.getBounds() : null;
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  const panelW = 420, panelH = 560;
  const x = catBounds ? Math.max(20, catBounds.x - panelW + CAT_SIZE) : sw - panelW - 40;
  const y = catBounds ? Math.max(20, catBounds.y - panelH - 20) : sh - panelH - 40;
  panelWindow = new BrowserWindow({ width: panelW, height: panelH, x, y, minWidth: 340, minHeight: 420, alwaysOnTop: true, frame: false, resizable: true, webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false } });
  panelWindow.loadFile(path.join(__dirname, 'panel.html'));
  panelWindow.on('closed', () => { panelWindow = null; });
}
function createTray() {
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip('Kiro');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Kiro Panel', click: () => createPanelWindow() },
    { label: 'Show/Hide Cat', click: () => { if (!catWindow) return; catWindow.isVisible() ? catWindow.hide() : catWindow.show(); } },
    { type: 'separator' }, { label: 'Quit Kiro', click: () => app.quit() }
  ]));
}
app.whenReady().then(() => { createCatWindow(); createTray(); app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createCatWindow(); }); });
app.on('window-all-closed', () => {});

ipcMain.on('cat:toggle-panel', () => { if (panelWindow) panelWindow.isVisible() ? panelWindow.hide() : panelWindow.show(); else createPanelWindow(); });
ipcMain.on('cat:move', (event, { dx, dy }) => { if (!catWindow) return; const b = catWindow.getBounds(); catWindow.setBounds({ x: b.x + dx, y: b.y + dy, width: b.width, height: b.height }); });
ipcMain.handle('settings:get', () => store.store);
ipcMain.handle('settings:set', (event, partial) => { store.set(partial); if (catWindow) catWindow.webContents.send('settings:changed', store.store); if (panelWindow) panelWindow.webContents.send('settings:changed', store.store); return store.store; });
ipcMain.handle('clipboard:read', () => clipboard.readText());
ipcMain.handle('clipboard:write', (event, text) => { clipboard.writeText(text); return true; });
ipcMain.handle('panel:close', () => { if (panelWindow) panelWindow.hide(); });

async function captureScreenImage() {
  const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1440, height: 900 } });
  if (!sources.length) return { error: 'No screen was available to capture.' };
  const source = sources[0];
  return { imageData: source.thumbnail.toDataURL(), sourceName: source.name || 'Screen', width: source.thumbnail.getSize().width, height: source.thumbnail.getSize().height };
}
ipcMain.handle('screen:capture', async () => {
  const win = panelWindow || catWindow;
  const { response } = await dialog.showMessageBox(win, { type: 'question', buttons: ['Cancel', 'Capture screen'], defaultId: 1, cancelId: 0, message: 'Let Kiro see your screen?', detail: 'Kiro will capture the current desktop image once and send it to your selected AI provider only when you ask for screen help.' });
  if (response !== 1) return { canceled: true };
  try { return await captureScreenImage(); } catch (err) { return { error: err.message || String(err) }; }
});
ipcMain.handle('screen:autoCapture', async () => {
  if (!store.get('screenAssist.enabled')) return { error: 'Auto Screen Assist is disabled.' };
  try { return await captureScreenImage(); } catch (err) { return { error: err.message || String(err) }; }
});

const IGNORE_DIRS = new Set(['node_modules', '.git', 'release', 'dist', '.next', '.venv']);
function withinProjectFolder(root, relativePath) {
  const resolved = path.resolve(root, relativePath), normalizedRoot = path.resolve(root) + path.sep;
  if (resolved + path.sep !== normalizedRoot && !resolved.startsWith(normalizedRoot)) throw new Error('Path escapes the permitted project folder.');
  return resolved;
}
ipcMain.handle('project:chooseFolder', async () => {
  const result = await dialog.showOpenDialog(panelWindow || catWindow, { properties: ['openDirectory'] });
  if (result.canceled || !result.filePaths[0]) return store.get('project');
  store.set('project', { folder: result.filePaths[0] }); return store.get('project');
});
ipcMain.handle('project:listFiles', async () => {
  const folder = store.get('project.folder'); if (!folder) return { error: 'No project folder selected yet.' };
  const results = [];
  async function walk(dir, depth) {
    if (depth > 4 || results.length > 500) return;
    let entries; try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) { if (IGNORE_DIRS.has(entry.name) || entry.name.startsWith('.')) continue; const full = path.join(dir, entry.name), rel = path.relative(folder, full); if (entry.isDirectory()) await walk(full, depth + 1); else results.push(rel); }
  }
  await walk(folder, 0); return { files: results, folder };
});
ipcMain.handle('project:readFile', async (event, relativePath) => {
  const folder = store.get('project.folder'); if (!folder) return { error: 'No project folder selected.' };
  try { return { content: await fs.readFile(withinProjectFolder(folder, relativePath), 'utf-8') }; } catch (err) { return { error: err.message }; }
});
async function writeProjectFile(relativePath, content) {
  const folder = store.get('project.folder'); if (!folder) return { error: 'No project folder selected.' };
  await fs.writeFile(withinProjectFolder(folder, relativePath), content, 'utf-8'); return { ok: true };
}
ipcMain.handle('project:writeFile', async (event, { relativePath, content }) => {
  const folder = store.get('project.folder'); if (!folder) return { error: 'No project folder selected.' };
  const { response } = await dialog.showMessageBox(panelWindow || catWindow, { type: 'question', buttons: ['Cancel', `Overwrite ${relativePath}`], defaultId: 1, cancelId: 0, message: `Let Kiro write to "${relativePath}"?`, detail: 'This will overwrite the file with the AI-generated content shown in the panel.' });
  if (response !== 1) return { error: 'Write cancelled.' };
  try { return await writeProjectFile(relativePath, content); } catch (err) { return { error: err.message }; }
});
ipcMain.handle('project:applyFix', async (event, { relativePath, content }) => {
  try { return await writeProjectFile(relativePath, content); } catch (err) { return { error: err.message }; }
});

ipcMain.handle('ai:ask', async (event, { systemPrompt, userPrompt, code, imageData }) => {
  const { provider, apiKey, model } = store.store;
  if (!apiKey) return { error: `No ${provider || 'AI'} API key set. Open Settings and add your API key.` };
  const fullUserPrompt = code ? `${userPrompt}\n\n\`\`\`\n${code}\n\`\`\`` : userPrompt;
  try {
    if (provider === 'cerebras') {
      // Cerebras deprecated llama-3.3-70b in 2026. Use the current production model.
      const cerebrasModel = (!model || model === 'llama-3.3-70b' || model === 'llama3.3-70b') ? 'gpt-oss-120b' : model;
      // Current public Cerebras models are text-only; screen images must use a vision-capable provider.
      if (imageData) return { error: 'Cerebras text models do not support vision. Switch to a vision-capable OpenAI or Anthropic model for Screen Assist.' };
      const res = await fetch('https://api.cerebras.ai/v1/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model: cerebrasModel, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: fullUserPrompt }], max_completion_tokens: 2000 }) });
      const data = await res.json(); if (!res.ok) return { error: data?.error?.message || `Cerebras API error (${res.status})` }; return { text: data.choices?.[0]?.message?.content || '' };
    }
    if (provider === 'anthropic') {
      const content = imageData ? [{ type: 'text', text: fullUserPrompt }, { type: 'image', source: { type: 'base64', media_type: 'image/png', data: imageData.replace(/^data:image\/\w+;base64,/, '') } }] : fullUserPrompt;
      const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: model || 'claude-sonnet-4-6', max_tokens: 2000, system: systemPrompt, messages: [{ role: 'user', content }] }) });
      const data = await res.json(); if (!res.ok) return { error: data?.error?.message || `Anthropic API error (${res.status})` }; return { text: (data.content || []).map(b => b.text || '').join('\n') };
    }
    const openAiContent = imageData ? [{ type: 'text', text: fullUserPrompt }, { type: 'image_url', image_url: { url: imageData } }] : fullUserPrompt;
    const res = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model: model || 'gpt-4o-mini', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: openAiContent }] }) });
    const data = await res.json(); if (!res.ok) return { error: data?.error?.message || `OpenAI API error (${res.status})` }; return { text: data.choices?.[0]?.message?.content || '' };
  } catch (err) { return { error: err.message || String(err) }; }
});
