import type { TerminalLayoutNode, TerminalPaneLayoutNode } from "@/types";

export function collectPanes(
  node: TerminalLayoutNode,
  panes: TerminalPaneLayoutNode[] = [],
): TerminalPaneLayoutNode[] {
  if (node.type === "pane") {
    panes.push(node);
    return panes;
  }

  collectPanes(node.first, panes);
  collectPanes(node.second, panes);
  return panes;
}

export function countPanes(node: TerminalLayoutNode): number {
  return node.type === "pane" ? 1 : countPanes(node.first) + countPanes(node.second);
}

export function findPaneById(node: TerminalLayoutNode, paneId: string): TerminalPaneLayoutNode | null {
  if (node.type === "pane") {
    return node.id === paneId ? node : null;
  }

  return findPaneById(node.first, paneId) ?? findPaneById(node.second, paneId);
}
