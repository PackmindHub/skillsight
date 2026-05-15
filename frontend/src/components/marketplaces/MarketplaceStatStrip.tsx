import { StatCard } from "@/components/ui";

export interface MarketplaceStatStripProps {
	total: number;
	approved: number;
	yielding: number;
	yieldedSkills: number;
	knownSkills: number;
	recentlyAdded: number;
	approvedOnly: boolean;
	onToggleApproved: () => void;
	yieldingOnly: boolean;
	onToggleYielding: () => void;
	recentOnly: boolean;
	onToggleRecent: () => void;
}

export function MarketplaceStatStrip({
	total,
	approved,
	yielding,
	yieldedSkills,
	knownSkills,
	recentlyAdded,
	approvedOnly,
	onToggleApproved,
	yieldingOnly,
	onToggleYielding,
	recentOnly,
	onToggleRecent,
}: MarketplaceStatStripProps) {
	return (
		<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
			<StatCard
				tone="approved"
				label="Approved"
				value={approved}
				total={total}
				active={approvedOnly}
				onToggle={onToggleApproved}
				title="Marketplaces currently marked approved. Click to filter the table to only approved marketplaces."
			/>
			<StatCard
				tone="active"
				label="Yielding marketplaces"
				value={yielding}
				total={total}
				active={yieldingOnly}
				onToggle={onToggleYielding}
				title="Marketplaces with at least one skill activated. Distinguishes catalog presence from real value. Click to filter."
			/>
			<StatCard
				tone="linked"
				label="Yield ratio"
				value={yieldedSkills}
				total={knownSkills}
				title="Across all marketplaces, how many catalogued skills have ever been activated. Single headline number for the catalog's effective coverage — not clickable."
			/>
			<StatCard
				tone="warning"
				label="Recently added"
				value={recentlyAdded}
				total={total}
				active={recentOnly}
				onToggle={onToggleRecent}
				title="Marketplaces first seen in the last 7 days. Awareness signal for governance — new sources to review. Click to filter."
			/>
		</div>
	);
}
