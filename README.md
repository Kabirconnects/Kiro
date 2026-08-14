# Kiro 🐾

Kiro is a free, open-source AI cat that lives on your screen. Click it to open
a small panel, grab whatever code is on your clipboard (or paste it in), and
ask Kiro to explain, fix, refactor, or comment it — using your own OpenAI or
Anthropic API key.

## Features

- 🐾 Animated cat companion — always-on-top, transparent, draggable, click to open (it's always a cat — see Character below)
- 🎨 **Multiple selectable characters** — 4 cat color skins (Violet, Orange Tabby, Mint, Black & White), picked from the Character tab and applied live
- 💬 Chat panel with quick actions: Explain, Fix bug, Refactor, Add comments
- 📋 One-click "Grab clipboard" to pull in code from anywhere
- 📂 **Direct file/project access, with explicit permission** — pick one project folder via the native OS picker, browse its files, load one into the chat, and let Kiro write a fix straight back to disk (you get a confirmation dialog before anything is overwritten, and Kiro can never touch anything outside that one folder)
- 🌐 **Browser-based companion** (`client/`) — the same chat + character picker running as a plain web app, no install needed, using your API key stored in the browser's localStorage
- 👤 **Local profile** — set your name for a friendlier greeting. There's no real login system yet since that only makes sense once there's a hosted backend Kiro can authenticate against — right now everything (keys, project folder, profile) lives on your own device/browser only
- 🔑 Bring your own API key (OpenAI or Anthropic) — stored locally only, never sent to any Kiro server
- 📦 Packaged as an installable desktop app (Windows/macOS/Linux) via electron-builder

## Download & install (no coding required)

1. Go to the [**Releases**](https://github.com/Kabirconnects/Kiro/releases) page.
2. Grab the file for your OS:
   - **Windows** — `Kiro-Setup-x.x.x.exe`
   - **macOS** — `Kiro-x.x.x.dmg`
   - **Linux** — `Kiro-x.x.x.AppImage` (make it executable: `chmod +x Kiro-*.AppImage`, then double-click or run it)
3. Install/run it. The cat appears near the bottom-right of your screen.
4. Click the cat → **Settings** → paste your own free-to-get OpenAI or Anthropic API key.
5. Copy some code, click **Grab clipboard**, then hit **Explain**, **Fix bug**, **Refactor**, or **Add comments**.

New installers are built automatically for Windows, macOS, and Linux every time a new version tag is pushed (see `.github/workflows/build.yml`).

## Run it locally (for development)

```bash
npm install
npm run dev
```

The cat will appear near your screen's bottom-right corner. Click it to open
the panel, go to **Settings**, and paste your API key.

## Run the browser companion

No install required — this is a plain static web app:

```bash
npm run dev -w client     # local dev server
npm run build -w client   # outputs client/dist, deployable to any static host (e.g. GitHub Pages)
```

Open it, go to Settings, paste your API key, and it works the same as the desktop chat tab
(minus native file access and always-on-top — a browser tab can't do those).

## Build an installer

```bash
npm run dist:win     # Windows .exe (NSIS)
npm run dist:mac      # macOS .dmg
npm run dist:linux    # Linux .AppImage
```

Installers land in `release/`.

## Roadmap

- [x] Desktop companion with an always-on-top animated cat
- [x] AI chat + code explain/fix/refactor/comment
- [x] Bring-your-own-key AI bridge (OpenAI + Anthropic)
- [x] Packaging and installers
- [x] Multiple selectable companion characters (cat color skins)
- [x] Direct file/project access with explicit permission
- [x] Browser-based companion (`client/` Vite+React app)
- [x] Local profile (name) — full accounts/auth still needs a hosted backend, see below
- [ ] Hosted backend + real authentication and multi-device user profiles
- [ ] Code-signed installers (removes the Windows SmartScreen / macOS Gatekeeper warnings)

> Kiro is designed to make coding more interactive, personal, and fun.
