const tabs = document.querySelectorAll('.tab');
const views = document.querySelectorAll('.view');

const codeBox = document.getElementById('code-box');
const promptBox = document.getElementById('prompt-box');
const responseBox = document.getElementById('response');
const sendBtn = document.getElementById('send-btn');
const applyBtn = document.getElementById('apply-btn');
const saveToFileBtn = document.getElementById('save-to-file-btn');
const closeBtn = document.getElementById('close-btn');

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

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    views.forEach(v => v.classList.remove('active'));
    document.getElementById(`${tab.dataset.tab}-view`).classList.add('active');
  });
});

closeBtn.addEventListener('click', () => window.kiro.closePanel());

async function loadSettings() {
  currentSettings = await window.kiro.getSettings();
  providerSelect.value = currentSettings.provider || 'openai';
  apiKeyInput.value = currentSettings.apiKey || '';
  modelInput.value = currentSettings.model || '';
  profileNameInput.value = currentSettings.profile?.name || '';
  renderSkins(currentSettings.character?.skin || 'violet');
  folderPathEl.textContent = currentSettings.project?.folder || 'No folder selected yet.';
}
loadSettings();

saveSettingsBtn.addEventListener('click', async () => {
  currentSettings = await window.kiro.setSettings({
    provider: providerSelect.value,
    apiKey: apiKeyInput.value.trim(),
    model: modelInput.value.trim(),
    profile: { name: profileNameInput.value.trim() }
  });
  saveSettingsBtn.textContent = 'Saved \u2713';
  setTimeout(() => (saveSettingsBtn.textContent = 'Save'), 1200);
});

function renderSkins(selectedId) {
  skinsContainer.innerHTML = '';
  Object.entries(KIRO_SKINS).forEach(([id, skin]) => {
    const opt = document.createElement('div');
    opt.className = 'skin-option' + (id === selectedId ? ' selected' : '');
    opt.innerHTML = `
      <div class="skin-swatch" style="background:${skin.bodyMain}; box-shadow: inset 0 0 0 6px ${skin.bodyDark}22;">\uD83D\uDC3E</div>
      <div class="skin-label">${skin.name}</div>
    `;
    opt.addEventListener('click', async () => {
      currentSettings = await window.kiro.setSettings({ character: { skin: id } });
      renderSkins(id);
    });
    skinsContainer.appendChild(opt);
  });
}

chooseFolderBtn.addEventListener('click', async () => {
  const project = await window.kiro.chooseProjectFolder();
  folderPathEl.textContent = project.folder || 'No folder selected yet.';
  if (project.folder) await refreshFileList();
});

refreshFilesBtn.addEventListener('click', refreshFileList);

async function refreshFileList() {
  const result = await window.kiro.listProjectFiles();
  fileListEl.innerHTML = '';
  if (result.error) {
    fileListEl.innerHTML = `<li>${result.error}</li>`;
    return;
  }
  result.files.forEach(rel => {
    const li = document.createElement('li');
    li.textContent = rel;
    li.addEventListener('click', async () => {
      const fileResult = await window.kiro.readProjectFile(rel);
      if (fileResult.error) {
        responseBox.textContent = `\u26A0\uFE0F ${fileResult.error}`;
        return;
      }
      codeBox.value = fileResult.content;
      openFilePath = rel;
      saveToFileBtn.style.display = 'block';
      document.querySelectorAll('#file-list li').forEach(el => el.classList.remove('selected'));
      li.classList.add('selected');
      document.querySelector('.tab[data-tab="chat"]').click();
    });
    fileListEl.appendChild(li);
  });
}

saveToFileBtn.addEventListener('click', async () => {
  if (!openFilePath || !lastResult) return;
  const result = await window.kiro.writeProjectFile(openFilePath, lastResult);
  if (result.error) {
    responseBox.textContent += `\n\n\u26A0\uFE0F ${result.error}`;
  } else {
    saveToFileBtn.textContent = 'Saved \u2713';
    setTimeout(() => (saveToFileBtn.textContent = '\uD83D\uDCBE Save result to open file'), 1200);
  }
});

document.querySelectorAll('.quick-actions button').forEach(btn => {
  btn.addEventListener('click', async () => {
    const action = btn.dataset.action;
    if (action === 'grab') {
      codeBox.value = await window.kiro.readClipboard();
      openFilePath = null;
      saveToFileBtn.style.display = 'none';
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

async function sendToAI() {
  const code = codeBox.value.trim();
  const userPrompt = promptBox.value.trim() || 'Help me with this code.';
  if (!code && !userPrompt) return;

  sendBtn.disabled = true;
  sendBtn.textContent = 'Thinking...';
  responseBox.textContent = 'Kiro is thinking...';

  const name = currentSettings?.profile?.name;
  const systemPrompt = [
    'You are Kiro, a friendly AI coding companion that lives as a desktop cat.',
    name ? `The user's name is ${name}.` : '',
    'When given code, respond with the requested help.',
    'If you return modified/fixed code, put ONLY the code in a single fenced code block,',
    'followed by a short plain-language explanation after the block.'
  ].join(' ');

  const result = await window.kiro.ask({ systemPrompt, userPrompt, code });

  sendBtn.disabled = false;
  sendBtn.textContent = 'Ask Kiro';

  if (result.error) {
    responseBox.textContent = `\u26A0\uFE0F ${result.error}`;
    lastResult = '';
    return;
  }

  responseBox.textContent = result.text || '(empty response)';
  lastResult = extractCode(result.text) || result.text || '';
}

function extractCode(text) {
  if (!text) return '';
  const match = text.match(/```[a-zA-Z]*\n([\s\S]*?)```/);
  return match ? match[1].trim() : '';
}

applyBtn.addEventListener('click', async () => {
  if (!lastResult) return;
  await window.kiro.writeClipboard(lastResult);
  applyBtn.textContent = 'Copied \u2713';
  setTimeout(() => (applyBtn.textContent = 'Copy result to clipboard'), 1200);
});
