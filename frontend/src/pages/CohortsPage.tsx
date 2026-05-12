import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MultiSelect, PageHeader, SearchBar, SegmentedControl } from "@/components/ui";
import { CohortCard } from "@/components/cohorts/CohortCard";
import { CohortDrawer } from "@/components/cohorts/CohortDrawer";
import { skillColor } from "@/components/cohorts/skill-color";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Cohort, CohortMember, CohortsResponse, DashboardPeriod } from "@/types/api";

type GroupBy = "none" | "anchor";

const PERIOD_OPTIONS: Array<{ value: DashboardPeriod; label: string }> = [
  { value: 30, label: "30d" },
  { value: 90, label: "90d" },
  { value: "all", label: "All" },
];

const MIN_SKILLS_OPTIONS = [1, 2, 3, 4, 5, 6] as const;

export default function CohortsPage() {
  const [period, setPeriod] = useState<DashboardPeriod>("all");
  const [data, setData] = useState<CohortsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [skillFilter, setSkillFilter] = useState<string[]>([]);
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [hideSolo, setHideSolo] = useState(false);
  const [minSkills, setMinSkills] = useState<number>(2);
  const [selected, setSelected] = useState<Cohort | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();

  // biome-ignore lint/correctness/useExhaustiveDependencies: seed once on mount; subsequent skillFilter edits are owned by component state.
  useEffect(() => {
    const raw = searchParams.get("skills");
    if (!raw) return;
    const names = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (names.length === 0) return;
    setSkillFilter(names);
    const next = new URLSearchParams(searchParams);
    next.delete("skills");
    setSearchParams(next, { replace: true });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.cohorts
      .list(period)
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period]);

  const cohorts = data?.cohorts ?? [];

  const skillOptions = useMemo(() => {
    const set = new Set<string>();
    for (const c of cohorts) for (const s of c.skills) set.add(s);
    return [...set]
      .sort((a, b) => a.localeCompare(b))
      .map((s) => ({ value: s, label: s }));
  }, [cohorts]);

  // When the user picks skills in the filter, re-cluster users so each cohort's
  // skill set is exactly the subset they activated within the selected universe.
  const projected = useMemo<Cohort[] | null>(() => {
    if (skillFilter.length === 0) return null;
    const selected = new Set(skillFilter);
    const groups = new Map<string, { skills: string[]; users: CohortMember[] }>();
    for (const c of cohorts) {
      for (const u of c.users) {
        const present = Object.keys(u.perSkill)
          .filter((s) => selected.has(s))
          .sort();
        if (present.length === 0) continue;
        const sig = present.join("|");
        const bucket = groups.get(sig);
        if (bucket) bucket.users.push(u);
        else groups.set(sig, { skills: present, users: [u] });
      }
    }
    let i = 1;
    return [...groups.values()].map(({ skills, users }) => {
      const activations = users.reduce(
        (sum, u) => sum + skills.reduce((s, k) => s + (u.perSkill[k] ?? 0), 0),
        0,
      );
      const lastActiveAt = users.reduce(
        (max, u) => (new Date(u.lastActiveAt).getTime() > new Date(max).getTime() ? u.lastActiveAt : max),
        users[0]!.lastActiveAt,
      );
      return { id: `proj-${i++}`, skills, users, activations, lastActiveAt };
    });
  }, [cohorts, skillFilter]);

  const baseCohorts = projected ?? cohorts;
  const effectiveMinSkills = projected ? Math.min(minSkills, skillFilter.length) : minSkills;

  const soloCount = useMemo(
    () =>
      baseCohorts.filter(
        (c) => c.skills.length >= effectiveMinSkills && c.users.length === 1,
      ).length,
    [baseCohorts, effectiveMinSkills],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return baseCohorts.filter((c) => {
      if (c.skills.length < effectiveMinSkills) return false;
      if (hideSolo && c.users.length < 2) return false;
      if (q) {
        const skillHit = c.skills.some((s) => s.toLowerCase().includes(q));
        const userHit = c.users.some((u) => u.email.toLowerCase().includes(q));
        if (!skillHit && !userHit) return false;
      }
      return true;
    });
  }, [baseCohorts, effectiveMinSkills, hideSolo, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort(
      (a, b) => b.users.length - a.users.length || b.activations - a.activations,
    );
  }, [filtered]);

  const grouped = useMemo(() => {
    if (groupBy !== "anchor") return null;
    const skillFreq = new Map<string, number>();
    for (const c of sorted) {
      for (const s of c.skills) {
        skillFreq.set(s, (skillFreq.get(s) ?? 0) + c.users.length);
      }
    }
    const groups = new Map<string, Cohort[]>();
    for (const c of sorted) {
      const anchor =
        [...c.skills].sort((a, b) => (skillFreq.get(b) ?? 0) - (skillFreq.get(a) ?? 0))[0] ??
        c.skills[0]!;
      const list = groups.get(anchor);
      if (list) list.push(c);
      else groups.set(anchor, [c]);
    }
    return [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [sorted, groupBy]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Cohorts"
        subtitle={
          <>
            Clusters of users that activate the same set of skills together
            {data && (
              <>
                {" "}
                · <span className="font-mono text-text-1">{data.totalUsers}</span>{" "}
                {data.totalUsers === 1 ? "user" : "users"} ·{" "}
                <span className="font-mono text-text-1">{data.totalSkills}</span>{" "}
                {data.totalSkills === 1 ? "skill" : "skills"}
              </>
            )}
            .
          </>
        }
        actions={
          <SegmentedControl<DashboardPeriod>
            value={period}
            onChange={setPeriod}
            options={PERIOD_OPTIONS}
          />
        }
      />

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="cohort-toolbar">
        <div className="max-w-[360px] flex-1">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search skill or user…"
          />
        </div>

        <MultiSelect
          label="Skills"
          options={skillOptions}
          values={skillFilter}
          onChange={setSkillFilter}
        />

        <div className="cohort-seg">
          <button
            type="button"
            className={cn(groupBy === "none" && "on")}
            onClick={() => setGroupBy("none")}
          >
            Flat
          </button>
          <button
            type="button"
            className={cn(groupBy === "anchor" && "on")}
            onClick={() => setGroupBy("anchor")}
          >
            Grouped
          </button>
        </div>

        <div className="cohort-seg" aria-label="Minimum skills">
          {MIN_SKILLS_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              className={cn(minSkills === n && "on")}
              onClick={() => setMinSkills(n)}
              title={`Min ${n} skills`}
            >
              ≥{n}
            </button>
          ))}
        </div>

        <button
          type="button"
          className={cn("cohort-solo-toggle", hideSolo && "on")}
          onClick={() => setHideSolo((v) => !v)}
        >
          <span className="cohort-solo-tick">{hideSolo ? "✓" : "○"}</span>
          <span>Hide solo</span>
          <span className="cohort-solo-n">{soloCount}</span>
        </button>

        <div className="cohort-results-meta">
          {sorted.length} of {baseCohorts.length} cohorts
        </div>
      </div>

      {loading ? (
        <div className="cohort-empty">Loading cohorts…</div>
      ) : sorted.length === 0 ? (
        <div className="cohort-empty">
          {cohorts.length === 0
            ? "No skill activations with a known user yet."
            : "No cohorts match the current filters."}
        </div>
      ) : grouped ? (
        <div className="cohort-groups">
          {(() => {
            let globalIdx = 0;
            return grouped.map(([anchor, list]) => (
              <section key={anchor}>
                <header className="cohort-group-head">
                  <span className="cohort-group-anchor">
                    <span
                      className="cohort-group-dot"
                      style={{ background: skillColor(anchor) }}
                    />
                    <span className="cohort-group-skill">{anchor}</span>
                  </span>
                  <span className="cohort-group-meta">
                    {list.length} cohort{list.length === 1 ? "" : "s"} ·{" "}
                    {list.reduce((s, c) => s + c.users.length, 0)} users
                  </span>
                </header>
                <div className="cohort-grid">
                  {list.map((c) => (
                    <CohortCard
                      key={c.id}
                      cohort={c}
                      idx={globalIdx++}
                      onSelect={setSelected}
                      highlightSkill={anchor}
                    />
                  ))}
                </div>
              </section>
            ));
          })()}
        </div>
      ) : (
        <div className="cohort-grid">
          {sorted.map((c, i) => (
            <CohortCard key={c.id} cohort={c} idx={i} onSelect={setSelected} />
          ))}
        </div>
      )}

      <CohortDrawer cohort={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
