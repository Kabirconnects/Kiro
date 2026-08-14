(() => {
  let stream = null;
  let video = null;
  let timer = null;
  let running = false;
  let busy = false;
  let intervalMs = 30000;

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
  `;
  document.head.appendChild(style);

  function setState(text, kind = '') {
    const el = document.getElementById('auto-screen-state');
    if (!el) return;
    el.className = `auto-screen-state ${kind}`;
    el.textContent = text;
  }

  function buildUI() {
    const settings = document.getElementById('settings-view');
    if (!settings || document.getElementById('auto-screen-card')) return;

    const card = document.createElement('div');
    card.id = 'auto-screen-card';
    card.className = 'auto-screen-card';
    card.innerHTML = `
      <div class="auto-screen-head">
        <div>
          <div class="auto-screen-title">👁️ Auto Screen Assist</div>
          <div class="auto-screen-sub">When enabled, Kiro periodically looks at your screen and suggests coding fixes. It stays off until you turn it on.</div>
        </div>
      </div>
      <div class="auto-screen-row">
        <button class="auto-screen-toggle" id="auto-screen-toggle">OFF</button>
        <select class="auto-screen-select" id="auto-screen-interval" aria-label="Screen check interval">
          <option value="15000">Every 15 seconds</option>
          <option value="30000" selected>Every 30 seconds</option>
          <option value="60000">Every 60 seconds</option>
          <option value="120000">Every 2 minutes</option>
        </select>
      </div>
      <div id="auto-screen-state" class="auto-screen-state">Off — Kiro is not viewing your screen.</div>
    `;
    settings.appendChild(card);

    document.getElementById('auto-screen-toggle').addEventListener('click', toggle);
    document.getElementById('auto-screen-interval').addEventListener('change', event => {
      intervalMs = Number(event.target.value) || 30000;
      if (running) restartTimer();
    });
  }

  async function startCapture() {
    if (running) return;
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setState('Screen sharing is not supported by this Electron build.', 'error');
      return;
    }

    try {
      setState('Choose the screen/window Kiro may watch…');
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 1 },
        audio: false
      });

      video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      await video.play();

      const track = stream.getVideoTracks()[0];
      track.addEventListener('ended', stopCapture);

      running = true;
      updateButton();
      setState('On — Kiro will check the selected screen periodically.', 'on');
      restartTimer();
      await scanNow();
    } catch (error) {
      stopCapture();
      setState(`Screen sharing cancelled: ${error.message || error}`, 'error');
    }
  }

  function stopCapture() {
    running = false;
    if (timer) clearTimeout(timer);
    timer = null;
    if (stream) stream.getTracks().forEach(track => track.stop());
    stream = null;
    if (video) video.srcObject = null;
    video = null;
    updateButton();
    setState('Off — Kiro is not viewing your screen.');
  }

  function updateButton() {
    const btn = document.getElementById('auto-screen-toggle');
    if (!btn) return;
    btn.textContent = running ? 'ON' : 'OFF';
    btn.classList.toggle('on', running);
  }

  function restartTimer() {
    if (timer) clearTimeout(timer);
    if (!running) return;
    timer = setTimeout(async () => {
      await scanNow();
      restartTimer();
    }, intervalMs);
  }

  function captureFrame() {
    if (!video || video.readyState < 2) return null;
    const canvas = document.createElement('canvas');
    const width = Math.min(video.videoWidth || 1280, 1440);
    const height = Math.round(width * ((video.videoHeight || 720) / (video.videoWidth || 1280)));
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', 0.72);
  }

  async function scanNow() {
    if (!running || busy) return;
    const imageData = captureFrame();
    if (!imageData) return;

    busy = true;
    setState('On — analyzing the latest screen…', 'on');

    try {
      const settings = await window.kiro.getSettings();
      if (!settings?.apiKey) {
        setState('Add an API key in Settings before Auto Screen Assist can analyze your screen.', 'error');
        return;
      }

      const result = await window.kiro.ask({
        systemPrompt: [
          'You are Kiro, an AI coding companion.',
          'Analyze the supplied desktop screenshot only for visible developer context.',
          'Prioritize visible code errors, terminal errors, build failures, compiler messages, and obvious development problems.',
          'Do not claim to see hidden files, off-screen content, passwords, or anything not visible.',
          'Be concise. If there is no clear coding problem, say so instead of inventing one.',
          'If you suggest a code fix, explain the change and tell the user to review it before applying.'
        ].join(' '),
        userPrompt: 'Automatically review my current screen for useful coding or development issues. If you find something actionable, tell me what it is and how to fix it.',
        code: '',
        imageData
      });

      if (result.error) {
        setState(`Analysis error: ${result.error}`, 'error');
        return;
      }

      const response = document.getElementById('response');
      if (response) response.textContent = `👁️ Auto Screen Assist\n\n${result.text || 'No useful issue found.'}`;
      const responseState = document.getElementById('response-state');
      if (responseState) {
        responseState.className = 'response-state ready';
        responseState.textContent = 'Screen review';
      }
      setState(`On — last review ${new Date().toLocaleTimeString()}`, 'on');
    } catch (error) {
      setState(`Analysis failed: ${error.message || error}`, 'error');
    } finally {
      busy = false;
    }
  }

  async function toggle() {
    if (running) {
      stopCapture();
    } else {
      await startCapture();
    }
  }

  function init() {
    buildUI();
    const interval = document.getElementById('auto-screen-interval');
    if (interval) intervalMs = Number(interval.value) || 30000;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
