# Kiro 🐾

Kiro is a free, open-source AI cat that lives on your screen. Click it to open
a small panel, grab whatever code is on your clipboard (or paste it in), and
ask Kiro to explain, fix, refactor, or comment it — using your own OpenAI or
Anthropic API key.

## Features (v0.1)

- 🐾 Animated cat companion — always-on-top, transparent, draggable, click to open
- 💬 Chat panel with quick actions: Explain, Fix bug, Refactor, Add comments
- 📋 One-click "Grab clipboard" to pull in code from anywhere
- 🔑 Bring your own API key (OpenAI or Anthropic) — stored locally only, never sent to any Kiro server
- 📦 Packaged as an installable desktop app (Windows/macOS/Linux) via electron-builder

## Run it locally

```bash
npm install
npm run dev
```

The cat will appear near your screen's bottom-right corner. Click it to open
the panel, go to **Settings**, and paste your API key.

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
- [ ] Multiple selectable companion characters
- [ ] Direct file/project access with explicit permission
- [ ] Browser-based companion (using the `client/` Vite+React app)
- [ ] Authentication and user profiles (only needed once there's a hosted backend)

> Kiro is designed to make coding more interactive, personal, and fun.
