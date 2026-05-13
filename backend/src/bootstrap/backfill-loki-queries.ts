import { inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { integrations } from "@/db/schema";
import { DEFAULT_LOKI_QUERY, PREVIOUS_DEFAULT_LOKI_QUERIES } from "@/domain/event";

// One-shot startup migration: integrations created before we started ingesting
// `plugin_loaded` events have the old default query string baked into their
// `lokiQuery` column. A plain default change wouldn't update them. Rewrite only
// rows that still hold a known previous default; user-customized queries are
// untouched.
export async function backfillLokiQueries(): Promise<void> {
	const stale = PREVIOUS_DEFAULT_LOKI_QUERIES.filter((q) => q !== DEFAULT_LOKI_QUERY);
	if (stale.length === 0) return;

	const updated = await db
		.update(integrations)
		.set({ lokiQuery: DEFAULT_LOKI_QUERY, updatedAt: new Date() })
		.where(inArray(integrations.lokiQuery, stale as unknown as string[]))
		.returning({ id: integrations.id });

	if (updated.length > 0) {
		console.log(
			`[bootstrap] Backfilled lokiQuery on ${updated.length} integration(s) to include plugin_loaded.`,
		);
	}
}
