import { useEffect, useState } from "react";
import { MarketplaceBadge } from "@/components/marketplaces/MarketplaceBadge";
import { Drawer } from "@/components/ui/Drawer";
import { TrendSparkline } from "@/components/skills/TrendSparkline";
import { api } from "@/lib/api";
import { cn, formatRelativeTime } from "@/lib/utils";
import type {
	PeriodFilter,
	SkillDetail,
	SkillDetailPluginRef,
} from "@/types/api";

interface SkillDetailDrawerProps {
	skillName: string | null;
	period: PeriodFilter;
	onClose: () => void;
}

const PLUGIN_STATUS_STYLES: Record<string, string> = {
	approved: "bg-success/15 text-success border-success/30",
	to_review: "bg-warning/15 text-warning border-warning/30",
	removed: "bg-danger/15 text-danger border-danger/30",
};

function PluginBadge({ plugin }: { plugin: SkillDetailPluginRef }) {
	const style = PLUGIN_STATUS_STYLES[plugin.status] ?? PLUGIN_STATUS_STYLES.to_review;
	return (
		<a
			href={`/plugins?name=${encodeURIComponent(plugin.pluginName)}`}
			target="_blank"
			rel="noopener noreferrer"
			title={
				plugin.marketplaceName
					? `Open plugin ${plugin.pluginName} (${plugin.marketplaceName}) in a new tab`
					: `Open plugin ${plugin.pluginName} (local) in a new tab`
			}
			className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-mono hover:underline ${style}`}
		>
			{plugin.pluginName}
			{!plugin.marketplaceName && (
				<span className="ml-1 text-[10px] text-text-4">(local)</span>
			)}
		</a>
	);
}

export function SkillDetailDrawer({ skillName, period, onClose }: SkillDetailDrawerProps) {
	const [detail, setDetail] = useState<SkillDetail | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const periodKey =
		period.kind === "preset" ? `preset:${period.days}` : `range:${period.from}:${period.to}`;

	// biome-ignore lint/correctness/useExhaustiveDependencies: periodKey is the stable identity of `period`
	useEffect(() => {
		if (!skillName) {
			setDetail(null);
			setError(null);
			return;
		}
		let cancelled = false;
		setLoading(true);
		setError(null);
		api.skills
			.detail(skillName, period)
			.then((d) => {
				if (!cancelled) setDetail(d);
			})
			.catch((e) => {
				if (!cancelled) setError(String(e));
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [skillName, periodKey]);

	const counts = detail?.dailyCounts.map((d) => d.count) ?? [];

	return (
		<Drawer open={skillName !== null} onClose={onClose} title={skillName ?? "Skill"} widthClass="w-[560px]">
			{loading && <p className="text-sm text-text-3">Loading…</p>}
			{error && <p className="text-sm text-danger">{error}</p>}
			{!loading && !error && detail && (
				<div className="space-y-6">
					<div className="grid grid-cols-2 gap-4">
						<div>
							<p className="text-xs uppercase tracking-wide text-text-4">Activations</p>
							<p className="mt-1 text-3xl font-semibold text-text-1">{detail.total}</p>
							<div className="mt-2">
								<TrendSparkline
									values={counts}
									width={240}
									height={40}
									days={
										period.kind === "preset" && typeof period.days === "number"
											? period.days
											: counts.length
									}
								/>
							</div>
						</div>
						<div>
							<p className="text-xs uppercase tracking-wide text-text-4">Unique users</p>
							<p className="mt-1 text-3xl font-semibold text-text-1">{detail.uniqueUsers}</p>
						</div>
					</div>

					{(() => {
						const unknown = Math.max(
							0,
							detail.total - detail.userSlash - detail.claudeProactive - detail.nestedSkill,
						);
						return (
							<div
								className={cn(
									"grid gap-3",
									unknown > 0 ? "grid-cols-4" : "grid-cols-3",
								)}
							>
								<TriggerStat label="user-slash" count={detail.userSlash} total={detail.total} colorClass="bg-accent-bright" />
								<TriggerStat label="claude-proactive" count={detail.claudeProactive} total={detail.total} colorClass="bg-success" />
								<TriggerStat label="nested-skill" count={detail.nestedSkill} total={detail.total} colorClass="bg-warning" />
								{unknown > 0 && (
									<TriggerStat
										label="unknown"
										count={unknown}
										total={detail.total}
										colorClass="bg-text-4"
										title="Claude Code didn't record what triggered it"
									/>
								)}
							</div>
						);
					})()}

					<div className="space-y-2">
						<p className="text-xs uppercase tracking-wide text-text-4">Source</p>
						<p className="text-sm text-text-1">
							{detail.skillSource === "bundled" ? (
								<span className="inline-flex items-center rounded border border-accent-soft/30 bg-accent-soft/15 px-1.5 py-0.5 text-xs font-medium text-accent-soft">
									Bundled
								</span>
							) : (
								<span className="text-text-3">External</span>
							)}
							{detail.status === "removed" && (
								<span className="ml-2 inline-flex items-center rounded border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-xs font-medium text-red-400">
									Removed
								</span>
							)}
						</p>
					</div>

					<div className="space-y-2">
						<p className="text-xs uppercase tracking-wide text-text-4">Marketplaces</p>
						{detail.marketplaces.length === 0 ? (
							<p className="text-sm text-text-4">—</p>
						) : (
							<div className="flex flex-wrap gap-1.5">
								{detail.marketplaces.map((mp) => (
									<MarketplaceBadge key={mp.name} name={mp.name} status={mp.status} />
								))}
							</div>
						)}
					</div>

					<div className="space-y-2">
						<p className="text-xs uppercase tracking-wide text-text-4">Plugins</p>
						{detail.plugins.length === 0 ? (
							<p className="text-sm text-text-4">—</p>
						) : (
							<div className="flex flex-wrap gap-1.5">
								{detail.plugins.map((p) => (
									<PluginBadge key={p.pluginName} plugin={p} />
								))}
							</div>
						)}
					</div>

					{detail.plugins.some((p) => p.skillRepoUrl) && (
						<div className="space-y-2">
							<p className="text-xs uppercase tracking-wide text-text-4">Source code</p>
							<ul className="space-y-1">
								{detail.plugins
									.filter((p) => p.skillRepoUrl)
									.map((p) => (
										<li key={p.pluginName}>
											<a
												href={p.skillRepoUrl ?? undefined}
												target="_blank"
												rel="noopener noreferrer"
												className="text-sm text-accent-bright hover:underline break-all"
												title={`Open skill source for ${p.pluginName} in a new tab`}
											>
												{p.skillRepoUrl}
											</a>
										</li>
									))}
							</ul>
						</div>
					)}

					<div className="grid grid-cols-2 gap-3">
						<SeenStat label="First seen" iso={detail.firstSeenAt} />
						<SeenStat label="Last seen" iso={detail.lastSeenAt} />
					</div>

					<div className="space-y-2">
						<p className="text-xs uppercase tracking-wide text-text-4">Top users</p>
						{detail.topUsers.length === 0 ? (
							<p className="text-sm text-text-4">No activations recorded in this window.</p>
						) : (
							<ul className="space-y-1">
								{detail.topUsers.map((u) => (
									<li
										key={u.userEmail}
										className="flex items-center justify-between rounded border border-edge-dim bg-surface-800 px-3 py-1.5 text-sm"
									>
										<span className="font-mono text-text-2 truncate">{u.userEmail}</span>
										<span className="text-text-1 font-medium">{u.count}</span>
									</li>
								))}
							</ul>
						)}
					</div>
				</div>
			)}
		</Drawer>
	);
}

function TriggerStat({
	label,
	count,
	total,
	colorClass,
	title,
}: {
	label: string;
	count: number;
	total: number;
	colorClass: string;
	title?: string;
}) {
	const pct = total > 0 ? (count / total) * 100 : 0;
	return (
		<div
			className="rounded border border-edge-dim bg-surface-800 px-3 py-2"
			title={title}
		>
			<p className="text-[10px] uppercase tracking-wide text-text-4">{label}</p>
			<p className="mt-1 text-lg font-semibold text-text-1">{count}</p>
			<div className="mt-1.5 h-1 w-full overflow-hidden rounded bg-surface-700">
				<div className={`h-full ${colorClass}`} style={{ width: `${pct}%` }} />
			</div>
			<p className="mt-1 text-[10px] text-text-4">{pct.toFixed(0)}%</p>
		</div>
	);
}

function SeenStat({ label, iso }: { label: string; iso: string | null }) {
	return (
		<div className="rounded border border-edge-dim bg-surface-800 px-3 py-2">
			<p className="text-[10px] uppercase tracking-wide text-text-4">{label}</p>
			<p className="mt-1 text-sm text-text-1">{iso ? formatRelativeTime(iso) : "—"}</p>
		</div>
	);
}
