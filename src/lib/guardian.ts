import { v4 as uuidv4 } from "uuid";
import { useGuardianStore } from "@/stores/guardianStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useProjectStore } from "@/stores/projectStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { killPty, writePty, gitDiff, guardianReview } from "@/lib/tauri";
import { stripAnsi } from "@/lib/patterns";
import type { AgentSession, AgentType, ReviewRequest } from "@/types";

// Module-level restart attempt tracker
const restartAttempts = new Map<string, number>();

// Compact multi-line text into a single line for inclusion in a CLI prompt.
function compactText(text: string, maxLen: number): string {
  return stripAnsi(text)
    .replace(/\r\n|\r|\n/g, " | ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

export async function spawnGuardianSession(projectId: string, agentType: AgentType): Promise<void> {
  const session: AgentSession = {
    id: crypto.randomUUID(),
    projectId,
    agentType,
    status: "starting",
    yoloMode: true, // Guardian needs YOLO to avoid getting stuck at tool confirmations
    createdAt: new Date().toISOString(),
    label: "Guardian",
    isGuardian: true,
    isResumed: false,
  };

  useSessionStore.getState().addSession(session);
  useGuardianStore.getState().setGuardianSession(projectId, session.id);
  useSessionStore.getState().setActiveSession(session.id);
}

export async function teardownGuardian(projectId: string): Promise<void> {
  const guardianSessionId = useGuardianStore.getState().guardianSessionIds[projectId];
  if (!guardianSessionId) return;

  await killPty(guardianSessionId).catch(() => {});
  useSessionStore.getState().removeSession(guardianSessionId);
  useGuardianStore.getState().clearProjectGuardianState(projectId);
  useGuardianStore.getState().removeOutputBuffer(guardianSessionId);
  restartAttempts.delete(projectId);

  useNotificationStore.getState().addNotification({
    id: uuidv4(),
    title: "Guardian Disabled",
    body: "Guardian disabled for project",
    sessionId: guardianSessionId,
    timestamp: new Date().toISOString(),
  });
}

export function triggerGuardianReview(sourceSession: AgentSession, projectPath: string): void {
  const guardianState = useGuardianStore.getState();
  const guardianSessionId = guardianState.guardianSessionIds[sourceSession.projectId];
  if (!guardianSessionId) return;

  const outputBuffer = guardianState.outputBuffers[sourceSession.id] ?? "";

  gitDiff(projectPath, false)
    .catch(() => "(git diff unavailable)")
    .then((diff) => {
      const review: ReviewRequest = {
        id: uuidv4(),
        sourceSessionId: sourceSession.id,
        projectId: sourceSession.projectId,
        sourceOutput: outputBuffer,
        gitDiff: diff.slice(0, 5000),
        status: "pending",
      };

      const store = useGuardianStore.getState();
      store.enqueueReview(review);

      // Only start processing if no review is currently active (avoid race)
      if (!useGuardianStore.getState().activeReview) {
        processNextReview(sourceSession.projectId, projectPath).catch(() => {});
      }
    });
}

export async function processNextReview(projectId: string, projectPath: string): Promise<void> {
  const store = useGuardianStore.getState();
  if (store.activeReview) return;
  const review = store.dequeueNextReview(projectId);
  if (!review) return;

  store.setActiveReview({ ...review, status: "in_review" });

  const sourceSession = useSessionStore
    .getState()
    .sessions.find((s) => s.id === review.sourceSessionId);
  const label = sourceSession?.label ?? "Unknown";
  const agentType = sourceSession?.agentType ?? "claude";

  const compactOutput = compactText(review.sourceOutput, 800);
  const compactDiff = compactText(review.gitDiff || "(no changes)", 1200);

  const prompt =
    `You are a Guardian Agent reviewing an AI agent action on a software project. ` +
    `Evaluate whether the action is safe and correct. ` +
    `Session: ${label} (${agentType}). ` +
    `Agent output: ${compactOutput}. ` +
    `Git diff: ${compactDiff}. ` +
    `Write a brief analysis (1-2 sentences), then end with exactly [DECISION: APPROVE] or [DECISION: REJECT] on its own line. ` +
    `Be conservative: if unsure, REJECT.`;

  try {
    const response = await guardianReview(prompt, projectPath);
    const match = response.match(/\[?DECISION:\s*(APPROVE|REJECT)\]?/i);
    if (match) {
      const decision = match[1].toUpperCase() as "APPROVE" | "REJECT";
      // Extract reasoning: everything before the decision tag
      const decisionIndex = response.search(/\[?DECISION:\s*(APPROVE|REJECT)\]?/i);
      const reasoning = response.slice(0, decisionIndex).trim();
      handleDecision(review.id, decision, reasoning, projectId, projectPath);
    } else {
      // Claude responded but didn't include a decision — treat as timeout
      store.updateReviewStatus(review.id, "timeout");
      useNotificationStore.getState().addNotification({
        id: uuidv4(),
        title: "Guardian: No Decision",
        body: "Guardian responded but did not include [DECISION: APPROVE/REJECT] — review manually",
        sessionId: store.guardianSessionIds[projectId] ?? "",
        timestamp: new Date().toISOString(),
      });
      store.setActiveReview(null);
      processNextReview(projectId, projectPath).catch(() => {});
    }
  } catch (err) {
    store.updateReviewStatus(review.id, "error");
    useNotificationStore.getState().addNotification({
      id: uuidv4(),
      title: "Guardian Error",
      body: `Guardian review failed: ${String(err).slice(0, 200)}`,
      sessionId: store.guardianSessionIds[projectId] ?? "",
      timestamp: new Date().toISOString(),
    });
    store.setActiveReview(null);
    processNextReview(projectId, projectPath).catch(() => {});
  }
}

export function handleDecision(
  reviewId: string,
  decision: "APPROVE" | "REJECT",
  reasoning: string,
  projectId: string,
  projectPath: string,
): void {
  const store = useGuardianStore.getState();
  const review = store.activeReview;
  if (!review || review.id !== reviewId) return;

  const guardianSessionId = store.guardianSessionIds[projectId];
  const sourceSession = useSessionStore
    .getState()
    .sessions.find((s) => s.id === review.sourceSessionId);
  const sessionLabel = sourceSession?.label ?? "Unknown";
  const sourceSessionId = review.sourceSessionId;

  if (decision === "APPROVE") {
    store.updateReviewStatus(reviewId, "approved");
    // Claude Code CLI permission TUI: press Enter (\r) to confirm the pre-selected "Allow"
    const encoded = Array.from(new TextEncoder().encode("\r"));
    writePty(sourceSessionId, encoded).catch((err) => {
      console.error("Failed to write approval to source PTY:", err);
    });

    useNotificationStore.getState().addNotification({
      id: uuidv4(),
      title: "Guardian Approved",
      body: `${sessionLabel}: ${reasoning.slice(0, 200)}`,
      sessionId: sourceSessionId,
      timestamp: new Date().toISOString(),
    });
  } else {
    store.updateReviewStatus(reviewId, "rejected");

    useNotificationStore.getState().addNotification({
      id: uuidv4(),
      title: "Guardian REJECTED",
      body: reasoning.slice(0, 300),
      sessionId: sourceSessionId,
      timestamp: new Date().toISOString(),
      actions: [
        { label: "Approve Override", action: "approve_override", sessionId: sourceSessionId },
        { label: "View Session", action: "view_session", sessionId: sourceSessionId },
        { label: "View Guardian", action: "view_guardian", sessionId: guardianSessionId ?? "" },
      ],
    });
  }

  store.setActiveReview(null);
  processNextReview(projectId, projectPath).catch(() => {});
}

export function handleGuardianCrash(projectId: string, guardianSessionId: string): void {
  const attempts = restartAttempts.get(projectId) ?? 0;

  if (attempts < 1) {
    restartAttempts.set(projectId, attempts + 1);
    useSessionStore.getState().removeSession(guardianSessionId);
    useGuardianStore.getState().removeGuardianSession(projectId);

    const project = useProjectStore.getState().projects.find((p) => p.id === projectId);
    if (project) {
      spawnGuardianSession(projectId, project.guardian_agent_type ?? "claude").catch((err) => {
        console.error("Failed to respawn guardian:", err);
      });
    }
  } else {
    restartAttempts.delete(projectId);

    const project = useProjectStore.getState().projects.find((p) => p.id === projectId);
    if (project) {
      useProjectStore
        .getState()
        .updateProject({ ...project, guardian_enabled: false })
        .catch(() => {});
    }

    useGuardianStore.getState().clearProjectGuardianState(projectId);

    useNotificationStore.getState().addNotification({
      id: uuidv4(),
      title: "Guardian Disabled",
      body: "Guardian crashed repeatedly - disabled",
      sessionId: guardianSessionId,
      timestamp: new Date().toISOString(),
    });
  }
}
