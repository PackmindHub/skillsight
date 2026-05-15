import { StatCard } from "@/components/ui";

export interface PluginStatStripProps {
	total: number;
	adopted: number;
	activated: number;
	shelfware: number;
	approvedMp: number;
	stale: number;
	adoptedOnly: boolean;
	onToggleAdopted: () => void;
	activatedOnly: boolean;
	onToggleActivated: () => void;
	shelfwareOnly: boolean;
	onToggleShelfware: () => void;
	approvedMpOnly: boolean;
	onToggleApprovedMp: () => void;
	staleOnly: boolean;
	onToggleStale: () => void;
}

export function PluginStatStrip({
	total,
	adopted,
	activated,
	shelfware,
	approvedMp,
	stale,
	adoptedOnly,
	onToggleAdopted,
	activatedOnly,
	onToggleActivated,
	shelfwareOnly,
	onToggleShelfware,
	approvedMpOnly,
	onToggleApprovedMp,
	staleOnly,
	onToggleStale,
}: PluginStatStripProps) {
	return (
		<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
			<StatCard
				tone="active"
				label="Adopted"
				value={adopted}
				total={total}
				active={adoptedOnly}
				onToggle={onToggleAdopted}
				title="Plugins loaded by at least one user (uniqueLoaderCount > 0). Adoption signal — independent of whether any skill from the plugin was activated. Click to filter."
			/>
			<StatCard
				tone="approved"
				label="Activated"
				value={activated}
				total={total}
				active={activatedOnly}
				onToggle={onToggleActivated}
				title="Plugins where at least one skill has been activated (skillActivationCount > 0). The gap between Adopted and Activated reveals plugins users install but never actually use. Click to filter."
			/>
			<StatCard
				tone="danger"
				label="Loaders without activations"
				value={shelfware}
				total={total}
				active={shelfwareOnly}
				onToggle={onToggleShelfware}
				title="Plugins loaded by users yet no shipped skill has fired — shelfware candidates. Strong cleanup or onboarding signal. Click to filter."
			/>
			<StatCard
				tone="linked"
				label="From approved marketplace"
				value={approvedMp}
				total={total}
				active={approvedMpOnly}
				onToggle={onToggleApprovedMp}
				title="Plugins whose owning marketplace is currently marked approved. Coverage of your governance posture. Click to filter."
			/>
			<StatCard
				tone="orphan"
				label="Stale"
				value={stale}
				total={total}
				active={staleOnly}
				onToggle={onToggleStale}
				title="Plugins that ship at least one skill but have had no skill activations in the last 30 days. Click to filter."
			/>
		</div>
	);
}
