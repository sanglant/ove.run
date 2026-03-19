import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { Text, Progress, ScrollArea } from "@mantine/core";
import { Eye } from "lucide-react";
import { useSessionStore } from "@/stores/sessionStore";
import { useProjectStore } from "@/stores/projectStore";
import { arbiterAnswer, arbiterProcessCompletion } from "@/lib/arbiter";
import { sendKeys, toBytes } from "@/lib/pty-utils";
import { answerMcpQuestion } from "@/lib/tauri";
import { useSettingsStore } from "@/stores/settingsStore";
import { AnsiUp } from "ansi_up";
import DOMPurify from "dompurify";
import type { FeedbackItem } from "@/types";
import { AgentBadge } from "@/components/ui/AgentBadge";
import classes from "./AgentFeedbackToast.module.css";

interface AgentFeedbackToastProps {
  item: FeedbackItem;
  onDismiss: () => void;
  showFocusButton?: boolean;
}

export function AgentFeedbackToast({ item, onDismiss, showFocusButton }: AgentFeedbackToastProps) {
  const settings = useSettingsStore((s) => s.settings);
  const arbiterTimeoutMs = settings.global.arbiter_timeout_seconds * 1000;

  const [freeText, setFreeText] = useState("");
  const [timeLeft, setTimeLeft] = useState(arbiterTimeoutMs);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const triggeredRef = useRef(false);

  const sessions = useSessionStore((s) => s.sessions);
  const setActiveSession = useSessionStore((s) => s.setActiveSession);
  const updateStatus = useSessionStore((s) => s.updateSessionStatus);

  const session = sessions.find((s) => s.id === item.sessionId);

  const handleSendKeys = useCallback(
    async (keys: number[]) => {
      if (item.source === "mcp") {
        // MCP-sourced question — answer via MCP response channel
        const text = keys.length > 0
          ? String.fromCharCode(...keys).replace(/\r$/, "")
          : "";
        try {
          await answerMcpQuestion(item.id, text);
        } catch (err) {
          console.error("Failed to answer MCP question:", err);
        }
      } else {
        // PTY-sourced question — write keys to terminal
        try {
          await sendKeys(item.sessionId, keys);
        } catch (err) {
          console.error("Failed to write to PTY:", err);
        }
      }
      updateStatus(item.sessionId, "working");
      onDismiss();
    },
    [item.id, item.source, item.sessionId, onDismiss, updateStatus],
  );

  const handleFreeTextSubmit = useCallback(() => {
    if (!freeText.trim()) return;
    if (item.source === "mcp") {
      answerMcpQuestion(item.id, freeText.trim()).catch((err) => {
        console.error("Failed to answer MCP question:", err);
      });
      updateStatus(item.sessionId, "working");
      onDismiss();
    } else {
      const bytes = toBytes(freeText + "\r");
      handleSendKeys(bytes);
    }
  }, [freeText, item.id, item.source, item.sessionId, handleSendKeys, updateStatus, onDismiss]);

  const handleFocusTerminal = useCallback(() => {
    setActiveSession(item.sessionId);
  }, [item.sessionId, setActiveSession]);

  // Arbiter auto-answer timer (for questions)
  useEffect(() => {
    triggeredRef.current = false;

    if (item.type !== "question" || !item.arbiterEnabled) {
      return;
    }

    setTimeLeft(arbiterTimeoutMs);
    const startTime = Date.now();

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, arbiterTimeoutMs - elapsed);
      setTimeLeft(remaining);

      if (remaining <= 0 && !triggeredRef.current) {
        triggeredRef.current = true;
        if (timerRef.current) clearInterval(timerRef.current);

        const proj = useProjectStore
          .getState()
          .projects.find((p) => p.id === item.projectId);
        if (proj) {
          arbiterAnswer(item, proj.path);
        }
        onDismiss();
      }
    }, 100);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [
    item.id,
    item.type,
    item.arbiterEnabled,
    item.sessionId,
    item.projectId,
    arbiterTimeoutMs,
    onDismiss,
  ]);

  // Arbiter auto-process completions (extract memories, dismiss)
  useEffect(() => {
    if (item.type !== "response" || !item.arbiterEnabled) {
      return;
    }

    const proj = useProjectStore
      .getState()
      .projects.find((p) => p.id === item.projectId);
    if (proj) {
      arbiterProcessCompletion(item, proj.path);
    }
    onDismiss();
  }, [item.id, item.type, item.arbiterEnabled, item.projectId, onDismiss]);

  const isQuestion = item.type === "question";

  const outputHtml = useMemo(() => {
    const ansiUp = new AnsiUp();
    ansiUp.use_classes = false;
    const raw = ansiUp.ansi_to_html(item.output).replace(/\n/g, "<br>");
    return DOMPurify.sanitize(raw);
  }, [item.output]);

  return (
    <div className={classes.toast}>
      {/* Header */}
      <div className={classes.header}>
        <div className={classes.headerLeft}>
          <AgentBadge agentType={session?.agentType ?? ""} />
          <Text size="xs" fw={600} c="var(--text-primary)" truncate>
            {session?.label ?? "Agent"}
          </Text>
        </div>
        <button className={classes.dismiss} onClick={onDismiss} title="Dismiss">
          &times;
        </button>
      </div>

      {/* Output preview */}
      <ScrollArea h={100} type="auto">
        <div
          dangerouslySetInnerHTML={{ __html: outputHtml }}
          className={classes.output}
        />
      </ScrollArea>

      {/* Arbiter timer */}
      {isQuestion && item.arbiterEnabled && (
        <div className={classes.timer}>
          <Text size="xs" c="var(--text-secondary)" mb={2}>
            Auto-answer in {Math.ceil(timeLeft / 1000)}s
          </Text>
          <Progress
            value={(timeLeft / arbiterTimeoutMs) * 100}
            size={3}
            color="var(--arbiter)"
            animated
          />
        </div>
      )}

      {/* Answer options */}
      {isQuestion && item.parsedOptions.length > 0 && (
        <div className={classes.options}>
          {item.parsedOptions.map((opt) => (
            <button
              key={opt.label}
              className={classes.optionButton}
              onClick={() => handleSendKeys(opt.keys)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Free text input */}
      {isQuestion && item.allowFreeInput && (
        <div className={classes.inputRow}>
          <input
            type="text"
            placeholder="Type response..."
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleFreeTextSubmit();
            }}
            className={classes.input}
          />
          <button
            className={classes.sendButton}
            onClick={handleFreeTextSubmit}
            disabled={!freeText.trim()}
          >
            Send
          </button>
        </div>
      )}

      {/* Focus terminal button (when terminal not in view) */}
      {showFocusButton && (
        <button className={classes.focusButton} onClick={handleFocusTerminal}>
          <Eye size={12} />
          Focus Terminal
        </button>
      )}
    </div>
  );
}
