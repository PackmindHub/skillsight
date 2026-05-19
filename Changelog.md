# Changelog

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
