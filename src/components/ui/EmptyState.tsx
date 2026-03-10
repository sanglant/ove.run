import type { ReactNode } from "react";
import { Text } from "@mantine/core";
import cn from "clsx";
import classes from "./EmptyState.module.css";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, children, className }: EmptyStateProps) {
  return (
    <div className={cn(classes.container, className)}>
      {icon}
      <div style={{ textAlign: "center" }}>
        <Text size="sm" c="var(--text-primary)">
          {title}
        </Text>
        {description && (
          <Text size="xs" c="dimmed" mt={4}>
            {description}
          </Text>
        )}
      </div>
      {children}
    </div>
  );
}
