import { Pause, Play, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { LiveSkillActivatedEvent } from "@/types/api";

type TriggerKey = "user-slash" | "claude-proactive" | "nested-skill";

interface TriggerMeta {
	label: string;
	color: string;
}

const TRIGGER_META: Record<TriggerKey, TriggerMeta> = {
	"user-slash": { label: "user-slash", color: "var(--color-accent-bright)" },
	"claude-proactive": { label: "claude-proactive", color: "var(--color-accent-2)" },
	"nested-skill": { label: "nested-skill", color: "var(--color-caution)" },
};

const TRIGGER_KEYS: TriggerKey[] = ["user-slash", "claude-proactive", "nested-skill"];
const LIMIT_OPTIONS = [50, 100, 250, 500] as const;
const MAX_BUFFER = 1000;

const TIMESTAMP_FORMAT = new Intl.DateTimeFormat(undefined, {
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
	second: "2-digit",
	hour12: false,
});

function formatTimestamp(iso: string): string {
	return TIMESTAMP_FORMAT.format(new Date(iso));
}

export default function LiveEventsPage() {
	const [events, setEvents] = useState<LiveSkillActivatedEvent[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [enabledTriggers, setEnabledTriggers] = useState<Set<TriggerKey>>(
		() => new Set(TRIGGER_KEYS),
	);
	const [limit, setLimit] = useState<number>(100);
	const [search, setSearch] = useState("");
	const [paused, setPaused] = useState(false);
	const [streamReady, setStreamReady] = useState(false);
	const newestIdRef = useRef<string | null>(null);
	const pausedRef = useRef(false);
	pausedRef.current = paused;

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		api.events
			.recent(MAX_BUFFER)
			.then((res) => {
				if (cancelled) return;
				setEvents(res.events);
				setError(null);
			})
			.catch((err: unknown) => {
				if (cancelled) return;
				setError(err instanceof Error ? err.message : String(err));
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		const close = api.events.openStream({
			onEvent: (incoming) => {
				setStreamReady(true);
				if (pausedRef.current) return;
				setEvents((prev) => {
					if (prev.some((e) => e.id === incoming.id)) return prev;
					const next = [incoming, ...prev];
					return next.length > MAX_BUFFER ? next.slice(0, MAX_BUFFER) : next;
				});
			},
			onError: () => {
				setStreamReady(false);
			},
		});
		return close;
	}, []);

	const triggerCounts = useMemo(() => {
		const counts: Record<TriggerKey, number> = {
			"user-slash": 0,
			"claude-proactive": 0,
			"nested-skill": 0,
		};
		for (const e of events) {
			if (e.trigger && (e.trigger as TriggerKey) in counts) {
				counts[e.trigger as TriggerKey] += 1;
			}
		}
		return counts;
	}, [events]);

	const filtered = useMemo(() => {
		const q = search.trim().toLowerCase();
		return events
			.filter((e) => {
				const t = (e.trigger as TriggerKey | null) ?? null;
				if (!t) return enabledTriggers.size === TRIGGER_KEYS.length;
				return enabledTriggers.has(t);
			})
			.filter((e) => {
				if (!q) return true;
				return Boolean(
					e.userEmail?.toLowerCase().includes(q) ||
						e.skillName?.toLowerCase().includes(q) ||
						e.pluginName?.toLowerCase().includes(q) ||
						e.marketplaceName?.toLowerCase().includes(q),
				);
			})
			.slice(0, limit);
	}, [events, enabledTriggers, limit, search]);

	const newestId = filtered[0]?.id ?? null;
	useEffect(() => {
		newestIdRef.current = newestId;
	}, [newestId]);

	function toggleTrigger(t: TriggerKey) {
		setEnabledTriggers((prev) => {
			const next = new Set(prev);
			if (next.has(t)) next.delete(t);
			else next.add(t);
			return next;
		});
	}

	function resetFilters() {
		setEnabledTriggers(new Set(TRIGGER_KEYS));
		setLimit(100);
		setSearch("");
	}

	const live = streamReady && !paused;

	return (
		<div className="space-y-4">
			<PageHeader
				title="Events"
				subtitle={
					<>
						Showing the last{" "}
						<span className="font-mono text-text-1">{filtered.length}</span>{" "}
						<code className="font-mono text-xs text-accent-soft bg-accent-bright/10 px-1.5 py-0.5 rounded">
							skill_activated
						</code>{" "}
						events{paused ? " · stream paused" : live ? <> · <span className="ev-live-inline"><span className="ev-live-dot" />live</span></> : " · connecting…"}.
					</>
				}
				actions={
					<>
						<Button
							variant={paused ? "primary" : "ghost"}
							size="sm"
							leftIcon={paused ? <Play size={14} /> : <Pause size={14} />}
							onClick={() => setPaused((p) => !p)}
						>
							{paused ? "Resume" : "Pause"}
						</Button>
						<Button variant="ghost" size="sm" onClick={resetFilters}>
							Reset filters
						</Button>
					</>
				}
			/>

			{error && <p className="text-sm text-danger">{error}</p>}

			<div className="ev-typefilters">
				{TRIGGER_KEYS.map((k) => {
					const meta = TRIGGER_META[k];
					const on = enabledTriggers.has(k);
					return (
						<button
							key={k}
							type="button"
							className={cn("ev-typechip", on && "on")}
							onClick={() => toggleTrigger(k)}
							style={
								on
									? {
											borderColor: `color-mix(in srgb, ${meta.color} 50%, transparent)`,
											background: `color-mix(in srgb, ${meta.color} 10%, transparent)`,
											color: meta.color,
										}
									: undefined
							}
						>
							<span
								className="ev-typechip-dot"
								style={{
									background: on ? meta.color : "var(--color-text-4)",
									boxShadow: on ? `0 0 6px ${meta.color}` : "none",
								}}
							/>
							<span>{meta.label}</span>
							<span className="ev-typechip-count">{triggerCounts[k]}</span>
						</button>
					);
				})}
			</div>

			<div className="flex flex-wrap items-center gap-3">
				<div className="relative max-w-[360px] flex-1">
					<Search
						size={14}
						className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-4"
					/>
					<input
						type="text"
						placeholder="Filter by actor, skill, plugin, marketplace…"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="h-9 w-full rounded-md border border-edge bg-surface-800 pl-9 pr-3 text-sm text-text-1 placeholder:text-text-4 focus:outline-none focus:ring-1 focus:ring-accent-bright focus:border-accent-bright"
					/>
				</div>
				<div className="ev-limit">
					<span className="ev-limit-lab">Limit</span>
					{LIMIT_OPTIONS.map((n) => (
						<button
							key={n}
							type="button"
							className={cn("ev-limit-btn", limit === n && "on")}
							onClick={() => setLimit(n)}
						>
							{n}
						</button>
					))}
				</div>
			</div>

			<div className="overflow-hidden rounded-lg border border-edge bg-surface-900">
				<div className="overflow-x-auto">
					<table className="ev-tbl min-w-full text-sm text-text-2">
						<thead className="bg-surface-800/60 text-text-3">
							<tr>
								<th className="px-4 py-2.5 text-left font-medium" style={{ width: 180 }}>
									Date time
								</th>
								<th className="px-4 py-2.5 text-left font-medium" style={{ width: "32%" }}>
									Skill
								</th>
								<th className="px-4 py-2.5 text-left font-medium">Trigger</th>
								<th className="px-4 py-2.5 text-left font-medium" style={{ width: 220 }}>
									Actor
								</th>
								<th className="px-4 py-2.5 text-left font-medium" style={{ width: 200 }}>
									Marketplace
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-edge-dim">
							{loading ? (
								<tr>
									<td colSpan={5} className="px-4 py-8 text-center text-sm text-text-3">
										Loading recent events…
									</td>
								</tr>
							) : filtered.length === 0 ? (
								<tr>
									<td colSpan={5} className="px-4 py-10 text-center text-sm text-text-3">
										No events match.{" "}
										<button
											type="button"
											className="text-accent-soft underline hover:text-accent-bright"
											onClick={resetFilters}
										>
											Reset filters
										</button>
									</td>
								</tr>
							) : (
								filtered.map((e) => {
									const trig =
										e.trigger && (e.trigger as TriggerKey) in TRIGGER_META
											? TRIGGER_META[e.trigger as TriggerKey]
											: null;
									const isNew = !paused && e.id === newestId;
									const isClaude = e.userEmail === "claude" || !e.userEmail;
									return (
										<tr key={e.id} className={cn("ev-row", isNew && "ev-row-new")}>
											<td className="px-4 py-2 align-top font-mono text-xs text-text-3 tabular-nums">
												{formatTimestamp(e.timestamp)}
											</td>
											<td className="px-4 py-2 align-top">
												<span className="font-mono text-[13px] text-text-1">
													{e.skillName}
												</span>
											</td>
											<td className="px-4 py-2 align-top">
												{trig ? (
													<span
														className="ev-trigger-pill"
														style={{
															color: trig.color,
															borderColor: `color-mix(in srgb, ${trig.color} 35%, transparent)`,
															background: `color-mix(in srgb, ${trig.color} 10%, transparent)`,
														}}
													>
														<span
															className="ev-type-dot"
															style={{
																background: trig.color,
																boxShadow: `0 0 6px ${trig.color}`,
															}}
														/>
														{trig.label}
													</span>
												) : (
													<span className="text-text-4">—</span>
												)}
											</td>
											<td
												className="px-4 py-2 align-top font-mono text-xs"
												style={{ color: isClaude ? "var(--color-accent-soft)" : "var(--color-text-2)" }}
											>
												{e.userEmail ?? "claude"}
											</td>
											<td className="px-4 py-2 align-top font-mono text-xs text-text-3">
												{e.marketplaceName ?? <span className="text-text-4">—</span>}
											</td>
										</tr>
									);
								})
							)}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}
