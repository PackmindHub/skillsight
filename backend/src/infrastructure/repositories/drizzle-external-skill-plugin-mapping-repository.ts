import { and, eq, notInArray, sql } from "drizzle-orm";
import type { AppDb } from "@/db/client";
import { externalSkillPluginMappings } from "@/db/schema";
import type { ExternalSkillPluginMapping } from "@/domain/external-skill-mapping";
import type {
	ExternalSkillPluginMappingUpsert,
	IExternalSkillPluginMappingRepository,
} from "@/domain/ports/external-skill-plugin-mapping-repository";

function toDomain(
	row: typeof externalSkillPluginMappings.$inferSelect,
): ExternalSkillPluginMapping {
	return {
		skillName: row.skillName,
		pluginName: row.pluginName,
		marketplaceName: row.marketplaceName,
		sourceId: row.sourceId,
		syncedAt: row.syncedAt,
	};
}

const excluded = (column: string) => sql.raw(`EXCLUDED.${column}`);

export class DrizzleExternalSkillPluginMappingRepository
	implements IExternalSkillPluginMappingRepository
{
	constructor(private readonly db: AppDb) {}

	async findAll(): Promise<ExternalSkillPluginMapping[]> {
		const rows = await this.db.select().from(externalSkillPluginMappings);
		return rows.map(toDomain);
	}

	async findByName(skillName: string): Promise<ExternalSkillPluginMapping | null> {
		const [row] = await this.db
			.select()
			.from(externalSkillPluginMappings)
			.where(eq(externalSkillPluginMappings.skillName, skillName))
			.limit(1);
		return row ? toDomain(row) : null;
	}

	async upsertMany(rows: ExternalSkillPluginMappingUpsert[]): Promise<void> {
		if (rows.length === 0) return;
		const now = new Date();
		await this.db
			.insert(externalSkillPluginMappings)
			.values(
				rows.map((r) => ({
					skillName: r.skillName,
					pluginName: r.pluginName,
					marketplaceName: r.marketplaceName,
					sourceId: r.sourceId,
					syncedAt: now,
				})),
			)
			.onConflictDoUpdate({
				target: externalSkillPluginMappings.skillName,
				set: {
					pluginName: excluded("plugin_name"),
					marketplaceName: excluded("marketplace_name"),
					sourceId: excluded("source_id"),
					syncedAt: now,
				},
			});
	}

	async deleteBySourceId(sourceId: string): Promise<void> {
		await this.db
			.delete(externalSkillPluginMappings)
			.where(eq(externalSkillPluginMappings.sourceId, sourceId));
	}

	async deleteMissingForSource(
		sourceId: string,
		presentSkillNames: string[],
	): Promise<void> {
		if (presentSkillNames.length === 0) {
			await this.deleteBySourceId(sourceId);
			return;
		}
		await this.db
			.delete(externalSkillPluginMappings)
			.where(
				and(
					eq(externalSkillPluginMappings.sourceId, sourceId),
					notInArray(externalSkillPluginMappings.skillName, presentSkillNames),
				),
			);
	}
}
