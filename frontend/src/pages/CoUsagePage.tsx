import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { PageHeader, SegmentedControl } from "@/components/ui";
import { SkillChip } from "@/components/cohorts/SkillChip";
import { skillColor } from "@/components/cohorts/skill-color";
import { ComboDrawer } from "@/components/co-usage/ComboDrawer";
import type { Combo } from "@/components/co-usage/types";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { CoUsageResponse, CoUsageSession, DashboardPeriod } from "@/types/api";

// ─── Tunables ────────────────────────────────────────────────────────────
const NOISE_FLOOR = 0.15; // suggest ignoring skills appearing in ≥15% of sessions
const NOISE_SUGGEST_COUNT = 3;

const PERIOD_OPTIONS: Array<{ value: DashboardPeriod; label: string }> = [
	{ value: 7, label: "7d" },
	{ value: 30, label: "30d" },
	{ value: 90, label: "90d" },
	{ value: "all", label: "All" },
];

const SIZE_OPTIONS = [
	{ value: "all", label: "All" },
	{ value: "2", label: "Pairs" },
	{ value: "3", label: "Triples" },
	{ value: "4+", label: "4+" },
] as const;
type SizeFilter = (typeof SIZE_OPTIONS)[number]["value"];

const SORT_OPTIONS = [
	{ value: "sessions", label: "Sessions" },
	{ value: "users", label: "Users" },
	{ value: "recent", label: "Recent" },
	{ value: "size", label: "Size" },
] as const;
type SortKey = (typeof SORT_OPTIONS)[number]["value"];

function formatNum(n: number): string {
	return n.toLocaleString("en-US");
}

function ageMinutes(iso: string, now: number): number {
	return Math.max(0, (now - new Date(iso).getTime()) / 60000);
}

function formatAgo(min: number): string {
	if (!Number.isFinite(min)) return "—";
	if (min < 1) return "just now";
	if (min < 60) return `${Math.round(min)}m`;
	if (min < 60 * 24) return `${Math.round(min / 60)}h`;
	return `${Math.round(min / (60 * 24))}d`;
}

// ─── Combo aggregation (re-projects sessions to ignore noise) ────────────
function aggregateCombos(sessions: CoUsageSession[], ignored: Set<string>): Combo[] {
	const map = new Map<string, Combo>();
	for (const s of sessions) {
		const kept = s.skills.filter((sk) => !ignored.has(sk.name));
		if (kept.length < 2) continue;
		const sortedNames = kept
			.map((k) => k.name)
			.slice()
			.sort();
		const id = sortedNames.join("|");
		let combo = map.get(id);
		if (!combo) {
			combo = {
				id,
				skills: sortedNames,
				size: sortedNames.length,
				sessions: [],
				sessionCount: 0,
				userCount: 0,
				users: [],
				totalActivations: 0,
				lastSeenAt: s.lastSeenAt,
			};
			map.set(id, combo);
		}
		combo.sessions.push({ ...s, skills: kept });
		combo.sessionCount += 1;
		const activations = kept.reduce((sum, k) => sum + k.activations, 0);
		combo.totalActivations += activations;
		if (s.lastSeenAt > combo.lastSeenAt) combo.lastSeenAt = s.lastSeenAt;
	}
	// finalize user lists
	for (const combo of map.values()) {
		const users = new Set<string>();
		for (const s of combo.sessions) {
			if (s.userEmail) users.add(s.userEmail);
		}
		combo.users = [...users];
		combo.userCount = users.size;
	}
	return [...map.values()];
}

// ─── Visual: density bar (30 daily bins) ─────────────────────────────────
function DensityBar({
	sessions,
	width = 200,
	height = 22,
	now,
}: {
	sessions: CoUsageSession[];
	width?: number;
	height?: number;
	now: number;
}) {
	const bins = new Array(30).fill(0);
	for (const s of sessions) {
		const ageDays = Math.floor(ageMinutes(s.lastSeenAt, now) / (60 * 24));
		const idx = 29 - Math.min(29, ageDays);
		bins[idx] += 1;
	}
	const max = Math.max(...bins, 1);
	const bw = (width - 29) / 30;
	return (
		<svg
			width={width}
			height={height}
			viewBox={`0 0 ${width} ${height}`}
			aria-hidden="true"
			className="block"
		>
			{bins.map((v, i) => {
				const bh = v === 0 ? 1.2 : Math.max(2, (v / max) * (height - 2));
				return (
					<rect
						// biome-ignore lint/suspicious/noArrayIndexKey: bins are positional.
						key={i}
						x={i * (bw + 1)}
						y={height - bh - 1}
						width={bw}
						height={bh}
						fill={v === 0 ? "var(--color-edge-dim)" : "var(--color-accent-bright)"}
						opacity={v === 0 ? 1 : 0.45 + (v / max) * 0.55}
						rx="1"
					/>
				);
			})}
		</svg>
	);
}

// ─── Visual: combo knot (n skill nodes around a hub) ─────────────────────
function ComboKnot({ skills, size = 48, top = false }: { skills: string[]; size?: number; top?: boolean }) {
	const n = skills.length || 1;
	const cx = size / 2;
	const cy = size / 2;
	const r = size * 0.34;
	const nodeR = Math.max(3.2, 6 - n * 0.45);
	const points = skills.map((s, i) => {
		const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
		return {
			key: s,
			x: cx + Math.cos(angle) * r,
			y: cy + Math.sin(angle) * r,
			color: skillColor(s),
		};
	});
	return (
		<svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
			<circle
				cx={cx}
				cy={cy}
				r={r + 3}
				fill="none"
				stroke="var(--color-edge-dim)"
				strokeDasharray="2 3"
				opacity="0.55"
			/>
			{points.map((p) => (
				<line
					key={`l-${p.key}`}
					x1={cx}
					y1={cy}
					x2={p.x}
					y2={p.y}
					stroke={p.color}
					strokeOpacity={top ? 0.75 : 0.5}
					strokeWidth="1.1"
				/>
			))}
			{points.map((p) => (
				<g key={`n-${p.key}`}>
					<circle cx={p.x} cy={p.y} r={nodeR + 2} fill={p.color} opacity="0.15" />
					<circle cx={p.x} cy={p.y} r={nodeR} fill={p.color} />
				</g>
			))}
			<circle
				cx={cx}
				cy={cy}
				r="3.6"
				fill="var(--color-surface-900)"
				stroke="var(--color-text-2)"
				strokeWidth="1.1"
			/>
			<circle cx={cx} cy={cy} r="1.4" fill="var(--color-text-1)" />
		</svg>
	);
}

// ─── Stat tile (mini) ────────────────────────────────────────────────────
function StatTile({
	label,
	value,
	sub,
	accent,
}: {
	label: string;
	value: string;
	sub?: string;
	accent: string;
}) {
	return (
		<div
			className="relative min-w-[140px] overflow-hidden rounded-lg border border-edge-dim px-3.5 py-2.5"
			style={{ background: "linear-gradient(180deg, var(--color-surface-800), var(--color-surface-900))" }}
		>
			<span
				aria-hidden="true"
				className="absolute inset-x-0 top-0 h-0.5 opacity-60"
				style={{ background: accent }}
			/>
			<div className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-text-4">{label}</div>
			<div className="mt-1 flex items-baseline gap-1.5">
				<span className="text-[22px] font-medium tracking-[-0.01em] text-text-1">{value}</span>
				{sub && <span className="font-mono text-[11px] text-text-4">{sub}</span>}
			</div>
		</div>
	);
}

// ─── IgnoreChip and SuggestChip ──────────────────────────────────────────
function IgnoreChip({ skill, onRemove }: { skill: string; onRemove: () => void }) {
	const c = skillColor(skill);
	const style: CSSProperties = {
		background: `color-mix(in srgb, ${c} 10%, var(--color-surface-800))`,
		borderColor: `color-mix(in srgb, ${c} 28%, var(--color-edge-dim))`,
	};
	return (
		<span
			className="inline-flex items-center gap-1.5 whitespace-nowrap rounded border px-2 py-[3px] pl-2 pr-1.5 font-mono text-[11.5px] text-text-2"
			style={style}
		>
			<span className="h-[5px] w-[5px] rounded-full" style={{ background: c }} />
			<span className="text-text-1">{skill}</span>
			<button
				type="button"
				onClick={onRemove}
				title="Stop ignoring this skill"
				aria-label={`Stop ignoring ${skill}`}
				className="ml-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded text-[10px] text-text-4 hover:bg-surface-700 hover:text-text-1"
			>
				✕
			</button>
		</span>
	);
}

function SuggestChip({
	skill,
	share,
	onIgnore,
}: {
	skill: string;
	share: number;
	onIgnore: () => void;
}) {
	const pct = Math.round(share * 100);
	const c = skillColor(skill);
	return (
		<button
			type="button"
			onClick={onIgnore}
			title={`Appears in ${pct}% of sessions. Click to ignore.`}
			className="inline-flex items-center gap-2 whitespace-nowrap rounded border border-dashed px-2 py-[3px] font-mono text-[11.5px] text-text-2 transition-colors"
			style={{
				background: "color-mix(in srgb, var(--color-warning) 8%, var(--color-surface-800))",
				borderColor: "color-mix(in srgb, var(--color-warning) 40%, transparent)",
			}}
		>
			<span className="h-[5px] w-[5px] rounded-full" style={{ background: c }} />
			<span className="text-text-1">{skill}</span>
			<span className="text-[10px] text-warning">{pct}%</span>
			<span className="text-[10px] text-text-4">+ ignore</span>
		</button>
	);
}

// ─── Searchable single-skill picker (for "Contains" and "Add to ignore") ─
interface PickerOption {
	name: string;
	sessions: number;
}

function SkillPicker({
	value,
	onChange,
	options,
	placeholder = "any skill",
	width = 220,
}: {
	value: string;
	onChange: (value: string) => void;
	options: PickerOption[];
	placeholder?: string;
	width?: number;
}) {
	const [open, setOpen] = useState(false);
	const [q, setQ] = useState("");
	const ref = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (!open) return;
		function onDown(e: MouseEvent) {
			if (!ref.current?.contains(e.target as Node)) setOpen(false);
		}
		function onEsc(e: KeyboardEvent) {
			if (e.key === "Escape") setOpen(false);
		}
		document.addEventListener("mousedown", onDown);
		document.addEventListener("keydown", onEsc);
		return () => {
			document.removeEventListener("mousedown", onDown);
			document.removeEventListener("keydown", onEsc);
		};
	}, [open]);
	const filtered = useMemo(() => {
		const list = !q.trim() ? options : options.filter((o) => o.name.toLowerCase().includes(q.toLowerCase()));
		return list.slice(0, 200);
	}, [q, options]);
	return (
		<div ref={ref} className="relative" style={{ minWidth: width }}>
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				className={cn(
					"flex w-full items-center gap-2.5 rounded-md border bg-surface-800 px-3 py-1.5 text-left transition-colors",
					open ? "border-edge-bright" : "border-edge-dim hover:border-edge",
				)}
			>
				{value ? (
					<>
						<span className="h-2 w-2 rounded-full" style={{ background: skillColor(value) }} />
						<span className="truncate font-mono text-[12.5px] text-text-1">{value}</span>
					</>
				) : (
					<span className="font-mono text-xs text-text-3">{placeholder}</span>
				)}
				<span className="ml-auto text-[10px] text-text-4">{open ? "▲" : "▾"}</span>
			</button>
			{open && (
				<div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 flex max-h-80 flex-col overflow-hidden rounded-lg border border-edge bg-surface-800 p-1.5 shadow-[0_14px_38px_rgba(0,0,0,0.5)]">
					<div className="mb-1 flex items-center gap-2 border-b border-dashed border-edge-dim px-2 py-1.5">
						<svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="text-text-4">
							<title>Search</title>
							<circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
							<path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
						</svg>
						<input
							// biome-ignore lint/a11y/noAutofocus: focus the input when the picker opens.
							autoFocus
							value={q}
							onChange={(e) => setQ(e.target.value)}
							placeholder="Search skill name…"
							className="flex-1 bg-transparent text-[12.5px] text-text-1 outline-none placeholder:text-text-4"
						/>
						<span className="font-mono text-[10px] text-text-4">{filtered.length}</span>
					</div>
					<div className="flex-1 overflow-y-auto">
						{filtered.map((o) => (
							<button
								key={o.name}
								type="button"
								onClick={() => {
									onChange(o.name);
									setOpen(false);
									setQ("");
								}}
								className={cn(
									"flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-colors",
									o.name === value
										? "bg-accent-bright/15"
										: "hover:bg-surface-700",
								)}
							>
								<span className="h-[7px] w-[7px] rounded-full" style={{ background: skillColor(o.name) }} />
								<span className="flex-1 truncate font-mono text-[12px] text-text-1">{o.name}</span>
								<span className="font-mono text-[10px] text-text-4">
									{o.sessions}
									<span className="ml-0.5">s</span>
								</span>
							</button>
						))}
						{filtered.length === 0 && (
							<div className="p-3 text-center text-xs text-text-4">No match</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}

// ─── Noise filter row ────────────────────────────────────────────────────
function NoiseFilterRow({
	ignored,
	suggestions,
	pickerOptions,
	onIgnore,
	onUnignore,
	onClear,
}: {
	ignored: string[];
	suggestions: { name: string; share: number }[];
	pickerOptions: PickerOption[];
	onIgnore: (name: string) => void;
	onUnignore: (name: string) => void;
	onClear: () => void;
}) {
	const [addOpen, setAddOpen] = useState(false);
	const popRef = useRef<HTMLDivElement>(null);
	const [q, setQ] = useState("");
	useEffect(() => {
		if (!addOpen) return;
		function onDown(e: MouseEvent) {
			if (!popRef.current?.contains(e.target as Node)) setAddOpen(false);
		}
		function onEsc(e: KeyboardEvent) {
			if (e.key === "Escape") setAddOpen(false);
		}
		document.addEventListener("mousedown", onDown);
		document.addEventListener("keydown", onEsc);
		return () => {
			document.removeEventListener("mousedown", onDown);
			document.removeEventListener("keydown", onEsc);
		};
	}, [addOpen]);

	const filteredPicker = useMemo(() => {
		const list = !q.trim()
			? pickerOptions
			: pickerOptions.filter((o) => o.name.toLowerCase().includes(q.toLowerCase()));
		return list.slice(0, 200);
	}, [q, pickerOptions]);

	return (
		<div
			className="flex flex-wrap items-center gap-3 rounded-lg border border-edge-dim px-3.5 py-2.5"
			style={{
				background:
					"linear-gradient(180deg, color-mix(in srgb, var(--color-warning) 3%, var(--color-surface-900)), var(--color-surface-900))",
				borderLeft: "2px solid color-mix(in srgb, var(--color-warning) 50%, var(--color-edge))",
			}}
		>
			<div className="flex items-center gap-2">
				<svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-warning opacity-90">
					<title>Ignore noise</title>
					<path d="M8 2L2 13h12L8 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
					<path d="M8 7v3M8 11.5v0.01" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
				</svg>
				<span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-text-2">Ignore noise</span>
				<span className="font-mono text-[10.5px] text-text-4">{ignored.length} ignored</span>
			</div>

			{ignored.length > 0 && (
				<div className="flex flex-wrap items-center gap-1.5">
					{ignored.map((s) => (
						<IgnoreChip key={s} skill={s} onRemove={() => onUnignore(s)} />
					))}
					{ignored.length >= 2 && (
						<button
							type="button"
							onClick={onClear}
							className="rounded px-1.5 py-0.5 font-mono text-[10.5px] text-text-4 hover:bg-surface-700 hover:text-text-2"
						>
							clear all
						</button>
					)}
				</div>
			)}

			<div ref={popRef} className="relative">
				<button
					type="button"
					onClick={() => setAddOpen((o) => !o)}
					className="inline-flex items-center gap-1.5 rounded border border-dashed border-edge bg-surface-800 px-2.5 py-[3.5px] font-mono text-[11.5px] text-text-3 transition-colors hover:border-edge-bright hover:text-text-1"
				>
					<span className="text-[13px] leading-none">+</span>
					Add skill
				</button>
				{addOpen && (
					<div className="absolute left-0 top-[calc(100%+6px)] z-[60] flex max-h-80 w-64 flex-col overflow-hidden rounded-lg border border-edge bg-surface-800 p-1.5 shadow-[0_14px_38px_rgba(0,0,0,0.5)]">
						<div className="mb-1 flex items-center gap-2 border-b border-dashed border-edge-dim px-2 py-1.5">
							<svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="text-text-4">
								<title>Search</title>
								<circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
								<path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
							</svg>
							<input
								// biome-ignore lint/a11y/noAutofocus: focus the input when the picker opens.
								autoFocus
								value={q}
								onChange={(e) => setQ(e.target.value)}
								placeholder="Search skill…"
								className="flex-1 bg-transparent text-[12.5px] text-text-1 outline-none placeholder:text-text-4"
							/>
						</div>
						<div className="flex-1 overflow-y-auto">
							{filteredPicker.map((o) => (
								<button
									key={o.name}
									type="button"
									onClick={() => {
										onIgnore(o.name);
										setAddOpen(false);
										setQ("");
									}}
									className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-surface-700"
								>
									<span className="h-[7px] w-[7px] rounded-full" style={{ background: skillColor(o.name) }} />
									<span className="flex-1 truncate font-mono text-[12px] text-text-1">{o.name}</span>
									<span className="font-mono text-[10px] text-text-4">
										{o.sessions}
										<span className="ml-0.5">s</span>
									</span>
								</button>
							))}
							{filteredPicker.length === 0 && (
								<div className="p-3 text-center text-xs text-text-4">No match</div>
							)}
						</div>
					</div>
				)}
			</div>

			{suggestions.length > 0 && (
				<div className="ml-auto flex flex-wrap items-center gap-1.5">
					<span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-4">
						Most frequent · candidates
					</span>
					{suggestions.map((s) => (
						<SuggestChip key={s.name} skill={s.name} share={s.share} onIgnore={() => onIgnore(s.name)} />
					))}
				</div>
			)}

			{ignored.length === 0 && suggestions.length === 0 && (
				<span className="ml-auto font-mono text-[11px] text-text-4">
					No high-frequency skills left to ignore.
				</span>
			)}
		</div>
	);
}

// ─── Single combo row ────────────────────────────────────────────────────
function ComboRow({
	combo,
	rank,
	onSelect,
	isSelected,
	now,
}: {
	combo: Combo;
	rank: number;
	onSelect: (combo: Combo) => void;
	isSelected: boolean;
	now: number;
}) {
	const isTop = rank === 0;
	const baseTdClass =
		"border-t border-edge-dim px-3 py-3.5 align-middle";
	return (
		<tr
			tabIndex={0}
			onClick={() => onSelect(combo)}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onSelect(combo);
				}
			}}
			className={cn(
				"cursor-pointer transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-accent-bright",
				isSelected
					? "bg-accent-bright/[0.09]"
					: isTop
						? "bg-accent-bright/[0.04] hover:bg-surface-700/55"
						: "hover:bg-surface-700/55",
			)}
		>
			<td className={cn(baseTdClass, "relative w-16 pl-4 text-center")}>
				{isTop && (
					<span
						aria-hidden="true"
						className="absolute left-0 top-2.5 bottom-2.5 w-0.5 rounded"
						style={{
							background: "var(--color-accent-bright)",
							boxShadow: "0 0 8px var(--color-accent-bright)",
						}}
					/>
				)}
				{isTop ? (
					<span
						className="inline-block rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-accent-soft"
						style={{
							background: "color-mix(in srgb, var(--color-accent-bright) 18%, transparent)",
							border: "1px solid color-mix(in srgb, var(--color-accent-bright) 40%, transparent)",
						}}
					>
						TOP
					</span>
				) : (
					<span className="font-mono text-[11px] text-text-4">
						#{String(rank + 1).padStart(2, "0")}
					</span>
				)}
			</td>

			<td className={cn(baseTdClass, "min-w-0")}>
				<div className="flex items-center gap-3.5">
					<ComboKnot skills={combo.skills} size={48} top={isTop} />
					<div className="min-w-0 flex-1">
						<div className="mb-1.5 flex flex-wrap gap-1.5">
							{combo.skills.map((s) => (
								<SkillChip key={s} skill={s} />
							))}
						</div>
						<div className="flex flex-wrap items-center gap-2 font-mono text-[10.5px] text-text-4">
							<span className="rounded border border-edge-dim px-1.5 py-px text-text-3">
								{combo.size}-skill
							</span>
							<span className="text-text-4">·</span>
							<span>{formatNum(combo.totalActivations)} activations</span>
						</div>
					</div>
				</div>
			</td>

			<td className={cn(baseTdClass, "w-[220px]")}>
				<DensityBar sessions={combo.sessions} now={now} />
				<div className="mt-0.5 flex justify-between font-mono text-[9px] text-text-4">
					<span>30d</span>
					<span>today</span>
				</div>
			</td>

			<td className={cn(baseTdClass, "w-[108px] text-right")}>
				<div
					className={cn(
						"font-mono text-[22px] font-medium leading-none tracking-[-0.01em]",
						isTop ? "text-accent-soft" : "text-text-1",
					)}
				>
					{combo.sessionCount}
				</div>
				<div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.06em] text-text-4">
					sessions
				</div>
			</td>

			<td className={cn(baseTdClass, "w-[76px] text-right")}>
				<span className="font-mono text-[14px] text-text-2">{combo.userCount}</span>
			</td>

			<td className={cn(baseTdClass, "w-[128px] whitespace-nowrap pr-4 text-right")}>
				<span className="font-mono text-[12px] text-text-3">
					{formatAgo(ageMinutes(combo.lastSeenAt, now))} ago
				</span>
			</td>
		</tr>
	);
}

// ─── Main page ───────────────────────────────────────────────────────────
export default function CoUsagePage() {
	const [period, setPeriod] = useState<DashboardPeriod>("all");
	const [data, setData] = useState<CoUsageResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [now, setNow] = useState(() => Date.now());

	const [ignored, setIgnored] = useState<Set<string>>(new Set());
	const [size, setSize] = useState<SizeFilter>("all");
	const [anchor, setAnchor] = useState<string>("");
	const [search, setSearch] = useState("");
	const [sort, setSort] = useState<SortKey>("sessions");
	const [selected, setSelected] = useState<Combo | null>(null);

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		api.coUsage
			.list(period)
			.then((res) => {
				if (cancelled) return;
				setData(res);
				setError(null);
				setNow(Date.now());
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
	}, [period]);

	const sessions = data?.sessions ?? [];

	// Noise stats are computed from the ORIGINAL universe so suggestions stay stable
	// as the user ignores skills.
	const noiseStats = useMemo(() => {
		const total = sessions.length;
		const counts = new Map<string, number>();
		for (const s of sessions) {
			for (const sk of s.skills) counts.set(sk.name, (counts.get(sk.name) ?? 0) + 1);
		}
		return [...counts.entries()]
			.map(([name, c]) => ({ name, sessions: c, share: total > 0 ? c / total : 0 }))
			.sort((a, b) => b.share - a.share);
	}, [sessions]);

	const noiseSuggestions = useMemo(
		() =>
			noiseStats
				.filter((s) => s.share >= NOISE_FLOOR && !ignored.has(s.name))
				.slice(0, NOISE_SUGGEST_COUNT)
				.map((s) => ({ name: s.name, share: s.share })),
		[noiseStats, ignored],
	);

	const pickerOptions: PickerOption[] = useMemo(
		() =>
			noiseStats
				.filter((s) => !ignored.has(s.name))
				.map((s) => ({ name: s.name, sessions: s.sessions })),
		[noiseStats, ignored],
	);

	const projectedCombos = useMemo(() => aggregateCombos(sessions, ignored), [sessions, ignored]);

	// Anchor picker options reflect the projected universe (post-ignore).
	const anchorOptions: PickerOption[] = useMemo(() => {
		const counts = new Map<string, number>();
		for (const c of projectedCombos) {
			for (const sk of c.skills) counts.set(sk, (counts.get(sk) ?? 0) + c.sessionCount);
		}
		return [...counts.entries()]
			.map(([name, sessionsCount]) => ({ name, sessions: sessionsCount }))
			.sort((a, b) => b.sessions - a.sessions);
	}, [projectedCombos]);

	const sizeCounts = useMemo(() => {
		const c = { all: projectedCombos.length, "2": 0, "3": 0, "4+": 0 };
		for (const combo of projectedCombos) {
			if (combo.size === 2) c["2"] += 1;
			else if (combo.size === 3) c["3"] += 1;
			else c["4+"] += 1;
		}
		return c;
	}, [projectedCombos]);

	const filtered = useMemo(() => {
		let list = projectedCombos;
		if (size === "2") list = list.filter((c) => c.size === 2);
		else if (size === "3") list = list.filter((c) => c.size === 3);
		else if (size === "4+") list = list.filter((c) => c.size >= 4);
		if (anchor) list = list.filter((c) => c.skills.includes(anchor));
		const q = search.trim().toLowerCase();
		if (q) list = list.filter((c) => c.skills.some((s) => s.toLowerCase().includes(q)));
		const sorted = [...list];
		if (sort === "sessions") {
			sorted.sort((a, b) => b.sessionCount - a.sessionCount || b.userCount - a.userCount);
		} else if (sort === "users") {
			sorted.sort((a, b) => b.userCount - a.userCount);
		} else if (sort === "recent") {
			sorted.sort((a, b) => (a.lastSeenAt < b.lastSeenAt ? 1 : -1));
		} else if (sort === "size") {
			sorted.sort((a, b) => b.size - a.size || b.sessionCount - a.sessionCount);
		}
		return sorted;
	}, [projectedCombos, size, anchor, search, sort]);

	// Re-projected session universe stats (post-ignore).
	const projectedSessionCount = useMemo(
		() => sessions.reduce((sum, s) => sum + (s.skills.filter((k) => !ignored.has(k.name)).length >= 2 ? 1 : 0), 0),
		[sessions, ignored],
	);
	const projectedUserCount = useMemo(() => {
		const users = new Set<string>();
		for (const s of sessions) {
			if (s.skills.filter((k) => !ignored.has(k.name)).length < 2) continue;
			if (s.userEmail) users.add(s.userEmail);
		}
		return users.size;
	}, [sessions, ignored]);

	function ignore(name: string) {
		setIgnored((prev) => {
			const next = new Set(prev);
			next.add(name);
			return next;
		});
		if (anchor === name) setAnchor("");
	}
	function unignore(name: string) {
		setIgnored((prev) => {
			const next = new Set(prev);
			next.delete(name);
			return next;
		});
	}
	function clearIgnored() {
		setIgnored(new Set());
	}

	// When the user picks a new period, drop any selected combo (its data is stale).
	useEffect(() => {
		setSelected(null);
	}, []);

	const repeatCombos = projectedCombos.filter((c) => c.sessionCount > 1).length;

	return (
		<div className="flex h-full flex-col gap-4">
			<PageHeader
				eyebrow="CO-USAGE"
				title={
					<>
						Skills that recur{" "}
						<span className="font-serif italic font-normal text-accent-soft">together</span> in the
						same session
					</>
				}
				subtitle={
					<>
						Each row is a group of skills (2, 3, 4 or more) that has fired inside at least one shared{" "}
						<span className="font-mono text-text-2">session_id</span>, ranked by how many sessions
						repeat that exact set. Sessions with a single activated skill are excluded.
					</>
				}
				actions={
					<div className="flex items-center gap-2.5">
						<StatTile
							label="Multi-skill sessions"
							value={formatNum(projectedSessionCount)}
							sub={`${projectedUserCount} ${projectedUserCount === 1 ? "user" : "users"}`}
							accent="var(--color-accent-bright)"
						/>
						<StatTile
							label="Distinct combos"
							value={formatNum(projectedCombos.length)}
							sub={`${repeatCombos} repeat`}
							accent="var(--color-accent-2)"
						/>
						<SegmentedControl<DashboardPeriod>
							value={period}
							onChange={setPeriod}
							options={PERIOD_OPTIONS}
						/>
					</div>
				}
			/>

			{error && <p className="text-sm text-danger">{error}</p>}

			<NoiseFilterRow
				ignored={[...ignored]}
				suggestions={noiseSuggestions}
				pickerOptions={pickerOptions}
				onIgnore={ignore}
				onUnignore={unignore}
				onClear={clearIgnored}
			/>

			{/* Filter row */}
			<div className="flex flex-wrap items-center gap-2.5 rounded-lg border border-edge-dim bg-surface-900 px-3 py-2.5">
				<span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-4">Size</span>
				<SegmentedControl<SizeFilter>
					value={size}
					onChange={setSize}
					options={SIZE_OPTIONS.map((o) => ({
						value: o.value,
						label: `${o.label} ${sizeCounts[o.value]}`,
					}))}
				/>

				<span aria-hidden="true" className="mx-1 h-5 w-px bg-edge-dim" />

				<div className="flex items-center gap-2">
					<span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-4">
						Contains
					</span>
					<SkillPicker
						value={anchor}
						onChange={setAnchor}
						options={anchorOptions}
						placeholder="any skill"
						width={200}
					/>
					{anchor && (
						<button
							type="button"
							onClick={() => setAnchor("")}
							className="px-1 text-xs text-text-4 hover:text-text-2"
						>
							clear
						</button>
					)}
				</div>

				<label className="flex min-w-[200px] flex-1 items-center gap-2 rounded-md border border-edge-dim bg-surface-800 px-2.5 py-1">
					<svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="text-text-4">
						<title>Search</title>
						<circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
						<path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
					</svg>
					<input
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Search a skill name inside combos…"
						className="flex-1 bg-transparent text-[13px] text-text-1 outline-none placeholder:text-text-4"
					/>
				</label>

				<span aria-hidden="true" className="mx-1 h-5 w-px bg-edge-dim" />

				<SegmentedControl<SortKey>
					value={sort}
					onChange={setSort}
					options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
				/>

				<span className="ml-auto font-mono text-[11px] text-text-4">
					{filtered.length} <span className="text-text-4">/ {projectedCombos.length}</span>
				</span>
			</div>

			{/* List + drawer */}
			<div className="flex min-h-0 flex-1 gap-3.5">
				<div
					className="flex-1 min-w-0 overflow-auto rounded-lg border border-edge-dim"
					style={{ background: "linear-gradient(180deg, var(--color-surface-800), var(--color-surface-900))" }}
				>
					{loading ? (
						<div className="p-12 text-center text-text-4">
							<div className="mb-1.5 font-mono text-xs uppercase tracking-[0.1em]">Loading…</div>
						</div>
					) : filtered.length === 0 ? (
						<div className="p-12 text-center text-text-4">
							<div className="mb-1.5 font-mono text-xs uppercase tracking-[0.1em]">No combos</div>
							<div className="text-sm text-text-3">
								{sessions.length === 0
									? "No multi-skill sessions ingested yet."
									: "Try widening the size filter or clearing the search."}
							</div>
						</div>
					) : (
						<table className="w-full border-separate" style={{ borderSpacing: 0 }}>
							<colgroup>
								<col style={{ width: 64 }} />
								<col />
								<col style={{ width: 220 }} />
								<col style={{ width: 108 }} />
								<col style={{ width: 76 }} />
								<col style={{ width: 128 }} />
							</colgroup>
							<thead>
								<tr>
									{(
										[
											{ label: "", key: null, align: "left", pl: 16 },
											{ label: "Combo", key: null, align: "left" },
											{ label: "30d distribution", key: null, align: "left" },
											{ label: "Sessions", key: "sessions" as SortKey, align: "right" },
											{ label: "Users", key: "users" as SortKey, align: "right" },
											{ label: "Last seen", key: "recent" as SortKey, align: "right", pr: 18 },
										] as const
									).map((h) => (
										<th
											key={h.label || "rank"}
											className={cn(
												"sticky top-0 z-[2] whitespace-nowrap border-b border-edge-dim bg-surface-900 px-3 py-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-text-4",
												h.align === "right" ? "text-right" : "text-left",
											)}
											style={{
												paddingLeft: "pl" in h ? h.pl : undefined,
												paddingRight: "pr" in h ? h.pr : undefined,
											}}
										>
											{h.key ? (
												<button
													type="button"
													onClick={() => setSort(h.key)}
													className="cursor-pointer select-none font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-text-4 hover:text-text-2"
												>
													{h.label}
													{sort === h.key && (
														<span className="ml-1 text-accent-soft">▼</span>
													)}
												</button>
											) : (
												h.label
											)}
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{filtered.map((c, i) => (
									<ComboRow
										key={c.id}
										combo={c}
										rank={i}
										now={now}
										onSelect={setSelected}
										isSelected={selected?.id === c.id}
									/>
								))}
							</tbody>
						</table>
					)}
				</div>

			</div>

			{selected && (
				<ComboDrawer
					combo={projectedCombos.find((c) => c.id === selected.id) ?? selected}
					comboList={filtered}
					onSelectCombo={setSelected}
					onClose={() => setSelected(null)}
					now={now}
				/>
			)}

		</div>
	);
}
