const tabs = document.querySelectorAll('.tab');
const chatView = document.getElementById('chat-view');
const settingsView = document.getElementById('settings-view');

const codeBox = document.getElementById('code-box');
const promptBox = document.getElementById('prompt-box');
const responseBox = document.getElementById('response');
const sendBtn = document.getElementById('send-btn');
const applyBtn = document.getElementById('apply-btn');
const closeBtn = document.getElementById('close-btn');

const providerSelect = document.getElementById('provider-select');
const apiKeyInput = document.getElementById('apikey-input');
const modelInput = document.getElementById('model-input');
const saveSettingsBtn = document.getElementById('save-settings-btn');

let lastResult = '';

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const isChat = tab.dataset.tab === 'chat';
    chatView.style.display = isChat ? 'flex' : 'none';
    settingsView.style.display = isChat ? 'none' : 'flex';
  });
});

closeBtn.addEventListener('click', () => window.kiro.closePanel());

async function loadSettings() {
  const s = await window.kiro.getSettings();
  providerSelect.value = s.provider || 'openai';
  apiKeyInput.value = s.apiKey || '';
  modelInput.value = s.model || '';
}
loadSettings();

saveSettingsBtn.addEventListener('click', async () => {
  await window.kiro.setSettings({
    provider: providerSelect.value,
    apiKey: apiKeyInput.value.trim(),
    model: modelInput.value.trim()
  });
  saveSettingsBtn.textContent = 'Saved ✓';
  setTimeout(() => (saveSettingsBtn.textContent = 'Save'), 1200);
});

document.querySelectorAll('.quick-actions button').forEach(btn => {
  btn.addEventListener('click', async () => {
    const action = btn.dataset.action;
    if (action === 'grab') {
      codeBox.value = await window.kiro.readClipboard();
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

  const systemPrompt = [
    'You are Kiro, a friendly AI coding companion that lives as a desktop cat.',
    'When given code, respond with the requested help.',
    'If you return modified/fixed code, put ONLY the code in a single fenced code block,',
    'followed by a short plain-language explanation after the block.'
  ].join(' ');

  const result = await window.kiro.ask({ systemPrompt, userPrompt, code });

  sendBtn.disabled = false;
  sendBtn.textContent = 'Ask Kiro';

  if (result.error) {
    responseBox.textContent = `⚠️ ${result.error}`;
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
  applyBtn.textContent = 'Copied ✓';
  setTimeout(() => (applyBtn.textContent = 'Copy result to clipboard'), 1200);
});
