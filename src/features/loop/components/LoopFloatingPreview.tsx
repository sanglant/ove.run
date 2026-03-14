import { useEffect, useRef, useState } from "react";
import { Terminal as TermIcon, ChevronDown, ChevronUp, Maximize2 } from "lucide-react";
import { Modal, ScrollArea } from "@mantine/core";
import { MODAL_STYLES, MODAL_OVERLAY_PROPS } from "@/constants/styles";
import { useLoopStore } from "@/stores/loopStore";
import { useUiStore } from "@/stores/uiStore";
import { listen } from "@/lib/tauri";
import { stripAnsi } from "@/lib/patterns";
import classes from "./LoopFloatingPreview.module.css";

const MAX_LINES = 80;

/**
 * Floating console preview that appears in the bottom-right when
 * the loop is active and the user is NOT on the loop panel.
 */
export function LoopFloatingPreview() {
  const status = useLoopStore((s) => s.status);
  const activeSessionId = useLoopStore((s) => s.activeSessionId);
  const activityMessage = useLoopStore((s) => s.activityMessage);
  const activePanel = useUiStore((s) => s.activePanel);
  const setActivePanel = useUiStore((s) => s.setActivePanel);

  const [collapsed, setCollapsed] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const scrollRef = useRef<HTMLPreElement>(null);
  const modalScrollRef = useRef<HTMLDivElement>(null);

  const isLoopActive = status === "running" || status === "planning" || status === "paused";
  const isOnLoopPanel = activePanel === "loop";
  const hasSession = !!activeSessionId;

  useEffect(() => {
    if (!activeSessionId) {
      setLines([]);
      return;
    }

    setLines([]);
    let cancelled = false;
    let unlisten: (() => void) | null = null;

    listen<number[]>(`pty-output-${activeSessionId}`, (event) => {
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
  }, [activeSessionId]);

  // Auto-scroll
  useEffect(() => {
    if (!collapsed && scrollRef.current) {
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      });
    }
  }, [lines, collapsed]);

  useEffect(() => {
    if (modalOpen && modalScrollRef.current) {
      requestAnimationFrame(() => {
        if (modalScrollRef.current) {
          modalScrollRef.current.scrollTop = modalScrollRef.current.scrollHeight;
        }
      });
    }
  }, [lines, modalOpen]);

  // Don't render when loop isn't active or when user is already on loop panel
  if (!isLoopActive || isOnLoopPanel) return null;

  const lastLines = lines.slice(-20).filter((l) => l.trim().length > 0);
  const allVisibleLines = lines.filter((l) => l.trim().length > 0);

  return (
    <>
      <div className={classes.floatingWidget}>
        {/* Header bar */}
        <button
          className={classes.widgetHeader}
          onClick={() => setCollapsed((v) => !v)}
          aria-expanded={!collapsed}
        >
          <TermIcon size={11} />
          <span className={classes.widgetTitle}>Loop</span>
          <span className={classes.liveDot} aria-hidden="true" />
          {activityMessage && (
            <span className={classes.widgetActivity}>{activityMessage}</span>
          )}
          <span style={{ flex: 1 }} />
          <button
            className={classes.widgetIconBtn}
            onClick={(e) => {
              e.stopPropagation();
              setModalOpen(true);
            }}
            aria-label="Expand console"
            title="Expand"
          >
            <Maximize2 size={10} />
          </button>
          <button
            className={classes.widgetIconBtn}
            onClick={(e) => {
              e.stopPropagation();
              setActivePanel("loop");
            }}
            aria-label="Go to Loop panel"
            title="Open Loop panel"
          >
            <TermIcon size={10} />
          </button>
          {collapsed ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </button>

        {/* Console body */}
        {!collapsed && (
          <pre ref={scrollRef} className={classes.widgetOutput}>
            {lastLines.length > 0
              ? lastLines.join("\n")
              : hasSession ? "Waiting for agent output…" : activityMessage ?? "Preparing…"}
          </pre>
        )}
      </div>

      {/* Full console modal */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Loop Console Output"
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
          <pre className={classes.modalOutput}>
            {allVisibleLines.length > 0
              ? allVisibleLines.join("\n")
              : hasSession ? "Waiting for agent output…" : activityMessage ?? "Preparing…"}
          </pre>
        </ScrollArea>
      </Modal>
    </>
  );
}
