import type { ISkillRepository, TimeWindow } from "@/domain/ports/skill-repository";
import type { IMarketplaceRepository } from "@/domain/ports/marketplace-repository";
import type { MarketplaceStatus } from "@/domain/marketplace";
import { defaultBundledStatus } from "@/domain/skill";

export async function getSkillDetail(
	deps: { skills: ISkillRepository; marketplaces: IMarketplaceRepository },
	input: { skillName: string; window: TimeWindow },
) {
	const [raw, statuses] = await Promise.all([
		deps.skills.getSkillDetail(input.skillName, input.window),
		deps.marketplaces.listStatuses(),
	]);

	if (!raw) return null;

	const mpStatusMap = new Map(statuses.map((m) => [m.name, m.status]));
	const { marketplaceNames, status, skillSource, ...rest } = raw;

	return {
		...rest,
		skillSource,
		status: defaultBundledStatus(status, skillSource),
		marketplaces: marketplaceNames.map((name) => ({
			name,
			status: (mpStatusMap.get(name) ?? "to_review") as MarketplaceStatus,
		})),
	};
}
