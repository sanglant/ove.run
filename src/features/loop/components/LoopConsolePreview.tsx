import { useEffect, useRef, useState } from "react";
import { Terminal as TermIcon, ChevronDown, ChevronRight, Maximize2 } from "lucide-react";
import { Modal, ScrollArea } from "@mantine/core";
import { MODAL_STYLES, MODAL_OVERLAY_PROPS } from "@/constants/styles";
import { listen } from "@/lib/tauri";
import { stripAnsi } from "@/lib/patterns";
import classes from "./LoopPanel.module.css";

const MAX_LINES = 80;

interface LoopConsolePreviewProps {
  sessionId: string | null;
}

export function LoopConsolePreview({ sessionId }: LoopConsolePreviewProps) {
  const [expanded, setExpanded] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const scrollRef = useRef<HTMLPreElement>(null);
  const modalScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sessionId) {
      setLines([]);
      return;
    }

    // Reset on session change
    setLines([]);

    let cancelled = false;
    let unlisten: (() => void) | null = null;

    listen<number[]>(`pty-output-${sessionId}`, (event) => {
      if (cancelled) return;
      const bytes = new Uint8Array(event.payload);
      const text = new TextDecoder().decode(bytes);
      const cleaned = stripAnsi(text);

      setLines((prev) => {
        const newLines = [...prev];
        const parts = cleaned.split(/\r?\n/);
        for (let i = 0; i < parts.length; i++) {
          if (i === 0 && newLines.length > 0) {
            newLines[newLines.length - 1] += parts[i];
          } else {
            newLines.push(parts[i]);
          }
        }
        if (newLines.length > MAX_LINES) {
          return newLines.slice(-MAX_LINES);
        }
        return newLines;
      });
    }).then((fn) => {
      if (cancelled) {
        fn();
      } else {
        unlisten = fn;
      }
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [sessionId]);

  // Auto-scroll to bottom (inline preview)
  useEffect(() => {
    if (expanded && scrollRef.current) {
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      });
    }
  }, [lines, expanded]);

  // Auto-scroll to bottom (modal)
  useEffect(() => {
    if (modalOpen && modalScrollRef.current) {
      requestAnimationFrame(() => {
        if (modalScrollRef.current) {
          modalScrollRef.current.scrollTop = modalScrollRef.current.scrollHeight;
        }
      });
    }
  }, [lines, modalOpen]);

  if (!sessionId) return null;

  const lastLines = lines.slice(-30).filter((l) => l.trim().length > 0);
  const allVisibleLines = lines.filter((l) => l.trim().length > 0);

  return (
    <>
      <div className={classes.consolePreview}>
        <button
          className={classes.consoleToggle}
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          <TermIcon size={12} />
          Agent Output
          <span className={classes.consoleLiveDot} aria-hidden="true" />
          <span style={{ flex: 1 }} />
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>

        {expanded && (
          <div className={classes.consoleBody}>
            <pre ref={scrollRef} className={classes.consoleOutput}>
              {lastLines.length > 0
                ? lastLines.join("\n")
                : "Waiting for agent output…"}
            </pre>
            <button
              className={classes.consoleExpandButton}
              onClick={() => setModalOpen(true)}
              title="Expand console"
            >
              <Maximize2 size={11} />
            </button>
          </div>
        )}
      </div>

      {/* Full console modal — uses Mantine Modal for consistency + a11y */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Agent Console Output"
        size="xl"
        centered
        overlayProps={MODAL_OVERLAY_PROPS}
        styles={{
          ...MODAL_STYLES,
          body: { ...MODAL_STYLES.body, padding: 0 },
          content: { ...MODAL_STYLES.content, maxHeight: "80vh" },
        }}
      >
        <ScrollArea h="60vh" type="auto" viewportRef={modalScrollRef}>
          <pre className={classes.consoleModalOutput}>
            {allVisibleLines.length > 0
              ? allVisibleLines.join("\n")
              : "Waiting for agent output…"}
          </pre>
        </ScrollArea>
      </Modal>
    </>
  );
}
