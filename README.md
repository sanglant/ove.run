# ove.run

**An intelligent desktop orchestrator for AI coding agents.**

Run multiple agents side by side, give them shared context and memory, let an AI arbiter handle interrupts, and loop through stories autonomously — all from a single native app. Built with Tauri, React, TypeScript, and Rust.

> If you find the project useful, you can support it here: [Buy Me a Coffee](https://buymeacoffee.com/)

---

## What's Inside

| Layer | Tech |
|-------|------|
| Runtime | Tauri v2 |
| Frontend | React 19, TypeScript, Vite |
| Backend | Rust, SQLite (FTS5) |
| Package manager | pnpm |

---

## Features

### Multi-Agent Terminal

Run Claude Code, Gemini CLI, GitHub Copilot, Codex, or any CLI agent in parallel terminal panes. Each session tracks status in real time (idle, working, needs input, finished, error) and sends desktop notifications when attention is needed. Sessions can be paused, resumed, and persisted across restarts. YOLO mode lets agents run without pausing for confirmation.

### Context Store

A structured library of reusable knowledge that agents can draw from. Create four types of context units — **Personas**, **Skills**, **Knowledge blocks**, and **References** — each with tiered detail levels (one-line summary, overview, full content). Assign context units to individual sessions or set project-wide defaults that auto-load. Ships with 12 built-in personas (Backend Dev, Security Auditor, Code Reviewer, etc.) and 8 skill packs (Testing Best Practices, Git Workflow, API Design, etc.). Full-text search powered by FTS5.

### Agent Memory

The system automatically extracts facts, decisions, and patterns from agent output into a searchable memory store. Each memory carries importance scoring, entity/topic tags, and public/private visibility. A background worker consolidates clusters of related memories into higher-level insights. Decayed memories are pruned over time so the store stays relevant. Memories and consolidations are injected into arbiter prompts for informed decision-making.

### Arbiter

An AI-powered decision engine that reviews agent questions and provides answers on your behalf. When an agent pauses for input, the Arbiter reads the question, pulls in relevant context units and memories, and responds — or dismisses stale prompts that resolved themselves. Three trust levels control autonomy:

- **Supervised** — you approve each step
- **Autonomous** — it runs, asks you when stuck
- **Full Auto** — handles everything

Configurable per project. Works with any CLI agent as the backing model.

### Loop Engine

Break down a high-level request into stories with acceptance criteria, dependencies, and priorities, then execute them in automated iterations. The engine runs quality gates (build, lint, typecheck, test) after each story, tracks iteration count against configurable limits, and applies circuit breakers to pause on repeated failures. An optional arbiter judge reviews each story's output before proceeding. Pause, resume, or cancel at any point.

### Git Integration

View branch status, stage/unstage files, inspect diffs, and commit — all inline. Real-time ahead/behind tracking and file-level status indicators (modified, added, deleted, renamed).

### Notes

A per-project markdown editor (TipTap-based) with floating toolbar, task lists, and a toggle to include notes directly in agent context. Useful for keeping specs, checklists, and design notes alongside the agents that consume them.

### Bug Tracking

Connect to Jira, GitHub Issues, Linear, or other providers via OAuth. Browse issues, view details, and spin up agent sessions to work on specific bugs — all without leaving the app.

### Notifications

Desktop and in-app alerts when agents finish, need input, or encounter errors. Notification history with unread badge and timestamp.

### Settings

Global preferences (theme, font, terminal scrollback, tray behavior) plus per-agent configuration (default YOLO mode, custom CLI args, environment variables, arbiter provider and model selection).

---

## Quick Start

**Prerequisites:** Node.js LTS, Rust, platform-specific dependencies (see [Building](#building) below).

```bash
corepack enable
pnpm install
pnpm tauri dev
```

---

## Building

Tauri produces native packages, so build on the target OS. The release command is always:

```bash
pnpm tauri build
```

Artifacts are placed under `src-tauri/target/release/bundle/`.

<details>
<summary><strong>macOS</strong></summary>

1. Install Node.js LTS.
2. Enable pnpm via Corepack:
   ```bash
   corepack enable
   ```
3. Install Rust:
   ```bash
   curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh
   ```
4. Install Apple developer tools:
   ```bash
   xcode-select --install
   ```
   If you plan to do broader Apple platform work, install full Xcode instead.
5. Install dependencies and build:
   ```bash
   pnpm install
   pnpm tauri build
   ```
</details>

<details>
<summary><strong>Windows</strong></summary>

1. Install Node.js LTS.
2. Install Rust using `rustup-init.exe` from [rust-lang.org](https://www.rust-lang.org/tools/install).
3. Install **Microsoft C++ Build Tools** and select **Desktop development with C++**.
4. Install the **Microsoft Edge WebView2 Runtime**.
5. If MSI packaging fails with `light.exe` or VBSCRIPT-related errors, enable the optional **VBSCRIPT** Windows feature.
6. Install dependencies and build:
   ```powershell
   corepack enable
   pnpm install
   pnpm tauri build
   ```
</details>

<details>
<summary><strong>Ubuntu / Debian</strong></summary>

Install system packages first:

```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

Then install Rust and build:

```bash
curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh
corepack enable
pnpm install
pnpm tauri build
```
</details>

<details>
<summary><strong>Other Linux distros</strong></summary>

Install the distro-specific equivalents of these packages:

- WebKitGTK 4.1 development files
- OpenSSL development files
- AppIndicator / Ayatana AppIndicator development files
- `librsvg`
- `libxdo`
- C/C++ build tools
- `curl`, `wget`, and `file`

Then:

```bash
curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh
corepack enable
pnpm install
pnpm tauri build
```

For a full package-by-package mapping, see the [Tauri prerequisites guide](https://v2.tauri.app/start/prerequisites/).
</details>

---

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE).
