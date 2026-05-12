import { cn } from "@/lib/utils";
import type { Cohort } from "@/types/api";
import { AvatarStack } from "./AvatarStack";
import { CohortKnot } from "./CohortKnot";
import { SkillChip } from "./SkillChip";
import { formatNum, formatRelative } from "./format";

interface CohortCardProps {
  cohort: Cohort;
  idx: number;
  onSelect: (cohort: Cohort) => void;
  highlightSkill?: string;
}

export function CohortCard({ cohort, idx, onSelect, highlightSkill }: CohortCardProps) {
  const isSolo = cohort.users.length === 1;
  return (
    <button
      type="button"
      className={cn("cohort-card", isSolo && "solo")}
      onClick={() => onSelect(cohort)}
    >
      <div className="cohort-card-top">
        <CohortKnot skills={cohort.skills} size={52} />
        <div className="cohort-card-meta">
          <div className="cohort-card-rank">CLUSTER · C{String(idx + 1).padStart(2, "0")}</div>
          <div className="cohort-card-stats">
            <span className="cohort-card-users">
              <AvatarStack emails={cohort.users.map((u) => u.email)} max={3} />
              <span className="n">{cohort.users.length}</span>
              <span className="lab">{cohort.users.length === 1 ? "user" : "users"}</span>
            </span>
          </div>
          <div className="cohort-card-subline">
            <span className="num">{formatNum(cohort.activations)}</span>
            <span className="sublab">activations</span>
            <span className="sep">·</span>
            <span className="last">{formatRelative(cohort.lastActiveAt)}</span>
          </div>
        </div>
      </div>
      <div className="cohort-card-chips">
        {cohort.skills.map((s) => (
          <SkillChip
            key={s}
            skill={s}
            dim={Boolean(highlightSkill && s !== highlightSkill && cohort.skills.length > 3)}
          />
        ))}
      </div>
      {isSolo && <span className="cohort-solo-flag">SOLO</span>}
    </button>
  );
}
