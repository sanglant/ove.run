import type { ReactNode } from "react";
import { Text } from "@mantine/core";

interface SectionTitleProps {
  children: ReactNode;
  className?: string;
  mb?: number;
}

export function SectionTitle({ children, className, mb = 8 }: SectionTitleProps) {
  return (
    <Text
      size="xs"
      tt="uppercase"
      lts="0.05em"
      fw={600}
      c="var(--text-secondary)"
      mb={mb}
      className={className}
    >
      {children}
    </Text>
  );
}
