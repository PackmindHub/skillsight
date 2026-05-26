# Graph Report - skills-sequential-usage-2c59d  (2026-05-26)

## Corpus Check
- 315 files · ~189,918 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 136 nodes · 200 edges · 6 communities (5 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5e120786`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]

## God Nodes (most connected - your core abstractions)
1. `DrizzleEventRepository` - 11 edges
2. `pad2()` - 5 edges
3. `ComboDrawer()` - 5 edges
4. `SessionTimelineBlock()` - 4 edges
5. `ComboRow()` - 4 edges
6. `CoUsageSession` - 4 edges
7. `CohortsWindow` - 3 edges
8. `IEventRepository` - 3 edges
9. `fmtClockShort()` - 3 edges
10. `fmtAgo()` - 3 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Communities (6 total, 1 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (30): AuditDiffMetadata, AuditEvent, Cohort, CohortMember, DailyTrend, MARKETPLACE_STATUSES, MarketplacePluginRow, MarketplaceProvider (+22 more)

### Community 1 - "Community 1"
Cohesion: 0.08
Nodes (22): AuditFilters, AuditResponse, CohortsResponse, CoUsageTimelineResponse, Integration, IntegrationPreviewEvent, LiveEventsResponse, LiveSkillActivatedEvent (+14 more)

### Community 2 - "Community 2"
Cohesion: 0.10
Nodes (16): Combo, ageMinutes(), ComboRow(), CoUsagePage(), DensityBar(), formatAgo(), formatNum(), PERIOD_OPTIONS (+8 more)

### Community 3 - "Community 3"
Cohesion: 0.11
Nodes (21): ComboDrawer(), ComboDrawerProps, DAYS, fmtAgo(), fmtClock(), fmtClockShort(), fmtDate(), fmtGap() (+13 more)

### Community 4 - "Community 4"
Cohesion: 0.22
Nodes (10): getSessionTimeline(), SessionTimelineEventDto, SessionTimelineResponse, CohortsWindow, DirectEventStats, IEventRepository, RecentSkillActivatedEvent, SessionSkillActivation (+2 more)

## Knowledge Gaps
- **46 isolated node(s):** `SessionTimelineEventDto`, `SessionTimelineResponse`, `DAYS`, `MONTHS`, `SessionTimelineBlockProps` (+41 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `DrizzleEventRepository` connect `Community 5` to `Community 4`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Why does `ComboDrawer()` connect `Community 3` to `Community 2`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **What connects `SessionTimelineEventDto`, `SessionTimelineResponse`, `DAYS` to the rest of the system?**
  _46 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06060606060606061 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.07692307692307693 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.10333333333333333 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.11333333333333333 - nodes in this community are weakly interconnected._