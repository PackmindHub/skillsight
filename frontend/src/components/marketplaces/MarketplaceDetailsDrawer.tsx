import { useEffect, useState } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { api } from "@/lib/api";
import type { MarketplaceDetailResponse } from "@/types/api";

interface MarketplaceDetailsDrawerProps {
	marketplaceName: string | null;
	onClose: () => void;
}

export function MarketplaceDetailsDrawer({
	marketplaceName,
	onClose,
}: MarketplaceDetailsDrawerProps) {
	const [detail, setDetail] = useState<MarketplaceDetailResponse | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!marketplaceName) {
			setDetail(null);
			setError(null);
			return;
		}
		let cancelled = false;
		setLoading(true);
		setError(null);
		api.marketplaces
			.detail(marketplaceName)
			.then((res) => {
				if (!cancelled) setDetail(res);
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
	}, [marketplaceName]);

	const plugins = detail?.plugins ?? [];
	const skills = detail?.skills ?? [];
	const totalActivations = skills.reduce((sum, s) => sum + s.activationCount, 0);
	const activatedSkillCount = skills.filter((s) => s.activationCount > 0).length;

	return (
		<Drawer
			open={marketplaceName !== null}
			onClose={onClose}
			title={marketplaceName ?? "Marketplace"}
			widthClass="w-[560px]"
		>
			{loading && <p className="text-sm text-text-3">Loading…</p>}
			{error && <p className="text-sm text-danger">{error}</p>}
			{!loading && !error && detail && (
				<div className="space-y-5">
					<div className="grid grid-cols-4 gap-3">
						<Stat label="Plugins" value={plugins.length} />
						<Stat label="Skills" value={skills.length} />
						<Stat
							label="Activated"
							value={activatedSkillCount}
							muted={activatedSkillCount === 0}
						/>
						<Stat
							label="Activations"
							value={totalActivations}
							muted={totalActivations === 0}
						/>
					</div>

					<div className="space-y-2">
						<p className="text-xs uppercase tracking-wide text-text-4">
							Plugins (sorted by activations)
						</p>
						{plugins.length === 0 ? (
							<p className="text-sm text-text-4">No plugins linked to this marketplace.</p>
						) : (
							<ul className="space-y-1">
								{plugins.map((p) => {
									const isUnused = p.skillActivationCount === 0;
									return (
										<li
											key={p.pluginName}
											className={`flex items-center justify-between gap-2 rounded border border-edge-dim bg-surface-800 px-3 py-1.5 text-sm ${
												isUnused ? "opacity-60" : ""
											}`}
										>
											<div className="flex items-center gap-2 min-w-0">
												<a
													href={`/plugins?name=${encodeURIComponent(p.pluginName)}`}
													target="_blank"
													rel="noopener noreferrer"
													className="font-mono text-text-2 truncate hover:text-accent-bright hover:underline"
													title={`Open plugin ${p.pluginName} in a new tab`}
												>
													{p.pluginName}
												</a>
												<StatusBadge status={p.status} />
												{p.pluginVersion && (
													<span className="text-xs text-text-4 font-mono">
														{p.pluginVersion}
													</span>
												)}
											</div>
											<div className="flex items-center gap-3 shrink-0 tabular-nums">
												<span
													className="text-xs text-text-4"
													title="Installations"
												>
													{p.installationCount} inst.
												</span>
												<span
													className={`font-medium ${
														isUnused ? "text-text-4" : "text-text-1"
													}`}
													title="Skill activations"
												>
													{p.skillActivationCount}
												</span>
											</div>
										</li>
									);
								})}
							</ul>
						)}
					</div>

					<div className="space-y-2">
						<p className="text-xs uppercase tracking-wide text-text-4">
							Skills (sorted by activations)
						</p>
						{skills.length === 0 ? (
							<p className="text-sm text-text-4">No skills declared for this marketplace.</p>
						) : (
							<ul className="space-y-1">
								{skills.map((s) => {
									const isUnused = s.activationCount === 0;
									return (
										<li
											key={`${s.pluginName}::${s.skillName}`}
											className={`flex items-center justify-between gap-2 rounded border border-edge-dim bg-surface-800 px-3 py-1.5 text-sm ${
												isUnused ? "opacity-60" : ""
											}`}
										>
											<div className="flex items-center gap-2 min-w-0">
												<a
													href={`/skills?search=${encodeURIComponent(s.skillName)}`}
													target="_blank"
													rel="noopener noreferrer"
													className="font-mono text-text-2 truncate hover:text-accent-bright hover:underline"
													title={`Open skill ${s.skillName} in a new tab`}
												>
													{s.skillName}
												</a>
												<span className="text-xs text-text-4 font-mono truncate">
													{s.pluginName}
												</span>
											</div>
											<span
												className={`font-medium tabular-nums shrink-0 ${
													isUnused ? "text-text-4" : "text-text-1"
												}`}
											>
												{s.activationCount}
											</span>
										</li>
									);
								})}
							</ul>
						)}
					</div>
				</div>
			)}
		</Drawer>
	);
}

function Stat({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
	return (
		<div className="rounded border border-edge-dim bg-surface-800 px-3 py-2">
			<p className="text-[10px] uppercase tracking-wide text-text-4">{label}</p>
			<p
				className={`mt-1 text-lg font-semibold tabular-nums ${
					muted ? "text-text-3" : "text-text-1"
				}`}
			>
				{value}
			</p>
		</div>
	);
}
