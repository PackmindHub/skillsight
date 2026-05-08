import type { DaysWindow, ISkillRepository } from "@/domain/ports/skill-repository";
import type { IMarketplaceRepository } from "@/domain/ports/marketplace-repository";
import type { MarketplaceStatus } from "@/domain/marketplace";

export async function getSkillDetail(
	deps: { skills: ISkillRepository; marketplaces: IMarketplaceRepository },
	input: { skillName: string; days: DaysWindow },
) {
	const [raw, statuses] = await Promise.all([
		deps.skills.getSkillDetail(input.skillName, input.days),
		deps.marketplaces.listStatuses(),
	]);

	if (!raw) return null;

	const mpStatusMap = new Map(statuses.map((m) => [m.name, m.status]));
	const { marketplaceNames, ...rest } = raw;

	return {
		...rest,
		marketplaces: marketplaceNames.map((name) => ({
			name,
			status: (mpStatusMap.get(name) ?? "to_review") as MarketplaceStatus,
		})),
	};
}
