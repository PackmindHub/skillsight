# Changelog

## Unreleased

- Track `plugin_loaded` events to surface adoption-funnel metrics (loaders vs. activations), including a weekly unique-loaders chart in the plugin drawer.
- Track plugin version history in a new `plugin_versions` table so version drift across loads is observable.
- Include `plugin_loaded` in the default Loki query (and backfill the earliest-default lookup) so existing integrations capture the new event without manual edits.
- Harden the separation between session JWTs and OTLP ingestion tokens, and gate admin-only routes accordingly.
- Speed up the Skills usage table with a `plugin_loaded` partial index, and stop refetching the Skills/Plugins tables on every window focus.
- Converge Skills, Plugins, and Marketplaces pages onto the shared design system primitives, with consistent header styling, status indicator strips, and tooltips on non-obvious columns.
- Drop `HH:MM` from the relative-time fallback for cleaner timestamps.

## 0.1.2

- Trigger an immediate sync when a new Loki integration is saved, so users see data without waiting for the first interval tick.
- Publish a GitHub Release on every `release/x.y.z` tag, using the matching `Changelog.md` section as the release body.

## 0.1.1

- Fix deployment issues.

## 0.1.0

- First initial release.
