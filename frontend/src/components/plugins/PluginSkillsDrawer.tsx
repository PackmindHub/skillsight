import { useEffect, useState } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { api } from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils";
import type { PluginSkillRow, PluginUserRow, PluginVersionRow } from "@/types/api";

interface PluginSkillsDrawerProps {
	pluginName: string | null;
	marketplaceName: string | null;
	onClose: () => void;
}

export function PluginSkillsDrawer({
	pluginName,
	marketplaceName,
	onClose,
}: PluginSkillsDrawerProps) {
	const [skills, setSkills] = useState<PluginSkillRow[] | null>(null);
	const [topUsers, setTopUsers] = useState<PluginUserRow[] | null>(null);
	const [versions, setVersions] = useState<PluginVersionRow[] | null>(null);
	const [latestVersion, setLatestVersion] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!pluginName) {
			setSkills(null);
			setTopUsers(null);
			setVersions(null);
			setLatestVersion(null);
			setError(null);
			return;
		}
		let cancelled = false;
		setLoading(true);
		setError(null);
		api.plugins
			.skills(pluginName, marketplaceName)
			.then((res) => {
				if (cancelled) return;
				setSkills(res.skills);
				setTopUsers(res.topUsers);
				setVersions(res.versions);
				setLatestVersion(res.latestVersion);
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
	}, [pluginName, marketplaceName]);

	const totalActivations = skills?.reduce((sum, s) => sum + s.activationCount, 0) ?? 0;
	const unusedCount = skills?.filter((s) => s.activationCount === 0).length ?? 0;

	return (
		<Drawer
			open={pluginName !== null}
			onClose={onClose}
			title={pluginName ?? "Plugin"}
			widthClass="w-[520px]"
		>
			{loading && <p className="text-sm text-text-3">Loading…</p>}
			{error && <p className="text-sm text-danger">{error}</p>}
			{!loading && !error && skills && (
				<div className="space-y-5">
					<div className="grid grid-cols-3 gap-3">
						<Stat label="Skills" value={skills.length} />
						<Stat label="Activations" value={totalActivations} />
						<Stat label="Unused" value={unusedCount} muted={unusedCount === 0} />
					</div>

					<div className="space-y-2">
						<p className="text-xs uppercase tracking-wide text-text-4">
							Versions {latestVersion && <span className="text-text-3">· latest {latestVersion}</span>}
						</p>
						{!versions || versions.length === 0 ? (
							<p className="text-sm text-text-4">No versions recorded yet.</p>
						) : (
							<ul className="space-y-1">
								{versions.map((v) => {
									const isLatest = v.version === latestVersion;
									return (
										<li
											key={v.version}
											className="flex items-center justify-between rounded border border-edge-dim bg-surface-800 px-3 py-1.5 text-sm"
										>
											<span className="flex items-baseline gap-2 min-w-0">
												<span
													className={`font-mono ${isLatest ? "text-text-1" : "text-text-2"}`}
													title={
														isLatest
															? "Highest semver — current 'latest'"
															: v.version
													}
												>
													{v.version}
												</span>
												{isLatest && (
													<span className="text-[10px] uppercase tracking-wider text-accent-bright">
														latest
													</span>
												)}
												<span
													className="text-[11px] text-text-4 truncate"
													title={`first seen ${v.firstSeenAt} · last seen ${v.lastSeenAt}`}
												>
													last seen {formatRelativeTime(v.lastSeenAt)}
												</span>
											</span>
											<span
												className="font-medium tabular-nums text-text-1"
												title="Distinct users who loaded this version"
											>
												{v.uniqueLoaderCount.toLocaleString("en-US")} loader
												{v.uniqueLoaderCount === 1 ? "" : "s"}
											</span>
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
							<p className="text-sm text-text-4">No skills declared for this plugin.</p>
						) : (
							<ul className="space-y-1">
								{skills.map((s) => {
									const isUnused = s.activationCount === 0;
									return (
										<li
											key={s.skillName}
											className={`flex items-center justify-between rounded border border-edge-dim bg-surface-800 px-3 py-1.5 text-sm ${
												isUnused ? "opacity-60" : ""
											}`}
										>
											<a
												href={`/skills?search=${encodeURIComponent(s.skillName)}`}
												target="_blank"
												rel="noopener noreferrer"
												className="font-mono text-text-2 truncate hover:text-accent-bright hover:underline"
												title={`Open skill ${s.skillName} in a new tab`}
											>
												{s.skillName}
											</a>
											<span
												className={`font-medium tabular-nums ${
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

					<div className="space-y-2">
						<p className="text-xs uppercase tracking-wide text-text-4">
							Top users (by activations)
						</p>
						{!topUsers || topUsers.length === 0 ? (
							<p className="text-sm text-text-4">No activations recorded.</p>
						) : (
							<ul className="space-y-1">
								{topUsers.map((u) => (
									<li
										key={u.userEmail}
										className="flex items-center justify-between rounded border border-edge-dim bg-surface-800 px-3 py-1.5 text-sm"
									>
										<span className="font-mono text-text-2 truncate" title={u.userEmail}>
											{u.userEmail}
										</span>
										<span className="font-medium tabular-nums text-text-1">
											{u.activationCount}
										</span>
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
