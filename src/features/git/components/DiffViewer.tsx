import { ScrollArea } from "@mantine/core";
import classes from "./DiffViewer.module.css";

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

const LINE_CLASS: Record<DiffLine["type"], string> = {
  addition: classes.lineAddition,
  deletion: classes.lineDeletion,
  context: classes.lineContext,
  header: classes.lineHeader,
  hunk: classes.lineHunk,
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
      <div className={classes.emptyState}>
        {filePath ? "No changes in selected file" : "Select a file to view diff"}
      </div>
    );
  }

  const lines = parseDiff(diff);

  return (
    <ScrollArea h="100%" className={classes.scrollArea}>
      {filePath && (
        <div className={classes.fileHeader}>
          {filePath}
        </div>
      )}
      <table className={classes.diffTable}>
        <tbody>
          {lines.map((line, i) => (
            <tr
              key={i}
              className={LINE_CLASS[line.type]}
            >
              <td className={classes.lineNumCell}>
                {line.type === "addition" || line.type === "context"
                  ? line.lineNum ?? ""
                  : ""}
              </td>
              <td className={classes.prefixCell}>
                {LINE_PREFIX[line.type]}
              </td>
              <td className={classes.contentCell}>
                {line.content}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollArea>
  );
}
