# Changelog

## 0.6.1

- Support self-hosted GitLab marketplace sources. A source now carries an explicit `provider` (`auto` / `github` / `gitlab` / `bitbucket`, selectable in the add-source form); GitLab content — both `marketplace.json` and each plugin's `skills/` listing — is fetched through the GitLab REST API ("get raw file" and repository-tree endpoints) instead of the `/-/raw/` web route, which 302-redirected `PRIVATE-TOKEN` auth to the sign-in page and 404'd private repos. The provider origin is derived from the source git URL so any GitLab host is targeted, not just `gitlab.com`; this also fixes private `gitlab.com` repositories that previously failed the same way. External-plugin token forwarding is now restricted to the same host *and* origin so a token can't leak across GitLab instances. Migration `0024` adds the `provider` column (default `auto`, preserving existing behavior).

## 0.6.0

- Promote skill identity from `(skill_name, plugin_name)` to the full tuple `(skill_name, plugin_name, marketplace_name, skill_source)`. The same plugin-less skill observed from user settings vs project settings (and per source) are now independent rows in the Skills table with independent approve/deny/ignore status, instead of silently collapsing into one. The status, bulk-status, and delete APIs carry the full key end-to-end; event deletion is scoped by `skill.source` so removing one identity no longer takes out another's events.
- Fix a runtime crash when a marketplace source declared the same skill in more than one plugin: `external_skill_plugin_mappings` keyed only on `skill_name`, so a single upsert batch carrying a skill twice failed with `ON CONFLICT DO UPDATE command cannot affect row a second time`. Its primary key is now `(skill_name, plugin_name, marketplace_name)`, letting a skill legitimately belong to several plugins. Migrations `0022` and `0023` widen the two primary keys (idempotent; existing rows are preserved).
- Surface redacted `third-party` plugins in the Plugins catalog instead of dropping them. Claude Code reports every anonymous (non-marketplace) plugin under the shared name `third-party`, carrying its real identity in `plugin_id_hash`; these are now synthesized at query time as one catalog row per hash (labeled `third-party · <hash>`) with their load and unique-loader counts and a per-hash weekly-loaders chart. The rows are read-only — they own no skills and have no stored catalog entry, so bulk-select and status editing are disabled. As before, they remain hidden until the "Show plugins without skills" toggle is on.

## 0.5.0

- Expand the Co-usage combo drawer with a per-session timeline view that renders each session's skill activations in chronological order, color-coded by skill, so the order in which skills fire within a combo is observable rather than just their co-occurrence. Backed by a new `GET /api/co-usage/sessions/:sessionId/timeline` endpoint that returns ordered `(skillName, pluginName, timestamp)` events for a given session.

## 0.4.0

- Add Packmind as a second kind of marketplace source alongside git-backed ones: instead of cloning a `marketplace.json`, Packmind sources are fed by the `@packmind/cli` binary (`packages list` / `packages show <slug>`), and each Packmind package becomes a plugin keyed by its `@space/slug`. The marketplace-source form now exposes a kind selector, Packmind rows carry a "Packmind" badge, and "Test connection" runs `packmind-cli whoami` for Packmind sources. The Docker image installs `@packmind/cli` globally so `packmind-cli` is on `PATH` out of the box.
- Add an `external_skill_plugin_mappings` table (with an in-memory cache refreshed after every Packmind sync) consulted at OTLP ingest time, so `skill_activated` events from Packmind telemetry — which don't carry `plugin.name` — retro-link to their owning plugin instead of creating orphan rows.
- Add a "Repository" link at the bottom of the sidebar pointing to the GitHub repo.
- Flip the StatusChip dropdown above its trigger when there isn't enough room below, so the status menu on the last row of the Skills table no longer gets clipped under the viewport.
- Pluralize the `Sessions` column header in the Skills table.

## 0.3.0

- Add a Co-usage page that surfaces groups of skills (pairs, triples, 4+) recurring inside the same `session_id`, with an Ignore-noise filter that re-projects sessions when omnipresent skills are excluded.
- Add a `Session` column to the Skills table (between `Users` and `Loaders`) showing the count of distinct sessions in which each skill was activated over the selected window.

## 0.2.1

- Surface the owning plugin under the skill name with a chip for `plugin:skill` entries, and strip the redundant prefix from the displayed name.
- Replace the plugin chip link with a hover menu offering two disambiguated actions: filter the Skills table by the plugin, or jump to the plugin's page.

## 0.2.0

- Track `plugin_loaded` events to surface adoption-funnel metrics (loaders vs. activations), including a weekly unique-loaders chart in the plugin drawer.
- Track plugin version history in a new `plugin_versions` table so version drift across loads is observable.
- Include `plugin_loaded` in the default Loki query (and backfill the earliest-default lookup) so existing integrations capture the new event without manual edits.
- Harden the separation between session JWTs and OTLP ingestion tokens, and gate admin-only routes accordingly.
- Speed up the Skills usage table with a `plugin_loaded` partial index, and stop refetching the Skills/Plugins tables on every window focus.
- Converge Skills, Plugins, and Marketplaces pages onto the shared design system primitives, with consistent header styling, status indicator strips, and tooltips on non-obvious columns.
- Surface stat-card explanations via a HelpTip popover on the Dashboard.
- Drop `HH:MM` from the relative-time fallback for cleaner timestamps.

## 0.1.2

- Trigger an immediate sync when a new Loki integration is saved, so users see data without waiting for the first interval tick.
- Publish a GitHub Release on every `release/x.y.z` tag, using the matching `Changelog.md` section as the release body.

## 0.1.1

- Fix deployment issues.

## 0.1.0

- First initial release.
