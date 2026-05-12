import { useEffect, useMemo, useState } from "react";
import { MultiSelect, PageHeader, SearchBar, SegmentedControl } from "@/components/ui";
import { CohortCard } from "@/components/cohorts/CohortCard";
import { CohortDrawer } from "@/components/cohorts/CohortDrawer";
import { skillColor } from "@/components/cohorts/skill-color";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Cohort, CohortsResponse, DashboardPeriod } from "@/types/api";

type SortKey = "users" | "acts" | "recent" | "size";
type GroupBy = "none" | "anchor";

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: "users", label: "By users" },
  { value: "acts", label: "By activations" },
  { value: "recent", label: "By recency" },
  { value: "size", label: "By skill count" },
];

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
  const [sort, setSort] = useState<SortKey>("users");
  const [selected, setSelected] = useState<Cohort | null>(null);

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

  const soloCount = useMemo(
    () => cohorts.filter((c) => c.skills.length >= minSkills && c.users.length === 1).length,
    [cohorts, minSkills],
  );

  const skillOptions = useMemo(() => {
    const set = new Set<string>();
    for (const c of cohorts) for (const s of c.skills) set.add(s);
    return [...set]
      .sort((a, b) => a.localeCompare(b))
      .map((s) => ({ value: s, label: s }));
  }, [cohorts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const skillSet = skillFilter.length > 0 ? new Set(skillFilter) : null;
    return cohorts.filter((c) => {
      if (c.skills.length < minSkills) return false;
      if (hideSolo && c.users.length < 2) return false;
      if (skillSet && !c.skills.some((s) => skillSet.has(s))) return false;
      if (q) {
        const skillHit = c.skills.some((s) => s.toLowerCase().includes(q));
        const userHit = c.users.some((u) => u.email.toLowerCase().includes(q));
        if (!skillHit && !userHit) return false;
      }
      return true;
    });
  }, [cohorts, minSkills, hideSolo, search, skillFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sort) {
      case "users":
        arr.sort((a, b) => b.users.length - a.users.length || b.activations - a.activations);
        break;
      case "acts":
        arr.sort((a, b) => b.activations - a.activations);
        break;
      case "recent":
        arr.sort(
          (a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime(),
        );
        break;
      case "size":
        arr.sort((a, b) => b.skills.length - a.skills.length);
        break;
    }
    return arr;
  }, [filtered, sort]);

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

        <div className="cohort-seg">
          {SORT_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              className={cn(sort === o.value && "on")}
              onClick={() => setSort(o.value)}
            >
              {o.label}
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
          {sorted.length} of {cohorts.length} cohorts
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
