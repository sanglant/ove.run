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
import { arbiterAnswer } from "@/lib/arbiter";
import { useSettingsStore } from "@/stores/settingsStore";
import { AnsiUp } from "ansi_up";
import type { FeedbackItem } from "@/types";
import { MODAL_STYLES, MODAL_OVERLAY_PROPS, MODAL_TRANSITION_PROPS, BUTTON_STYLES } from "@/constants/styles";
import { AgentBadge } from "@/components/ui/AgentBadge";
import { ModalFooter } from "@/components/ui/ModalFooter";
import classes from "./AgentFeedbackModal.module.css";

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
  const arbiterTimeoutMs = settings.global.arbiter_timeout_seconds * 1000;

  const [freeText, setFreeText] = useState("");
  const [timeLeft, setTimeLeft] = useState(arbiterTimeoutMs);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const triggeredRef = useRef(false);

  const sessions = useSessionStore((s) => s.sessions);
  const setActiveSession = useSessionStore((s) => s.setActiveSession);
  const projects = useProjectStore((s) => s.projects);

  const session = sessions.find((s) => s.id === item.sessionId);
  const project = projects.find((p) => p.id === item.projectId);
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

  // Arbiter auto-answer timer
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
      <AgentBadge agentType={session?.agentType ?? ""} />
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
      overlayProps={MODAL_OVERLAY_PROPS}
      transitionProps={MODAL_TRANSITION_PROPS}
      styles={MODAL_STYLES}
    >
      <Stack gap="md" className={classes.content}>
        {/* Output display */}
        <ScrollArea h={220} type="auto" viewportRef={scrollViewportRef}>
          <div
            dangerouslySetInnerHTML={{ __html: outputHtml }}
            className={classes.output}
          />
        </ScrollArea>

        {/* Arbiter timer */}
        {isQuestion && item.arbiterEnabled && (
          <div>
            <Text size="xs" c="var(--text-secondary)" mb={4}>
              Arbiter auto-answer in {Math.ceil(timeLeft / 1000)}s
            </Text>
            <Progress
              value={(timeLeft / arbiterTimeoutMs) * 100}
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
              styles={BUTTON_STYLES.primary}
            >
              Send
            </Button>
          </Group>
        )}
      </Stack>

      {/* Footer */}
      <ModalFooter>
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
          styles={BUTTON_STYLES.subtle}
        >
          Dismiss
        </Button>
      </ModalFooter>
    </Modal>
  );
}
