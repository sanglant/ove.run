# ove.run

**A terminal-first desktop environment for AI coding agents.**

Run agents, supervise output, preserve context, and stay in control — without babysitting interrupts. Built with Tauri, React, TypeScript, and Rust.

> If you find the project useful, you can support it here: [Buy Me a Coffee](https://buymeacoffee.com/)

---

## What's Inside

Terminal, git, notes, knowledge, bugs, notifications, and settings — unified in a single native desktop shell.

| Layer | Tech |
|-------|------|
| Runtime | Tauri v2 |
| Frontend | React 19, TypeScript, Vite |
| Backend | Rust |
| Package manager | pnpm |

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
