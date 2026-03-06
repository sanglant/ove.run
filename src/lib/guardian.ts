import { v4 as uuidv4 } from "uuid";
import { useGuardianStore } from "@/stores/guardianStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { guardianReview, listKnowledge, readKnowledgeContent, createKnowledge, writePty } from "@/lib/tauri";
import { useSessionStore } from "@/stores/sessionStore";
import { stripAnsi } from "@/lib/patterns";
import type { FeedbackItem, ParsedOption } from "@/types";

function compactText(text: string, maxLen: number): string {
  return stripAnsi(text)
    .replace(/\r\n|\r|\n/g, " | ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

export async function guardianAnswer(
  item: FeedbackItem,
  projectPath: string,
): Promise<void> {
  const { projectId, sessionId, output, parsedOptions, allowFreeInput } = item;

  let knowledgeNotes = "";
  const hasKnowledge = useGuardianStore.getState().guardianInitialized[projectId];
  if (hasKnowledge) {
    try {
      const entries = await listKnowledge(projectId);
      const guardianEntry = entries.find((e) => e.name === "Guardian Notes");
      if (guardianEntry) {
        knowledgeNotes = await readKnowledgeContent(projectId, guardianEntry.id);
      }
    } catch {
      // proceed without knowledge
    }
  }

  const compactOutput = compactText(output, 1500);
  const optionLabels = parsedOptions.map((o) => o.label).join(", ");

  const knowledgeSection = knowledgeNotes
    ? `Project knowledge: ${compactText(knowledgeNotes, 800)}`
    : "No project notes yet — after answering, also provide brief project notes.";

  const prompt =
    `You are a Guardian agent reviewing an AI coding agent's question on a software project. ` +
    `${knowledgeSection} ` +
    `Agent terminal output: ${compactOutput}. ` +
    `Available options: ${optionLabels || "(none)"}. ` +
    `Free text input allowed: ${allowFreeInput ? "yes" : "no"}. ` +
    `Pick the best option for this project. Respond with:\n` +
    `ANSWER: {exact option label}\n` +
    `or if free text is needed:\n` +
    `ANSWER_TEXT: {your response}\n` +
    `REASONING: {1-2 sentence explanation}\n` +
    (knowledgeNotes ? "" : `PROJECT_NOTES: {brief project summary, tech stack, key conventions for future reference}\n`);

  try {
    const response = await guardianReview(prompt, projectPath);
    const result = parseGuardianResponse(response, parsedOptions);

    if (result.answer) {
      const option = parsedOptions.find(
        (o) => o.label.toLowerCase() === result.answer!.toLowerCase(),
      );
      if (option) {
        await sendKeys(sessionId, option.keys);
      } else if (allowFreeInput) {
        await sendText(sessionId, result.answer);
      }
    } else if (result.answerText && allowFreeInput) {
      await sendText(sessionId, result.answerText);
    } else if (parsedOptions.length > 0) {
      await sendKeys(sessionId, parsedOptions[0].keys);
    }

    useSessionStore.getState().updateSessionStatus(sessionId, "working");

    if (result.projectNotes && !knowledgeNotes) {
      try {
        await createKnowledge(projectId, "Guardian Notes", "notes", result.projectNotes);
        useGuardianStore.getState().setGuardianInitialized(projectId, true);
      } catch {
        // non-critical
      }
    }

    const session = useSessionStore.getState().sessions.find((s) => s.id === sessionId);
    const choiceLabel = result.answer || result.answerText || "first option";
    useNotificationStore.getState().addNotification({
      id: uuidv4(),
      title: "Guardian Answered",
      body: `${session?.label ?? "Session"}: ${choiceLabel} — ${result.reasoning ?? ""}`.slice(0, 300),
      sessionId,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Guardian answer failed:", err);
    useNotificationStore.getState().addNotification({
      id: uuidv4(),
      title: "Guardian Error",
      body: `Failed to auto-answer: ${String(err).slice(0, 200)}`,
      sessionId,
      timestamp: new Date().toISOString(),
    });
  }
}

interface GuardianResult {
  answer?: string;
  answerText?: string;
  reasoning?: string;
  projectNotes?: string;
}

function parseGuardianResponse(response: string, _options: ParsedOption[]): GuardianResult {
  const result: GuardianResult = {};

  const answerMatch = response.match(/^ANSWER:\s*(.+)$/m);
  if (answerMatch) result.answer = answerMatch[1].trim();

  const answerTextMatch = response.match(/^ANSWER_TEXT:\s*(.+)$/m);
  if (answerTextMatch) result.answerText = answerTextMatch[1].trim();

  const reasoningMatch = response.match(/^REASONING:\s*(.+)$/m);
  if (reasoningMatch) result.reasoning = reasoningMatch[1].trim();

  const notesMatch = response.match(/^PROJECT_NOTES:\s*([\s\S]+?)(?=\n[A-Z_]+:|$)/m);
  if (notesMatch) result.projectNotes = notesMatch[1].trim();

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
