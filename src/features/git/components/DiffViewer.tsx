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

const LINE_STYLES: Record<DiffLine["type"], string> = {
  addition: "bg-[var(--success)]/10 text-[var(--success)]",
  deletion: "bg-[var(--danger)]/10 text-[var(--danger)]",
  context: "text-[var(--text-secondary)]",
  header: "text-[var(--accent)] font-medium bg-[var(--bg-tertiary)]",
  hunk: "text-[var(--warning)] bg-[var(--bg-tertiary)] italic",
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
      <div className="flex items-center justify-center h-full text-[var(--text-secondary)] text-sm">
        {filePath ? "No changes in selected file" : "Select a file to view diff"}
      </div>
    );
  }

  const lines = parseDiff(diff);

  return (
    <div className="h-full overflow-auto font-mono text-xs">
      {filePath && (
        <div className="sticky top-0 px-4 py-2 bg-[var(--bg-tertiary)] border-b border-[var(--border)] text-[var(--text-secondary)] font-mono text-xs">
          {filePath}
        </div>
      )}
      <table className="w-full border-collapse">
        <tbody>
          {lines.map((line, i) => (
            <tr
              key={i}
              className={`${LINE_STYLES[line.type]} leading-relaxed hover:brightness-110`}
            >
              <td className="select-none pl-3 pr-2 text-[var(--text-secondary)] text-right w-10 border-r border-[var(--border)] opacity-60">
                {line.type === "addition" || line.type === "context"
                  ? line.lineNum ?? ""
                  : ""}
              </td>
              <td className="select-none pl-2 pr-3 w-5 text-center opacity-70">
                {LINE_PREFIX[line.type]}
              </td>
              <td className="pl-2 pr-4 whitespace-pre-wrap break-all">
                {line.content}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
