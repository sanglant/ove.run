import cn from "clsx";
import { getStatusMeta } from "@/constants/agents";
import classes from "./StatusDot.module.css";

interface StatusDotProps {
  status: string;
  className?: string;
}

export function StatusDot({ status, className }: StatusDotProps) {
  const meta = getStatusMeta(status);
  return (
    <span
      className={cn(classes.dot, meta.className, className)}
      style={{ "--dot-color": meta.color } as React.CSSProperties}
    />
  );
}
