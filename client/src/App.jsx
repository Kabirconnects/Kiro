import { useEffect, useState } from 'react';
import CatSVG from './CatSVG.jsx';
import { KIRO_SKINS } from './skins.js';

const STORAGE_KEY = 'kiro-web-settings';

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { provider: 'openai', apiKey: '', model: '', skin: 'violet', name: '' };
}

function saveSettings(s) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

async function askAI(settings, systemPrompt, userPrompt, code) {
  const { provider, apiKey, model } = settings;
  if (!apiKey) return { error: 'No API key set. Open Settings and add your key.' };

  const fullUserPrompt = code ? `${userPrompt}\n\n\`\`\`\n${code}\n\`\`\`` : userPrompt;

  try {
    if (provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
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
      return { text: (data.content || []).map(b => b.text || '').join('\n') };
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
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
    return { text: data.choices?.[0]?.message?.content || '' };
  } catch (err) {
    return { error: err.message || String(err) };
  }
}

function extractCode(text) {
  if (!text) return '';
  const match = text.match(/```[a-zA-Z]*\n([\s\S]*?)```/);
  return match ? match[1].trim() : '';
}

const PRESETS = {
  explain: 'Explain what this code does, step by step, in plain language.',
  fix: 'Find and fix the bug(s) in this code. Return the corrected full code, then briefly explain what was wrong.',
  refactor: 'Refactor this code for readability and best practices, keeping behavior identical. Return the full refactored code, then a short summary of changes.',
  comment: 'Add clear, concise comments to this code explaining each meaningful part. Return the full commented code.'
};

export default function App() {
  const [settings, setSettings] = useState(loadSettings);
  const [tab, setTab] = useState('chat');
  const [code, setCode] = useState('');
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState("Kiro's answer will show up here.");
  const [lastResult, setLastResult] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => saveSettings(settings), [settings]);

  const skin = KIRO_SKINS[settings.skin] || KIRO_SKINS.violet;

  async function grabClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      setCode(text);
    } catch {
      setResponse('⚠️ This browser blocked clipboard access — paste your code into the box instead.');
    }
  }

  async function copyResult() {
    if (!lastResult) return;
    try {
      await navigator.clipboard.writeText(lastResult);
    } catch {}
  }

  async function send(overridePrompt) {
    const userPrompt = (overridePrompt || prompt || 'Help me with this code.').trim();
    setPrompt(userPrompt);
    setLoading(true);
    setResponse('Kiro is thinking...');

    const systemPrompt = [
      'You are Kiro, a friendly AI coding companion running as a free web app.',
      settings.name ? `The user's name is ${settings.name}.` : '',
      'When given code, respond with the requested help.',
      'If you return modified/fixed code, put ONLY the code in a single fenced code block,',
      'followed by a short plain-language explanation after the block.'
    ].join(' ');

    const result = await askAI(settings, systemPrompt, userPrompt, code.trim());
    setLoading(false);

    if (result.error) {
      setResponse(`⚠️ ${result.error}`);
      setLastResult('');
      return;
    }
    setResponse(result.text || '(empty response)');
    setLastResult(extractCode(result.text) || result.text || '');
  }

  return (
    <div style={styles.page(skin)}>
      <div style={styles.card}>
        <div style={styles.header}>
          <CatSVG skin={skin} size={56} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>Kiro 🐾</div>
            <div style={{ color: '#9a8fc2', fontSize: 12 }}>Free browser companion — bring your own API key</div>
          </div>
        </div>

        <div style={styles.tabs}>
          {['chat', 'character', 'settings'].map(t => (
            <div
              key={t}
              onClick={() => setTab(t)}
              style={styles.tab(tab === t)}
            >
              {t[0].toUpperCase() + t.slice(1)}
            </div>
          ))}
        </div>

        {tab === 'chat' && (
          <div style={styles.view}>
            <div style={styles.quickActions}>
              <button style={styles.chip} onClick={grabClipboard}>📋 Grab clipboard</button>
              {Object.keys(PRESETS).map(k => (
                <button key={k} style={styles.chip} onClick={() => send(PRESETS[k])}>
                  {k[0].toUpperCase() + k.slice(1)}
                </button>
              ))}
            </div>
            <textarea
              style={styles.codeBox}
              placeholder="Paste code here, or use Grab clipboard..."
              value={code}
              onChange={e => setCode(e.target.value)}
            />
            <textarea
              style={styles.promptBox}
              placeholder="What do you want Kiro to do?"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
            />
            <div style={styles.row}>
              <button style={styles.primaryBtn} disabled={loading} onClick={() => send()}>
                {loading ? 'Thinking...' : 'Ask Kiro'}
              </button>
              <button style={styles.ghostBtn} onClick={copyResult}>Copy result</button>
            </div>
            <div style={styles.response}>{response}</div>
          </div>
        )}

        {tab === 'character' && (
          <div style={styles.view}>
            <div style={{ color: '#9a8fc2', fontSize: 12 }}>Kiro is (and always will be) a cat — pick a coloring.</div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {Object.entries(KIRO_SKINS).map(([id, s]) => (
                <div
                  key={id}
                  onClick={() => setSettings({ ...settings, skin: id })}
                  style={{ textAlign: 'center', cursor: 'pointer' }}
                >
                  <div style={{
                    borderRadius: '50%',
                    padding: 6,
                    border: settings.skin === id ? '2px solid #7c5cff' : '2px solid transparent'
                  }}>
                    <CatSVG skin={s} size={56} />
                  </div>
                  <div style={{ fontSize: 11, color: '#9a8fc2' }}>{s.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'settings' && (
          <div style={styles.view}>
            <label style={styles.label}>Your name (just for a friendlier greeting)</label>
            <input style={styles.input} value={settings.name} onChange={e => setSettings({ ...settings, name: e.target.value })} placeholder="e.g. Asur" />

            <label style={styles.label}>Provider</label>
            <select style={styles.input} value={settings.provider} onChange={e => setSettings({ ...settings, provider: e.target.value })}>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
            </select>

            <label style={styles.label}>API key (stored only in this browser's localStorage)</label>
            <input style={styles.input} type="password" value={settings.apiKey} onChange={e => setSettings({ ...settings, apiKey: e.target.value })} placeholder="sk-..." />

            <label style={styles.label}>Model (optional override)</label>
            <input style={styles.input} value={settings.model} onChange={e => setSettings({ ...settings, model: e.target.value })} placeholder="e.g. gpt-4o-mini or claude-sonnet-4-6" />

            <div style={{ color: '#9a8fc2', fontSize: 11, marginTop: 6 }}>
              Your key only ever leaves this browser to talk directly to OpenAI or Anthropic's API —
              never to any Kiro server. There's no Kiro account system yet; that only makes sense once
              there's a hosted backend to log into.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: (skin) => ({
    minHeight: '100vh',
    background: '#1a1428',
    color: '#eee6ff',
    fontFamily: '-apple-system, Segoe UI, Roboto, sans-serif',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20
  }),
  card: { width: 440, background: '#241b3d', borderRadius: 16, padding: 18, border: '1px solid #33264f' },
  header: { display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 },
  tabs: { display: 'flex', gap: 6, marginBottom: 10 },
  tab: (active) => ({
    padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12,
    background: active ? '#14102080' : 'transparent', color: active ? '#eee6ff' : '#9a8fc2'
  }),
  view: { display: 'flex', flexDirection: 'column', gap: 8 },
  quickActions: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  chip: { background: '#14102080', color: '#eee6ff', border: '1px solid #3a2c5c', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', fontSize: 12 },
  codeBox: { height: 90, background: '#14102080', border: '1px solid #3a2c5c', borderRadius: 8, color: '#eee6ff', padding: 8, fontFamily: 'monospace', fontSize: 12 },
  promptBox: { height: 44, background: '#14102080', border: '1px solid #3a2c5c', borderRadius: 8, color: '#eee6ff', padding: 8, fontSize: 12 },
  row: { display: 'flex', gap: 6 },
  primaryBtn: { flex: 1, background: '#7c5cff', color: 'white', border: 'none', borderRadius: 8, padding: 8, fontWeight: 600, cursor: 'pointer' },
  ghostBtn: { flex: 1, background: 'transparent', border: '1px solid #3a2c5c', color: '#eee6ff', borderRadius: 8, padding: 8, cursor: 'pointer' },
  response: { minHeight: 100, maxHeight: 220, overflowY: 'auto', background: '#14102080', border: '1px solid #3a2c5c', borderRadius: 8, padding: 8, whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 12 },
  label: { color: '#9a8fc2', fontSize: 12 },
  input: { background: '#14102080', border: '1px solid #3a2c5c', borderRadius: 8, color: '#eee6ff', padding: 8, fontSize: 12 }
};
