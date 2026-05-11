# Plan: add `lastSeenAt` to `SkillTableRow` and render "Last used" column

No schema migration needed — the data is already in `events.timestamp`.

## Semantic choice

"Last used" should mean **lifetime last activation** (so a skill last triggered 6 months ago shows "182d ago", not "—"). The current `windowed_events` CTE is time-bounded by `days`, so we need a separate lifetime aggregation.

## Backend changes

### 1. `backend/src/domain/skill.ts`

Add to `SkillTableRow`:

```ts
lastSeenAt: string | null;  // ISO timestamp of most recent skill_activated event, lifetime
```

Use ISO string, not `Date` — keeps clock math on the client and matches `SkillDetailRow.lastSeenAt`.

### 2. `backend/src/infrastructure/repositories/drizzle-skill-repository.ts` — `getSkillsTable`

Add a CTE next to `windowed_events`:

```sql
lifetime_last AS (
  SELECT
    e.attributes->>'skill.name' AS skill_name,
    MAX(e.timestamp) AS last_seen_at
  FROM events e
  WHERE e.event_name = ${EVENT_NAMES.SKILL_ACTIVATED}
    AND e.attributes->>'skill.name' IS NOT NULL
  GROUP BY 1
)
```

Then:

- `LEFT JOIN lifetime_last ll ON ll.skill_name = kp.skill_name`
- Select `ll.last_seen_at AS last_seen_at`
- Map in the TS row type and `.map(r => ...)`: `lastSeenAt: r.last_seen_at ? new Date(r.last_seen_at).toISOString() : null`

### 3. `backend/src/application/skills/get-skills-table.ts`

No change — the existing `...rest` spread will forward `lastSeenAt` automatically once the repo provides it.

### 4. Index check — `backend/src/db/schema.ts`

Verify there's an index supporting `WHERE event_name = ? AND attributes->>'skill.name' IS NOT NULL GROUP BY skill_name`. The recent `4e5dd2a Add unique index on events to dedupe Loki sync overlap` suggests events is heavily indexed; grep `idx_events_skill` to confirm. If none, the new CTE will still work (Postgres handles `MAX(timestamp) GROUP BY jsonb_field` on hundreds of thousands of rows fine), but file a follow-up TODO if scans get slow at >1M events.

### 5. Tests

- `backend/src/application/skills/get-skills-table.test.ts` — add an event with an explicit timestamp, assert `lastSeenAt` matches and that a never-used skill row has `lastSeenAt: null`.
- The four `getSkillsTable: async () => []` mocks in other tests need no change (the empty array still satisfies the type).

## Frontend changes

### 6. `frontend/src/types/api.ts`

```ts
export interface SkillTableRow {
  // …existing
  lastSeenAt: string | null;
}
```

### 7. `frontend/src/pages/SkillsTablePage.tsx`

- Add a `Last used` `<th>` between `Status` and `Trigger mix`.
- Update `colSpan` from 9 → 10 in the empty/error/no-rows rows.
- Add the corresponding `<td>` per row using a helper:

  ```ts
  function lastUsedLabel(iso: string | null): { text: string; cold: boolean } {
    if (!iso) return { text: "—", cold: true };
    const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
    if (min < 60) return { text: `${min}m ago`, cold: false };
    const h = Math.floor(min / 60);
    if (h < 24) return { text: `${h}h ago`, cold: false };
    const d = Math.floor(h / 24);
    return { text: `${d}d ago`, cold: min > 1440 };
  }
  ```

- Render with `font-mono text-[11px]`; `cold` → `text-text-4`, otherwise `text-text-3`.
- Bump `SortableHeader` to allow `"lastSeenAt"` as a sort key; extend `SortKey` and `SORT_KEYS`.

### 8. `frontend/src/pages/DashboardPage.tsx` (optional bonus)

The "Top movers" card could pick up a cold badge for dormant skills. Skip unless asked.

## Verification

- `bun run typecheck` and `bun run lint` from repo root.
- `bun test backend/src/application/skills/get-skills-table.test.ts` for the new assertion.
- Spot-check via `bun run dev`: a fresh DB with seeded events shows correct relative times; a `never_used` skill shows "—".

## Estimated diff size

~15 lines backend SQL/types, ~30 lines frontend, ~10 lines new test. One PR, no migration.

## Risks

- **None to data.** Pure SELECT change.
- **Minor perf risk** if the events table is huge and `attributes->>'skill.name'` isn't indexed — measure with `EXPLAIN ANALYZE` against prod-like data before merging. Worst case, materialize `last_seen_at` onto `plugin_skills` via a trigger, but that's a separate, larger change.
