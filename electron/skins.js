// Kiro is always a cat — skins just change its coloring, not its species.
const KIRO_SKINS = {
  violet: { name: 'Violet (default)', bodyMain: '#372a55', bodyDark: '#2b2140', accent: '#7c5cff', eye: '#ffe66d' },
  tabby:  { name: 'Orange Tabby',     bodyMain: '#7a3b1e', bodyDark: '#5c2b14', accent: '#ffb454', eye: '#2b2140' },
  mint:   { name: 'Mint',             bodyMain: '#1f5c52', bodyDark: '#163f38', accent: '#6dffc4', eye: '#ffe66d' },
  mono:   { name: 'Black & White',    bodyMain: '#23262b', bodyDark: '#14161a', accent: '#d7dde3', eye: '#62e884' }
};

function applyKiroSkin(skinId) {
  const skin = KIRO_SKINS[skinId] || KIRO_SKINS.violet;
  const root = document.documentElement.style;
  root.setProperty('--body-main', skin.bodyMain);
  root.setProperty('--body-dark', skin.bodyDark);
  root.setProperty('--accent', skin.accent);
  root.setProperty('--eye', skin.eye);
}

// Premium UI layer. It is intentionally self-contained so the existing panel
// markup and functionality continue to work without changing element IDs.
document.addEventListener('DOMContentLoaded', () => {
  const style = document.createElement('style');
  style.textContent = `
    .kiro-live-strip {
      display:flex; align-items:center; justify-content:space-between; gap:8px;
      padding:8px 10px; border:1px solid rgba(139,92,246,.18);
      border-radius:12px; background:linear-gradient(90deg,rgba(139,92,246,.09),rgba(255,255,255,.025));
      color:#aaa3bd; font-size:10px;
    }
    .kiro-live-left { display:flex; align-items:center; gap:7px; min-width:0; }
    .kiro-pulse { width:7px; height:7px; border-radius:50%; background:#4ade80; box-shadow:0 0 0 0 rgba(74,222,128,.5); animation:kiroPulse 2s infinite; flex:none; }
    @keyframes kiroPulse { 0%{box-shadow:0 0 0 0 rgba(74,222,128,.45)} 70%{box-shadow:0 0 0 7px rgba(74,222,128,0)} 100%{box-shadow:0 0 0 0 rgba(74,222,128,0)} }
    .kiro-live-model { color:#e7e1f2; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .kiro-shortcuts { display:flex; gap:5px; flex-wrap:wrap; }
    .kiro-key {
      padding:4px 7px; border-radius:7px; border:1px solid rgba(255,255,255,.08);
      background:rgba(255,255,255,.035); color:#817a92; font-size:9px;
    }
    .kiro-tip {
      display:flex; align-items:flex-start; gap:8px; padding:9px 10px; border-radius:11px;
      border:1px solid rgba(255,255,255,.07); background:rgba(255,255,255,.02);
      color:#8f899e; font-size:10px; line-height:1.4;
    }
    .kiro-tip strong { color:#cfc8dc; }
    .kiro-glow-line { height:1px; margin:1px 8px; background:linear-gradient(90deg,transparent,rgba(139,92,246,.45),transparent); }
    .kiro-count {
      display:inline-flex; align-items:center; justify-content:center; min-width:18px; height:18px;
      padding:0 5px; border-radius:9px; background:rgba(139,92,246,.14); color:#b8a4ff; font-size:9px; font-weight:800;
    }
    .kiro-command-hint { color:#6f697f; font-size:9px; text-align:right; margin-top:-3px; }
    .kiro-toast {
      position:fixed; left:12px; right:12px; bottom:12px; z-index:9999; padding:10px 12px;
      border-radius:11px; background:rgba(25,22,38,.96); border:1px solid rgba(139,92,246,.3);
      box-shadow:0 16px 40px rgba(0,0,0,.45); color:#eee8fa; font-size:11px;
      transform:translateY(16px); opacity:0; pointer-events:none; transition:.2s ease;
    }
    .kiro-toast.show { transform:translateY(0); opacity:1; }
  `;
  document.head.appendChild(style);

  const tabs = document.getElementById('tabs');
  const chatView = document.getElementById('chat-view');
  if (!tabs || !chatView) return;

  const strip = document.createElement('div');
  strip.className = 'kiro-live-strip';
  strip.innerHTML = `
    <div class="kiro-live-left">
      <span class="kiro-pulse"></span>
      <span>Ready to help</span>
      <span class="kiro-live-model">AI coding workspace</span>
    </div>
    <span class="kiro-count">v0.1</span>
  `;
  tabs.insertAdjacentElement('afterend', strip);

  const hint = document.createElement('div');
  hint.className = 'kiro-shortcuts';
  hint.innerHTML = '<span class="kiro-key">Ctrl/⌘ + Enter · Ask</span><span class="kiro-key">Click cat · Toggle</span><span class="kiro-key">⚙ · Settings</span>';
  strip.insertAdjacentElement('afterend', hint);

  const glow = document.createElement('div');
  glow.className = 'kiro-glow-line';
  hint.insertAdjacentElement('afterend', glow);

  const tip = document.createElement('div');
  tip.className = 'kiro-tip';
  tip.innerHTML = '<span>💡</span><span><strong>Pro tip:</strong> Select a project file in Files, then ask Kiro to explain or improve it. Your original file stays untouched until you save.</span>';
  chatView.appendChild(tip);

  window.kiroToast = message => {
    let toast = document.querySelector('.kiro-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'kiro-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(window.__kiroToastTimer);
    window.__kiroToastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
  };

  // Load the opt-in automatic screen assistant after the DOM is ready.
  const autoScreenScript = document.createElement('script');
  autoScreenScript.src = 'auto-screen.js';
  document.body.appendChild(autoScreenScript);
});
