import { Drawer } from "@/components/ui";
import type { Cohort } from "@/types/api";
import { CohortKnot } from "./CohortKnot";
import { initialsOf } from "./initials";
import { formatNum, formatRelative } from "./format";
import { skillColor } from "./skill-color";

interface CohortDrawerProps {
  cohort: Cohort | null;
  onClose: () => void;
}

export function CohortDrawer({ cohort, onClose }: CohortDrawerProps) {
  if (!cohort) return null;

  const skillTotals = cohort.skills
    .map((skill) => {
      let total = 0;
      for (const user of cohort.users) total += user.perSkill[skill] ?? 0;
      return { skill, total };
    })
    .sort((a, b) => b.total - a.total);
  const maxSkill = Math.max(1, ...skillTotals.map((s) => s.total));

  const members = [...cohort.users].sort((a, b) => b.totalActivations - a.totalActivations);
  const headline =
    cohort.skills.slice(0, 3).join(" + ") +
    (cohort.skills.length > 3 ? ` +${cohort.skills.length - 3}` : "");

  return (
    <Drawer open onClose={onClose} title={`Cohort · ${headline}`}>
      <div className="flex items-center gap-3 pb-3">
        <CohortKnot skills={cohort.skills} size={48} />
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-4">
            COHORT · {cohort.skills.length} SKILLS · {cohort.users.length}{" "}
            {cohort.users.length === 1 ? "USER" : "USERS"}
          </div>
          <div className="mt-1 truncate font-mono text-[13px] text-text-1">{headline}</div>
        </div>
      </div>

      <section className="cohort-drawer-stats">
        <div>
          <div className="lab">Activations</div>
          <div className="val">{formatNum(cohort.activations)}</div>
        </div>
        <div>
          <div className="lab">Skills</div>
          <div className="val">{cohort.skills.length}</div>
        </div>
        <div>
          <div className="lab">Users</div>
          <div className="val">{cohort.users.length}</div>
        </div>
        <div>
          <div className="lab">Last active</div>
          <div className="val text-base">{formatRelative(cohort.lastActiveAt)}</div>
        </div>
      </section>

      <section className="cohort-drawer-section">
        <h3 className="cohort-drawer-h3">Skills in this cohort</h3>
        <div>
          {skillTotals.map((s) => (
            <div key={s.skill} className="cohort-drawer-skill">
              <span
                className="cohort-drawer-skill-dot"
                style={{ background: skillColor(s.skill) }}
              />
              <span className="cohort-drawer-skill-name">{s.skill}</span>
              <span className="cohort-drawer-skill-bar">
                <span
                  className="cohort-drawer-skill-fill"
                  style={{
                    width: `${(s.total / maxSkill) * 100}%`,
                    background: skillColor(s.skill, 0.7),
                  }}
                />
              </span>
              <span className="cohort-drawer-skill-n">{formatNum(s.total)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="cohort-drawer-section">
        <h3 className="cohort-drawer-h3">Members</h3>
        <div>
          {members.map((u) => (
            <div key={u.email} className="cohort-drawer-user">
              <span className="cohort-drawer-uav">{initialsOf(u.email)}</span>
              <span className="cohort-drawer-uinfo">
                <span className="email">{u.email}</span>
                <span className="role">last active {formatRelative(u.lastActiveAt)}</span>
              </span>
              <span className="cohort-drawer-uacts">{formatNum(u.totalActivations)}</span>
            </div>
          ))}
        </div>
      </section>
    </Drawer>
  );
}
