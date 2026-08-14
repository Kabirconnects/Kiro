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
