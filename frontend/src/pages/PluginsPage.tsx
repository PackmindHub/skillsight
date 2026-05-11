import { PluginSkillsDrawer } from "@/components/plugins/PluginSkillsDrawer";
import {
	Card,
	EmptyRow,
	Input,
	PageHeader,
	Select,
	StatusBadge,
	StatusFilter,
	TBody,
	TD,
	TH,
	THead,
	TR,
	Table,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useStatusFilter } from "@/lib/use-status-filter";
import { PLUGIN_STATUSES, type Plugin, type PluginStatus } from "@/types/api";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

type MarketplaceAssociation = "all" | "with" | "without";
const MARKETPLACE_ASSOCIATIONS: readonly MarketplaceAssociation[] = ["all", "with", "without"] as const;

function isMarketplaceAssociation(v: string | null): v is MarketplaceAssociation {
	return v === "all" || v === "with" || v === "without";
}

const ASSOC_LABELS: Record<MarketplaceAssociation, string> = {
	all: "All",
	with: "With marketplace",
	without: "Without marketplace",
};

const STATUS_OPTIONS: { value: PluginStatus; label: string }[] = [
	{ value: "unknown", label: "Unknown" },
	{ value: "to_review", label: "To Review" },
	{ value: "approved", label: "Approved" },
	{ value: "removed", label: "Removed" },
];

export default function PluginsPage() {
	const [items, setItems] = useState<Plugin[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [searchParams, setSearchParams] = useSearchParams();
	const { status: statusFilter, setStatus } = useStatusFilter<PluginStatus>(
		"status",
		PLUGIN_STATUSES,
	);
	const [selectedPlugin, setSelectedPlugin] = useState<string | null>(null);

	const search = searchParams.get("search") ?? "";
	const highlightName = searchParams.get("name") ?? "";
	const marketplaceFilter = searchParams.get("marketplace") ?? "";
	const mpAssocParam = searchParams.get("mpAssoc");
	const mpAssoc: MarketplaceAssociation = isMarketplaceAssociation(mpAssocParam) ? mpAssocParam : "all";
	const highlightedRowRef = useRef<HTMLTableRowElement | null>(null);

	function updateSearch(value: string) {
		setSearchParams(
			(prev) => {
				const next = new URLSearchParams(prev);
				if (!value) next.delete("search");
				else next.set("search", value);
				return next;
			},
			{ replace: true },
		);
	}

	function updateMpAssoc(value: MarketplaceAssociation) {
		setSearchParams(
			(prev) => {
				const next = new URLSearchParams(prev);
				if (value === "all") next.delete("mpAssoc");
				else next.set("mpAssoc", value);
				return next;
			},
			{ replace: true },
		);
	}

	function clearParam(key: string) {
		setSearchParams(
			(prev) => {
				const next = new URLSearchParams(prev);
				next.delete(key);
				return next;
			},
			{ replace: true },
		);
	}

	useEffect(() => {
		api.plugins
			.list()
			.then((res) => setItems(res.plugins))
			.catch((e) => setError(String(e)))
			.finally(() => setLoading(false));
	}, []);

	async function handleStatusChange(pluginName: string, status: PluginStatus) {
		setItems((prev) =>
			prev.map((p) => (p.pluginName === pluginName ? { ...p, status } : p)),
		);
		try {
			await api.plugins.update(pluginName, { status });
		} catch {
			api.plugins
				.list()
				.then((res) => setItems(res.plugins))
				.catch(() => {});
		}
	}

	const filteredItems = useMemo(() => {
		return items.filter((p) => {
			if (statusFilter !== "all" && (p.status ?? "unknown") !== statusFilter) return false;
			if (marketplaceFilter && p.marketplaceName !== marketplaceFilter) return false;
			if (mpAssoc === "with" && !p.marketplaceName) return false;
			if (mpAssoc === "without" && p.marketplaceName) return false;
			if (search && !p.pluginName.toLowerCase().includes(search.toLowerCase())) return false;
			return true;
		});
	}, [items, statusFilter, search, marketplaceFilter, mpAssoc]);

	useLayoutEffect(() => {
		if (!highlightName || loading) return;
		const node = highlightedRowRef.current;
		if (node) node.scrollIntoView({ block: "center", behavior: "smooth" });
	}, [highlightName, loading]);

	if (loading) return <p className="text-text-3 text-sm">Loading…</p>;

	return (
		<div className="space-y-4">
			<PageHeader
				title="Plugins"
				subtitle="Plugins discovered from installation events. Status reflects the approval state of the associated marketplace."
			/>

			{error && <p className="text-sm text-danger">{error}</p>}

			{items.length === 0 ? (
				<Card padding="lg" className="flex flex-col items-center gap-3 text-center py-12">
					<div className="w-12 h-12 rounded-full bg-surface-800 border border-edge flex items-center justify-center">
						<svg className="w-6 h-6 text-text-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} role="img" aria-label="No plugins">
							<path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 0 1-.657.643 48.39 48.39 0 0 1-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 0 1-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 0 0-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 0 1-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 0 0 .657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 0 1-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.401.604-.401.959v0c0 .333.277.599.61.58a48.1 48.1 0 0 0 5.427-.63 48.05 48.05 0 0 0 .582-4.717.532.532 0 0 0-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.036 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.369 0 .713.128 1.003.349.283.215.604.401.959.401v0a.656.656 0 0 0 .658-.663 48.422 48.422 0 0 0-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 0 1-.61-.58v0Z" />
						</svg>
					</div>
					<div>
						<p className="text-sm font-medium text-text-2">No plugins discovered yet</p>
						<p className="text-xs text-text-4 mt-1">
							Plugins appear automatically when{" "}
							<code className="font-mono bg-surface-800 px-1 py-0.5 rounded text-text-3">
								plugin_installed
							</code>{" "}
							events are received.
						</p>
					</div>
				</Card>
			) : (
				<>
					<div className="flex flex-wrap items-center gap-2">
						<Input
							size="sm"
							placeholder="Search plugin name…"
							value={search}
							onChange={(e) => updateSearch(e.target.value)}
							className="min-w-48"
						/>
						<StatusFilter<PluginStatus>
							value={statusFilter}
							onChange={setStatus}
							options={PLUGIN_STATUSES}
						/>
						<Select
							size="sm"
							aria-label="Filter by marketplace association"
							value={mpAssoc}
							onChange={(e) => updateMpAssoc(e.target.value as MarketplaceAssociation)}
						>
							{MARKETPLACE_ASSOCIATIONS.map((value) => (
								<option key={value} value={value}>
									Marketplace: {ASSOC_LABELS[value]}
								</option>
							))}
						</Select>
						{marketplaceFilter && (
							<span className="inline-flex items-center gap-1 rounded-full border border-edge bg-surface-800 px-2 py-0.5 text-xs text-text-2">
								Marketplace: {marketplaceFilter}
								<button
									type="button"
									aria-label="Clear marketplace filter"
									onClick={() => clearParam("marketplace")}
									className="text-text-4 hover:text-text-1"
								>
									×
								</button>
							</span>
						)}
						{highlightName && (
							<span className="inline-flex items-center gap-1 rounded-full border border-edge bg-surface-800 px-2 py-0.5 text-xs text-text-2">
								Highlighted: {highlightName}
								<button
									type="button"
									aria-label="Clear highlight"
									onClick={() => clearParam("name")}
									className="text-text-4 hover:text-text-1"
								>
									×
								</button>
							</span>
						)}
						{filteredItems.length !== items.length && (
							<span className="text-xs text-text-4">
								{filteredItems.length} / {items.length}
							</span>
						)}
					</div>

					<Table>
						<THead>
							<TR>
								<TH>Plugin</TH>
								<TH>Marketplace</TH>
								<TH>Version</TH>
								<TH>Trigger</TH>
								<TH>Status</TH>
								<TH align="right">Skills</TH>
								<TH align="right">Activations</TH>
								<TH align="right">Installations</TH>
								<TH align="right">Unique Users</TH>
							</TR>
						</THead>
						<TBody>
							{filteredItems.length === 0 ? (
								<EmptyRow colSpan={9}>No plugins match the current filters.</EmptyRow>
							) : (
								filteredItems.map((plugin) => {
									const status = (plugin.status ?? "unknown") as PluginStatus;
									const isHighlighted = highlightName === plugin.pluginName;
									const openDrawer = () => setSelectedPlugin(plugin.pluginName);
									const activations = plugin.skillActivationCount;
									return (
										<TR
											key={plugin.pluginName}
											ref={isHighlighted ? highlightedRowRef : undefined}
											highlighted={isHighlighted}
										>
											<TD className="font-mono whitespace-nowrap">
												<button
													type="button"
													onClick={openDrawer}
													className="text-accent-soft hover:underline"
													title="View plugin skills"
												>
													{plugin.pluginName}
												</button>
											</TD>
											<TD className="text-text-3">
												{plugin.marketplaceName ? (
													<a
														href={`/marketplaces?name=${encodeURIComponent(plugin.marketplaceName)}`}
														target="_blank"
														rel="noopener noreferrer"
														className="text-accent-soft hover:underline"
													>
														{plugin.marketplaceName}
													</a>
												) : (
													<span
														className="text-text-4"
														title="Locally installed (no marketplace)"
													>
														—
													</span>
												)}
											</TD>
											<TD className="text-text-3">
												{plugin.pluginVersion ?? <span className="text-text-4">—</span>}
											</TD>
											<TD>
												{plugin.installTrigger ? (
													<span className="inline-block rounded border border-edge bg-surface-800 px-2 py-0.5 text-xs font-medium text-text-2">
														{plugin.installTrigger}
													</span>
												) : (
													<span className="text-text-4">—</span>
												)}
											</TD>
											<TD>
												<div className="flex items-center gap-2">
													<StatusBadge status={status} />
													<Select
														size="sm"
														value={status}
														onChange={(e) =>
															handleStatusChange(
																plugin.pluginName,
																e.target.value as PluginStatus,
															)
														}
													>
														{STATUS_OPTIONS.map((opt) => (
															<option key={opt.value} value={opt.value}>
																{opt.label}
															</option>
														))}
													</Select>
												</div>
											</TD>
											<TD numeric>
												{plugin.skillCount > 0 ? (
													<button
														type="button"
														onClick={openDrawer}
														className="text-accent-soft hover:underline"
														title="View plugin skills"
													>
														{plugin.skillCount}
													</button>
												) : (
													<span className="text-text-4">0</span>
												)}
											</TD>
											<TD numeric>
												{plugin.skillCount > 0 ? (
													<button
														type="button"
														onClick={openDrawer}
														className={
															activations > 0
																? "text-accent-soft hover:underline"
																: "text-text-4 hover:underline"
														}
														title={
															activations === 0
																? "Skills declared but never activated — click to inspect"
																: "View plugin skills"
														}
													>
														{activations}
													</button>
												) : (
													<span className="text-text-4">—</span>
												)}
											</TD>
											<TD numeric>{plugin.installationCount}</TD>
											<TD numeric>{plugin.uniqueUserCount}</TD>
										</TR>
									);
								})
							)}
						</TBody>
					</Table>
				</>
			)}

			<PluginSkillsDrawer
				pluginName={selectedPlugin}
				onClose={() => setSelectedPlugin(null)}
			/>
		</div>
	);
}
