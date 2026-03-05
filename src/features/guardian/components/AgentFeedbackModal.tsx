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
import { triggerGuardianReview } from "@/lib/guardian";
import { useGuardianStore } from "@/stores/guardianStore";
import { AnsiUp } from "ansi_up";
import type { FeedbackItem } from "@/types";

const GUARDIAN_TIMEOUT_MS = 20_000;

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
  const [freeText, setFreeText] = useState("");
  const [timeLeft, setTimeLeft] = useState(GUARDIAN_TIMEOUT_MS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const triggeredRef = useRef(false);

  const sessions = useSessionStore((s) => s.sessions);
  const setActiveSession = useSessionStore((s) => s.setActiveSession);
  const projects = useProjectStore((s) => s.projects);

  const session = sessions.find((s) => s.id === item.sessionId);
  const project = projects.find((p) => p.id === item.projectId);
  const title = `${project?.name ?? "Project"} — ${session?.label ?? "Session"}`;

  const updateStatus = useSessionStore((s) => s.updateSessionStatus);

  const handleSendKeys = useCallback(
    async (keys: number[]) => {
      try {
        // Split key sequence into individual keypresses and send with delays.
        // Ink's SelectInput needs time to process each arrow key before the next.
        const keypresses: number[][] = [];
        let i = 0;
        while (i < keys.length) {
          if (keys[i] === 0x1b && keys[i + 1] === 0x5b && i + 2 < keys.length) {
            // ESC [ X — 3-byte escape sequence (arrow key etc.)
            keypresses.push(keys.slice(i, i + 3));
            i += 3;
          } else {
            keypresses.push([keys[i]]);
            i += 1;
          }
        }

        for (let k = 0; k < keypresses.length; k++) {
          await writePty(item.sessionId, keypresses[k]);
          // Small delay between keypresses so Ink processes each one
          if (k < keypresses.length - 1) {
            await new Promise((r) => setTimeout(r, 50));
          }
        }
      } catch (err) {
        console.error("Failed to write to PTY:", err);
      }
      // Immediately transition to "working" so the yellow dot clears
      // and detection can pick up the next state from fresh output
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

    setTimeLeft(GUARDIAN_TIMEOUT_MS);
    const startTime = Date.now();

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, GUARDIAN_TIMEOUT_MS - elapsed);
      setTimeLeft(remaining);

      if (remaining <= 0 && !triggeredRef.current) {
        triggeredRef.current = true;
        if (timerRef.current) clearInterval(timerRef.current);

        // Trigger guardian review
        const sess = useSessionStore
          .getState()
          .sessions.find((s) => s.id === item.sessionId);
        const proj = useProjectStore
          .getState()
          .projects.find((p) => p.id === item.projectId);
        const guardianSessionId =
          useGuardianStore.getState().guardianSessionIds[item.projectId];
        if (sess && proj && guardianSessionId) {
          triggerGuardianReview(sess, proj.path);
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

  // Auto-scroll to bottom so the actual question/result is visible.
  // Debounced so rapid output bursts only trigger one scroll operation.
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

  return (
    <Modal
      opened
      onClose={onDismiss}
      title={
        <Text fw={600} size="sm">
          {title}
        </Text>
      }
      size="lg"
      centered
      overlayProps={{ backgroundOpacity: 0.4, blur: 2 }}
      styles={{
        body: { padding: "0.75rem 1rem" },
        header: {
          background: "var(--bg-secondary, #111114)",
          borderBottom: "1px solid var(--border-color, #2e2e3e)",
        },
        content: { background: "var(--bg-secondary, #111114)" },
      }}
    >
      <Stack gap="sm">
        {/* Output display */}
        <ScrollArea h={200} type="auto" viewportRef={scrollViewportRef}>
          <div
            dangerouslySetInnerHTML={{ __html: outputHtml }}
            style={{
              fontFamily: "JetBrains Mono, Cascadia Code, monospace",
              fontSize: "12px",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              color: "var(--text-secondary, #8888a0)",
              lineHeight: 1.4,
            }}
          />
        </ScrollArea>

        {/* Guardian timer */}
        {isQuestion && item.guardianEnabled && (
          <div>
            <Text size="xs" c="dimmed" mb={4}>
              Guardian auto-answer in {Math.ceil(timeLeft / 1000)}s
            </Text>
            <Progress
              value={(timeLeft / GUARDIAN_TIMEOUT_MS) * 100}
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
              style={{ flex: 1 }}
              styles={{
                input: {
                  fontFamily: "JetBrains Mono, Cascadia Code, monospace",
                  background: "var(--bg-primary, #090909)",
                },
              }}
            />
            <Button
              size="xs"
              onClick={handleFreeTextSubmit}
              disabled={!freeText.trim()}
            >
              Send
            </Button>
          </Group>
        )}

        {/* Footer buttons */}
        <Group gap="xs" justify="flex-end">
          <Button size="xs" variant="subtle" onClick={handleFocusTerminal}>
            Focus Terminal
          </Button>
          <Button size="xs" variant="subtle" color="gray" onClick={onDismiss}>
            Dismiss
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
