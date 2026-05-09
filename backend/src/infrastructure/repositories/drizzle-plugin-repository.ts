import { and, eq, notInArray, sql } from "drizzle-orm";
import type { AppDb } from "@/db/client";
import { plugins } from "@/db/schema";
import type { IPluginRepository } from "@/domain/ports/plugin-repository";
import type { NewPlugin, PluginStatus, PluginWithStats } from "@/domain/plugin";

export class DrizzlePluginRepository implements IPluginRepository {
	constructor(private readonly db: AppDb) {}

	async listWithStats(): Promise<PluginWithStats[]> {
		const rows = await this.db.execute(sql`
			SELECT
			  p.plugin_name             AS "pluginName",
			  p.marketplace_name        AS "marketplaceName",
			  p.plugin_version          AS "pluginVersion",
			  p.install_trigger         AS "installTrigger",
			  p.marketplace_is_official AS "marketplaceIsOfficial",
			  p.status,
			  p.first_seen_at           AS "firstSeenAt",
			  p.last_seen_at            AS "lastSeenAt",
			  COALESCE(s.install_count, 0)::int AS "installationCount",
			  COALESCE(s.unique_users, 0)::int  AS "uniqueUserCount",
			  COALESCE(ps.skill_count, 0)::int  AS "skillCount"
			FROM plugins p
			LEFT JOIN (
			  SELECT
			    attributes->>'plugin.name'      AS plugin_name,
			    COUNT(*)::int                   AS install_count,
			    COUNT(DISTINCT user_email)::int AS unique_users
			  FROM events
			  WHERE event_name = 'claude_code.plugin_installed'
			    AND attributes->>'plugin.name' IS NOT NULL
			  GROUP BY attributes->>'plugin.name'
			) s ON s.plugin_name = p.plugin_name
			LEFT JOIN (
			  SELECT plugin_name, COUNT(*)::int AS skill_count
			  FROM plugin_skills
			  GROUP BY plugin_name
			) ps ON ps.plugin_name = p.plugin_name
			ORDER BY s.install_count DESC NULLS LAST, p.plugin_name
		`);
		return rows as unknown as PluginWithStats[];
	}

	async upsert(plugin: NewPlugin): Promise<void> {
		const now = new Date();
		await this.db
			.insert(plugins)
			.values({
				pluginName: plugin.pluginName,
				marketplaceName: plugin.marketplaceName,
				pluginVersion: plugin.pluginVersion,
				installTrigger: plugin.installTrigger,
				marketplaceIsOfficial: plugin.marketplaceIsOfficial,
				status: plugin.status,
				firstSeenAt: now,
				lastSeenAt: now,
			})
			.onConflictDoUpdate({
				target: plugins.pluginName,
				set: {
					marketplaceName: plugin.marketplaceName,
					pluginVersion: plugin.pluginVersion,
					installTrigger: plugin.installTrigger,
					marketplaceIsOfficial: plugin.marketplaceIsOfficial,
					status: plugin.status,
					lastSeenAt: now,
				},
			});
	}

	async updateStatusByMarketplace(marketplaceName: string, status: PluginStatus): Promise<void> {
		await this.db
			.update(plugins)
			.set({ status })
			.where(eq(plugins.marketplaceName, marketplaceName));
	}

	async markRemovedByMarketplace(
		marketplaceName: string,
		activePluginNames: string[],
	): Promise<string[]> {
		const where =
			activePluginNames.length === 0
				? and(eq(plugins.marketplaceName, marketplaceName))
				: and(
						eq(plugins.marketplaceName, marketplaceName),
						notInArray(plugins.pluginName, activePluginNames),
					);
		const updated = await this.db
			.update(plugins)
			.set({ status: "removed" })
			.where(where)
			.returning({ pluginName: plugins.pluginName });
		return updated.map((row) => row.pluginName);
	}

	async listNamesByMarketplace(marketplaceName: string): Promise<string[]> {
		const rows = await this.db
			.select({ pluginName: plugins.pluginName })
			.from(plugins)
			.where(eq(plugins.marketplaceName, marketplaceName));
		return rows.map((r) => r.pluginName);
	}
}
