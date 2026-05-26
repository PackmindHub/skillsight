import { SkillChip } from "@/components/cohorts/SkillChip";
import { skillColor } from "@/components/cohorts/skill-color";
import { api } from "@/lib/api";
import type { CoUsageSession, CoUsageTimelineEvent } from "@/types/api";
import { type CSSProperties, Fragment, useEffect, useMemo, useState } from "react";
import type { Combo } from "./types";

// ─── Time helpers ────────────────────────────────────────────────────────
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function pad2(n: number): string {
	return String(n).padStart(2, "0");
}

function fmtClock(ts: number): string {
	const d = new Date(ts);
	return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function fmtClockShort(ts: number): string {
	const d = new Date(ts);
	return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function fmtDate(ts: number): string {
	const d = new Date(ts);
	return `${DAYS[d.getDay()]} ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

function fmtOffset(ms: number): string {
	const safe = Math.max(0, ms);
	const s = Math.round(safe / 1000);
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const sec = s % 60;
	return h > 0 ? `+${h}:${pad2(m)}:${pad2(sec)}` : `+${m}:${pad2(sec)}`;
}

function fmtGap(ms: number): string {
	const s = Math.round(ms / 1000);
	if (s < 60) return `${s}s`;
	const m = Math.floor(s / 60);
	if (m < 60) return `${m}m`;
	const h = Math.floor(m / 60);
	const remM = m % 60;
	return remM > 0 ? `${h}h ${remM}m` : `${h}h`;
}

function fmtAgo(min: number): string {
	if (!Number.isFinite(min)) return "—";
	if (min < 1) return "just now";
	if (min < 60) return `${Math.round(min)}m`;
	if (min < 60 * 24) return `${Math.round(min / 60)}h`;
	return `${Math.round(min / (60 * 24))}d`;
}

function fmtNum(n: number): string {
	return n.toLocaleString("en-US");
}

// ─── Session timeline block ──────────────────────────────────────────────

interface SessionTimelineBlockProps {
	session: CoUsageSession;
	comboSkillSet: Set<string>;
	now: number;
}

interface TimelineRun {
	from: number;
	to: number;
	skill: string;
	count: number;
}

interface PositionedEvent {
	skill: string;
	ts: number;
	x: number;
}

const GAP_BREAK_MS = 5 * 60 * 1000;

function SessionTimelineBlock({ session, comboSkillSet, now }: SessionTimelineBlockProps) {
	const [events, setEvents] = useState<CoUsageTimelineEvent[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [hover, setHover] = useState<number | null>(null);

	useEffect(() => {
		let cancelled = false;
		setEvents(null);
		setError(null);
		api.coUsage
			.timeline(session.sessionId)
			.then((res) => {
				if (cancelled) return;
				setEvents(res.events);
			})
			.catch((err: unknown) => {
				if (cancelled) return;
				setError(err instanceof Error ? err.message : String(err));
			});
		return () => {
			cancelled = true;
		};
	}, [session.sessionId]);

	const layout = useMemo(() => {
		if (!events || events.length === 0) return null;
		const tsList = events.map((e) => new Date(e.timestamp).getTime());
		const sessionStart = tsList[0]!;
		const sessionEnd = tsList[tsList.length - 1]!;
		const sessionDur = Math.max(1, sessionEnd - sessionStart);

		// Gap-aware x-positioning: cap large gaps so track stays readable.
		let xs: number[];
		if (events.length === 1) {
			xs = [0.5];
		} else {
			const gaps: number[] = [];
			for (let i = 1; i < events.length; i++) gaps.push(tsList[i]! - tsList[i - 1]!);
			const sorted = [...gaps].sort((a, b) => a - b);
			const median = sorted[Math.floor(sorted.length / 2)] || 1;
			const cap = Math.max(median * 6, 2 * 60 * 1000); // 6× median or 2min
			let acc = 0;
			const out = [0];
			for (let i = 1; i < events.length; i++) {
				acc += Math.min(tsList[i]! - tsList[i - 1]!, cap);
				out.push(acc);
			}
			const total = out[out.length - 1] || 1;
			xs = out.map((v) => v / total);
		}

		const positioned: PositionedEvent[] = events.map((e, i) => ({
			skill: e.skillName,
			ts: tsList[i]!,
			x: xs[i]!,
		}));

		// Gap break markers (gaps > 5 min get a compressed marker)
		const breaks: { idx: number; gap: number; x: number }[] = [];
		for (let i = 1; i < events.length; i++) {
			const g = tsList[i]! - tsList[i - 1]!;
			if (g > GAP_BREAK_MS) breaks.push({ idx: i, gap: g, x: (xs[i - 1]! + xs[i]!) / 2 });
		}

		// Detect runs of same skill (consecutive identical skill)
		const runs: TimelineRun[] = [];
		let i = 0;
		while (i < events.length) {
			let j = i + 1;
			while (j < events.length && events[j]!.skillName === events[i]!.skillName) j++;
			runs.push({ from: i, to: j - 1, skill: events[i]!.skillName, count: j - i });
			i = j;
		}

		return { positioned, breaks, runs, sessionStart, sessionEnd, sessionDur };
	}, [events]);

	const blockStyle: CSSProperties = {
		padding: "12px 14px 10px",
		borderRadius: 8,
		background: "var(--color-surface-800)",
		border: "1px solid var(--color-edge-dim)",
	};

	if (error) {
		return (
			<div style={blockStyle}>
				<div className="flex items-center justify-between gap-3 mb-2">
					<SessionHeaderMeta session={session} now={now} />
				</div>
				<div className="font-mono text-[11px] text-danger">Failed to load timeline: {error}</div>
			</div>
		);
	}

	if (!events) {
		return (
			<div style={blockStyle}>
				<div className="flex items-center justify-between gap-3 mb-2">
					<SessionHeaderMeta session={session} now={now} />
				</div>
				<div className="font-mono text-[11px] text-text-4">Loading timeline…</div>
			</div>
		);
	}

	if (events.length === 0 || !layout) {
		return (
			<div style={blockStyle}>
				<div className="flex items-center justify-between gap-3 mb-2">
					<SessionHeaderMeta session={session} now={now} />
				</div>
				<div className="font-mono text-[11px] text-text-4">No skill activations recorded.</div>
			</div>
		);
	}

	const { positioned, breaks, runs, sessionStart, sessionEnd, sessionDur } = layout;
	const inCombo = positioned.filter((e) => comboSkillSet.has(e.skill)).length;
	const extras = positioned.length - inCombo;

	return (
		<div style={blockStyle}>
			{/* Header */}
			<div className="flex flex-wrap items-center justify-between gap-3 mb-2">
				<SessionHeaderMeta session={session} now={now} />
				<div className="flex items-center gap-2 font-mono text-[10.5px] text-text-3 shrink-0">
					<span>{fmtDate(sessionStart)}</span>
					<span className="text-text-4">·</span>
					<span className="text-text-1">
						{fmtClockShort(sessionStart)}–{fmtClockShort(sessionEnd)}
					</span>
					<span className="text-text-4">·</span>
					<span className="text-accent-soft">{fmtGap(sessionDur)}</span>
				</div>
			</div>

			{/* Stats row */}
			<div className="mb-3 flex items-baseline gap-4 font-mono text-[10.5px]">
				<span>
					<span className="text-text-1 text-[16px] font-medium tracking-[-0.01em]">
						{positioned.length}
					</span>
					<span className="ml-1.5 text-[9.5px] uppercase tracking-[0.08em] text-text-4">
						activations
					</span>
				</span>
				<span>
					<span className="text-accent-soft text-[16px] font-medium tracking-[-0.01em]">
						{inCombo}
					</span>
					<span className="ml-1.5 text-[9.5px] uppercase tracking-[0.08em] text-text-4">
						in combo
					</span>
				</span>
				{extras > 0 && (
					<span className="text-text-4">
						<span className="text-text-3 text-[13px]">+{extras}</span>
						<span className="ml-1 text-[9.5px] uppercase tracking-[0.08em]">other skills</span>
					</span>
				)}
			</div>

			{/* Axis labels */}
			<div
				className="relative font-mono text-[10px] text-text-4"
				style={{ height: 14, margin: "0 8px" }}
			>
				<span className="absolute left-0 top-0">{fmtClockShort(sessionStart)}</span>
				<span className="absolute right-0 top-0">{fmtClockShort(sessionEnd)}</span>
			</div>

			{/* Track */}
			<div
				className="relative"
				style={{ height: 32, margin: "0 8px" }}
				onMouseLeave={() => setHover(null)}
			>
				{/* Rail */}
				<div
					className="absolute left-0 right-0 top-1/2"
					style={{
						height: 2,
						transform: "translateY(-50%)",
						background:
							"linear-gradient(90deg, color-mix(in srgb, var(--color-edge-bright) 60%, transparent), var(--color-edge-bright), color-mix(in srgb, var(--color-edge-bright) 60%, transparent))",
						borderRadius: 2,
					}}
				/>

				{/* Gap break markers */}
				{breaks.map((b) => (
					<div
						key={`brk-${b.idx}`}
						className="pointer-events-none absolute z-[1] inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 font-mono text-[10px] text-text-3"
						style={{
							top: "50%",
							left: `${b.x * 100}%`,
							padding: "2px 6px",
							transform: "translate(-50%, -50%)",
							background: "var(--color-surface-900)",
							border: "1px dashed color-mix(in srgb, var(--color-edge-bright) 60%, transparent)",
						}}
					>
						<span style={{ color: "var(--color-text-4)", lineHeight: 1, fontSize: 11 }}>⤳</span>
						{fmtGap(b.gap)}
					</div>
				))}

				{/* Run brackets (multi-count) */}
				{runs
					.filter((r) => r.count > 1)
					.map((r) => {
						const left = positioned[r.from]!.x * 100;
						const right = positioned[r.to]!.x * 100;
						const c = skillColor(r.skill);
						return (
							<div
								key={`run-${r.from}`}
								className="pointer-events-none absolute"
								style={{
									top: "calc(50% - 14px)",
									left: `${left}%`,
									width: `${Math.max(0.2, right - left)}%`,
									height: 10,
									border: `1.4px solid ${c}`,
									borderBottom: "none",
									borderRadius: "5px 5px 0 0",
									opacity: 0.7,
								}}
							>
								<span
									className="absolute font-mono rounded"
									style={{
										top: -15,
										left: "50%",
										transform: "translateX(-50%)",
										fontSize: 9,
										color: c,
										padding: "0 4px",
										background: "var(--color-surface-800)",
										whiteSpace: "nowrap",
									}}
								>
									×{r.count}
								</span>
							</div>
						);
					})}

				{/* Dots */}
				{positioned.map((e, i) => {
					const inSet = comboSkillSet.has(e.skill);
					const c = skillColor(e.skill);
					const isHov = hover === i;
					return (
						<button
							// biome-ignore lint/suspicious/noArrayIndexKey: timeline positions are stable per session id.
							key={i}
							type="button"
							onMouseEnter={() => setHover(i)}
							onFocus={() => setHover(i)}
							onBlur={() => setHover(null)}
							aria-label={`${e.skill} at ${fmtClock(e.ts)}`}
							className="absolute z-[2] cursor-pointer border-none bg-transparent p-0"
							style={{
								top: "50%",
								left: `${e.x * 100}%`,
								transform: "translate(-50%, -50%)",
								width: 18,
								height: 18,
							}}
						>
							<span
								className="block"
								style={{
									width: 12,
									height: 12,
									margin: 3,
									borderRadius: "50%",
									background: inSet ? c : "var(--color-surface-900)",
									border: inSet
										? "2px solid var(--color-surface-900)"
										: `2px solid color-mix(in srgb, ${c} 70%, var(--color-edge-bright))`,
									opacity: inSet ? 1 : 0.55,
									boxShadow: isHov
										? `0 0 0 3px color-mix(in srgb, ${c} 50%, transparent), 0 0 14px color-mix(in srgb, ${c} 70%, transparent)`
										: inSet
											? `0 0 0 2px color-mix(in srgb, ${c} 35%, transparent), 0 0 10px color-mix(in srgb, ${c} 55%, transparent)`
											: "none",
									transform: isHov ? "scale(1.25)" : "scale(1)",
									transition: "transform .12s ease, box-shadow .12s ease",
								}}
							/>
						</button>
					);
				})}

				{/* Tooltip */}
				{hover != null &&
					(() => {
						const e = positioned[hover]!;
						const c = skillColor(e.skill);
						const side = e.x > 0.6 ? "left" : "right";
						return (
							<div
								className="pointer-events-none absolute z-[5] rounded-md border border-edge bg-surface-900 shadow-[0_10px_30px_rgba(0,0,0,0.45)]"
								style={{
									bottom: "calc(100% + 8px)",
									left: `${e.x * 100}%`,
									transform:
										side === "left"
											? "translate(calc(-100% + 10px), 0)"
											: "translate(-10px, 0)",
									minWidth: 210,
									padding: "8px 10px",
								}}
							>
								<div
									className="flex items-center gap-1.5 pb-1.5 mb-1.5 border-b border-edge-dim"
								>
									<span
										className="rounded-full"
										style={{ width: 8, height: 8, background: c }}
									/>
									<span className="font-mono text-[11px] text-text-1">{e.skill}</span>
								</div>
								{(
									[
										["time", fmtClock(e.ts)],
										["offset", fmtOffset(e.ts - sessionStart)],
										["step", `${hover + 1} of ${positioned.length}`],
									] as const
								).map(([lab, val]) => (
									<div
										key={lab}
										className="flex justify-between gap-3 py-px font-mono text-[10px]"
									>
										<span className="uppercase tracking-[0.06em] text-text-4">{lab}</span>
										<span
											className="text-text-1"
											style={{ fontVariantNumeric: "tabular-nums" }}
										>
											{val}
										</span>
									</div>
								))}
							</div>
						);
					})()}
			</div>

			{/* Skill labels under track */}
			<div
				className="relative overflow-hidden"
				style={{ height: 22, margin: "2px 8px 0" }}
			>
				{runs.map((r) => {
					const inSet = comboSkillSet.has(r.skill);
					const center = (positioned[r.from]!.x + positioned[r.to]!.x) / 2;
					let posStyle: CSSProperties;
					if (center < 0.1) {
						posStyle = { left: "0%", transform: "translateX(0)" };
					} else if (center > 0.9) {
						posStyle = { left: "100%", transform: "translateX(-100%)" };
					} else {
						posStyle = { left: `${center * 100}%`, transform: "translateX(-50%)" };
					}
					const c = skillColor(r.skill);
					return (
						<span
							key={`lab-${r.from}`}
							title={r.skill}
							className="absolute inline-flex items-baseline gap-1 overflow-hidden whitespace-nowrap rounded font-mono text-[10px]"
							style={{
								top: 0,
								...posStyle,
								padding: "1px 6px",
								color: inSet ? "var(--color-text-1)" : "var(--color-text-3)",
								background: `color-mix(in srgb, ${c} ${inSet ? 12 : 6}%, var(--color-surface-800))`,
								border: `1px solid color-mix(in srgb, ${c} ${inSet ? 32 : 18}%, var(--color-edge-dim))`,
								maxWidth: 200,
								textOverflow: "ellipsis",
								opacity: inSet ? 1 : 0.65,
							}}
						>
							<span style={{ color: c, fontWeight: inSet ? 500 : 400 }}>{r.skill}</span>
							{r.count > 1 && (
								<span style={{ color: "var(--color-text-4)", fontSize: 9 }}>×{r.count}</span>
							)}
						</span>
					);
				})}
			</div>
		</div>
	);
}

function SessionHeaderMeta({ session, now }: { session: CoUsageSession; now: number }) {
	const ageMin = Math.max(0, (now - new Date(session.lastSeenAt).getTime()) / 60000);
	const shortId = session.sessionId.length > 8 ? session.sessionId.slice(0, 8) : session.sessionId;
	return (
		<div className="flex items-center gap-2.5 min-w-0">
			<span
				className="rounded font-mono text-[11px] text-text-1"
				style={{
					background: "var(--color-surface-700)",
					padding: "2px 6px",
				}}
			>
				{shortId}
			</span>
			<span className="min-w-0 truncate font-mono text-[11.5px] text-text-2">
				{session.userEmail ?? "(unknown user)"}
			</span>
			<span className="font-mono text-[10px] text-text-4 shrink-0">
				{fmtAgo(ageMin)} ago
			</span>
		</div>
	);
}

// ─── Drawer stat tile ────────────────────────────────────────────────────

function DrawerStat({
	label,
	value,
	accent,
	small,
}: {
	label: string;
	value: string;
	accent?: string;
	small?: boolean;
}) {
	return (
		<div className="relative bg-surface-900 px-3 py-2.5">
			{accent && (
				<span
					aria-hidden="true"
					className="absolute inset-x-0 top-0"
					style={{ height: 2, background: accent, opacity: 0.55 }}
				/>
			)}
			<div className="mb-1 font-mono text-[9px] uppercase tracking-[0.1em] text-text-4">
				{label}
			</div>
			<div
				className="font-medium tracking-[-0.01em] text-text-1"
				style={{
					fontSize: small ? 13 : 18,
					fontVariantNumeric: "tabular-nums",
				}}
			>
				{value}
			</div>
		</div>
	);
}

// ─── Drawer icon button ──────────────────────────────────────────────────

function DrawerIconBtn({
	onClick,
	enabled,
	label,
	title,
	children,
}: {
	onClick: () => void;
	enabled: boolean;
	label: string;
	title: string;
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={!enabled}
			aria-label={label}
			title={title}
			className="inline-flex h-[26px] w-[26px] items-center justify-center rounded border border-edge-dim bg-surface-800 text-text-2 transition-colors enabled:hover:border-edge-bright enabled:hover:text-text-1 disabled:cursor-not-allowed disabled:opacity-50"
		>
			{children}
		</button>
	);
}

// ─── Drawer ──────────────────────────────────────────────────────────────

type SortMode = "recent" | "most";

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
	{ value: "recent", label: "Recent" },
	{ value: "most", label: "Most active" },
];

const INITIAL_VISIBLE = 8;
const VISIBLE_INCREMENT = 12;

interface ComboDrawerProps {
	combo: Combo;
	comboList: Combo[];
	onSelectCombo: (combo: Combo) => void;
	onClose: () => void;
	now: number;
}

export function ComboDrawer({
	combo,
	comboList,
	onSelectCombo,
	onClose,
	now,
}: ComboDrawerProps) {
	const idx = useMemo(() => comboList.findIndex((c) => c.id === combo.id), [comboList, combo.id]);
	const hasPrev = idx > 0;
	const hasNext = idx >= 0 && idx < comboList.length - 1;
	const goPrev = () => {
		if (hasPrev) onSelectCombo(comboList[idx - 1]!);
	};
	const goNext = () => {
		if (hasNext) onSelectCombo(comboList[idx + 1]!);
	};

	const [sortMode, setSortMode] = useState<SortMode>("recent");
	const [visibleN, setVisibleN] = useState(INITIAL_VISIBLE);
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset visible count when user navigates to a different combo.
	useEffect(() => {
		setVisibleN(INITIAL_VISIBLE);
	}, [combo.id]);

	const sortedSessions = useMemo(() => {
		const list = [...combo.sessions];
		if (sortMode === "most") {
			list.sort((a, b) => {
				const ta = a.skills.reduce((sum, s) => sum + s.activations, 0);
				const tb = b.skills.reduce((sum, s) => sum + s.activations, 0);
				return tb - ta;
			});
		} else {
			list.sort((a, b) => (a.lastSeenAt < b.lastSeenAt ? 1 : -1));
		}
		return list;
	}, [combo.sessions, sortMode]);

	const comboSkillSet = useMemo(() => new Set(combo.skills), [combo.skills]);

	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (e.key === "Escape") {
				onClose();
				return;
			}
			const tag = (e.target as HTMLElement | null)?.tagName;
			if (tag === "INPUT" || tag === "TEXTAREA") return;
			if (e.key === "ArrowLeft" && idx > 0) {
				e.preventDefault();
				onSelectCombo(comboList[idx - 1]!);
			}
			if (e.key === "ArrowRight" && idx >= 0 && idx < comboList.length - 1) {
				e.preventDefault();
				onSelectCombo(comboList[idx + 1]!);
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose, onSelectCombo, comboList, idx]);

	useEffect(() => {
		const prev = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = prev;
		};
	}, []);

	const topUsers = useMemo(() => {
		const counts = new Map<string, number>();
		for (const s of combo.sessions) {
			if (!s.userEmail) continue;
			counts.set(s.userEmail, (counts.get(s.userEmail) ?? 0) + 1);
		}
		return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
	}, [combo.sessions]);

	const totalActs = combo.sessions.reduce(
		(acc, s) => acc + s.skills.reduce((a, k) => a + k.activations, 0),
		0,
	);
	const lastSeenAgo = Math.max(0, (now - new Date(combo.lastSeenAt).getTime()) / 60000);

	return (
		<Fragment>
			<style>{`
				@keyframes ccu-fade-in { from { opacity: 0 } to { opacity: 1 } }
				@keyframes ccu-slide-in { from { transform: translateX(40px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
			`}</style>

			{/* Scrim */}
			<button
				type="button"
				aria-label="Close drawer"
				onClick={onClose}
				className="fixed inset-0 z-[80] border-0 bg-black/55 backdrop-blur-sm"
				style={{ animation: "ccu-fade-in .14s ease" }}
			/>

			{/* Drawer */}
			<aside
				className="fixed bottom-0 right-0 top-0 z-[81] flex flex-col border-l border-edge text-text-1 shadow-[-24px_0_80px_rgba(0,0,0,0.6)]"
				style={{
					width: "min(82vw, 760px)",
					background:
						"linear-gradient(180deg, var(--color-surface-800), var(--color-surface-900))",
					animation: "ccu-slide-in .18s ease",
				}}
			>
				{/* Header */}
				<header className="border-b border-edge-dim bg-surface-900 px-5 py-4">
					<div className="mb-2.5 flex items-center gap-2">
						<div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-accent-soft">
							Combo timelines
						</div>
						{idx >= 0 && (
							<div className="font-mono text-[9.5px] tracking-[0.08em] text-text-4">
								#{pad2(idx + 1)} of {comboList.length}
							</div>
						)}
						<div className="ml-auto flex items-center gap-1">
							<DrawerIconBtn
								onClick={goPrev}
								enabled={hasPrev}
								label="Previous combo"
								title="Previous combo (←)"
							>
								<svg width="14" height="14" viewBox="0 0 16 16" fill="none">
									<title>Previous</title>
									<path
										d="M10 3l-5 5 5 5"
										stroke="currentColor"
										strokeWidth="1.6"
										strokeLinecap="round"
										strokeLinejoin="round"
									/>
								</svg>
							</DrawerIconBtn>
							<DrawerIconBtn
								onClick={goNext}
								enabled={hasNext}
								label="Next combo"
								title="Next combo (→)"
							>
								<svg width="14" height="14" viewBox="0 0 16 16" fill="none">
									<title>Next</title>
									<path
										d="M6 3l5 5-5 5"
										stroke="currentColor"
										strokeWidth="1.6"
										strokeLinecap="round"
										strokeLinejoin="round"
									/>
								</svg>
							</DrawerIconBtn>
							<div className="mx-1 h-[18px] w-px bg-edge-dim" />
							<DrawerIconBtn
								onClick={onClose}
								enabled={true}
								label="Close drawer"
								title="Close (Esc)"
							>
								<svg width="14" height="14" viewBox="0 0 16 16" fill="none">
									<title>Close</title>
									<path
										d="M3 3l10 10M13 3L3 13"
										stroke="currentColor"
										strokeWidth="1.6"
										strokeLinecap="round"
									/>
								</svg>
							</DrawerIconBtn>
						</div>
					</div>

					{/* Skill chips */}
					<div className="mb-3.5 flex flex-wrap items-center gap-1.5">
						{combo.skills.map((s, i) => (
							<Fragment key={s}>
								<SkillChip skill={s} />
								{i < combo.skills.length - 1 && (
									<span className="font-mono text-xs text-text-4">+</span>
								)}
							</Fragment>
						))}
					</div>

					{/* Stat grid */}
					<div
						className="grid grid-cols-4 overflow-hidden rounded-lg border border-edge-dim"
						style={{ gap: 1, background: "var(--color-edge-dim)" }}
					>
						<DrawerStat
							label="Sessions"
							value={fmtNum(combo.sessionCount)}
							accent="var(--color-accent-bright)"
						/>
						<DrawerStat label="Users" value={fmtNum(combo.userCount)} />
						<DrawerStat label="Activations" value={fmtNum(totalActs)} />
						<DrawerStat label="Last seen" value={`${fmtAgo(lastSeenAgo)} ago`} small />
					</div>

					{/* Top users mini-strip */}
					{topUsers.length > 0 && (
						<div className="mt-2.5 flex flex-wrap items-center gap-2">
							<span className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-text-4">
								Top users
							</span>
							{topUsers.map(([u, n]) => {
								const initials = u
									.split("@")[0]
									?.split(/[._-]/)
									.map((p) => p[0]?.toUpperCase() ?? "")
									.filter(Boolean)
									.slice(0, 2)
									.join("");
								return (
									<span
										key={u}
										className="inline-flex items-center gap-1.5 rounded border border-edge-dim bg-surface-800 font-mono text-[10.5px] text-text-2"
										style={{ padding: "2px 8px 2px 6px" }}
									>
										<span
											className="inline-flex items-center justify-center rounded-full text-text-1"
											style={{
												width: 16,
												height: 16,
												fontSize: 8,
												letterSpacing: "0.04em",
												background:
													"linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 65%, var(--color-surface-600)), color-mix(in srgb, var(--color-accent-2) 50%, var(--color-surface-600)))",
											}}
										>
											{initials || "?"}
										</span>
										<span className="text-text-1">{u}</span>
										<span className="text-text-4" style={{ fontSize: 9.5 }}>
											{n}
											<span className="ml-0.5">sess</span>
										</span>
									</span>
								);
							})}
						</div>
					)}
				</header>

				{/* Sort row */}
				<div className="flex items-center gap-2.5 border-b border-edge-dim px-5 py-2.5 font-mono text-[10.5px]">
					<span className="uppercase tracking-[0.08em] text-text-4">
						Per-session timelines
					</span>
					<span className="ml-auto text-text-3">
						showing{" "}
						<span className="text-text-1">
							{Math.min(visibleN, sortedSessions.length)}
						</span>{" "}
						of {sortedSessions.length}
					</span>
					<div className="inline-flex rounded-md border border-edge-dim bg-surface-800 p-0.5">
						{SORT_OPTIONS.map((o) => {
							const active = sortMode === o.value;
							return (
								<button
									key={o.value}
									type="button"
									onClick={() => setSortMode(o.value)}
									className="rounded px-2 py-[3px] font-mono text-[10.5px] transition-colors"
									style={{
										color: active ? "var(--color-text-1)" : "var(--color-text-3)",
										background: active
											? "color-mix(in srgb, var(--color-accent-bright) 18%, var(--color-surface-700))"
											: "transparent",
										boxShadow: active
											? "inset 0 0 0 1px color-mix(in srgb, var(--color-accent-bright) 35%, transparent)"
											: "none",
									}}
								>
									{o.label}
								</button>
							);
						})}
					</div>
				</div>

				{/* Sessions list */}
				<div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-5 py-3 pb-5">
					{sortedSessions.slice(0, visibleN).map((s) => (
						<SessionTimelineBlock
							key={s.sessionId}
							session={s}
							comboSkillSet={comboSkillSet}
							now={now}
						/>
					))}
					{visibleN < sortedSessions.length && (
						<button
							type="button"
							onClick={() => setVisibleN((n) => n + VISIBLE_INCREMENT)}
							className="rounded-md border border-dashed border-edge bg-surface-800 px-3.5 py-2.5 text-center font-mono text-[11.5px] text-text-2 transition-colors hover:border-edge-bright hover:text-text-1"
						>
							Show {Math.min(VISIBLE_INCREMENT, sortedSessions.length - visibleN)} more sessions ↓
						</button>
					)}
				</div>

				{/* Footer hint */}
				<footer className="flex items-center gap-3 border-t border-edge-dim bg-surface-900 px-5 py-2 font-mono text-[10px] text-text-4">
					<span>
						<Kbd>esc</Kbd> close
					</span>
					<span>
						<Kbd>←</Kbd> <Kbd>→</Kbd> prev / next combo
					</span>
				</footer>
			</aside>
		</Fragment>
	);
}

function Kbd({ children }: { children: React.ReactNode }) {
	return (
		<kbd
			className="inline-block rounded border border-edge bg-surface-800 font-mono text-text-2"
			style={{
				padding: "1px 5px",
				fontSize: 9,
				lineHeight: 1.4,
				marginRight: 2,
			}}
		>
			{children}
		</kbd>
	);
}
