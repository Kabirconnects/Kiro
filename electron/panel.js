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

function showTab(tabName) {
  const validTabs = ['chat', 'files', 'character', 'settings'];
  if (!validTabs.includes(tabName)) tabName = 'chat';

  tabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });

  views.forEach(view => {
    view.classList.toggle('active', view.id === `${tabName}-view`);
  });

  if (tabName === 'settings') loadSettings();
  if (tabName === 'files') refreshFileList();
}

// Event delegation keeps navigation reliable even if the panel HTML changes.
document.getElementById('tabs').addEventListener('click', event => {
  const tab = event.target.closest('.tab');
  if (!tab) return;
  showTab(tab.dataset.tab);
});

// Dedicated settings button in the title bar.
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
  }
}

loadSettings();

saveSettingsBtn.addEventListener('click', async () => {
  saveSettingsBtn.disabled = true;
  try {
    currentSettings = await window.kiro.setSettings({
      provider: providerSelect.value,
      apiKey: apiKeyInput.value.trim(),
      model: modelInput.value.trim(),
      profile: {
        name: profileNameInput.value.trim()
      }
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
});

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
      <div class="skin-label">${skin.name}</div>
    `;

    opt.addEventListener('click', async () => {
      try {
        currentSettings = await window.kiro.setSettings({
          character: { skin: id }
        });
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
      fileListEl.innerHTML = `<li>${result.error}</li>`;
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
          return;
        }

        codeBox.value = fileResult.content;
        openFilePath = rel;
        saveToFileBtn.style.display = 'block';

        document
          .querySelectorAll('#file-list li')
          .forEach(el => el.classList.remove('selected'));
        li.classList.add('selected');

        showTab('chat');
      });

      fileListEl.appendChild(li);
    });
  } catch (error) {
    fileListEl.innerHTML = `<li>⚠️ ${error.message || error}</li>`;
  }
}

saveToFileBtn.addEventListener('click', async () => {
  if (!openFilePath || !lastResult) return;

  const result = await window.kiro.writeProjectFile(
    openFilePath,
    lastResult
  );

  if (result.error) {
    responseBox.textContent += `\n\n⚠️ ${result.error}`;
    return;
  }

  saveToFileBtn.textContent = 'Saved ✓';
  setTimeout(() => {
    saveToFileBtn.textContent = '💾 Save result to open file';
  }, 1200);
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

  const name = currentSettings?.profile?.name;
  const systemPrompt = [
    'You are Kiro, a friendly AI coding companion that lives as a desktop cat.',
    name ? `The user's name is ${name}.` : '',
    'When given code, respond with the requested help.',
    'If you return modified/fixed code, put ONLY the code in a single fenced code block,',
    'followed by a short plain-language explanation after the block.'
  ].filter(Boolean).join(' ');

  try {
    const result = await window.kiro.ask({
      systemPrompt,
      userPrompt,
      code
    });

    if (result.error) {
      responseBox.textContent = `⚠️ ${result.error}`;
      lastResult = '';
      return;
    }

    responseBox.textContent = result.text || '(empty response)';
    lastResult = extractCode(result.text) || result.text || '';
  } catch (error) {
    responseBox.textContent = `⚠️ ${error.message || error}`;
    lastResult = '';
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = 'Ask Kiro';
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

  setTimeout(() => {
    applyBtn.textContent = 'Copy result to clipboard';
  }, 1200);
});
