import type { CSSProperties } from "react";
import { ScrollArea } from "@mantine/core";

interface DiffViewerProps {
  diff: string;
  filePath?: string;
}

interface DiffLine {
  type: "addition" | "deletion" | "context" | "header" | "hunk";
  content: string;
  lineNum?: number;
}

function parseDiff(raw: string): DiffLine[] {
  const lines = raw.split("\n");
  const result: DiffLine[] = [];
  let lineNum = 0;

  for (const line of lines) {
    if (line.startsWith("+++") || line.startsWith("---")) {
      result.push({ type: "header", content: line });
    } else if (line.startsWith("@@")) {
      const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)/);
      if (match) {
        lineNum = parseInt(match[1], 10) - 1;
      }
      result.push({ type: "hunk", content: line });
    } else if (line.startsWith("+")) {
      lineNum++;
      result.push({ type: "addition", content: line.slice(1), lineNum });
    } else if (line.startsWith("-")) {
      result.push({ type: "deletion", content: line.slice(1) });
    } else {
      lineNum++;
      result.push({ type: "context", content: line.slice(1), lineNum });
    }
  }

  return result;
}

const LINE_STYLES: Record<DiffLine["type"], CSSProperties> = {
  addition: { backgroundColor: "rgba(140, 192, 132, 0.1)", color: "var(--success)" },
  deletion: { backgroundColor: "rgba(229, 115, 127, 0.1)", color: "var(--danger)" },
  context: { color: "var(--text-secondary)" },
  header: { color: "var(--accent)", fontWeight: 500, backgroundColor: "var(--bg-tertiary)" },
  hunk: { color: "var(--warning)", backgroundColor: "var(--bg-tertiary)", fontStyle: "italic" },
};

const LINE_PREFIX: Record<DiffLine["type"], string> = {
  addition: "+",
  deletion: "-",
  context: " ",
  header: " ",
  hunk: " ",
};

export function DiffViewer({ diff, filePath }: DiffViewerProps) {
  if (!diff) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "var(--text-secondary)",
          fontSize: "13px",
        }}
      >
        {filePath ? "No changes in selected file" : "Select a file to view diff"}
      </div>
    );
  }

  const lines = parseDiff(diff);

  return (
    <ScrollArea h="100%" style={{ fontFamily: "monospace", fontSize: "12px" }}>
      {filePath && (
        <div
          style={{
            position: "sticky",
            top: 0,
            padding: "6px 16px",
            backgroundColor: "var(--bg-secondary)",
            borderBottom: "1px solid var(--border)",
            color: "var(--text-secondary)",
            fontFamily: "monospace",
            fontSize: "12px",
            zIndex: 1,
          }}
        >
          {filePath}
        </div>
      )}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {lines.map((line, i) => (
            <tr
              key={i}
              style={{ ...LINE_STYLES[line.type], lineHeight: 1.6 }}
            >
              <td
                style={{
                  userSelect: "none",
                  paddingLeft: "12px",
                  paddingRight: "8px",
                  color: "var(--text-secondary)",
                  textAlign: "right",
                  width: "40px",
                  borderRight: "1px solid var(--border)",
                  opacity: 0.6,
                }}
              >
                {line.type === "addition" || line.type === "context"
                  ? line.lineNum ?? ""
                  : ""}
              </td>
              <td
                style={{
                  userSelect: "none",
                  paddingLeft: "8px",
                  paddingRight: "12px",
                  width: "20px",
                  textAlign: "center",
                  opacity: 0.7,
                }}
              >
                {LINE_PREFIX[line.type]}
              </td>
              <td
                style={{
                  paddingLeft: "8px",
                  paddingRight: "16px",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                }}
              >
                {line.content}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollArea>
  );
}
