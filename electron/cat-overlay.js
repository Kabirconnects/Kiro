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
  // Treat as a click (not a drag) if it was quick and no drag was registered
  // by the OS-level window drag region.
  if (held < 350) {
    window.kiro.togglePanel();
  }
});
