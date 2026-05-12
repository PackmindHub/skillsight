import type { ISkillRepository, TimeWindow } from "@/domain/ports/skill-repository";
import type { IMarketplaceRepository } from "@/domain/ports/marketplace-repository";
import type { MarketplaceStatus } from "@/domain/marketplace";
import { defaultBundledStatus } from "@/domain/skill";

export async function getSkillsTable(
	deps: { skills: ISkillRepository; marketplaces: IMarketplaceRepository },
	input: { window: TimeWindow; includeIgnored?: boolean },
) {
	const [rawRows, statuses] = await Promise.all([
		deps.skills.getSkillsTable(input.window, input.includeIgnored ?? false),
		deps.marketplaces.listStatuses(),
	]);

	const mpStatusMap = new Map(statuses.map((m) => [m.name, m.status]));

	return rawRows.map(({ marketplaceNames, status, skillSource, ...rest }) => ({
		...rest,
		skillSource,
		status: defaultBundledStatus(status, skillSource),
		marketplaces: marketplaceNames.map((name) => ({
			name,
			status: (mpStatusMap.get(name) ?? "to_review") as MarketplaceStatus,
		})),
	}));
}
