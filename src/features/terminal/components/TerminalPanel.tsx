import { useEffect, useRef, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { useProjectStore } from "@/stores/projectStore";
import { useGuardianStore } from "@/stores/guardianStore";
import { spawnPty, writePty, resizePty, killPty, listAgentTypes } from "@/lib/tauri";
import { listen } from "@tauri-apps/api/event";
import { detectStatusFromOutput, stripAnsi } from "@/lib/patterns";
import { triggerGuardianReview, handleGuardianCrash } from "@/lib/guardian";
import type { AgentSession, AgentDefinition, AgentStatus } from "@/types";
import { v4 as uuidv4 } from "uuid";

interface TerminalPanelProps {
  session: AgentSession;
  isActive: boolean;
  projectPath: string;
}

export function TerminalPanel({ session, isActive, projectPath }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const spawnedRef = useRef(false);
  const agentDefRef = useRef<AgentDefinition | null>(null);
  const unlistenOutputRef = useRef<(() => void) | null>(null);
  const unlistenExitRef = useRef<(() => void) | null>(null);

  const updateStatus = useSessionStore((s) => s.updateSessionStatus);
  const settings = useSettingsStore((s) => s.settings);
  const addNotification = useNotificationStore((s) => s.addNotification);
  const lastStatusRef = useRef<AgentStatus>(session.status);
  const outputBufferRef = useRef("");

  const doSpawn = useCallback(
    async (term: Terminal, fitAddon: FitAddon) => {
      if (spawnedRef.current) return;
      if (!agentDefRef.current) return;
      spawnedRef.current = true;

      updateStatus(session.id, "starting");

      try {
        fitAddon.fit();
        const { cols, rows } = term;
        const agentDef = agentDefRef.current;

        const cmdParts = agentDef.command.split(" ");
        const command = cmdParts[0];
        const baseArgs = cmdParts.slice(1);
        const defaultArgs = agentDef.default_args ?? [];
        const customArgs = settings.agents[session.agentType]?.custom_args ?? [];
        const envVars = settings.agents[session.agentType]?.env_vars ?? {};
        const args = session.yoloMode
          ? [...baseArgs, ...defaultArgs, ...customArgs, agentDef.yolo_flag].filter(Boolean)
          : [...baseArgs, ...defaultArgs, ...customArgs].filter(Boolean);

        await spawnPty(session.id, command, args, projectPath, envVars, cols, rows);
        updateStatus(session.id, "idle");
      } catch (err) {
        console.error("Failed to spawn PTY:", err);
        term.writeln("\r\n\x1b[31mFailed to start agent process.\x1b[0m");
        updateStatus(session.id, "error");
        spawnedRef.current = false;
      }
    },
    [session.id, session.yoloMode, session.agentType, projectPath, settings.agents, updateStatus],
  );

  // Initialize terminal on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      theme: {
        background: "#090909",
        foreground: "#e8e8f0",
        cursor: "#6c7ee1",
        cursorAccent: "#090909",
        selectionBackground: "#2e2e3e",
        black: "#111114",
        red: "#e5737f",
        green: "#8cc084",
        yellow: "#d4a56a",
        blue: "#6c7ee1",
        magenta: "#bb9af7",
        cyan: "#7dcfff",
        white: "#8888a0",
        brightBlack: "#50505f",
        brightRed: "#e5737f",
        brightGreen: "#8cc084",
        brightYellow: "#d4a574",
        brightBlue: "#8b9cf7",
        brightMagenta: "#bb9af7",
        brightCyan: "#7dcfff",
        brightWhite: "#e8e8f0",
      },
      fontFamily: settings.global.font_family || "JetBrains Mono, Cascadia Code, monospace",
      fontSize: settings.global.font_size || 14,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: "block",
      scrollback: settings.global.terminal_scrollback || 10000,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());
    term.open(containerRef.current);

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Handle user input
    term.onData((data) => {
      if (!spawnedRef.current) return;
      const bytes = Array.from(new TextEncoder().encode(data));
      writePty(session.id, bytes).catch((err) => {
        console.error("writePty error:", err);
      });
    });

    // Handle resize
    term.onResize(({ cols, rows }) => {
      if (!spawnedRef.current) return;
      resizePty(session.id, cols, rows).catch((err) => {
        console.error("resizePty error:", err);
      });
    });

    // Listen for PTY output
    let cancelledOutput = false;
    listen<number[]>(`pty-output-${session.id}`, (event) => {
      if (cancelledOutput) return;
      const bytes = new Uint8Array(event.payload);
      term.write(bytes);

      // Detect agent status from output
      const text = new TextDecoder().decode(bytes);
      outputBufferRef.current += text;
      // Keep only last 500 chars for pattern matching
      if (outputBufferRef.current.length > 500) {
        outputBufferRef.current = outputBufferRef.current.slice(-500);
      }

      // Update guardian output buffer (2000 char rolling buffer, ANSI-stripped, no re-render)
      const guardianState = useGuardianStore.getState();
      const currentBuffer = guardianState.outputBuffers[session.id] || "";
      const cleanText = stripAnsi(text);
      guardianState.updateOutputBuffer(session.id, (currentBuffer + cleanText).slice(-2000));

      const detected = detectStatusFromOutput(session.agentType, outputBufferRef.current);
      if (detected && detected !== lastStatusRef.current) {
        lastStatusRef.current = detected;
        updateStatus(session.id, detected);

        // Send notification for important status changes
        if (settings.global.notifications_enabled && (detected === "finished" || detected === "needs_input")) {
          addNotification({
            id: uuidv4(),
            title: detected === "finished" ? "Agent Finished" : "Input Required",
            body: `${session.label} ${detected === "finished" ? "has completed" : "needs your input"}`,
            sessionId: session.id,
            timestamp: new Date().toISOString(),
          });
        }

        // Trigger guardian review when agent needs input (non-guardian sessions only)
        if (detected === "needs_input" && !session.isGuardian) {
          const project = useProjectStore.getState().projects.find((p) => p.id === session.projectId);
          const guardianSessionId = useGuardianStore.getState().guardianSessionIds[session.projectId];
          if (project && guardianSessionId) {
            triggerGuardianReview(session, project.path);
          }
        }
      }
    }).then((unlisten) => {
      if (cancelledOutput) {
        unlisten();
      } else {
        unlistenOutputRef.current = unlisten;
      }
    });

    // Listen for PTY exit
    let cancelledExit = false;
    listen<number>(`pty-exit-${session.id}`, (event) => {
      if (cancelledExit) return;
      const code = event.payload ?? 0;

      // Handle guardian exit — only treat non-zero exit as crash
      if (session.isGuardian) {
        if (code !== 0) {
          handleGuardianCrash(session.projectId, session.id);
        }
        return;
      }

      term.writeln(`\r\n\x1b[2m[Process exited with code ${code}]\x1b[0m`);
      updateStatus(session.id, code === 0 ? "finished" : "error");
      spawnedRef.current = false;
    }).then((unlisten) => {
      if (cancelledExit) {
        unlisten();
      } else {
        unlistenExitRef.current = unlisten;
      }
    });

    // ResizeObserver for auto-fit
    const observer = new ResizeObserver(() => {
      if (!isActive) return;
      try {
        fitAddon.fit();
      } catch {
        // ignore
      }
    });
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    // Load agent types and spawn
    listAgentTypes()
      .then((defs) => {
        const def = defs.find((d) => d.agent_type === session.agentType) ?? null;
        agentDefRef.current = def;
        return doSpawn(term, fitAddon);
      })
      .catch((err) => {
        console.error("Failed to load agent types:", err);
        term.writeln("\r\n\x1b[31mFailed to load agent configuration.\x1b[0m");
        updateStatus(session.id, "error");
      });

    return () => {
      cancelledOutput = true;
      cancelledExit = true;
      unlistenOutputRef.current?.();
      unlistenExitRef.current?.();
      observer.disconnect();

      killPty(session.id).catch(() => {});
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
      spawnedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  // Fit terminal when it becomes active
  useEffect(() => {
    if (isActive && fitAddonRef.current) {
      setTimeout(() => {
        try {
          fitAddonRef.current?.fit();
        } catch {
          // ignore
        }
      }, 50);
    }
  }, [isActive]);

  // Re-spawn when yoloMode changes (and session is already started or errored)
  const prevYoloRef = useRef(session.yoloMode);
  useEffect(() => {
    if (prevYoloRef.current === session.yoloMode) return;
    prevYoloRef.current = session.yoloMode;

    if (!termRef.current || !fitAddonRef.current) return;
    const term = termRef.current;
    const fitAddon = fitAddonRef.current;

    killPty(session.id)
      .catch(() => {})
      .then(() => {
        spawnedRef.current = false;
        term.clear();
        term.writeln("\x1b[2m[Respawning with updated configuration...]\x1b[0m\r\n");
        return doSpawn(term, fitAddon);
      });
  }, [session.yoloMode, session.id, doSpawn]);

  return (
    <div
      ref={containerRef}
      style={{
        display: isActive ? "flex" : "none",
        width: "100%",
        height: "100%",
        flex: 1,
        overflow: "hidden",
      }}
      aria-label={`Terminal for session ${session.label}`}
    />
  );
}
