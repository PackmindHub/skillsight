import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { skillColor } from "./skill-color";

interface SkillChipProps {
  skill: string;
  dim?: boolean;
}

export function SkillChip({ skill, dim = false }: SkillChipProps) {
  const style = { "--cohort-chip-c": skillColor(skill) } as CSSProperties;
  return (
    <span className={cn("cohort-chip", dim && "dim")} style={style}>
      <span className="cohort-chip-dot" />
      {skill}
    </span>
  );
}
