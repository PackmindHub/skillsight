import { StatCard } from "@/components/ui";

export interface SkillStatStripProps {
	total: number;
	linked: number;
	orphan: number;
	inApproved: number;
	activeInWindow: number;
	soloUser: number;
	pluginLink: "all" | "linked" | "orphan";
	onTogglePluginLink: (next: "all" | "linked" | "orphan") => void;
	approvedOnly: boolean;
	onToggleApproved: () => void;
	activeOnly: boolean;
	onToggleActive: () => void;
	soloOnly: boolean;
	onToggleSolo: () => void;
}

export function SkillStatStrip({
	total,
	linked,
	orphan,
	inApproved,
	activeInWindow,
	soloUser,
	pluginLink,
	onTogglePluginLink,
	approvedOnly,
	onToggleApproved,
	activeOnly,
	onToggleActive,
	soloOnly,
	onToggleSolo,
}: SkillStatStripProps) {
	return (
		<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
			<StatCard
				tone="active"
				label="Active in window"
				value={activeInWindow}
				total={total}
				active={activeOnly}
				onToggle={onToggleActive}
				title="Skills that fired at least once during the selected period. Click to filter the table to those skills."
			/>
			<StatCard
				tone="linked"
				label="Linked to plugin"
				value={linked}
				total={total}
				active={pluginLink === "linked"}
				onToggle={() => onTogglePluginLink(pluginLink === "linked" ? "all" : "linked")}
				title="Skills that ship as part of a plugin (vs. ad-hoc / user-uploaded skills loaded outside any plugin). Click to filter."
			/>
			<StatCard
				tone="orphan"
				label="Not in plugin"
				value={orphan}
				total={total}
				active={pluginLink === "orphan"}
				onToggle={() => onTogglePluginLink(pluginLink === "orphan" ? "all" : "orphan")}
				title="Skills loaded outside any plugin — typically user-uploaded or ad-hoc skills. Click to filter."
			/>
			<StatCard
				tone="approved"
				label="In approved marketplaces"
				value={inApproved}
				total={total}
				active={approvedOnly}
				onToggle={onToggleApproved}
				title="Skills reachable through at least one marketplace currently marked approved. Click to filter."
			/>
			<StatCard
				tone="warning"
				label="Solo-user skills"
				value={soloUser}
				total={total}
				active={soloOnly}
				onToggle={onToggleSolo}
				title="Skills that have been activated by exactly one user. Often candidates for evangelism or cleanup. Click to filter."
			/>
		</div>
	);
}
