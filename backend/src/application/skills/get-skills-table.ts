import type { ISkillRepository } from "@/domain/ports/skill-repository";
import type { IMarketplaceRepository } from "@/domain/ports/marketplace-repository";
import type { MarketplaceStatus } from "@/domain/marketplace";

export async function getSkillsTable(
	deps: { skills: ISkillRepository; marketplaces: IMarketplaceRepository },
	input: { days: number },
) {
	const [rawRows, statuses] = await Promise.all([
		deps.skills.getSkillsTable(input.days),
		deps.marketplaces.listStatuses(),
	]);

	const mpStatusMap = new Map(statuses.map((m) => [m.name, m.status]));

	return rawRows.map(({ marketplaceNames, status, ...rest }) => ({
		...rest,
		status,
		marketplaces: marketplaceNames.map((name) => ({
			name,
			status: (mpStatusMap.get(name) ?? "to_review") as MarketplaceStatus,
		})),
	}));
}
