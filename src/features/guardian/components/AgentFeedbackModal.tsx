import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import {
  Modal,
  Button,
  Group,
  Text,
  TextInput,
  Stack,
  Progress,
  ScrollArea,
} from "@mantine/core";
import { useAgentFeedbackStore } from "@/stores/agentFeedbackStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useProjectStore } from "@/stores/projectStore";
import { writePty } from "@/lib/tauri";
import { guardianAnswer } from "@/lib/guardian";
import { useSettingsStore } from "@/stores/settingsStore";
import { AnsiUp } from "ansi_up";
import type { FeedbackItem } from "@/types";
import classes from "./AgentFeedbackModal.module.css";

const AGENT_META: Record<string, { label: string; color: string; displayName: string }> = {
  claude: { label: "CC", color: "var(--claude)", displayName: "Claude" },
  gemini: { label: "GC", color: "var(--gemini)", displayName: "Gemini" },
  copilot: { label: "CP", color: "var(--copilot)", displayName: "Copilot" },
  codex: { label: "CX", color: "var(--codex)", displayName: "Codex" },
  terminal: { label: ">_", color: "var(--text-secondary)", displayName: "Terminal" },
};

export function AgentFeedbackModal() {
  const queue = useAgentFeedbackStore((s) => s.queue);
  const dismissCurrent = useAgentFeedbackStore((s) => s.dismissCurrent);
  const current = queue[0] ?? null;

  if (!current) return null;

  return <FeedbackModalContent item={current} onDismiss={dismissCurrent} />;
}

function FeedbackModalContent({
  item,
  onDismiss,
}: {
  item: FeedbackItem;
  onDismiss: () => void;
}) {
  const settings = useSettingsStore((s) => s.settings);
  const guardianTimeoutMs = settings.global.guardian_timeout_seconds * 1000;

  const [freeText, setFreeText] = useState("");
  const [timeLeft, setTimeLeft] = useState(guardianTimeoutMs);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const triggeredRef = useRef(false);

  const sessions = useSessionStore((s) => s.sessions);
  const setActiveSession = useSessionStore((s) => s.setActiveSession);
  const projects = useProjectStore((s) => s.projects);

  const session = sessions.find((s) => s.id === item.sessionId);
  const project = projects.find((p) => p.id === item.projectId);
  const agentMeta = AGENT_META[session?.agentType ?? ""] ?? AGENT_META.claude;

  const updateStatus = useSessionStore((s) => s.updateSessionStatus);

  const handleSendKeys = useCallback(
    async (keys: number[]) => {
      try {
        const keypresses: number[][] = [];
        let i = 0;
        while (i < keys.length) {
          if (keys[i] === 0x1b && keys[i + 1] === 0x5b && i + 2 < keys.length) {
            keypresses.push(keys.slice(i, i + 3));
            i += 3;
          } else {
            keypresses.push([keys[i]]);
            i += 1;
          }
        }

        for (let k = 0; k < keypresses.length; k++) {
          await writePty(item.sessionId, keypresses[k]);
          if (k < keypresses.length - 1) {
            await new Promise((r) => setTimeout(r, 50));
          }
        }
      } catch (err) {
        console.error("Failed to write to PTY:", err);
      }
      updateStatus(item.sessionId, "working");
      onDismiss();
    },
    [item.sessionId, onDismiss, updateStatus],
  );

  const handleFreeTextSubmit = useCallback(() => {
    if (!freeText.trim()) return;
    const bytes = Array.from(new TextEncoder().encode(freeText + "\r"));
    handleSendKeys(bytes);
  }, [freeText, handleSendKeys]);

  const handleFocusTerminal = useCallback(() => {
    setActiveSession(item.sessionId);
    onDismiss();
  }, [item.sessionId, setActiveSession, onDismiss]);

  // Guardian auto-answer timer
  useEffect(() => {
    triggeredRef.current = false;

    if (item.type !== "question" || !item.guardianEnabled) {
      return;
    }

    setTimeLeft(guardianTimeoutMs);
    const startTime = Date.now();

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, guardianTimeoutMs - elapsed);
      setTimeLeft(remaining);

      if (remaining <= 0 && !triggeredRef.current) {
        triggeredRef.current = true;
        if (timerRef.current) clearInterval(timerRef.current);

        const proj = useProjectStore
          .getState()
          .projects.find((p) => p.id === item.projectId);
        if (proj) {
          guardianAnswer(item, proj.path);
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
    item.guardianEnabled,
    item.sessionId,
    item.projectId,
    guardianTimeoutMs,
    onDismiss,
  ]);

  const isQuestion = item.type === "question";
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const scrollDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const outputHtml = useMemo(() => {
    const ansiUp = new AnsiUp();
    ansiUp.use_classes = false;
    return ansiUp.ansi_to_html(item.output).replace(/\n/g, "<br>");
  }, [item.output]);

  useEffect(() => {
    const vp = scrollViewportRef.current;
    if (!vp) return;

    if (scrollDebounceRef.current) clearTimeout(scrollDebounceRef.current);
    scrollDebounceRef.current = setTimeout(() => {
      if (scrollViewportRef.current) {
        scrollViewportRef.current.scrollTop = scrollViewportRef.current.scrollHeight;
      }
    }, 50);

    return () => {
      if (scrollDebounceRef.current) clearTimeout(scrollDebounceRef.current);
    };
  }, [outputHtml]);

  const modalTitle = (
    <div className={classes.titleRow}>
      {/* Agent type badge */}
      <span
        className={classes.agentBadge}
        style={{
          '--agent-badge-bg': `color-mix(in srgb, ${agentMeta.color} 15%, transparent)`,
          '--agent-badge-color': agentMeta.color,
        } as React.CSSProperties}
      >
        {agentMeta.label}
      </span>
      <Text fw={600} size="sm" c="var(--text-primary)">
        {project?.name ?? "Project"}
      </Text>
      <Text size="sm" c="var(--text-secondary)">
        —
      </Text>
      <Text size="sm" c="var(--text-secondary)">
        {session?.label ?? "Session"}
      </Text>
    </div>
  );

  return (
    <Modal
      opened
      onClose={onDismiss}
      title={modalTitle}
      size="lg"
      centered
      overlayProps={{ blur: 3, backgroundOpacity: 0.6 }}
      transitionProps={{ transition: "slide-up" }}
      styles={{
        header: {
          backgroundColor: "var(--bg-elevated)",
          borderBottom: "1px solid var(--border)",
          padding: "16px 20px",
        },
        title: {
          color: "var(--text-primary)",
          fontSize: "14px",
          fontWeight: 600,
        },
        body: {
          padding: 0,
          backgroundColor: "var(--bg-elevated)",
        },
        content: {
          backgroundColor: "var(--bg-elevated)",
          border: "1px solid var(--border-bright)",
        },
        close: {
          color: "var(--text-secondary)",
        },
      }}
    >
      <Stack gap="md" className={classes.content}>
        {/* Output display */}
        <ScrollArea h={220} type="auto" viewportRef={scrollViewportRef}>
          <div
            dangerouslySetInnerHTML={{ __html: outputHtml }}
            className={classes.output}
          />
        </ScrollArea>

        {/* Guardian timer */}
        {isQuestion && item.guardianEnabled && (
          <div>
            <Text size="xs" c="var(--text-secondary)" mb={4}>
              Guardian auto-answer in {Math.ceil(timeLeft / 1000)}s
            </Text>
            <Progress
              value={(timeLeft / guardianTimeoutMs) * 100}
              size="xs"
              color="blue"
              animated
            />
          </div>
        )}

        {/* Answer options */}
        {isQuestion && item.parsedOptions.length > 0 && (
          <Group gap="xs">
            {item.parsedOptions.map((opt) => (
              <Button
                key={opt.label}
                size="xs"
                variant="light"
                onClick={() => handleSendKeys(opt.keys)}
                styles={{
                  root: {
                    backgroundColor: "var(--bg-tertiary)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border)",
                    "&:hover": {
                      backgroundColor: "color-mix(in srgb, var(--accent) 15%, transparent)",
                      borderColor: "var(--accent)",
                    },
                  },
                }}
              >
                {opt.label}
              </Button>
            ))}
          </Group>
        )}

        {/* Free text input */}
        {isQuestion && item.allowFreeInput && (
          <Group gap="xs" align="end">
            <TextInput
              placeholder="Type your response..."
              value={freeText}
              onChange={(e) => setFreeText(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleFreeTextSubmit();
              }}
              size="xs"
              className={classes.flex1}
              styles={{
                input: {
                  fontFamily: "JetBrains Mono, Cascadia Code, monospace",
                  backgroundColor: "var(--bg-tertiary)",
                  borderColor: "var(--border)",
                  color: "var(--text-primary)",
                  "&:focus": { borderColor: "var(--accent)" },
                },
              }}
            />
            <Button
              size="xs"
              onClick={handleFreeTextSubmit}
              disabled={!freeText.trim()}
              styles={{
                root: {
                  backgroundColor: "var(--accent)",
                  color: "var(--bg-primary)",
                  "&:hover": { backgroundColor: "var(--accent-hover)" },
                  "&:disabled": { opacity: 0.5 },
                },
              }}
            >
              Send
            </Button>
          </Group>
        )}
      </Stack>

      {/* Footer */}
      <div className={classes.footer}>
        <Group gap="xs" justify="flex-end">
          <Button
            size="xs"
            variant="subtle"
            onClick={handleFocusTerminal}
            styles={{
              root: {
                color: "var(--accent)",
                "&:hover": {
                  backgroundColor: "color-mix(in srgb, var(--accent) 10%, transparent)",
                },
              },
            }}
          >
            Focus Terminal
          </Button>
          <Button
            size="xs"
            variant="subtle"
            onClick={onDismiss}
            styles={{
              root: {
                color: "var(--text-secondary)",
                "&:hover": {
                  color: "var(--text-primary)",
                  backgroundColor: "transparent",
                },
              },
            }}
          >
            Dismiss
          </Button>
        </Group>
      </div>
    </Modal>
  );
}
