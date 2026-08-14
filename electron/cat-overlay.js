const stage = document.getElementById('stage');

// Keep the first desktop interaction deliberately simple and reliable:
// clicking the cat opens/hides the Kiro panel.
stage.addEventListener('click', () => {
  window.kiro.togglePanel();
});

// Apply saved skin on load, and live-update if changed from the panel.
window.kiro.getSettings().then(s => applyKiroSkin(s.character?.skin));
window.kiro.onSettingsChanged(s => applyKiroSkin(s.character?.skin));
