const tabs = document.querySelectorAll('.tab');
const views = document.querySelectorAll('.view');

const codeBox = document.getElementById('code-box');
const promptBox = document.getElementById('prompt-box');
const responseBox = document.getElementById('response');
const sendBtn = document.getElementById('send-btn');
const applyBtn = document.getElementById('apply-btn');
const saveToFileBtn = document.getElementById('save-to-file-btn');
const closeBtn = document.getElementById('close-btn');
const settingsTopBtn = document.getElementById('settings-top-btn');

const providerSelect = document.getElementById('provider-select');
const apiKeyInput = document.getElementById('apikey-input');
const modelInput = document.getElementById('model-input');
const profileNameInput = document.getElementById('profile-name-input');
const saveSettingsBtn = document.getElementById('save-settings-btn');

const chooseFolderBtn = document.getElementById('choose-folder-btn');
const refreshFilesBtn = document.getElementById('refresh-files-btn');
const folderPathEl = document.getElementById('folder-path');
const fileListEl = document.getElementById('file-list');

const skinsContainer = document.getElementById('skins-container');

let lastResult = '';
let openFilePath = null;
let currentSettings = null;

// Small UI layer kept in JS so the existing panel HTML remains compatible.
function installWorkspacePolish() {
  const style = document.createElement('style');
  style.textContent = `
    .workspace-meta { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-top:-2px; }
    .context-pill { display:inline-flex; align-items:center; gap:5px; max-width:62%; padding:5px 8px; border-radius:8px; background:rgba(139,92,246,.08); border:1px solid rgba(139,92,246,.15); color:#bdb2d8; font-size:9px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .context-pill strong { color:#eee8fb; overflow:hidden; text-overflow:ellipsis; }
    .shortcut-pill { color:#777084; font-size:9px; }
    .response-card-head { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:7px; }
    .response-title { display:flex; align-items:center; gap:7px; font-size:10px; font-weight:800; color:#e9e3f5; text-transform:uppercase; letter-spacing:.65px; }
    .response-state { font-size:9px; color:#7d748e; }
    .response-state.ready { color:#4ade80; }
    .response-state.busy { color:#a78bfa; }
    .response-state.error { color:#fb7185; }
    .response-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:92px; text-align:center; color:#777084; gap:6px; }
    .response-empty .icon { font-size:20px; opacity:.85; }
    .response-empty strong { color:#aaa1b9; font-size:11px; }
    .response-empty span { font-size:9px; }
    .response-ready { color:#e5deef; }
    .quick-actions button.action-active { border-color:rgba(139,92,246,.65); background:rgba(139,92,246,.12); box-shadow:0 0 0 2px rgba(139,92,246,.07); }
    #send-btn { min-height:40px; font-size:12px; }
    #apply-btn { min-height:40px; }
    #save-to-file-btn { min-height:38px; }
    @media (max-height:560px) {
      #code-box { height:82px; min-height:68px; }
      #prompt-box { height:48px; min-height:44px; }
      #response { min-height:90px; }
      .hero-card { margin-top:0; }
    }
  `;
  document.head.appendChild(style);

  const codeLabel = document.querySelector('#chat-view .field-label');
  if (codeLabel) {
    const meta = document.createElement('div');
    meta.className = 'workspace-meta';
    meta.innerHTML = `
      <span class="context-pill" id="file-context">📄 <strong>No file selected</strong></span>
      <span class="shortcut-pill">Ctrl/⌘ + Enter to ask</span>
    `;
    codeLabel.parentNode.insertBefore(meta, codeLabel);
  }

  if (responseBox) {
    const head = document.createElement('div');
    head.className = 'response-card-head';
    head.innerHTML = `
      <div class="response-title">✦ Kiro response</div>
      <div class="response-state ready" id="response-state">Ready</div>
    `;
    responseBox.parentNode.insertBefore(head, responseBox);
    responseBox.innerHTML = `<div class="response-empty"><div class="icon">✦</div><strong>Your coding answer will appear here</strong><span>Ask Kiro to explain, fix, refactor, or review your code.</span></div>`;
  }
}

function setResponseState(state, label) {
  const el = document.getElementById('response-state');
  if (!el) return;
  el.className = `response-state ${state}`;
  el.textContent = label;
}

function setFileContext(path) {
  const el = document.getElementById('file-context');
  if (!el) return;
  const label = path ? path : 'No file selected';
  el.innerHTML = `📄 <strong>${escapeHtml(label)}</strong>`;
  el.title = label;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;'
  }[char]));
}

function showTab(tabName) {
  const validTabs = ['chat', 'files', 'character', 'settings'];
  if (!validTabs.includes(tabName)) tabName = 'chat';

  tabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });

  views.forEach(view => {
    view.classList.toggle('active', view.id === `${tabName}-view`);
  });

  // Always reset the selected view to its top so hero/content cannot appear clipped.
  const activeView = document.getElementById(`${tabName}-view`);
  if (activeView) requestAnimationFrame(() => { activeView.scrollTop = 0; });

  if (tabName === 'settings') loadSettings();
  if (tabName === 'files') refreshFileList();
}

// Event delegation keeps navigation reliable even if the panel HTML changes.
document.getElementById('tabs').addEventListener('click', event => {
  const tab = event.target.closest('.tab');
  if (!tab) return;
  showTab(tab.dataset.tab);
});

settingsTopBtn.addEventListener('click', () => showTab('settings'));
closeBtn.addEventListener('click', () => window.kiro.closePanel());

async function loadSettings() {
  try {
    currentSettings = await window.kiro.getSettings();
    providerSelect.value = currentSettings?.provider || 'openai';
    apiKeyInput.value = currentSettings?.apiKey || '';
    modelInput.value = currentSettings?.model || '';
    profileNameInput.value = currentSettings?.profile?.name || '';
    renderSkins(currentSettings?.character?.skin || 'violet');
    folderPathEl.textContent = currentSettings?.project?.folder || 'No folder selected yet.';
  } catch (error) {
    console.error('Kiro settings load failed:', error);
    responseBox.textContent = `⚠️ Could not load settings: ${error.message || error}`;
    setResponseState('error', 'Settings error');
  }
}

async function saveSettings() {
  saveSettingsBtn.disabled = true;
  try {
    currentSettings = await window.kiro.setSettings({
      provider: providerSelect.value,
      apiKey: apiKeyInput.value.trim(),
      model: modelInput.value.trim(),
      profile: { name: profileNameInput.value.trim() }
    });
    saveSettingsBtn.textContent = 'Saved ✓';
  } catch (error) {
    console.error('Kiro settings save failed:', error);
    saveSettingsBtn.textContent = 'Save failed';
  } finally {
    setTimeout(() => {
      saveSettingsBtn.textContent = '💾 Save Settings';
      saveSettingsBtn.disabled = false;
    }, 1200);
  }
}

saveSettingsBtn.addEventListener('click', saveSettings);

function renderSkins(selectedId) {
  skinsContainer.innerHTML = '';
  if (typeof KIRO_SKINS === 'undefined') {
    skinsContainer.textContent = 'Character skins unavailable.';
    return;
  }

  Object.entries(KIRO_SKINS).forEach(([id, skin]) => {
    const opt = document.createElement('div');
    opt.className = 'skin-option' + (id === selectedId ? ' selected' : '');
    opt.innerHTML = `
      <div class="skin-swatch" style="background:${skin.bodyMain}; box-shadow: inset 0 0 0 6px ${skin.bodyDark}22;">🐾</div>
      <div class="skin-label">${escapeHtml(skin.name)}</div>
    `;

    opt.addEventListener('click', async () => {
      try {
        currentSettings = await window.kiro.setSettings({ character: { skin: id } });
        renderSkins(id);
      } catch (error) {
        console.error('Kiro skin save failed:', error);
      }
    });

    skinsContainer.appendChild(opt);
  });
}

chooseFolderBtn.addEventListener('click', async () => {
  try {
    const project = await window.kiro.chooseProjectFolder();
    folderPathEl.textContent = project?.folder || 'No folder selected yet.';
    if (project?.folder) await refreshFileList();
  } catch (error) {
    responseBox.textContent = `⚠️ Could not choose project folder: ${error.message || error}`;
  }
});

refreshFilesBtn.addEventListener('click', refreshFileList);

async function refreshFileList() {
  fileListEl.innerHTML = '<li>Loading files…</li>';

  try {
    const result = await window.kiro.listProjectFiles();
    fileListEl.innerHTML = '';

    if (result.error) {
      fileListEl.innerHTML = `<li>${escapeHtml(result.error)}</li>`;
      return;
    }

    if (!result.files?.length) {
      fileListEl.innerHTML = '<li>No files found.</li>';
      return;
    }

    result.files.forEach(rel => {
      const li = document.createElement('li');
      li.textContent = rel;

      li.addEventListener('click', async () => {
        const fileResult = await window.kiro.readProjectFile(rel);
        if (fileResult.error) {
          responseBox.textContent = `⚠️ ${fileResult.error}`;
          setResponseState('error', 'File error');
          return;
        }

        codeBox.value = fileResult.content;
        openFilePath = rel;
        setFileContext(rel);
        saveToFileBtn.style.display = 'block';

        document.querySelectorAll('#file-list li').forEach(el => el.classList.remove('selected'));
        li.classList.add('selected');
        showTab('chat');
      });

      fileListEl.appendChild(li);
    });
  } catch (error) {
    fileListEl.innerHTML = `<li>⚠️ ${escapeHtml(error.message || error)}</li>`;
  }
}

saveToFileBtn.addEventListener('click', async () => {
  if (!openFilePath || !lastResult) return;

  const result = await window.kiro.writeProjectFile(openFilePath, lastResult);
  if (result.error) {
    responseBox.textContent += `\n\n⚠️ ${result.error}`;
    setResponseState('error', 'Save failed');
    return;
  }

  saveToFileBtn.textContent = 'Saved ✓';
  setResponseState('ready', 'Saved');
  setTimeout(() => { saveToFileBtn.textContent = '💾 Save result to open file'; }, 1200);
});

document.querySelectorAll('.quick-actions button').forEach(btn => {
  btn.addEventListener('click', async () => {
    document.querySelectorAll('.quick-actions button').forEach(b => b.classList.remove('action-active'));
    btn.classList.add('action-active');

    const action = btn.dataset.action;
    if (action === 'grab') {
      codeBox.value = await window.kiro.readClipboard();
      openFilePath = null;
      setFileContext(null);
      saveToFileBtn.style.display = 'none';
      setResponseState('ready', 'Clipboard loaded');
      setTimeout(() => btn.classList.remove('action-active'), 500);
      return;
    }

    const presets = {
      explain: 'Explain what this code does, step by step, in plain language.',
      fix: 'Find and fix the bug(s) in this code. Return the corrected full code, then briefly explain what was wrong.',
      refactor: 'Refactor this code for readability and best practices, keeping behavior identical. Return the full refactored code, then a short summary of changes.',
      comment: 'Add clear, concise comments to this code explaining each meaningful part. Return the full commented code.'
    };

    if (presets[action]) {
      promptBox.value = presets[action];
      await sendToAI();
    }
  });
});

sendBtn.addEventListener('click', sendToAI);

promptBox.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault();
    sendToAI();
  }
});

async function sendToAI() {
  const code = codeBox.value.trim();
  const userPrompt = promptBox.value.trim() || 'Help me with this code.';

  if (!code && !userPrompt) return;

  sendBtn.disabled = true;
  sendBtn.textContent = 'Thinking…';
  responseBox.textContent = 'Kiro is thinking…';
  setResponseState('busy', 'Thinking');

  const name = currentSettings?.profile?.name;
  const systemPrompt = [
    'You are Kiro, a friendly AI coding companion that lives as a desktop cat.',
    name ? `The user's name is ${name}.` : '',
    'When given code, respond with the requested help.',
    'If you return modified/fixed code, put ONLY the code in a single fenced code block,',
    'followed by a short plain-language explanation after the block.'
  ].filter(Boolean).join(' ');

  try {
    const result = await window.kiro.ask({ systemPrompt, userPrompt, code });

    if (result.error) {
      responseBox.textContent = `⚠️ ${result.error}`;
      lastResult = '';
      setResponseState('error', 'Error');
      return;
    }

    responseBox.textContent = result.text || '(empty response)';
    responseBox.classList.add('response-ready');
    lastResult = extractCode(result.text) || result.text || '';
    setResponseState('ready', 'Complete');
  } catch (error) {
    responseBox.textContent = `⚠️ ${error.message || error}`;
    lastResult = '';
    setResponseState('error', 'Error');
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = '✨ Ask Kiro';
  }
}

function extractCode(text) {
  if (!text) return '';
  const match = text.match(/```[a-zA-Z0-9_+-]*\n([\s\S]*?)```/);
  return match ? match[1].trim() : '';
}

applyBtn.addEventListener('click', async () => {
  if (!lastResult) return;

  await window.kiro.writeClipboard(lastResult);
  applyBtn.textContent = 'Copied ✓';
  setResponseState('ready', 'Copied');

  setTimeout(() => { applyBtn.textContent = 'Copy result to clipboard'; }, 1200);
});

installWorkspacePolish();
loadSettings();
setFileContext(null);
