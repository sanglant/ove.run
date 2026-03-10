import { getAgentMeta } from "@/constants/agents";
import classes from "./AgentBadge.module.css";

interface AgentBadgeProps {
  agentType: string;
  variant?: "label" | "displayName";
  className?: string;
}

export function AgentBadge({ agentType, variant = "label", className }: AgentBadgeProps) {
  const meta = getAgentMeta(agentType);
  return (
    <span
      className={`${classes.badge}${className ? ` ${className}` : ""}`}
      style={{
        "--agent-badge-bg": `color-mix(in srgb, ${meta.color} 15%, transparent)`,
        "--agent-badge-color": meta.color,
      } as React.CSSProperties}
    >
      {variant === "displayName" ? meta.displayName : meta.label}
    </span>
  );
}
