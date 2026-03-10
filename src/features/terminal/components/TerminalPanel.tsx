import { useEffect, useRef, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import cn from "clsx";
import panelClasses from "./TerminalPanel.module.css";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { useProjectStore } from "@/stores/projectStore";
import { spawnPty, writePty, resizePty, killPty, listAgentTypes, sendDesktopNotification } from "@/lib/tauri";
import { listen } from "@tauri-apps/api/event";
import { detectStatusFromOutput } from "@/lib/patterns";
import { useAgentFeedbackStore } from "@/stores/agentFeedbackStore";
import { parseFeedbackOptions, cleanTerminalOutput } from "@/lib/feedbackParser";
import type { AgentSession, AgentDefinition, AgentStatus } from "@/types";
import { v4 as uuidv4 } from "uuid";

/**
 * Read the last N lines from xterm's active buffer.
 * Uses translateToString(true) which trims trailing whitespace per line,
 * eliminating the Ink space-padding issue natively.
 */
function readXtermBuffer(term: Terminal, lineCount = 40): string {
  const buf = term.buffer.active;
  const totalLines = buf.length;
  const start = Math.max(0, totalLines - lineCount);
  const lines: string[] = [];
  for (let i = start; i < totalLines; i++) {
    const line = buf.getLine(i);
    if (line) lines.push(line.translateToString(true));
  }
  return lines.join("\n");
}

interface TerminalPanelProps {
  session: AgentSession;
  isVisible: boolean;
  isFocused: boolean;
  projectPath: string;
}

export function TerminalPanel({ session, isVisible, isFocused, projectPath }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const spawnedRef = useRef(false);
  const agentDefRef = useRef<AgentDefinition | null>(null);
  const isVisibleRef = useRef(isVisible);
  isVisibleRef.current = isVisible;
  const unlistenOutputRef = useRef<(() => void) | null>(null);
  const unlistenExitRef = useRef<(() => void) | null>(null);

  const updateStatus = useSessionStore((s) => s.updateSessionStatus);
  const settings = useSettingsStore((s) => s.settings);
  const addNotification = useNotificationStore((s) => s.addNotification);
  const lastStatusRef = useRef<AgentStatus>(session.status);
  // Keep lastStatusRef in sync with external status changes (e.g. modal setting "working")
  lastStatusRef.current = session.status;

  const doSpawn = useCallback(
    async (term: Terminal, fitAddon: FitAddon) => {
      if (spawnedRef.current) return;
      if (!agentDefRef.current) return;
      spawnedRef.current = true;

      updateStatus(session.id, "starting");

      try {
        try {
          fitAddon.fit();
        } catch {
          // Container may not be visible yet — use defaults
        }
        const cols = term.cols || 80;
        const rows = term.rows || 24;
        const agentDef = agentDefRef.current;

        const cmdParts = agentDef.command.split(" ");
        const command = cmdParts[0];
        const baseArgs = cmdParts.slice(1);
        const defaultArgs = agentDef.default_args ?? [];
        const customArgs = settings.agents[session.agentType]?.custom_args ?? [];
        const resumeArgs = session.isResumed ? (agentDef.resume_args ?? []) : [];
        const envVars = settings.agents[session.agentType]?.env_vars ?? {};
        const args = session.yoloMode
          ? [...baseArgs, ...resumeArgs, ...defaultArgs, ...customArgs, agentDef.yolo_flag].filter(Boolean)
          : [...baseArgs, ...resumeArgs, ...defaultArgs, ...customArgs].filter(Boolean);

        await spawnPty(session.id, command, args, projectPath, envVars, cols, rows);
        updateStatus(session.id, "idle");

        if (session.initialPrompt) {
          setTimeout(async () => {
            const bytes = Array.from(new TextEncoder().encode(session.initialPrompt + "\r"));
            await writePty(session.id, bytes);
          }, 2000);
        }
      } catch (err) {
        console.error("Failed to spawn PTY:", err);
        term.writeln("\r\n\x1b[31mFailed to start agent process.\x1b[0m");
        updateStatus(session.id, "error");
        spawnedRef.current = false;
      }
    },
    [session.id, session.yoloMode, session.agentType, session.isResumed, projectPath, settings.agents, updateStatus],
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

    // Handle resize — ignore degenerate sizes from hidden containers
    term.onResize(({ cols, rows }) => {
      if (!spawnedRef.current) return;
      if (cols < 10 || rows < 3) return;
      resizePty(session.id, cols, rows).catch((err) => {
        console.error("resizePty error:", err);
      });
    });

    // Listen for PTY output
    let cancelledOutput = false;
    listen<number[]>(`pty-output-${session.id}`, (event) => {
      if (cancelledOutput) return;
      const bytes = new Uint8Array(event.payload);

      // term.write is async — use callback to ensure buffer is updated before reading
      term.write(bytes, () => {
        if (cancelledOutput) return;

        // Read directly from xterm's processed buffer — handles ANSI stripping
        // and trailing whitespace trimming natively, avoiding all custom buffer bugs
        const screenText = readXtermBuffer(term, 40);
        const detected = detectStatusFromOutput(agentDefRef.current, screenText);
        if (detected && detected !== lastStatusRef.current) {
          const prevStatus = lastStatusRef.current;
          console.log(`[agentic] status change: ${prevStatus} → ${detected} (session=${session.id})`);
          lastStatusRef.current = detected;
          updateStatus(session.id, detected);

          // Send notification for important status changes
          if (settings.global.notifications_enabled && (detected === "finished" || detected === "needs_input")) {
            const notifTitle = detected === "finished" ? "Agent Finished" : "Input Required";
            const notifBody = `${session.label} ${detected === "finished" ? "has completed" : "needs your input"}`;
            addNotification({
              id: uuidv4(),
              title: notifTitle,
              body: notifBody,
              sessionId: session.id,
              timestamp: new Date().toISOString(),
            });
            // System notification when app is not focused
            if (!document.hasFocus()) {
              sendDesktopNotification(notifTitle, notifBody).catch(() => {});
            }
          }

          // Enqueue feedback
          const project = useProjectStore.getState().projects.find((p) => p.id === session.projectId);
          const feedbackOutput = cleanTerminalOutput(readXtermBuffer(term, 30));

          if (detected === "needs_input") {
            const parsed = parseFeedbackOptions(feedbackOutput);
            useAgentFeedbackStore.getState().enqueue({
              id: uuidv4(),
              sessionId: session.id,
              projectId: session.projectId,
              type: "question",
              output: feedbackOutput,
              parsedOptions: parsed.options,
              allowFreeInput: parsed.allowFreeInput,
              timestamp: new Date().toISOString(),
              guardianEnabled: !!project?.guardian_enabled,
            });
          } else if ((detected === "idle" || detected === "finished") && prevStatus === "working") {
            useAgentFeedbackStore.getState().enqueue({
              id: uuidv4(),
              sessionId: session.id,
              projectId: session.projectId,
              type: "response",
              output: feedbackOutput,
              parsedOptions: [],
              allowFreeInput: false,
              timestamp: new Date().toISOString(),
              guardianEnabled: false,
            });
          }
        }
      });
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

    // ResizeObserver for auto-fit — use isVisibleRef to avoid stale closure
    const observer = new ResizeObserver(() => {
      if (!isVisibleRef.current) return;
      // Guard against fitting into a 0-width hidden container
      const el = containerRef.current;
      if (!el || el.clientWidth < 100 || el.clientHeight < 50) return;
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

  // Fit terminal when it becomes visible or focused
  useEffect(() => {
    if (isVisible && fitAddonRef.current) {
      setTimeout(() => {
        try {
          fitAddonRef.current?.fit();
        } catch {
          // ignore
        }
      }, 50);
    }
  }, [isVisible, isFocused]);

  useEffect(() => {
    if (!isFocused || !termRef.current) return;
    try {
      termRef.current.focus();
    } catch {
      // ignore
    }
  }, [isFocused]);

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
      className={cn(panelClasses.container, !isVisible && panelClasses.containerHidden)}
      aria-label={`Terminal for session ${session.label}`}
    />
  );
}
