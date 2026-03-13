import { v4 as uuidv4 } from "uuid";
import { useNotificationStore } from "@/stores/notificationStore";
import { arbiterReview, writePty, listAgentTypes, searchMemories, extractMemories, checkConsolidation } from "@/lib/tauri";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { stripAnsi } from "@/lib/patterns";
import type { FeedbackItem, ParsedOption } from "@/types";

function compactText(text: string, maxLen: number): string {
  return stripAnsi(text)
    .replace(/\r\n|\r|\n/g, " | ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

export async function arbiterAnswer(
  item: FeedbackItem,
  projectPath: string,
): Promise<void> {
  const { sessionId, output, parsedOptions, allowFreeInput } = item;

  const compactOutput = compactText(output, 1500);
  const optionLabels = parsedOptions.map((o) => o.label).join(", ");

  let memoryContext = "";
  try {
    const memories = await searchMemories(compactText(output, 500), item.projectId, sessionId, 5);
    if (memories.length > 0) {
      memoryContext = "Relevant project memories:\n" + memories.map(m => `- ${m.content}`).join("\n");
    }
  } catch {
    // proceed without memories
  }

  const prompt =
    `You are an Arbiter agent reviewing an AI coding agent's question on a software project. ` +
    `${memoryContext || "No project context available yet."} ` +
    `Agent terminal output: ${compactOutput}. ` +
    `Available options: ${optionLabels || "(none)"}. ` +
    `Free text input allowed: ${allowFreeInput ? "yes" : "no"}. ` +
    `Pick the best option for this project. If the agent appears to have already resolved the issue ` +
    `or the prompt is stale/no longer relevant, respond with ANSWER: DISMISS to close without answering.\n` +
    `Respond with:\n` +
    `ANSWER: {exact option label} (or ANSWER: DISMISS to skip)\n` +
    `or if free text is needed:\n` +
    `ANSWER_TEXT: {your response}\n` +
    `REASONING: {1-2 sentence explanation}\n`;

  // Resolve CLI command and model from global arbiter settings
  const globalSettings = useSettingsStore.getState().settings.global;
  const arbiterProvider = globalSettings.arbiter_provider || "claude";
  let cliCommand: string | undefined;
  try {
    const defs = await listAgentTypes();
    const def = defs.find((d) => d.agent_type === arbiterProvider);
    if (def) cliCommand = def.command;
  } catch {
    // fall back to default
  }
  const model = globalSettings.arbiter_model || undefined;

  try {
    const response = await arbiterReview(prompt, projectPath, cliCommand, model);
    const result = parseArbiterResponse(response, parsedOptions);

    const isDismiss = result.answer?.toLowerCase() === "dismiss";

    if (isDismiss) {
      // Arbiter determined the issue is resolved — dismiss without sending input
      useSessionStore.getState().updateSessionStatus(sessionId, "working");
    } else if (result.answer) {
      const option = matchOption(result.answer, parsedOptions);
      if (option) {
        await sendKeys(sessionId, option.keys);
      } else if (allowFreeInput) {
        await sendText(sessionId, result.answer);
      }
      useSessionStore.getState().updateSessionStatus(sessionId, "working");
    } else if (result.answerText && allowFreeInput) {
      await sendText(sessionId, result.answerText);
      useSessionStore.getState().updateSessionStatus(sessionId, "working");
    } else if (parsedOptions.length > 0) {
      await sendKeys(sessionId, parsedOptions[0].keys);
      useSessionStore.getState().updateSessionStatus(sessionId, "working");
    }

    const session = useSessionStore.getState().sessions.find((s) => s.id === sessionId);
    const choiceLabel = isDismiss ? "dismissed (resolved)" : (result.answer || result.answerText || "first option");
    useNotificationStore.getState().addNotification({
      id: uuidv4(),
      title: "Arbiter Answered",
      body: `${session?.label ?? "Session"}: ${choiceLabel} — ${result.reasoning ?? ""}`.slice(0, 300),
      sessionId,
      timestamp: new Date().toISOString(),
    });

    extractMemories(item.projectId, sessionId, output, projectPath).catch(() => {});
    checkConsolidation(item.projectId, projectPath).catch(() => {});
  } catch (err) {
    console.error("Arbiter answer failed:", err);
    useNotificationStore.getState().addNotification({
      id: uuidv4(),
      title: "Arbiter Error",
      body: `Failed to auto-answer: ${String(err).slice(0, 200)}`,
      sessionId,
      timestamp: new Date().toISOString(),
    });
  }
}

interface ArbiterResult {
  answer?: string;
  answerText?: string;
  reasoning?: string;
}

/**
 * Match Arbiter's answer to a parsed option using progressively looser strategies:
 * 1. Exact match (case-insensitive)
 * 2. One label contains the other
 * 3. First word match (e.g. "Yes" matches "Yes (default)")
 */
function matchOption(answer: string, options: ParsedOption[]): ParsedOption | undefined {
  const a = answer.toLowerCase().trim();

  // Exact match
  const exact = options.find((o) => o.label.toLowerCase() === a);
  if (exact) return exact;

  // Containment match (answer inside label or label inside answer)
  const contained = options.find((o) => {
    const l = o.label.toLowerCase();
    return l.includes(a) || a.includes(l);
  });
  if (contained) return contained;

  // First-word match
  const aFirstWord = a.split(/[\s(]/)[0];
  if (aFirstWord.length >= 2) {
    const firstWord = options.find(
      (o) => o.label.toLowerCase().split(/[\s(]/)[0] === aFirstWord,
    );
    if (firstWord) return firstWord;
  }

  return undefined;
}

function parseArbiterResponse(response: string, _options: ParsedOption[]): ArbiterResult {
  const result: ArbiterResult = {};

  const answerMatch = response.match(/^ANSWER:\s*(.+)$/m);
  if (answerMatch) result.answer = answerMatch[1].trim();

  const answerTextMatch = response.match(/^ANSWER_TEXT:\s*(.+)$/m);
  if (answerTextMatch) result.answerText = answerTextMatch[1].trim();

  const reasoningMatch = response.match(/^REASONING:\s*(.+)$/m);
  if (reasoningMatch) result.reasoning = reasoningMatch[1].trim();

  return result;
}

async function sendKeys(sessionId: string, keys: number[]): Promise<void> {
  const keypresses: number[][] = [];
  let i = 0;
  while (i < keys.length) {
    if (keys[i] === 0x1b && keys[i + 1] === 0x5b && i + 2 < keys.length) {
      keypresses.push(keys.slice(i, i + 3));
      i += 3;
    } else {
      keypresses.push([keys[i]]);
      i += 1;
    }
  }
  for (let k = 0; k < keypresses.length; k++) {
    await writePty(sessionId, keypresses[k]);
    if (k < keypresses.length - 1) {
      await new Promise((r) => setTimeout(r, 50));
    }
  }
}

async function sendText(sessionId: string, text: string): Promise<void> {
  const bytes = Array.from(new TextEncoder().encode(text + "\r"));
  await sendKeys(sessionId, bytes);
}
