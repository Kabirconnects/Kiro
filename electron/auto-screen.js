(() => {
  let stream = null;
  let video = null;
  let timer = null;
  let running = false;
  let busy = false;
  let intervalMs = 30000;
  let lastFix = null;

  const style = document.createElement('style');
  style.textContent = `
    .auto-screen-card { margin-top:4px; padding:12px; border:1px solid rgba(139,92,246,.22); border-radius:12px; background:linear-gradient(135deg,rgba(139,92,246,.08),rgba(34,211,238,.05)); }
    .auto-screen-head { display:flex; align-items:center; justify-content:space-between; gap:10px; }
    .auto-screen-title { font-weight:800; color:#eee8fb; font-size:12px; }
    .auto-screen-sub { margin-top:3px; color:#8e879d; font-size:9px; line-height:1.4; }
    .auto-screen-row { display:flex; align-items:center; gap:7px; margin-top:10px; }
    .auto-screen-toggle { min-width:58px; border:1px solid #49386f; background:#211833; color:#bdb2d8; border-radius:8px; padding:7px 9px; cursor:pointer; font-weight:700; }
    .auto-screen-toggle.on { background:#7c5cff; border-color:#7c5cff; color:#fff; }
    .auto-screen-select { flex:1; background:#141020; color:#eee6ff; border:1px solid #3a2c5c; border-radius:8px; padding:7px; font-size:11px; }
    .auto-screen-state { margin-top:8px; color:#777084; font-size:9px; }
    .auto-screen-state.on { color:#4ade80; }
    .auto-screen-state.error { color:#fb7185; }
    .kiro-issue-card { margin-top:8px; padding:11px; border:1px solid rgba(251,113,133,.28); border-radius:13px; background:linear-gradient(145deg,rgba(251,113,133,.08),rgba(139,92,246,.05)); }
    .kiro-issue-head { display:flex; justify-content:space-between; gap:8px; margin-bottom:7px; }
    .kiro-issue-title { color:#ffd5dc; font-size:11px; font-weight:800; }
    .kiro-issue-text { color:#d7d0e2; font-size:10px; line-height:1.5; white-space:pre-wrap; max-height:100px; overflow:auto; }
    .kiro-issue-actions { display:flex; gap:7px; margin-top:9px; }
    .kiro-fix-btn,.kiro-ask-btn { border-radius:9px; padding:9px; cursor:pointer; font-weight:800; }
    .kiro-fix-btn { flex:1; border:0; background:linear-gradient(135deg,#8b5cf6,#7044df); color:white; }
    .kiro-fix-btn:disabled { opacity:.55; cursor:default; }
    .kiro-ask-btn { border:1px solid rgba(255,255,255,.1); background:rgba(255,255,255,.04); color:#ddd6e9; }
    .kiro-side-bubble { position:fixed; left:12px; right:12px; bottom:12px; z-index:9000; border:1px solid rgba(139,92,246,.3); background:rgba(25,22,38,.98); border-radius:14px; padding:11px; box-shadow:0 18px 50px rgba(0,0,0,.5); }
    .kiro-side-title { color:#bcaaff; font-size:10px; font-weight:800; margin-bottom:4px; }
    .kiro-side-text { color:#e8e2f0; font-size:10px; line-height:1.45; max-height:72px; overflow:auto; }
    .kiro-side-row { display:flex; gap:7px; margin-top:8px; }
    .kiro-side-input { flex:1; min-width:0; padding:9px; border-radius:9px; border:1px solid rgba(255,255,255,.1); background:#100e17; color:#eee8f7; outline:none; }
    .kiro-side-send { border:0; border-radius:9px; padding:9px 12px; background:#7c5cff; color:white; font-weight:800; cursor:pointer; }
  `;
  document.head.appendChild(style);

  function toast(message) { if (typeof window.kiroToast === 'function') window.kiroToast(message); }
  function getOpenFile() { const strong = document.querySelector('#file-context strong'); const value = strong?.textContent?.trim(); return value && value !== 'No file selected' ? value : null; }
  function extractCode(text) { const match = String(text || '').match(/```[a-zA-Z0-9_+-]*\s*([\s\S]*?)```/); return match ? match[1].trim() : ''; }
  function stripCode(text) { return String(text || '').replace(/```[\s\S]*?```/g, '').trim(); }

  function setState(text, kind = '') { const el = document.getElementById('auto-screen-state'); if (!el) return; el.className = `auto-screen-state ${kind}`; el.textContent = text; }
  function updateButton() { const btn = document.getElementById('auto-screen-toggle'); if (!btn) return; btn.textContent = running ? 'ON' : 'OFF'; btn.classList.toggle('on', running); }

  function buildUI() {
    const settings = document.getElementById('settings-view');
    if (!settings || document.getElementById('auto-screen-card')) return;
    const card = document.createElement('div'); card.id = 'auto-screen-card'; card.className = 'auto-screen-card';
    card.innerHTML = `
      <div class="auto-screen-head"><div><div class="auto-screen-title">👁️ Auto Screen Assist</div><div class="auto-screen-sub">Kiro watches the screen only after you turn this ON, then reports useful coding problems.</div></div></div>
      <div class="auto-screen-row"><button class="auto-screen-toggle" id="auto-screen-toggle">OFF</button><select class="auto-screen-select" id="auto-screen-interval"><option value="15000">Every 15 seconds</option><option value="30000" selected>Every 30 seconds</option><option value="60000">Every 60 seconds</option><option value="120000">Every 2 minutes</option></select></div>
      <div id="auto-screen-state" class="auto-screen-state">Off — Kiro is not viewing your screen.</div>
    `;
    settings.appendChild(card);
    document.getElementById('auto-screen-toggle').addEventListener('click', toggle);
    document.getElementById('auto-screen-interval').addEventListener('change', async e => { intervalMs = Number(e.target.value) || 30000; restartTimer(); try { await window.kiro.setSettings({ screenAssist: { enabled: running, intervalMs } }); } catch {} });
  }

  async function startCapture() {
    if (running) return;
    if (!navigator.mediaDevices?.getDisplayMedia) { setState('Screen sharing is not supported by this Electron build.', 'error'); return; }
    try {
      setState('Choose the screen/window Kiro may watch…');
      stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 1 }, audio: false });
      video = document.createElement('video'); video.muted = true; video.playsInline = true; video.srcObject = stream; await video.play();
      stream.getVideoTracks()[0].addEventListener('ended', stopCapture);
      running = true; updateButton(); setState('On — Kiro will check for coding problems automatically.', 'on');
      await window.kiro.setSettings({ screenAssist: { enabled: true, intervalMs } });
      restartTimer(); await scanNow();
    } catch (error) { stopCapture(); setState(`Screen sharing cancelled: ${error.message || error}`, 'error'); }
  }

  async function stopCapture() {
    running = false; if (timer) clearTimeout(timer); timer = null;
    if (stream) stream.getTracks().forEach(track => track.stop()); stream = null; if (video) video.srcObject = null; video = null;
    updateButton(); setState('Off — Kiro is not viewing your screen.');
    try { await window.kiro.setSettings({ screenAssist: { enabled: false, intervalMs } }); } catch {}
  }

  function restartTimer() { if (timer) clearTimeout(timer); if (!running) return; timer = setTimeout(async () => { await scanNow(); restartTimer(); }, intervalMs); }
  function captureFrame() { if (!video || video.readyState < 2) return null; const canvas = document.createElement('canvas'); const width = Math.min(video.videoWidth || 1280, 1440); const height = Math.round(width * ((video.videoHeight || 720) / (video.videoWidth || 1280))); canvas.width = width; canvas.height = height; const ctx = canvas.getContext('2d'); ctx.drawImage(video, 0, 0, width, height); return canvas.toDataURL('image/jpeg', .72); }

  function showIssue(text, fixedCode) {
    const response = document.getElementById('response');
    if (response) response.textContent = `👁️ Kiro noticed a problem\n\n${text}`;
    let card = document.getElementById('kiro-issue-card');
    if (!card) { card = document.createElement('div'); card.id = 'kiro-issue-card'; card.className = 'kiro-issue-card'; const parent = response?.parentNode; if (parent) parent.insertBefore(card, response); }
    lastFix = fixedCode ? { code: fixedCode, file: getOpenFile() } : null;
    card.innerHTML = `<div class="kiro-issue-head"><span class="kiro-issue-title">🐛 Error / improvement found</span><span class="response-state ready">Screen</span></div><div class="kiro-issue-text">${escapeHtml(text)}</div><div class="kiro-issue-actions">${fixedCode ? '<button id="kiro-fix-btn" class="kiro-fix-btn">⚡ Fix it</button>' : ''}<button id="kiro-ask-btn" class="kiro-ask-btn">Ask Kiro</button></div>`;
    document.getElementById('kiro-fix-btn')?.addEventListener('click', applyFix);
    document.getElementById('kiro-ask-btn')?.addEventListener('click', () => { const p = document.getElementById('prompt-box'); if (p) { p.value = `Kiro found this on my screen:\n${text}\n\nTell me exactly what to do.`; p.focus(); } });
  }

  async function applyFix() {
    const btn = document.getElementById('kiro-fix-btn');
    if (!lastFix?.code) return;
    if (!lastFix.file) { toast('Open the affected file in Kiro first, then click Fix it.'); return; }
    if (btn) { btn.disabled = true; btn.textContent = 'Applying…'; }
    const result = await window.kiro.applyProjectFix(lastFix.file, lastFix.code);
    if (result?.error) { if (btn) { btn.disabled = false; btn.textContent = '⚡ Fix it'; } toast(`Fix failed: ${result.error}`); return; }
    const codeBox = document.getElementById('code-box'); if (codeBox) codeBox.value = lastFix.code;
    if (btn) btn.textContent = 'Fixed ✓'; toast(`Fixed ${lastFix.file}`);
  }

  function showSideInput(message) {
    let bubble = document.getElementById('kiro-side-bubble');
    if (!bubble) { bubble = document.createElement('div'); bubble.id = 'kiro-side-bubble'; bubble.className = 'kiro-side-bubble'; document.body.appendChild(bubble); }
    bubble.innerHTML = `<div class="kiro-side-title">🐾 Kiro says</div><div class="kiro-side-text">${escapeHtml(message)}</div><div class="kiro-side-row"><input id="kiro-side-input" class="kiro-side-input" placeholder="Tell Kiro what to do…"><button id="kiro-side-send" class="kiro-side-send">Ask</button></div>`;
    const send = () => { const input = document.getElementById('kiro-side-input'); const prompt = document.getElementById('prompt-box'); if (input?.value && prompt) { prompt.value = input.value; prompt.focus(); bubble.remove(); } };
    document.getElementById('kiro-side-send')?.addEventListener('click', send); document.getElementById('kiro-side-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
  }

  async function scanNow() {
    if (!running || busy) return;
    const imageData = captureFrame(); if (!imageData) return; busy = true; setState('On — analyzing the latest screen…', 'on');
    try {
      const settings = await window.kiro.getSettings();
      if (!settings?.apiKey) { setState('Add an API key in Settings before screen analysis.', 'error'); return; }
      const currentFile = getOpenFile();
      const code = document.getElementById('code-box')?.value?.trim() || '';
      const result = await window.kiro.ask({
        systemPrompt: 'You are Kiro, an automatic coding companion. Only report problems visibly supported by the screenshot. Look for compiler errors, terminal errors, broken UI, or clear coding mistakes. Be concise. If a fix is possible from visible code, return the complete replacement code in exactly one fenced code block after the explanation. Never invent an error.',
        userPrompt: `Review my screen now. ${currentFile ? `The loaded project file is ${currentFile}.` : 'No project file is loaded.'} Find a real coding/development issue if one is visible. Tell me what Kiro wants me to fix. If you can confidently reconstruct the corrected code, include it in one code block.`,
        code, imageData
      });
      if (result?.error) { setState(`Analysis error: ${result.error}`, 'error'); return; }
      const text = String(result.text || '').trim(); if (!text || /^NO_ISSUE$/i.test(text)) { setState(`On — last review ${new Date().toLocaleTimeString()} · no clear issue`, 'on'); return; }
      const fixedCode = extractCode(text); const explanation = stripCode(text); showIssue(explanation, fixedCode); showSideInput(explanation); setState(`On — issue found at ${new Date().toLocaleTimeString()}`, 'on'); toast('Kiro found something to fix.');
    } catch (error) { setState(`Analysis failed: ${error.message || error}`, 'error'); }
    finally { busy = false; }
  }

  async function toggle() { if (running) await stopCapture(); else await startCapture(); }
  function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c])); }

  async function init() {
    buildUI();
    try {
      const settings = await window.kiro.getSettings();
      intervalMs = Number(settings?.screenAssist?.intervalMs) || 30000;
      const select = document.getElementById('auto-screen-interval'); if (select) select.value = String(intervalMs);
    } catch {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
