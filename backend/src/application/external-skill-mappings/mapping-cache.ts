import type { IExternalSkillPluginMappingRepository } from "@/domain/ports/external-skill-plugin-mapping-repository";

export interface MappingHit {
	pluginName: string;
	marketplaceName: string;
}

// Small in-memory cache of skill_name -> (pluginName, marketplaceName) used at
// OTLP ingest time to retro-link skills whose events don't carry plugin.name
// (currently: Packmind-managed skills). The cache is fully reloaded after every
// successful Packmind sync; lookups during ingest are O(1) and synchronous.
export class ExternalSkillMappingCache {
	private map = new Map<string, MappingHit>();
	private loaded = false;

	constructor(private readonly repo: IExternalSkillPluginMappingRepository) {}

	async load(): Promise<void> {
		const rows = await this.repo.findAll();
		const next = new Map<string, MappingHit>();
		for (const r of rows) {
			next.set(r.skillName, {
				pluginName: r.pluginName,
				marketplaceName: r.marketplaceName,
			});
		}
		this.map = next;
		this.loaded = true;
	}

	async refresh(): Promise<void> {
		await this.load();
	}

	lookup(skillName: string): MappingHit | undefined {
		return this.map.get(skillName);
	}

	size(): number {
		return this.map.size;
	}

	isLoaded(): boolean {
		return this.loaded;
	}
}
