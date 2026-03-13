import { Eye, Bot, Zap } from "lucide-react";
import type { TrustLevel } from "@/types";
import { TRUST_LEVEL_LABELS } from "@/types";
import classes from "./TrustLevelSelector.module.css";

interface TrustLevelSelectorProps {
  value: TrustLevel;
  onChange: (level: TrustLevel) => void;
}

const LEVELS: { level: TrustLevel; icon: React.ReactNode }[] = [
  { level: 1, icon: <Eye size={16} /> },
  { level: 2, icon: <Bot size={16} /> },
  { level: 3, icon: <Zap size={16} /> },
];

export function TrustLevelSelector({ value, onChange }: TrustLevelSelectorProps) {
  return (
    <div className={classes.root} role="radiogroup" aria-label="Trust level">
      {LEVELS.map(({ level, icon }) => {
        const { name, description } = TRUST_LEVEL_LABELS[level];
        const selected = value === level;
        return (
          <button
            key={level}
            type="button"
            role="radio"
            aria-checked={selected}
            className={`${classes.card} ${selected ? classes.selected : ""}`}
            onClick={() => onChange(level)}
          >
            <span className={classes.iconWrap} aria-hidden="true">
              {icon}
            </span>
            <span className={classes.text}>
              <span className={classes.name}>{name}</span>
              <span className={classes.description}>{description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
