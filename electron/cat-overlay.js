const stage = document.getElementById('stage');

let downAt = 0;
let moved = false;

stage.addEventListener('mousedown', () => {
  downAt = Date.now();
  moved = false;
});

window.addEventListener('mousemove', () => {
  moved = true;
});

stage.addEventListener('mouseup', () => {
  const held = Date.now() - downAt;
  if (held < 350) {
    window.kiro.togglePanel();
  }
});

// Apply saved skin on load, and live-update if changed from the panel.
window.kiro.getSettings().then(s => applyKiroSkin(s.character?.skin));
window.kiro.onSettingsChanged(s => applyKiroSkin(s.character?.skin));
