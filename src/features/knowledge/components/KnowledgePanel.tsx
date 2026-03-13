import { BookOpen } from "lucide-react";
import classes from "./KnowledgePanel.module.css";

export function KnowledgePanel() {
  return (
    <div className={classes.emptyState}>
      <BookOpen size={42} strokeWidth={1} className={classes.emptyIcon} />
      <p>Context panel coming soon</p>
      <span>This will be replaced by the unified context store in a future update.</span>
    </div>
  );
}
