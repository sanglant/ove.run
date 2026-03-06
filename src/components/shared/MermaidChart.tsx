/**
 * MermaidChart — pure React/SVG mermaid flowchart renderer. No external deps.
 *
 * Supported syntax:
 *   Directives:  graph TD | graph LR | flowchart TD | flowchart LR  (also TB, BT, RL)
 *
 *   Nodes:
 *     A[Box label]        rectangle
 *     A(Rounded label)    rounded rectangle
 *     A{Diamond label}    diamond
 *     A((Circle label))   circle
 *     A([Stadium label])  stadium / pill
 *     A                   bare id → rectangle with id as label
 *
 *   Edges:
 *     A --> B              simple arrow
 *     A -->|edge label| B  piped label
 *     A -- label --> B     inline label
 *     A -.-> B             dotted (rendered identically to solid)
 *
 * Limitations:
 *   - No subgraphs, no classDef / style directives, no click handlers
 *   - Back-edges in cycles fall back to rank 0 (may cause visual overlap)
 *   - Labels are single-line; very long labels are ellipsis-truncated
 */
import { useMemo, useId } from "react";
import styles from "./MermaidChart.module.css";

// ── Types ─────────────────────────────────────────────────────────────────────

type Direction = "TD" | "LR" | "BT" | "RL";
type NodeShape = "box" | "rounded" | "diamond" | "circle" | "stadium";

interface MNode {
  id: string;
  label: string;
  shape: NodeShape;
}

interface MEdge {
  from: string;
  to: string;
  label?: string;
}

interface ParsedGraph {
  direction: Direction;
  nodes: Map<string, MNode>;
  edges: MEdge[];
}

interface LayoutNode extends MNode {
  cx: number;
  cy: number;
  w: number;
  h: number;
}

// ── Dimensions ────────────────────────────────────────────────────────────────

const DIM: Record<NodeShape, { w: number; h: number }> = {
  box:     { w: 120, h: 38 },
  rounded: { w: 120, h: 38 },
  stadium: { w: 120, h: 38 },
  diamond: { w: 116, h: 54 },
  circle:  { w:  56, h: 56 },
};

// Grid cell size — based on the widest/tallest possible node so ranks align.
const CELL_W = DIM.box.w + 52;   // 172 px per column
const CELL_H = DIM.circle.h + 28; // 84 px per row
const PAD    = 28;                 // outer padding
const ARROW_LEN = 9;               // arrowhead length (px) — used to shorten line ends

// ── Parser ────────────────────────────────────────────────────────────────────

function parseNodeToken(raw: string): MNode | null {
  raw = raw.trim();

  // A((label))
  let m = raw.match(/^([A-Za-z0-9_]+)\(\((.+?)\)\)$/);
  if (m) return { id: m[1], label: m[2], shape: "circle" };

  // A([label])
  m = raw.match(/^([A-Za-z0-9_]+)\(\[(.+?)\]\)$/);
  if (m) return { id: m[1], label: m[2], shape: "stadium" };

  // A[label]
  m = raw.match(/^([A-Za-z0-9_]+)\[(.+?)\]$/);
  if (m) return { id: m[1], label: m[2], shape: "box" };

  // A(label)
  m = raw.match(/^([A-Za-z0-9_]+)\((.+?)\)$/);
  if (m) return { id: m[1], label: m[2], shape: "rounded" };

  // A{label}
  m = raw.match(/^([A-Za-z0-9_]+)\{(.+?)\}$/);
  if (m) return { id: m[1], label: m[2], shape: "diamond" };

  // bare A
  m = raw.match(/^([A-Za-z0-9_]+)$/);
  if (m) return { id: m[1], label: m[1], shape: "box" };

  return null;
}

function parseMermaid(code: string): ParsedGraph | null {
  const lines = code
    .trim()
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("%%"));

  if (!lines.length) return null;

  const headerMatch = lines[0].match(/^(?:graph|flowchart)\s+(TD|LR|BT|RL|TB)\b/i);
  if (!headerMatch) return null;

  const rawDir = headerMatch[1].toUpperCase();
  const direction: Direction = rawDir === "TB" ? "TD" : (rawDir as Direction);

  const nodes = new Map<string, MNode>();
  const edges: MEdge[] = [];

  function reg(n: MNode) {
    if (!nodes.has(n.id)) nodes.set(n.id, n);
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].split("%%")[0].trim();
    if (!line) continue;

    // A -->|label| B  or  A-- label -->|label| B
    let m = line.match(/^(.+?)\s*--?>?\s*\|([^|]*)\|\s*(.+)$/);
    if (m) {
      const from = parseNodeToken(m[1].trim());
      const to   = parseNodeToken(m[3].trim());
      if (from && to) {
        reg(from); reg(to);
        edges.push({ from: from.id, to: to.id, label: m[2].trim() || undefined });
        continue;
      }
    }

    // A -- label --> B
    m = line.match(/^(.+?)\s+--\s+([^-]+?)\s+-->\s+(.+)$/);
    if (m) {
      const from = parseNodeToken(m[1].trim());
      const to   = parseNodeToken(m[3].trim());
      if (from && to) {
        reg(from); reg(to);
        edges.push({ from: from.id, to: to.id, label: m[2].trim() || undefined });
        continue;
      }
    }

    // A --> B  or  A -.-> B  or  A ==> B
    m = line.match(/^(.+?)\s+(?:-->|-.->|==>)\s+(.+)$/);
    if (m) {
      const from = parseNodeToken(m[1].trim());
      const to   = parseNodeToken(m[2].trim());
      if (from && to) {
        reg(from); reg(to);
        edges.push({ from: from.id, to: to.id });
        continue;
      }
    }

    // Standalone node definition
    const n = parseNodeToken(line);
    if (n) reg(n);
  }

  return { direction, nodes, edges };
}

// ── Layout (longest-path ranking + centering) ─────────────────────────────────

function layoutGraph(graph: ParsedGraph): {
  layoutNodes: Map<string, LayoutNode>;
  svgW: number;
  svgH: number;
} {
  const { nodes, edges, direction } = graph;
  const ids = Array.from(nodes.keys());

  if (!ids.length) return { layoutNodes: new Map(), svgW: 200, svgH: 80 };

  // Build adjacency + in-degree
  const outEdges = new Map<string, string[]>(ids.map((id) => [id, []]));
  const inDeg    = new Map<string, number>(ids.map((id) => [id, 0]));

  for (const { from, to } of edges) {
    if (!outEdges.has(from)) { outEdges.set(from, []); inDeg.set(from, 0); }
    if (!inDeg.has(to))      { outEdges.set(to, []);   inDeg.set(to, 0); }
    outEdges.get(from)!.push(to);
    inDeg.set(to, (inDeg.get(to) ?? 0) + 1);
  }

  // Kahn's topo sort + longest-path rank assignment
  const rank   = new Map<string, number>(ids.map((id) => [id, 0]));
  const degCpy = new Map(inDeg);
  const queue: string[] = [];

  for (const [id, d] of degCpy) if (d === 0) queue.push(id);
  if (!queue.length) ids.forEach((id) => queue.push(id)); // cyclic fallback

  const visited = new Set<string>();
  const bfsQueue = [...queue];

  while (bfsQueue.length) {
    const id = bfsQueue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    for (const next of outEdges.get(id) ?? []) {
      const nr = (rank.get(id) ?? 0) + 1;
      if (nr > (rank.get(next) ?? 0)) rank.set(next, nr);
      const nd = (degCpy.get(next) ?? 1) - 1;
      degCpy.set(next, nd);
      if (nd <= 0) bfsQueue.push(next);
    }
  }

  // Fallback for nodes not reached (in cycles)
  for (const id of ids) if (!visited.has(id)) rank.set(id, 0);

  const maxRank = Math.max(...rank.values());
  const byRank: string[][] = Array.from({ length: maxRank + 1 }, () => []);
  for (const id of ids) byRank[rank.get(id)!].push(id);

  const maxPerRank = Math.max(...byRank.map((g) => g.length));
  const isH = direction === "LR" || direction === "RL";

  // Assign positions
  const layoutNodes = new Map<string, LayoutNode>();

  for (let r = 0; r <= maxRank; r++) {
    const group = byRank[r];
    const offset = ((maxPerRank - group.length) / 2) * (isH ? CELL_H : CELL_W);

    for (let c = 0; c < group.length; c++) {
      const id    = group[c];
      const node  = nodes.get(id)!;
      const { w, h } = DIM[node.shape];

      let cx: number;
      let cy: number;

      if (!isH) {
        // TD / BT
        cx = PAD + offset + c * CELL_W + CELL_W / 2;
        cy = PAD + r * CELL_H + CELL_H / 2;
        if (direction === "BT") cy = PAD + (maxRank - r) * CELL_H + CELL_H / 2;
      } else {
        // LR / RL
        cy = PAD + offset + c * CELL_H + CELL_H / 2;
        cx = PAD + r * CELL_W + CELL_W / 2;
        if (direction === "RL") cx = PAD + (maxRank - r) * CELL_W + CELL_W / 2;
      }

      layoutNodes.set(id, { ...node, cx, cy, w, h });
    }
  }

  // SVG bounding box
  let maxX = 0;
  let maxY = 0;
  for (const n of layoutNodes.values()) {
    maxX = Math.max(maxX, n.cx + n.w / 2 + PAD);
    maxY = Math.max(maxY, n.cy + n.h / 2 + PAD);
  }

  return { layoutNodes, svgW: maxX, svgH: maxY };
}

// ── Geometry ──────────────────────────────────────────────────────────────────

function rectBoundary(
  cx: number, cy: number,
  hw: number, hh: number,
  dx: number, dy: number,
): { x: number; y: number } {
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return { x: cx, y: cy };
  const sx = hw / (Math.abs(dx) || 0.001);
  const sy = hh / (Math.abs(dy) || 0.001);
  const s  = Math.min(sx, sy);
  return { x: cx + dx * s, y: cy + dy * s };
}

function circleBoundary(
  cx: number, cy: number,
  r: number,
  dx: number, dy: number,
): { x: number; y: number } {
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  return { x: cx + (dx / len) * r, y: cy + (dy / len) * r };
}

function getEdgeEndpoints(from: LayoutNode, to: LayoutNode) {
  const dx = to.cx - from.cx;
  const dy = to.cy - from.cy;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;

  const sp = from.shape === "circle"
    ? circleBoundary(from.cx, from.cy, from.w / 2, dx, dy)
    : rectBoundary(from.cx, from.cy, from.w / 2, from.h / 2, dx, dy);

  // Boundary point on target
  const tp = to.shape === "circle"
    ? circleBoundary(to.cx, to.cy, to.w / 2, -dx, -dy)
    : rectBoundary(to.cx, to.cy, to.w / 2, to.h / 2, -dx, -dy);

  // Shorten the line end so the arrowhead tip sits exactly on the boundary
  const tpShort = {
    x: tp.x - (dx / len) * ARROW_LEN,
    y: tp.y - (dy / len) * ARROW_LEN,
  };

  return { sp, tp, tpShort };
}

// ── Node renderers ────────────────────────────────────────────────────────────

const MAX_LABEL_CHARS = 15;

function truncate(s: string, max = MAX_LABEL_CHARS) {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function RenderNode({ node }: { node: LayoutNode }) {
  const { cx, cy, w, h, shape, label } = node;
  const x  = cx - w / 2;
  const y  = cy - h / 2;
  const lbl = truncate(label);

  const textEl = (
    <text
      x={cx}
      y={cy}
      textAnchor="middle"
      dominantBaseline="middle"
      className={styles.nodeLabel}
    >
      {lbl}
    </text>
  );

  switch (shape) {
    case "circle":
      return (
        <g>
          <circle cx={cx} cy={cy} r={w / 2} className={styles.nodeShape} />
          {textEl}
        </g>
      );

    case "diamond": {
      const pts = `${cx},${y} ${cx + w / 2},${cy} ${cx},${cy + h / 2} ${cx - w / 2},${cy}`;
      return (
        <g>
          <polygon points={pts} className={styles.nodeShape} />
          {textEl}
        </g>
      );
    }

    case "rounded":
    case "stadium":
      return (
        <g>
          <rect x={x} y={y} width={w} height={h} rx={h / 2} className={styles.nodeShape} />
          {textEl}
        </g>
      );

    default: // box
      return (
        <g>
          <rect x={x} y={y} width={w} height={h} rx={5} className={styles.nodeShape} />
          {textEl}
        </g>
      );
  }
}

// ── Main component ────────────────────────────────────────────────────────────

interface MermaidChartProps {
  code: string;
}

export function MermaidChart({ code }: MermaidChartProps) {
  const uid = useId().replace(/:/g, "");

  const result = useMemo<{
    layoutNodes: Map<string, LayoutNode>;
    edges: MEdge[];
    svgW: number;
    svgH: number;
  } | null>(() => {
    try {
      const graph = parseMermaid(code);
      if (!graph) return null;
      const layout = layoutGraph(graph);
      return { ...layout, edges: graph.edges };
    } catch {
      return null;
    }
  }, [code]);

  if (!result) {
    return (
      <div className={styles.error} role="img" aria-label="Mermaid chart (parse error)">
        <span className={styles.errorIcon} aria-hidden="true">⚠</span>
        <span>Unable to render chart — check mermaid syntax</span>
        <pre className={styles.errorCode}>{code}</pre>
      </div>
    );
  }

  const { layoutNodes, edges, svgW, svgH } = result;
  const markerId = `arrow-${uid}`;

  return (
    <div className={styles.root} role="img" aria-label="Mermaid flowchart">
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        width={svgW}
        height={svgH}
        className={styles.svg}
        aria-hidden="true"
      >
        <defs>
          <marker
            id={markerId}
            markerWidth="10"
            markerHeight="8"
            refX="10"
            refY="4"
            orient="auto"
          >
            <polygon
              points="0 0, 10 4, 0 8"
              className={styles.arrowhead}
            />
          </marker>
        </defs>

        {/* Edges — rendered first so they appear behind nodes */}
        <g className={styles.edgesGroup}>
          {edges.map((edge, i) => {
            const from = layoutNodes.get(edge.from);
            const to   = layoutNodes.get(edge.to);
            if (!from || !to) return null;

            const { sp, tpShort, tp } = getEdgeEndpoints(from, to);
            const midX = (sp.x + tp.x) / 2;
            const midY = (sp.y + tp.y) / 2;

            return (
              <g key={i}>
                <line
                  x1={sp.x}
                  y1={sp.y}
                  x2={tpShort.x}
                  y2={tpShort.y}
                  className={styles.edge}
                  markerEnd={`url(#${markerId})`}
                />
                {edge.label && (
                  <text
                    x={midX}
                    y={midY - 5}
                    textAnchor="middle"
                    className={styles.edgeLabel}
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}
        </g>

        {/* Nodes — rendered on top */}
        <g className={styles.nodesGroup}>
          {Array.from(layoutNodes.values()).map((node) => (
            <RenderNode key={node.id} node={node} />
          ))}
        </g>
      </svg>
    </div>
  );
}
