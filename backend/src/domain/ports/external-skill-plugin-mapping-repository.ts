import type { ExternalSkillPluginMapping } from "@/domain/external-skill-mapping";

export interface ExternalSkillPluginMappingUpsert {
	skillName: string;
	pluginName: string;
	marketplaceName: string;
	sourceId: string;
}

export interface IExternalSkillPluginMappingRepository {
	findAll(): Promise<ExternalSkillPluginMapping[]>;
	findByName(skillName: string): Promise<ExternalSkillPluginMapping | null>;
	upsertMany(rows: ExternalSkillPluginMappingUpsert[]): Promise<void>;
	deleteBySourceId(sourceId: string): Promise<void>;
	deleteMissingForSource(sourceId: string, presentSkillNames: string[]): Promise<void>;
}
