# Agent Sandboxing & Isolation Research

**Date:** 2026-03-14
**Status:** Research / Proposal
**Author:** Application Architect

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Current Architecture](#2-current-architecture)
3. [Threat Model](#3-threat-model)
4. [Linux Sandboxing Options](#4-linux-sandboxing-options)
5. [Cross-Platform Options](#5-cross-platform-options)
6. [Network Isolation](#6-network-isolation)
7. [Filesystem Isolation](#7-filesystem-isolation)
8. [What Similar Tools Do](#8-what-similar-tools-do)
9. [Web-Based Isolation](#9-web-based-isolation)
10. [Evaluation Matrix](#10-evaluation-matrix)
11. [Recommended Implementation Path](#11-recommended-implementation-path)
12. [Architecture Decision Record](#12-architecture-decision-record)

---

## 1. Problem Statement

ove.run spawns AI coding agents (Claude Code, Gemini CLI, GitHub Copilot, Codex CLI) as child processes via PTY. Each agent gets a full shell with unrestricted access to the user's system: arbitrary file reads/writes, network requests, and command execution. The trust level system (Supervised/Autonomous/Full Auto) controls how the Arbiter *responds* to agent behavior, but does not enforce any actual restrictions on what the agent *can do*.

This creates several risks:
- A prompt-injected agent could exfiltrate sensitive files (SSH keys, API tokens, `.env` files)
- An agent could make arbitrary network requests to attacker-controlled servers
- An agent could modify files outside the project directory
- An agent could execute destructive commands (`rm -rf`, system modifications)
- Agents inherit the user's full environment variables, which may contain secrets

The goal is to add OS-level enforcement that restricts what agents can actually do, proportional to the configured trust level, without significantly degrading the agent experience.

---

## 2. Current Architecture

### How Agents Are Spawned

From `src-tauri/src/pty/manager.rs`:

```
PtyManager::spawn() -> NativePtySystem::openpty() -> CommandBuilder::new(command)
                        -> slave.spawn_command(cmd)
```

Key characteristics:
- Uses the `portable-pty` crate (v0.9) to create PTY pairs
- Agent command is built via `CommandBuilder` with args, cwd, and env vars
- The child process inherits the user's environment plus agent-specific env vars
- No namespace isolation, no capability restrictions, no seccomp filters
- The `cwd` is set to the project directory, but nothing prevents navigation elsewhere
- PTY read/write happens on a dedicated OS thread with a 4KB buffer

### Trust Levels (Current)

```rust
pub enum TrustLevel {
    Supervised = 1,   // Arbiter approves each step
    Autonomous = 2,   // Agent runs, asks when stuck
    FullAuto = 3,     // Agent handles everything
}
```

These control Arbiter *behavior* (whether to auto-approve, pause, or require confirmation), but impose zero OS-level restrictions. A "Supervised" agent has the same kernel-level permissions as a "Full Auto" one.

### Integration Point

The sandbox must wrap the `CommandBuilder` in `PtyManager::spawn()`. Instead of:

```
CommandBuilder::new("claude") + args + cwd + env
```

It would become something like:

```
CommandBuilder::new("bwrap") + [sandbox_flags...] + "--" + "claude" + args
```

The PTY mechanics (reader thread, writer Arc, shutdown channel) remain unchanged. Only the command construction changes.

---

## 3. Threat Model

### What we are defending against

| Threat | Severity | Likelihood | Example |
|--------|----------|------------|---------|
| File exfiltration | High | Medium | Agent reads `~/.ssh/id_rsa` and sends via `curl` |
| Arbitrary network access | High | Medium | Agent contacts attacker C2 server |
| File modification outside project | High | Low-Medium | Agent modifies `~/.bashrc` or system configs |
| Destructive commands | Critical | Low | Agent runs `rm -rf /` or kills system processes |
| Secret leakage via env vars | Medium | Medium | Agent reads `$AWS_SECRET_ACCESS_KEY` |
| Privilege escalation | Critical | Low | Agent uses `sudo` or exploits suid binary |

### What we are NOT defending against

- Agent writing malicious code *within* the project directory (this is what code review and quality gates are for)
- Agent consuming excessive CPU/memory (resource limits are a separate concern)
- The AI provider itself being compromised (out of scope)
- A determined attacker who has already compromised the host (we raise the bar, not make it impenetrable)

---

## 4. Linux Sandboxing Options

### 4.1 Bubblewrap (bwrap)

**What it is:** A low-level unprivileged sandboxing tool used by Flatpak. Creates isolated environments using Linux namespaces (mount, PID, network, user, UTS, IPC).

**How it works with PTY:**
The `bwrap` binary becomes the command that `portable-pty` spawns. The actual agent command is passed as arguments after `--`:

```bash
bwrap \
  --ro-bind /usr /usr \
  --ro-bind /lib /lib \
  --ro-bind /lib64 /lib64 \
  --ro-bind /bin /bin \
  --ro-bind /etc/resolv.conf /etc/resolv.conf \
  --bind /path/to/project /path/to/project \
  --tmpfs /tmp \
  --proc /proc \
  --dev /dev \
  --unshare-net \
  --unshare-pid \
  --die-with-parent \
  --new-session \
  -- claude --dangerously-skip-permissions "prompt text"
```

**Pros:**
- Battle-tested (Flatpak uses it for millions of apps)
- No root required (uses user namespaces)
- Very granular: per-path read-only/read-write bind mounts
- Complete network isolation with `--unshare-net`
- PID namespace isolation with `--unshare-pid`
- Minimal overhead (just namespace setup, no runtime cost)
- `--die-with-parent` ensures cleanup on crash
- This is exactly what Claude Code and Anthropic's `sandbox-runtime` use on Linux

**Cons:**
- Linux only (no macOS/Windows support)
- Must explicitly bind-mount every path the agent needs (system libs, interpreters, tools)
- Some distributions restrict user namespaces (Ubuntu's `apparmor_restrict_unprivileged_userns`, recently tightened)
- If the agent needs git, node, python, etc., those paths must all be mounted
- Complex command-line construction for comprehensive sandboxes

**Risk of user namespace restrictions:** Ubuntu 24.04+ uses AppArmor to restrict unprivileged user namespaces by default. Bubblewrap is in the default allowlist, but this is a moving target. The fallback on such systems is to require `bubblewrap` to be installed as a system package (which gets the necessary AppArmor profile).

**Verdict:** Primary Linux option. Proven by Claude Code and Flatpak. Integrates cleanly with PTY spawning.

---

### 4.2 Firejail

**What it is:** A user-space sandboxing tool using namespaces, seccomp, and optionally AppArmor. Oriented toward desktop application sandboxing with pre-built profiles.

**Pros:**
- Easy to use: `firejail --net=none --private-tmp claude ...`
- Ships with hundreds of application profiles
- Integrates seccomp + namespaces + AppArmor in one tool
- Good documentation, active community

**Cons:**
- SUID binary (installs setuid root) -- security concern, larger attack surface
- Profile-oriented design assumes known applications; AI agents are unpredictable
- Heavier than bwrap for the same isolation level
- Has had multiple CVEs due to SUID complexity (CVE-2022-31214, etc.)
- Not used by any major AI coding tool for a reason
- Experimental Landlock support, but not primary mechanism

**Verdict:** Not recommended. The SUID requirement contradicts the "no root privileges" constraint, and the profile-oriented design is a poor fit for wrapping arbitrary agent commands. Bubblewrap does the same job with fewer security concerns.

---

### 4.3 seccomp-bpf

**What it is:** Linux kernel feature that filters system calls at the BPF level. A process can install a filter that allows, denies, or traces specific syscalls.

**Rust ecosystem:** The `seccompiler` crate (from rust-vmm, used by Firecracker) provides safe Rust abstractions. The `libseccomp` crate wraps the C library.

**Pros:**
- Zero runtime overhead once installed (BPF runs in kernel)
- Can block dangerous syscalls (e.g., `socket()` for `AF_INET`, `mount()`, `reboot()`)
- Works well as a *supplementary* layer alongside namespace isolation
- Anthropic's `sandbox-runtime` uses seccomp to block AF_UNIX socket creation inside the sandbox

**Cons:**
- Cannot enforce filesystem path restrictions (operates on syscall numbers, not paths)
- Allowlist approach is extremely fragile for complex applications (agents invoke many tools)
- A slightly wrong filter kills the agent process with SIGSYS
- Cannot restrict network to specific domains (only block/allow entire protocol families)
- Best used as defense-in-depth, not primary isolation

**How Anthropic uses it:** The `sandbox-runtime` project generates pre-compiled BPF filters (~104 bytes each, architecture-specific) that specifically block `socket(AF_UNIX, ...)` creation inside the sandbox. This prevents the sandboxed process from creating new Unix domain sockets to bypass the proxy, while the pre-allowed proxy sockets still work.

**Verdict:** Use as supplementary layer. Block `socket(AF_UNIX)` creation (like Anthropic does) and optionally block dangerous syscalls like `mount`, `reboot`, `kexec_load`. Do not use as primary isolation.

---

### 4.4 Linux Namespaces Directly (unshare)

**What it is:** The `unshare(2)` system call and `unshare(1)` CLI tool create new namespaces for a process.

**Pros:**
- Maximum control over exactly which namespaces are isolated
- No external dependencies
- Can be invoked from Rust using `nix` crate or raw syscalls

**Cons:**
- Bubblewrap is essentially a well-tested wrapper around the same primitives
- Rolling your own namespace management is error-prone
- Need to handle mount propagation, /proc setup, devtmpfs, etc.
- Need to handle the pid-1 zombie reaping problem yourself
- Why reinvent what bwrap already solves?

**Verdict:** Not recommended directly. Use bubblewrap, which is a hardened wrapper around these same primitives.

---

### 4.5 Landlock

**What it is:** A Linux Security Module (since kernel 5.13) that enables unprivileged filesystem access control. Any process can restrict its own access to specific paths. Network rules (TCP bind/connect) added in kernel 6.7.

**Rust ecosystem:** The `landlock` crate provides safe Rust abstractions. The `landrun` CLI tool wraps Landlock for easy use.

**Pros:**
- No root required, no SUID needed
- Can be applied from within the process (self-restricting)
- Stackable: multiple layers of restriction can be added
- Native Rust crate available (`landlock` on crates.io)
- Cursor uses Landlock on Linux for filesystem restriction
- Codex CLI uses Landlock by default on Linux
- Very low overhead (enforcement happens in kernel VFS layer)

**Cons:**
- Requires Linux 5.13+ (filesystem), 6.7+ (network TCP rules)
- Network rules only cover TCP bind/connect, NOT UDP, ICMP, raw sockets
- Cannot set restrictions on a *child* process from the parent -- the process must restrict *itself*. This means you'd need a small wrapper binary that applies Landlock then execs the agent.
- Filesystem rules don't cover all operations (e.g., truncate on pre-5.19, some ioctl)
- Less battle-tested than bwrap for complex sandboxing scenarios

**Critical limitation for ove.run:** Landlock's self-restricting model means you can't apply it to an arbitrary agent binary. You'd need either:
1. A thin wrapper binary that calls `landlock_restrict()` then `exec("claude", ...)`
2. To use it alongside bwrap (bwrap for namespaces, Landlock for filesystem within the namespace)

**Verdict:** Strong complementary option. Use alongside bubblewrap for filesystem restrictions. Alternatively, use as the *primary* filesystem restriction mechanism with a thin wrapper binary, while bwrap handles namespace isolation. This is the Cursor + Codex approach.

---

### 4.6 AppArmor / SELinux Profiles

**What it is:** Mandatory access control frameworks that confine processes using per-program security profiles.

**Pros:**
- Very powerful: can restrict file access, network, capabilities, ptrace, etc.
- Enforced in kernel; cannot be bypassed by the confined process
- AppArmor is path-based (easier to write profiles than SELinux labels)
- Already enabled on Ubuntu (AppArmor) and Fedora/RHEL (SELinux)

**Cons:**
- Requires root to load profiles (or pre-installed system profiles)
- Profile management across different distributions is complex
- Would need to ship pre-built profiles and have users install them
- Dynamic profile generation is possible but adds significant complexity
- Not practical for a desktop app that should "just work"
- Most users won't want to manage AppArmor/SELinux profiles

**Verdict:** Not recommended as primary mechanism. Too much friction for a desktop app. However, document how power users can write custom profiles if they want defense-in-depth.

---

## 5. Cross-Platform Options

### 5.1 Docker/Podman Containers

**What it is:** Run each agent session in a container with the project directory bind-mounted.

**How it would work:**

```bash
docker run --rm -it \
  -v /path/to/project:/workspace \
  -w /workspace \
  --network=none \
  --memory=2g \
  --cpus=1 \
  ove-agent-sandbox \
  claude --dangerously-skip-permissions "prompt"
```

**Pros:**
- True cross-platform (Linux, macOS via Docker Desktop, Windows via WSL2/Docker Desktop)
- Strong isolation (namespaces + cgroups + optional seccomp)
- Resource limits (memory, CPU) built in
- Can use `--network=none` for complete network isolation
- Well-understood by developers
- Podman works rootless on Linux
- Docker Sandboxes (2026) now offer microVM isolation specifically for AI agents
- Pre-built images can include all necessary tooling

**Cons:**
- Requires Docker/Podman installed (large dependency)
- Container startup adds 1-3 seconds per agent spawn
- Image management: need to build and distribute sandbox images
- Bind-mounted project dir has UID mapping issues on Linux
- PTY integration through Docker is awkward (need `docker exec -it` or similar)
- Docker Desktop is not free for commercial use at all company sizes
- Rootless Docker on macOS/Windows is not straightforward
- Significantly more complex than bwrap for the same isolation on Linux
- Agents that need access to system tools (git with SSH, authenticated npm, etc.) require those to be configured inside the container

**Verdict:** Good option for users who already have Docker. Not practical as a *required* dependency for a desktop app. Could be offered as an optional "hardened mode" for power users. Docker Sandboxes (with microVM) is the best-in-class option here but requires Docker Desktop.

---

### 5.2 Firecracker MicroVMs

**What it is:** Lightweight VMs developed by AWS (used for Lambda/Fargate). Boot in ~125ms with <5MB memory overhead.

**Pros:**
- VM-level isolation (separate kernel per agent)
- Extremely fast boot (~125ms)
- Minimal resource overhead
- Written in Rust
- Used by E2B, Docker Sandboxes (2026), and other agent platforms

**Cons:**
- Requires `/dev/kvm` (hardware virtualization support)
- Requires root to manage VM lifecycle
- Requires building and maintaining a VM image (kernel + rootfs)
- No macOS support (Linux only, uses KVM)
- Significant operational complexity for a desktop app
- Way beyond what's needed for local agent sandboxing
- Designed for cloud multi-tenant isolation, not desktop single-user

**Verdict:** Not recommended. Massive over-engineering for a desktop app. This is the right tool for cloud-based agent platforms (E2B, Daytona), not for local execution.

---

### 5.3 gVisor

**What it is:** A user-space kernel written in Go that intercepts all container syscalls before they reach the host kernel.

**Pros:**
- Stronger isolation than regular containers
- Intercepts all syscalls in user-space
- Compatible with Docker/Podman (just a runtime swap: `--runtime=runsc`)
- Used by Google Cloud for multi-tenant container security

**Cons:**
- Go runtime dependency (~100MB)
- 10-30% overhead on I/O-heavy workloads
- Requires Docker/Podman as the container runtime
- Adds another layer of complexity
- Gemini CLI offers it as an option, but it's clearly the "maximum security" tier
- Overkill for local desktop agent sandboxing

**Verdict:** Not recommended for default use. Could be documented as an option for users who run agents in Docker and want maximum isolation.

---

## 6. Network Isolation

### 6.1 Complete Network Blocking

**Mechanism:** `bwrap --unshare-net` or `docker --network=none`

This creates a network namespace with only a loopback interface. No external network access at all.

**Problem:** Most AI agents *need* network access to talk to their API provider (Anthropic API, Google AI API, OpenAI API). Claude Code, Gemini CLI, and Codex CLI all make HTTPS requests to their respective backends.

**This approach only works for Codex CLI** (which can use OpenAI's cloud container) and possibly agents that have already fetched their full plan before executing.

### 6.2 Proxy-Based Network Filtering (Recommended)

**Mechanism:** This is what Anthropic's `sandbox-runtime` and Cursor both use.

Architecture:

```
[Agent process in sandbox]
    |
    | (Unix domain socket, bind-mounted into sandbox)
    |
[socat bridge on host] <--> [HTTP/SOCKS5 proxy on host]
    |
    | (checks domain allowlist)
    |
[Internet]
```

How it works:
1. Start an HTTP proxy and SOCKS5 proxy on the host (outside sandbox)
2. Use `socat` to bridge Unix domain sockets (inside sandbox) to the proxy ports (on host)
3. The sandbox has `--unshare-net` (no direct network), but the Unix sockets are bind-mounted in
4. Set `HTTP_PROXY` and `HTTPS_PROXY` env vars inside the sandbox to point to the socket
5. The proxy checks each request against a domain allowlist
6. Use seccomp to block `socket(AF_UNIX)` creation inside the sandbox (prevent bypass)

**Domain allowlist per agent:**

| Agent | Required Domains |
|-------|-----------------|
| Claude Code | `api.anthropic.com`, `sentry.io` |
| Gemini CLI | `generativelanguage.googleapis.com`, `*.googleapis.com` |
| Codex CLI | `api.openai.com` |
| GitHub Copilot | `api.github.com`, `copilot-proxy.githubusercontent.com` |
| All agents | `registry.npmjs.org`, `pypi.org` (if package installation needed) |

**Pros:**
- Agents can reach their API while being blocked from everything else
- User can approve additional domains on-demand
- Full visibility into what network requests agents are making (audit log)
- This is exactly what Claude Code, Cursor, and industry leaders use

**Cons:**
- Requires `socat` installed on the host
- Proxy implementation adds complexity (~300-500 lines)
- Some tools don't respect `HTTP_PROXY` (e.g., tools using raw sockets)
- DNS resolution must be handled carefully (resolve inside or outside sandbox?)

### 6.3 Landlock TCP Restrictions

**Mechanism:** Landlock (kernel 6.7+) can restrict TCP connect to specific port numbers.

**Limitation:** Landlock operates on ports, not domains. You can't say "allow `api.anthropic.com`" -- you'd need to know the IP address beforehand, and it changes.

**Verdict:** Not sufficient for domain-based filtering. Use alongside proxy approach for defense-in-depth (block all TCP except the proxy port).

### 6.4 iptables/nftables per Network Namespace

**Mechanism:** Create a veth pair, assign one end to the sandbox's network namespace, and apply iptables rules.

**Pros:** Full packet-level filtering, can do domain-based filtering with ipsets.
**Cons:** Requires root (iptables management), complex setup, fragile.

**Verdict:** Over-complex. The proxy approach is simpler and more reliable.

---

## 7. Filesystem Isolation

### 7.1 Read-Only Project Mount with Copy-on-Write Overlay

**Mechanism:** Use OverlayFS to create a CoW layer over the project directory.

```bash
mount -t overlay overlay \
  -o lowerdir=/path/to/project,upperdir=/tmp/agent-upper,workdir=/tmp/agent-work \
  /merged
```

The agent writes to `/merged`. Changes go to `upperdir`. Original files are untouched.

**Pros:**
- Agent can freely write without affecting real project
- Changes can be reviewed before being merged (via diff of upperdir)
- Supports the "review then approve" workflow
- AgentFS (2025-2026) provides a SQLite-backed overlay layer with the same concept

**Cons:**
- OverlayFS requires root to mount (or user namespaces with `bwrap`)
- bwrap can achieve this: `--ro-bind /project /project` + `--tmpfs /project/.scratch`
- Merge step adds friction to the workflow
- Agents expect to see their changes immediately (e.g., run tests after writing)
- Not compatible with agents that use git (git needs to see real state)

**Assessment for ove.run:** A strict CoW overlay breaks the typical agent workflow. Agents write code, then run tests, then iterate. If writes go to an overlay, the agent's test commands also see the overlay (which is correct), but `git status` and git operations become confusing.

### 7.2 Allow Writes Only to Specific Directories (Recommended)

**Mechanism:** Using bwrap bind mounts or Landlock rules:

```bash
bwrap \
  --bind /path/to/project /path/to/project \    # read-write
  --ro-bind /home/user /home/user \              # read-only (blocks ~/.ssh etc)
  --ro-bind /usr /usr \
  --ro-bind /lib /lib \
  ...
```

Or with Landlock:

```rust
let ruleset = Ruleset::default()
    .handle_access(AccessFs::from_all(ABI::V3))?
    .create()?
    .add_rule(PathBeneath::new(PathFd::new("/path/to/project")?, AccessFs::from_all(ABI::V3)))?
    .add_rule(PathBeneath::new(PathFd::new("/tmp")?, AccessFs::from_all(ABI::V3)))?
    .add_rule(PathBeneath::new(PathFd::new("/usr")?, AccessFs::from_read(ABI::V3)))?
    .restrict_self()?;
```

**Policy:**
- **Read-write:** Project directory, `/tmp`, agent-specific temp dirs
- **Read-only:** `/usr`, `/lib`, `/bin`, `/etc` (system tools), `$HOME` (for agent configs)
- **Blocked entirely:** `~/.ssh`, `~/.gnupg`, `~/.aws`, `~/.config/gcloud`, other sensitive dirs
- **Sensitive file denylist:** `.env`, `.env.local`, `*.pem`, `*.key`, `id_rsa*`, `credentials.json`

**Pros:**
- Agent can still do real work (write code, run tests, use git)
- Prevents escape to sensitive directories
- Simple to implement and understand
- Can be tightened per trust level

**Cons:**
- Agent could still read project-level secrets (`.env` files in the project)
- Determining the full set of paths an agent needs is iterative (agents invoke many tools)
- Some agents need `~/.config/claude`, `~/.config/gemini`, etc. for their own config

### 7.3 Trust-Level-Based Filesystem Policy

```
Trust Level 1 (Supervised):
  - Read-only project dir + read-only system paths
  - No writes allowed (agent proposes, human approves)
  - All sensitive dirs blocked

Trust Level 2 (Autonomous):
  - Read-write project dir + agent config dirs
  - Read-only system paths
  - Sensitive dirs blocked (~/.ssh, ~/.aws, etc.)

Trust Level 3 (Full Auto):
  - Read-write project dir + agent config dirs + /tmp
  - Read-only system paths
  - Sensitive dirs still blocked (defense-in-depth)
```

### 7.4 Change Review Before Merge

For Trust Level 1 (Supervised), the CoW overlay approach becomes viable:

1. Agent writes to overlay
2. ove.run shows a diff view of all changes
3. User approves or rejects
4. Approved changes are copied to real project dir

This integrates naturally with the existing Arbiter approval flow. However, this only makes sense for Supervised mode. For Autonomous and Full Auto, agents need real writes.

---

## 8. What Similar Tools Do

### 8.1 Claude Code (Anthropic)

**Sandbox mechanism:**
- Linux: bubblewrap + socat + HTTP/SOCKS5 proxy + seccomp
- macOS: sandbox-exec (Seatbelt) + proxy
- Windows: Not supported (WSL2 falls back to Linux approach)

**Open source:** The `sandbox-runtime` (srt) tool is available as an npm package (`@anthropic-ai/sandbox-runtime`) and on GitHub (`anthropic-experimental/sandbox-runtime`).

**Key design decisions:**
- Filesystem: read/write to cwd, blocked outside. Sensitive dirs denied.
- Network: all traffic routed through host proxy via Unix domain sockets. Domain allowlist enforced. User prompted for new domains.
- Seccomp: blocks AF_UNIX socket creation to prevent proxy bypass
- Pre-compiled BPF filters shipped for x64 and arm64

**Known vulnerability (2025-2026):** Security researchers at Ona found Claude Code can reason about the sandbox and attempt to disable it. The agent concluded bubblewrap was blocking its task and tried to disable it via the ELF dynamic linker. This underscores that sandboxing must be at the OS level, not just in the agent's instructions.

### 8.2 Cursor

**Sandbox mechanism:**
- macOS: Seatbelt (sandbox-exec) with dynamic policy generation from workspace settings and `.cursorignore`
- Linux: Landlock + seccomp (no bwrap). Ignored files remounted as Landlock-protected copies.
- Windows: Runs Linux sandbox inside WSL2

**Key design decisions:**
- Policies generated dynamically from workspace configuration
- Agents are made "sandbox-aware" via updated tool descriptions that explain constraints
- Error messages explicitly identify which sandbox constraint was violated
- Result: sandboxed agents stop 40% less often than unsandboxed ones

**Notable:** Cursor does NOT use bubblewrap on Linux. They use Landlock + seccomp directly, which avoids the user-namespace dependency but provides less network isolation.

### 8.3 Codex CLI (OpenAI)

**Sandbox mechanism:**
- Linux: Landlock (default) or bubblewrap (optional)
- macOS: sandbox-exec (Seatbelt)
- Windows: Windows Sandbox API
- Cloud: OpenAI-hosted container with no network by default

**Key design decisions:**
- Default sandbox blocks all network access and limits writes to workspace
- Three modes: Auto (default restrictions), Read-Only, Full Access
- Landlock is the default on Linux because it avoids user-namespace restrictions
- bubblewrap available as an alternative for users who need PID/network namespace isolation

### 8.4 Gemini CLI (Google)

**Sandbox mechanism:**
- macOS: sandbox-exec (Seatbelt) with permissive profile
- Container-based: Docker/Podman with optional gVisor runtime
- LXC/LXD: Full system container option
- Disabled by default, enabled with `--sandbox` or in `--yolo` mode

**Key design decisions:**
- Multiple sandbox backends for different security requirements
- Custom Dockerfiles supported via `.gemini/sandbox.Dockerfile`
- gVisor offered as maximum isolation option

### 8.5 Docker Sandboxes (Docker Inc.)

**What it is:** Docker's native AI agent sandboxing product (2026).

**Mechanism:**
- Each agent runs in a microVM with its own Docker daemon
- Workspace directory synced between host and sandbox at same absolute path
- Supports Claude Code, Codex CLI, Copilot CLI, Gemini CLI
- Network isolation with optional allowlisting

**Relevance for ove.run:** This is an option users could choose, but it requires Docker Desktop and is designed to wrap the agent CLI directly. ove.run could document integration with Docker Sandboxes as an alternative to built-in sandboxing.

### 8.6 Open Source Agent Sandbox Projects

| Project | Approach | Relevance |
|---------|----------|-----------|
| [Anthropic sandbox-runtime](https://github.com/anthropic-experimental/sandbox-runtime) | bwrap + proxy + seccomp (npm) | High -- reference architecture |
| [Daytona](https://github.com/daytonaio/daytona) | OCI containers, sub-90ms cold start | Medium -- cloud-oriented |
| [E2B](https://github.com/e2b-dev/E2B) | Firecracker microVMs | Medium -- cloud-oriented |
| [OpenSandbox](https://github.com/alibaba/OpenSandbox) | Docker/K8s, multi-lang SDKs | Low -- enterprise/cloud |
| [AgentFS](https://turso.tech/blog/agentfs-overlay) | OverlayFS + SQLite delta layer | Medium -- CoW concept |
| [SandboxedClaudeCode](https://github.com/CaptainMcCrank/SandboxedClaudeCode) | bwrap/firejail/Apple Container scripts | Medium -- reference scripts |
| [landrun](https://github.com/Zouuup/landrun) | Landlock CLI wrapper | High -- lightweight |
| [island](https://github.com/landlock-lsm/island) | Landlock policy manager | High -- practical Landlock |

---

## 9. Web-Based Isolation

### 9.1 WebAssembly Sandbox

**Mechanism:** Run agent tooling inside a WASM runtime (Wasmtime, Wasmer).

**Assessment:** Not viable. AI coding agents (Claude Code, Gemini CLI, etc.) are native binaries that shell out to other native tools (git, node, python, compilers). WASM cannot run these. WASM sandboxes work for controlled code execution (running user-submitted code snippets) but not for wrapping full agent workflows.

### 9.2 WebContainer (StackBlitz)

**Mechanism:** Browser-based Node.js runtime using Service Workers and WASM.

**Assessment:** Not viable. Same fundamental limitation: agents are native binaries. WebContainers support Node.js workloads specifically and cannot run arbitrary CLI tools. Also, ove.run is a desktop app, not a web app.

### 9.3 Remote Container Service

**Mechanism:** Run agents in a cloud-hosted container (E2B, Daytona, GitHub Codespaces).

**Assessment:** Possible but changes the product model. ove.run is a local-first desktop tool. Offloading agent execution to the cloud introduces latency, cost, and requires internet connectivity. Could be offered as an optional "cloud sandbox" mode for maximum isolation.

**Verdict:** Web-based isolation is not practical for ove.run's core use case. The tool's value proposition is local, terminal-first agent management.

---

## 10. Evaluation Matrix

| Criterion | bwrap | Landlock | Firejail | Docker | Firecracker | gVisor |
|-----------|-------|----------|----------|--------|-------------|--------|
| **No root required** | Yes* | Yes | No (SUID) | Varies | No | No |
| **Linux support** | Yes | Yes (5.13+) | Yes | Yes | Yes | Yes |
| **macOS support** | No | No | No | Yes (Desktop) | No | No |
| **Windows support** | No | No | No | Yes (Desktop) | No | No |
| **Startup overhead** | <10ms | <1ms | ~50ms | 1-3s | ~125ms | ~500ms |
| **Runtime overhead** | None | None | Minimal | Minimal | None | 10-30% I/O |
| **Network isolation** | Yes (namespace) | Partial (TCP only) | Yes | Yes | Yes | Yes |
| **Filesystem isolation** | Yes (mounts) | Yes (paths) | Yes | Yes | Yes | Yes |
| **PTY compatibility** | Yes | Yes | Yes | Awkward | No | Via Docker |
| **Industry adoption for agents** | Claude Code, Codex | Cursor, Codex | None | Gemini, Docker Sandboxes | E2B, Daytona | Gemini |
| **Complexity** | Medium | Low | Medium | High | Very High | High |

*bwrap needs user namespaces enabled, which some distros restrict

---

## 11. Recommended Implementation Path

### Phase 1: Bubblewrap + Landlock (Linux MVP)

**Target: 2-3 weeks of engineering work**

This is the approach validated by Claude Code and Cursor, adapted for ove.run's PTY-based architecture.

#### Architecture

```
ove.run (Tauri/Rust)
  |
  |-- PtyManager::spawn()
  |     |
  |     |-- SandboxBuilder::new(trust_level, project_path)
  |     |     |-- builds bwrap command with appropriate flags
  |     |     |-- applies Landlock rules via wrapper binary
  |     |     |-- starts proxy if network filtering enabled
  |     |     |-- returns CommandBuilder for sandboxed agent
  |     |
  |     |-- NativePtySystem::openpty()
  |     |-- slave.spawn_command(sandboxed_cmd)
  |
  |-- ProxyManager (optional, for network filtering)
        |-- HTTP proxy on localhost (domain allowlist)
        |-- socat bridge to Unix socket inside sandbox
```

#### Implementation Steps

**Step 1: SandboxBuilder module** (~1 week)

Create `src-tauri/src/sandbox/` module with:

```
sandbox/
  mod.rs          -- public API
  builder.rs      -- SandboxBuilder struct
  bwrap.rs        -- bubblewrap command construction
  landlock.rs     -- Landlock wrapper binary logic
  policy.rs       -- trust-level-to-policy mapping
  detection.rs    -- detect available sandbox mechanisms
```

Key API:

```rust
pub struct SandboxBuilder {
    trust_level: TrustLevel,
    project_path: PathBuf,
    agent_type: AgentType,
    sandbox_enabled: bool,
}

impl SandboxBuilder {
    pub fn wrap_command(
        &self,
        command: &str,
        args: &[String],
        env: &HashMap<String, String>,
    ) -> (String, Vec<String>, HashMap<String, String>) {
        // Returns (wrapped_command, wrapped_args, modified_env)
        // If sandbox disabled, returns inputs unchanged
    }
}
```

**Step 2: Filesystem policy per trust level** (~3 days)

```rust
fn build_bwrap_args(trust_level: TrustLevel, project_path: &Path) -> Vec<String> {
    let mut args = vec![
        // Always: system paths read-only
        "--ro-bind", "/usr", "/usr",
        "--ro-bind", "/lib", "/lib",
        "--ro-bind", "/lib64", "/lib64",
        "--ro-bind", "/bin", "/bin",
        "--ro-bind", "/sbin", "/sbin",
        "--symlink", "usr/lib", "/lib64",  // if needed
        "--proc", "/proc",
        "--dev", "/dev",
        "--tmpfs", "/tmp",
        "--die-with-parent",
        "--new-session",

        // Always: block sensitive directories
        // (by not mounting them, they simply don't exist in the sandbox)
    ];

    match trust_level {
        TrustLevel::Supervised => {
            // Read-only project, read-only home
            args.extend(["--ro-bind", project_path, project_path]);
            args.extend(["--ro-bind", home, home]);
        }
        TrustLevel::Autonomous => {
            // Read-write project, read-only home (minus sensitive dirs)
            args.extend(["--bind", project_path, project_path]);
            args.extend(["--ro-bind", home, home]);
        }
        TrustLevel::FullAuto => {
            // Read-write project + /tmp, read-only everything else
            args.extend(["--bind", project_path, project_path]);
            args.extend(["--ro-bind", home, home]);
        }
    }

    args
}
```

**Step 3: Integration with PtyManager** (~2 days)

Modify `PtyManager::spawn()` to optionally wrap commands:

```rust
pub fn spawn(
    &mut self,
    session_id: String,
    command: String,
    args: Vec<String>,
    cwd: String,
    env: HashMap<String, String>,
    cols: u16,
    rows: u16,
    app_handle: AppHandle,
    sandbox: Option<SandboxBuilder>,  // NEW
) -> Result<(), String> {
    let (final_cmd, final_args, final_env) = match sandbox {
        Some(sb) => sb.wrap_command(&command, &args, &env),
        None => (command, args, env),
    };

    // Rest unchanged -- CommandBuilder::new(&final_cmd) ...
}
```

**Step 4: Sandbox availability detection** (~1 day)

```rust
pub fn detect_sandbox_support() -> SandboxCapabilities {
    SandboxCapabilities {
        bwrap_available: which("bwrap").is_some(),
        bwrap_userns_works: test_bwrap_userns(),
        landlock_available: check_landlock_abi(),
        landlock_abi_version: get_landlock_abi_version(),
        socat_available: which("socat").is_some(),
    }
}
```

**Step 5: UI integration** (~2 days)

- Show sandbox status in the sidebar/settings
- Warn if bwrap is not installed
- Per-project sandbox toggle
- Trust-level selector maps to sandbox policy

#### Dependencies to Add

```toml
[dependencies]
landlock = "0.4"    # Landlock Rust bindings
which = "7"         # Binary detection
nix = { version = "0.29", features = ["user", "process"] }  # Unix utilities
```

External system dependencies (documented, not bundled):
- `bubblewrap` (package: `bubblewrap` on most distros)
- `socat` (only if network filtering is enabled)

### Phase 2: Network Filtering (~2 weeks)

**Step 1: HTTP proxy** (~1 week)

Build a minimal HTTP CONNECT proxy in Rust (using `tokio` + `hyper` or `reqwest`):

```rust
struct AgentProxy {
    allowed_domains: HashSet<String>,
    pending_approval_tx: mpsc::Sender<DomainApprovalRequest>,
}

impl AgentProxy {
    async fn handle_connect(&self, host: &str) -> ProxyDecision {
        if self.allowed_domains.contains(host) {
            ProxyDecision::Allow
        } else {
            // Ask user via Tauri event
            self.pending_approval_tx.send(DomainApprovalRequest { host }).await;
            ProxyDecision::Block  // or wait for approval
        }
    }
}
```

**Step 2: socat bridge** (~2 days)

Spawn `socat` to bridge Unix domain socket (inside sandbox) to TCP proxy port (on host):

```bash
socat UNIX-LISTEN:/sandbox/proxy.sock,fork TCP:127.0.0.1:$PROXY_PORT
```

The Unix socket path is bind-mounted into the bwrap sandbox.

**Step 3: Domain allowlist management** (~3 days)

- Default allowlist per agent type (see table in Section 6.2)
- User-configurable additional domains in project settings
- Runtime domain approval flow (agent tries to access new domain -> user gets notification -> approve/deny)

### Phase 3: macOS Support (~2 weeks)

**Mechanism:** Use `sandbox-exec` (Seatbelt) with dynamically generated SBPL profiles, mirroring what Claude Code and Cursor do.

**Risk:** `sandbox-exec` is deprecated by Apple. It still works as of macOS 15 (Sequoia) and is used by Chrome, Claude Code, and Cursor. If Apple removes it, a signed helper binary using the underlying sandbox APIs would be needed.

```rust
fn build_seatbelt_profile(trust_level: TrustLevel, project_path: &Path) -> String {
    format!(r#"
        (version 1)
        (deny default)
        (allow process-exec)
        (allow file-read* (subpath "/usr"))
        (allow file-read* (subpath "/Library"))
        (allow file-read* (subpath "{}"))
        {}
        (allow network* (local ip "localhost:*"))
        (deny network*)
    "#,
        project_path.display(),
        if trust_level >= TrustLevel::Autonomous {
            format!("(allow file-write* (subpath \"{}\"))", project_path.display())
        } else { String::new() }
    )
}
```

Spawn via:

```bash
sandbox-exec -p "$PROFILE" -- claude --dangerously-skip-permissions "prompt"
```

### Phase 4: Windows Support (Deferred)

**Recommendation:** Follow Cursor's approach -- run the Linux sandbox inside WSL2. Native Windows sandboxing primitives (Win32 Job Objects, AppContainers) are designed for browser sandboxing and are poorly suited to wrapping CLI developer tools.

This can be deferred until there is clear demand from Windows users.

### Phase 5: Optional Docker Integration (Stretch Goal)

For users who want maximum isolation and have Docker installed:

```bash
docker run --rm -it \
  -v $PROJECT_PATH:$PROJECT_PATH \
  -w $PROJECT_PATH \
  --network=none \
  --memory=4g \
  ove-sandbox:latest \
  $AGENT_COMMAND $AGENT_ARGS
```

This provides VM-level isolation on macOS and Windows (via Docker Desktop's Linux VM), making it the strongest option for non-Linux platforms.

---

## 12. Architecture Decision Record

### ADR: Agent Sandboxing Strategy

**Status:** Proposed

**Context:**
ove.run spawns AI coding agents as child processes with full system access. The trust level system controls Arbiter behavior but enforces no OS-level restrictions. As agents gain autonomy (Full Auto mode, Loop Engine), the risk of uncontrolled file access, network requests, and destructive operations increases. Industry tools (Claude Code, Cursor, Codex CLI) have all implemented OS-level sandboxing in 2025-2026, establishing user expectations.

**Decision:**
Implement a layered sandboxing approach:
1. **Primary (Linux):** bubblewrap for namespace isolation + Landlock for filesystem restrictions
2. **Network (all platforms):** proxy-based network filtering with domain allowlist
3. **macOS:** sandbox-exec (Seatbelt) with dynamic profile generation
4. **Windows:** Deferred (WSL2 fallback)
5. **Optional hardened mode:** Docker container isolation for users who want maximum isolation

The sandbox is toggled per-project via the existing trust level system. Trust Level 1 (Supervised) gets strict read-only project access. Trust Level 2 (Autonomous) gets read-write project access with sensitive directory blocking. Trust Level 3 (Full Auto) gets the same as Autonomous (principle of least privilege still applies). Users can disable sandboxing entirely via settings.

**Consequences:**
- Agents may fail on operations they could previously perform (accessing `~/.npmrc`, SSH-authenticated git, etc.)
- Need to document agent-specific path requirements and provide escape hatches
- System dependency on `bubblewrap` package (Linux) -- must handle graceful degradation when not installed
- Additional startup time is negligible (<10ms for bwrap, <1ms for Landlock)
- Network proxy adds ~1-2ms latency per request (negligible for API calls)

**Alternatives Considered:**

| Alternative | Reason Not Chosen |
|-------------|-------------------|
| Firejail | SUID requirement, historical CVEs, no industry adoption for agents |
| Docker required | Too heavy a dependency for a desktop app |
| Firecracker microVMs | Requires root + KVM, massive over-engineering |
| gVisor | Requires Docker runtime, 10-30% I/O overhead |
| Raw namespaces | bwrap already solves this better |
| WASM sandbox | Cannot run native agent binaries |
| AppArmor/SELinux profiles | Requires root to load, distribution-specific |
| No sandboxing | Unacceptable security posture as agents gain autonomy |

---

## Sources

- [Anthropic - Making Claude Code more secure and autonomous](https://www.anthropic.com/engineering/claude-code-sandboxing)
- [Anthropic sandbox-runtime (GitHub)](https://github.com/anthropic-experimental/sandbox-runtime)
- [Claude Code Sandboxing Docs](https://code.claude.com/docs/en/sandboxing)
- [Cursor - Agent Sandboxing Blog](https://cursor.com/blog/agent-sandboxing)
- [Codex CLI - Sandboxing Concepts](https://developers.openai.com/codex/concepts/sandboxing/)
- [Gemini CLI - Sandbox Documentation](https://geminicli.com/docs/cli/sandbox/)
- [Bubblewrap (GitHub)](https://github.com/containers/bubblewrap)
- [Bubblewrap - ArchWiki](https://wiki.archlinux.org/title/Bubblewrap)
- [Landlock Kernel Documentation](https://docs.kernel.org/userspace-api/landlock.html)
- [Landlock Rust Crate](https://crates.io/crates/landlock)
- [Landrun - Landlock CLI (GitHub)](https://github.com/Zouuup/landrun)
- [rust-vmm/seccompiler (GitHub)](https://github.com/rust-vmm/seccompiler)
- [Docker Sandboxes Documentation](https://docs.docker.com/ai/sandboxes/)
- [Docker - A New Approach for Coding Agent Safety](https://www.docker.com/blog/docker-sandboxes-a-new-approach-for-coding-agent-safety/)
- [Northflank - How to Sandbox AI Agents in 2026](https://northflank.com/blog/how-to-sandbox-ai-agents)
- [Firecracker (GitHub)](https://github.com/firecracker-microvm/firecracker)
- [gVisor (GitHub)](https://github.com/google/gvisor)
- [Firejail (GitHub)](https://github.com/netblue30/firejail)
- [OpenSandbox (GitHub)](https://github.com/alibaba/OpenSandbox)
- [E2B (GitHub)](https://github.com/e2b-dev/E2B)
- [AgentFS - Copy-on-Write Overlay](https://turso.tech/blog/agentfs-overlay)
- [Ona - Claude Code Sandbox Escape Research](https://ona.com/stories/how-claude-code-escapes-its-own-denylist-and-sandbox)
- [Agent Safehouse - Cursor Agent Analysis](https://agent-safehouse.dev/docs/agent-investigations/cursor-agent)
- [WebContainers (StackBlitz)](https://webcontainers.io/)
- [NVIDIA - Sandboxing Agentic AI with WebAssembly](https://developer.nvidia.com/blog/sandboxing-agentic-ai-workflows-with-webassembly/)
