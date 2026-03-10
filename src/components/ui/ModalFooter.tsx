import type { ReactNode } from "react";
import { Group } from "@mantine/core";
import classes from "./ModalFooter.module.css";

interface ModalFooterProps {
  children: ReactNode;
}

export function ModalFooter({ children }: ModalFooterProps) {
  return (
    <div className={classes.footer}>
      <Group justify="flex-end" gap="xs">
        {children}
      </Group>
    </div>
  );
}
