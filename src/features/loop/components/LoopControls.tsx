import { useState } from "react";
import { Button, TextInput } from "@mantine/core";
import { Play, Pause, RotateCw, Square } from "lucide-react";
import type { LoopStatus } from "@/types";
import classes from "./LoopPanel.module.css";

interface LoopControlsProps {
  status: LoopStatus;
  projectId: string;
  projectPath: string;
  onStart: (projectId: string, projectPath: string, request?: string) => void;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
}

export function LoopControls({
  status,
  projectId,
  projectPath,
  onStart,
  onPause,
  onResume,
  onCancel,
}: LoopControlsProps) {
  const [requestText, setRequestText] = useState("");
  const [showRequest, setShowRequest] = useState(false);

  const isRunning = status === "running" || status === "planning";
  const isPaused = status === "paused";
  const isActive = isRunning || isPaused;

  const handleStartClick = () => {
    if (!showRequest) {
      setShowRequest(true);
      return;
    }
    onStart(projectId, projectPath, requestText.trim() || undefined);
    setRequestText("");
    setShowRequest(false);
  };

  const buttonStyles = {
    root: { fontSize: 12, height: 28, minHeight: 28, paddingLeft: 10, paddingRight: 10 },
  };

  const dangerStyles = {
    root: {
      fontSize: 12,
      height: 28,
      minHeight: 28,
      paddingLeft: 10,
      paddingRight: 10,
      "--button-color": "var(--danger)",
      "--button-hover": "color-mix(in srgb, var(--danger) 12%, transparent)",
    } as React.CSSProperties,
  };

  return (
    <>
      <div className={classes.controls}>
        {!isActive && (
          <Button
            size="xs"
            leftSection={<Play size={12} />}
            onClick={handleStartClick}
            styles={buttonStyles}
            variant="light"
            color="var(--accent)"
          >
            {showRequest ? "Confirm" : "Start"}
          </Button>
        )}

        {isRunning && (
          <Button
            size="xs"
            leftSection={<Pause size={12} />}
            onClick={onPause}
            styles={buttonStyles}
            variant="subtle"
          >
            Pause
          </Button>
        )}

        {isPaused && (
          <Button
            size="xs"
            leftSection={<RotateCw size={12} />}
            onClick={onResume}
            styles={buttonStyles}
            variant="subtle"
          >
            Resume
          </Button>
        )}

        {isActive && (
          <Button
            size="xs"
            leftSection={<Square size={12} />}
            onClick={onCancel}
            styles={dangerStyles}
            variant="subtle"
          >
            Cancel
          </Button>
        )}

        {showRequest && !isActive && (
          <Button
            size="xs"
            variant="subtle"
            onClick={() => {
              setShowRequest(false);
              setRequestText("");
            }}
            styles={buttonStyles}
          >
            Dismiss
          </Button>
        )}
      </div>

      {showRequest && !isActive && (
        <div className={classes.requestRow}>
          <TextInput
            placeholder="Describe what you want the loop to do…"
            value={requestText}
            onChange={(e) => setRequestText(e.target.value)}
            size="xs"
            style={{ flex: 1 }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleStartClick();
              if (e.key === "Escape") {
                setShowRequest(false);
                setRequestText("");
              }
            }}
            autoFocus
            styles={{
              input: {
                backgroundColor: "var(--bg-tertiary)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
                fontSize: 12,
              },
            }}
            aria-label="User request for loop"
          />
        </div>
      )}
    </>
  );
}
