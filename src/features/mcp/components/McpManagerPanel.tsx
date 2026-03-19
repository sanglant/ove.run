import { useEffect, useState, useCallback } from "react";
import { v4 as uuid } from "uuid";
import {
  Text,
  Badge,
  Group,
  Stack,
  ScrollArea,
  ActionIcon,
  Textarea,
  Button,
  Collapse,
  Tooltip,
  JsonInput,
} from "@mantine/core";
import {
  Activity,
  Server,
  MessageCircleQuestion,
  ChevronRight,
  Send,
  Clock,
  Plug,
  Plus,
  Trash2,
  Pencil,
} from "lucide-react";
import { useMcpStore } from "@/stores/mcpStore";
import { useContextStore } from "@/stores/contextStore";
import { useProjectStore } from "@/stores/projectStore";
import { EmptyState } from "@/components/ui/EmptyState";
import { AppModal } from "@/components/ui/AppModal";
import { ModalFooter } from "@/components/ui/ModalFooter";
import { StatusDot } from "@/components/ui/StatusDot";
import { MarkdownViewer } from "@/components/shared/MarkdownViewer";
import type { ContextUnit } from "@/types";
import classes from "./McpManagerPanel.module.css";

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

const TOOL_COLORS: Record<string, string> = {
  check_in: "blue",
  request_guidance: "orange",
  report_completion: "green",
};

const DEFAULT_MCP_CONFIG = JSON.stringify(
  { name: "", url: "http://localhost:3000/mcp", description: "" },
  null,
  2,
);

function generateMcpDocs(config: {
  name: string;
  url?: string;
  command?: string;
  args?: string[];
  description?: string;
}): { l0: string; l1: string; l2: string } {
  const name = config.name || "Unnamed MCP Server";
  const desc = config.description || "Custom MCP server";
  const isHttp = !!config.url;

  const l0 = desc;

  const l1Parts = [`## ${name}\n`];
  l1Parts.push(`**Connection:** ${isHttp ? "HTTP" : config.command ? "stdio" : "unknown"}`);
  if (config.url) l1Parts.push(`**URL:** \`${config.url}\``);
  if (config.command) {
    l1Parts.push(`**Command:** \`${[config.command, ...(config.args || [])].join(" ")}\``);
  }
  l1Parts.push(`\n${desc}`);

  const l2Parts = [`# ${name}\n`, `## Connection\n`];
  if (isHttp) {
    l2Parts.push(`- **Type:** HTTP (Streamable)`, `- **URL:** \`${config.url}\``);
  } else if (config.command) {
    l2Parts.push(`- **Type:** stdio`, `- **Command:** \`${config.command}\``);
    if (config.args?.length) l2Parts.push(`- **Args:** ${config.args.map((a) => `\`${a}\``).join(", ")}`);
  }
  l2Parts.push(`\n## Description\n\n${desc}`);
  l2Parts.push(`\n## Configuration\n\n\`\`\`json\n${JSON.stringify(config, null, 2)}\n\`\`\``);

  return { l0, l1: l1Parts.join("\n"), l2: l2Parts.join("\n") };
}

// ────────────────────────────────────────────────────────────────
// Add / Edit MCP Modal
// ────────────────────────────────────────────────────────────────

function AddMcpModal({
  opened,
  onClose,
  editingUnit,
}: {
  opened: boolean;
  onClose: () => void;
  editingUnit?: ContextUnit | null;
}) {
  const { addUnit, editUnit } = useContextStore();
  const activeProject = useProjectStore((s) => s.projects[0]);

  const [configJson, setConfigJson] = useState(DEFAULT_MCP_CONFIG);
  const [parseError, setParseError] = useState<string | null>(null);
  const [previewDocs, setPreviewDocs] = useState<{ l0: string; l1: string; l2: string } | null>(null);

  useEffect(() => {
    if (!opened) return;
    if (editingUnit) {
      try {
        const tags = JSON.parse(editingUnit.tags_json || "[]");
        const mcpConfig = tags.find((t: any) => typeof t === "object" && t._mcp_config);
        setConfigJson(
          mcpConfig?._mcp_config
            ? JSON.stringify(mcpConfig._mcp_config, null, 2)
            : JSON.stringify({ name: editingUnit.name, description: editingUnit.l0_summary || "" }, null, 2),
        );
      } catch {
        setConfigJson(JSON.stringify({ name: editingUnit.name, description: editingUnit.l0_summary || "" }, null, 2));
      }
    } else {
      setConfigJson(DEFAULT_MCP_CONFIG);
    }
    setParseError(null);
    setPreviewDocs(null);
  }, [editingUnit, opened]);

  const handleValidate = useCallback(() => {
    try {
      const parsed = JSON.parse(configJson);
      if (!parsed.name || typeof parsed.name !== "string") {
        setParseError('"name" is required');
        setPreviewDocs(null);
        return;
      }
      if (!parsed.url && !parsed.command) {
        setParseError('Provide "url" (HTTP) or "command" (stdio)');
        setPreviewDocs(null);
        return;
      }
      setParseError(null);
      setPreviewDocs(generateMcpDocs(parsed));
    } catch (e: any) {
      setParseError(e.message || "Invalid JSON");
      setPreviewDocs(null);
    }
  }, [configJson]);

  const handleSave = useCallback(async () => {
    try {
      const parsed = JSON.parse(configJson);
      if (!parsed.name) return;
      const docs = generateMcpDocs(parsed);
      const tags = [{ _mcp_config: parsed }];

      if (editingUnit) {
        await editUnit({
          ...editingUnit,
          name: parsed.name,
          tags_json: JSON.stringify(tags),
          l0_summary: docs.l0,
          l1_overview: docs.l1,
          l2_content: docs.l2,
          updated_at: new Date().toISOString(),
        });
      } else {
        const now = new Date().toISOString();
        await addUnit({
          id: uuid(),
          name: parsed.name,
          type: "mcp",
          scope: "project",
          project_id: activeProject?.id ?? null,
          tags_json: JSON.stringify(tags),
          l0_summary: docs.l0,
          l1_overview: docs.l1,
          l2_content: docs.l2,
          created_at: now,
          updated_at: now,
          is_bundled: false,
          bundled_slug: null,
        });
      }
      onClose();
    } catch {
      setParseError("Failed to save");
    }
  }, [configJson, editingUnit, addUnit, editUnit, activeProject, onClose]);

  return (
    <AppModal
      opened={opened}
      onClose={onClose}
      title={editingUnit ? "Edit MCP Server" : "Add MCP Server"}
      size="lg"
    >
      <div className={classes.modalSections}>
        {/* ── Config input ── */}
        <div className={classes.configSection}>
          <span className={classes.configLabel}>Server Configuration</span>
          <JsonInput
            value={configJson}
            onChange={setConfigJson}
            placeholder='{"name": "...", "url": "http://...", "description": "..."}'
            minRows={6}
            maxRows={14}
            autosize
            formatOnBlur
            styles={{
              input: {
                fontFamily: "var(--mantine-font-family-monospace)",
                fontSize: "var(--mantine-font-size-xs)",
                background: "var(--mantine-color-dark-7)",
                border: "1px solid var(--mantine-color-dark-4)",
              },
            }}
          />
          <span className={classes.configHint}>
            Required: <code>name</code> + <code>url</code> or <code>command</code>.
            Optional: <code>description</code>, <code>args</code>, <code>env</code>.
          </span>
        </div>

        {parseError && <div className={classes.errorText}>{parseError}</div>}

        {/* ── Preview ── */}
        {previewDocs && (
          <div className={classes.previewSection}>
            <span className={classes.configLabel}>Preview</span>
            <div className={classes.previewContent}>
              <MarkdownViewer content={previewDocs.l2} />
            </div>
          </div>
        )}

        {/* ── Actions ── */}
        <ModalFooter>
          <Button size="xs" variant="default" onClick={handleValidate}>
            Validate & Preview
          </Button>
          <Button size="xs" onClick={handleSave} disabled={!previewDocs}>
            {editingUnit ? "Update" : "Add Server"}
          </Button>
        </ModalFooter>
      </div>
    </AppModal>
  );
}

// ────────────────────────────────────────────────────────────────
// Server Card
// ────────────────────────────────────────────────────────────────

function McpServerCard({
  unit,
  expanded,
  onToggle,
  onEdit,
  onDelete,
}: {
  unit: ContextUnit;
  expanded: boolean;
  onToggle: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className={classes.serverCard}>
      <div className={classes.serverCardHeader} onClick={onToggle}>
        <ChevronRight
          size={12}
          className={classes.serverCardChevron}
          data-expanded={expanded}
        />
        <Text size="sm" fw={500} style={{ flex: 1 }}>
          {unit.name}
        </Text>
        {unit.is_bundled && (
          <Badge size="xs" variant="outline" color="dimmed">
            Built-in
          </Badge>
        )}
        {!unit.is_bundled && (onEdit || onDelete) && (
          <div className={classes.serverCardActions}>
            {onEdit && (
              <Tooltip label="Edit" position="top">
                <ActionIcon
                  size="xs"
                  variant="subtle"
                  onClick={(e) => { e.stopPropagation(); onEdit(); }}
                >
                  <Pencil size={11} />
                </ActionIcon>
              </Tooltip>
            )}
            {onDelete && (
              <Tooltip label="Delete" position="top">
                <ActionIcon
                  size="xs"
                  variant="subtle"
                  color="red"
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                >
                  <Trash2 size={11} />
                </ActionIcon>
              </Tooltip>
            )}
          </div>
        )}
      </div>

      {/* Summary line when collapsed */}
      {unit.l0_summary && !expanded && (
        <Text size="xs" c="dimmed" mt={4}>
          {unit.l0_summary}
        </Text>
      )}

      {/* Expanded markdown docs */}
      <Collapse in={expanded}>
        <div className={classes.serverCardContent}>
          {unit.l2_content ? (
            <MarkdownViewer content={unit.l2_content} />
          ) : unit.l1_overview ? (
            <MarkdownViewer content={unit.l1_overview} />
          ) : (
            <Text size="xs" c="dimmed">No documentation available.</Text>
          )}
        </div>
      </Collapse>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Main Panel
// ────────────────────────────────────────────────────────────────

export function McpManagerPanel() {
  const {
    serverStatus,
    activities,
    pendingQuestions,
    sessionStatuses,
    loadServerStatus,
    loadActivities,
    loadPendingQuestions,
    answerQuestion,
  } = useMcpStore();

  const { units, loadUnits, removeUnit } = useContextStore();
  const [expandedServers, setExpandedServers] = useState<Set<string>>(new Set());
  const [answerTexts, setAnswerTexts] = useState<Record<string, string>>({});
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<ContextUnit | null>(null);

  useEffect(() => {
    loadServerStatus();
    loadActivities();
    loadPendingQuestions();
    loadUnits();
  }, []);

  const handleModalClose = useCallback(() => {
    setAddModalOpen(false);
    setEditingUnit(null);
    loadUnits();
  }, [loadUnits]);

  const mcpUnits = units.filter((u) => u.type === "mcp");
  const builtInServers = mcpUnits.filter((u) => u.is_bundled);
  const userServers = mcpUnits.filter((u) => !u.is_bundled);

  const toggleServer = (id: string) => {
    setExpandedServers((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleAnswer = async (questionId: string) => {
    const text = answerTexts[questionId] || "";
    if (!text.trim()) return;
    await answerQuestion(questionId, text);
    setAnswerTexts((prev) => {
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
  };

  const activeSessions = Object.values(sessionStatuses);

  return (
    <>
      <ScrollArea h="100%" offsetScrollbars>
        <Stack gap={28} p="md">
          {/* ── MCP Servers ── */}
          <div>
            <Group gap="xs" mb={10}>
              <Server size={14} />
              <Text size="sm" fw={600}>MCP Servers</Text>
              <Badge
                size="xs"
                variant="dot"
                color={serverStatus.running ? "green" : "red"}
              >
                {serverStatus.running ? `Port ${serverStatus.port}` : "Stopped"}
              </Badge>
              <div style={{ flex: 1 }} />
              <Tooltip label="Add MCP Server" position="left">
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  onClick={() => { setEditingUnit(null); setAddModalOpen(true); }}
                >
                  <Plus size={14} />
                </ActionIcon>
              </Tooltip>
            </Group>

            <Stack gap={6}>
              {builtInServers.map((unit) => (
                <McpServerCard
                  key={unit.id}
                  unit={unit}
                  expanded={expandedServers.has(unit.id)}
                  onToggle={() => toggleServer(unit.id)}
                />
              ))}

              {userServers.length > 0 && (
                <>
                  <Text size="xs" c="dimmed" fw={500} mt={8}>
                    Custom Servers
                  </Text>
                  {userServers.map((unit) => (
                    <McpServerCard
                      key={unit.id}
                      unit={unit}
                      expanded={expandedServers.has(unit.id)}
                      onToggle={() => toggleServer(unit.id)}
                      onEdit={() => { setEditingUnit(unit); setAddModalOpen(true); }}
                      onDelete={() => removeUnit(unit.id)}
                    />
                  ))}
                </>
              )}
            </Stack>
          </div>

          {/* ── Live Activity ── */}
          <div>
            <Group gap="xs" mb={10}>
              <Activity size={14} />
              <Text size="sm" fw={600}>Live Activity</Text>
              {activeSessions.length > 0 && (
                <Badge size="xs" variant="light" color="blue">
                  {activeSessions.length} session{activeSessions.length !== 1 ? "s" : ""}
                </Badge>
              )}
            </Group>

            {/* Sessions */}
            {activeSessions.length > 0 && (
              <Stack gap={4} mb="md">
                {activeSessions.map((session) => (
                  <Group key={session.session_id} gap="xs" className={classes.sessionRow}>
                    <StatusDot status={session.status} />
                    <Text size="xs" truncate style={{ flex: 1 }}>
                      {session.task_summary || session.session_id.slice(0, 8)}
                    </Text>
                    <Badge size="xs" variant="light">{session.status}</Badge>
                  </Group>
                ))}
              </Stack>
            )}

            {/* Pending Questions */}
            {pendingQuestions.length > 0 && (
              <div className={classes.section}>
                <div className={classes.sectionHeader}>
                  <MessageCircleQuestion size={12} />
                  <Text size="xs" fw={600}>Pending Questions</Text>
                  <Badge size="xs" color="orange">{pendingQuestions.length}</Badge>
                </div>
                <Stack gap={6}>
                  {pendingQuestions.map((q) => (
                    <div key={q.id} className={classes.questionCard}>
                      <Text size="xs" mb={8}>{q.question}</Text>
                      {q.options.length > 0 && (
                        <Group gap={4} mb={8} wrap="wrap">
                          {q.options.map((opt, i) => (
                            <Button
                              key={i}
                              size="compact-xs"
                              variant="light"
                              onClick={() => answerQuestion(q.id, opt, i)}
                            >
                              {opt}
                            </Button>
                          ))}
                        </Group>
                      )}
                      {q.allow_free_input && (
                        <Group gap="xs">
                          <Textarea
                            size="xs"
                            placeholder="Type your answer..."
                            style={{ flex: 1 }}
                            minRows={1}
                            maxRows={3}
                            value={answerTexts[q.id] || ""}
                            onChange={(e) =>
                              setAnswerTexts((prev) => ({ ...prev, [q.id]: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleAnswer(q.id);
                              }
                            }}
                          />
                          <ActionIcon size="sm" variant="light" color="blue" onClick={() => handleAnswer(q.id)}>
                            <Send size={12} />
                          </ActionIcon>
                        </Group>
                      )}
                      <Group gap={4} mt={6}>
                        <Clock size={10} />
                        <Text size="xs" c="dimmed">{Math.round(q.created_at_ms / 1000)}s ago</Text>
                      </Group>
                    </div>
                  ))}
                </Stack>
              </div>
            )}

            {/* Activity Log */}
            <div className={classes.section}>
              <div className={classes.sectionHeader}>
                <Text size="xs" fw={600}>Activity Log</Text>
                <Badge size="xs" variant="light">{activities.length}</Badge>
              </div>
              {activities.length === 0 ? (
                <EmptyState
                  icon={<Plug size={24} />}
                  title="No MCP activity yet"
                  description="Activity will appear here when agents call MCP tools."
                />
              ) : (
                <Stack gap={2}>
                  {[...activities].reverse().slice(0, 50).map((a) => (
                    <Group key={a.id} gap="xs" className={classes.activityRow} wrap="nowrap">
                      <Text size="xs" c="dimmed" style={{ width: 60, flexShrink: 0 }}>
                        {formatTimestamp(a.timestamp)}
                      </Text>
                      <Badge
                        size="xs"
                        variant="light"
                        color={TOOL_COLORS[a.tool_name] || "gray"}
                        style={{ flexShrink: 0 }}
                      >
                        {a.tool_name}
                      </Badge>
                      {a.status && <StatusDot status={a.status} />}
                      <Text size="xs" truncate style={{ flex: 1 }}>
                        {a.task_summary || a.question || ""}
                      </Text>
                      {a.gate_passed !== null && (
                        <Badge size="xs" color={a.gate_passed ? "green" : "red"}>
                          {a.gate_passed ? "pass" : "fail"}
                        </Badge>
                      )}
                    </Group>
                  ))}
                </Stack>
              )}
            </div>
          </div>
        </Stack>
      </ScrollArea>

      <AddMcpModal opened={addModalOpen} onClose={handleModalClose} editingUnit={editingUnit} />
    </>
  );
}
