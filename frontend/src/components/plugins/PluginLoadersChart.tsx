import type { PluginWeeklyLoaders } from "@/types/api";
import { useMemo, useState } from "react";

interface Props {
	data: PluginWeeklyLoaders;
}

// CSS-token-backed palette. The last entry is reused for "other" when there
// are more versions than colors.
const PALETTE = [
	{ name: "accent-bright", varName: "--color-accent-bright" },
	{ name: "accent-2", varName: "--color-accent-2" },
	{ name: "warning", varName: "--color-warning" },
	{ name: "info", varName: "--color-info" },
	{ name: "success", varName: "--color-success" },
	{ name: "magenta", varName: "--color-magenta" },
] as const;

const MAX_LEGEND_VERSIONS = 6;
const OTHER_KEY = "__other__";

const WIDTH = 480;
const HEIGHT = 140;
const PADDING_TOP = 12;
const PADDING_BOTTOM = 22;
const PADDING_LEFT = 4;
const PADDING_RIGHT = 4;

export function PluginLoadersChart({ data }: Props) {
	const [hoverIdx, setHoverIdx] = useState<number | null>(null);

	const view = useMemo(() => buildViewModel(data), [data]);

	if (view.weeks.length === 0) return null;

	const chartHeight = HEIGHT - PADDING_TOP - PADDING_BOTTOM;
	const chartWidth = WIDTH - PADDING_LEFT - PADDING_RIGHT;
	const slot = chartWidth / view.weeks.length;
	const barWidth = Math.max(4, slot * 0.66);

	return (
		<div className="space-y-2">
			<div className="relative">
				<svg
					viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
					preserveAspectRatio="none"
					className="w-full h-[140px]"
					role="img"
					aria-label="Weekly unique loaders over the last 60 days"
				>
					{/* Baseline */}
					<line
						x1={0}
						y1={HEIGHT - PADDING_BOTTOM}
						x2={WIDTH}
						y2={HEIGHT - PADDING_BOTTOM}
						className="stroke-edge-dim"
						strokeWidth="1"
					/>
					{view.weeks.map((week, i) => {
						const cx = PADDING_LEFT + slot * (i + 0.5);
						const x = cx - barWidth / 2;
						let yCursor = HEIGHT - PADDING_BOTTOM;
						return (
							<g
								key={week.weekStart}
								onMouseEnter={() => setHoverIdx(i)}
								onMouseLeave={() => setHoverIdx((cur) => (cur === i ? null : cur))}
							>
								{/* Hover hit-area covering the whole slot */}
								<rect
									x={PADDING_LEFT + slot * i}
									y={PADDING_TOP}
									width={slot}
									height={chartHeight}
									fill="transparent"
								/>
								{week.segments.map((seg) => {
									const h = view.maxTotal === 0 ? 0 : (seg.value / view.maxTotal) * chartHeight;
									if (h <= 0) return null;
									yCursor -= h;
									return (
										<rect
											key={seg.key}
											x={x}
											y={yCursor}
											width={barWidth}
											height={h}
											style={{ fill: `var(${seg.color})` }}
											opacity={hoverIdx === null || hoverIdx === i ? 1 : 0.35}
										/>
									);
								})}
								<text
									x={cx}
									y={HEIGHT - PADDING_BOTTOM + 14}
									textAnchor="middle"
									className="fill-text-4"
									style={{ fontSize: 9 }}
								>
									{formatWeekLabel(week.weekStart)}
								</text>
							</g>
						);
					})}
					{/* Max value annotation top-right */}
					{view.maxTotal > 0 && (
						<text
							x={WIDTH - PADDING_RIGHT}
							y={PADDING_TOP - 2}
							textAnchor="end"
							className="fill-text-4"
							style={{ fontSize: 9 }}
						>
							max {view.maxTotal}
						</text>
					)}
				</svg>
				{hoverIdx !== null && (
					<Tooltip week={view.weeks[hoverIdx]} versionsMode={view.mode === "stacked"} />
				)}
			</div>
			{view.mode === "stacked" && (
				<ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-text-3">
					{view.legend.map((item) => (
						<li key={item.key} className="flex items-center gap-1.5">
							<span
								className="inline-block w-2 h-2 rounded-sm"
								style={{ backgroundColor: `var(${item.color})` }}
							/>
							<span className="font-mono">{item.label}</span>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

interface Segment {
	key: string;
	value: number;
	color: string;
}

interface WeekView {
	weekStart: string;
	total: number;
	segments: Segment[];
	breakdown: Array<{ key: string; label: string; value: number }>;
}

interface ViewModel {
	mode: "stacked" | "single";
	maxTotal: number;
	weeks: WeekView[];
	legend: Array<{ key: string; label: string; color: string }>;
}

function buildViewModel(data: PluginWeeklyLoaders): ViewModel {
	const mode: "stacked" | "single" = data.versions.length > 0 ? "stacked" : "single";

	const visibleVersions = data.versions.slice(0, MAX_LEGEND_VERSIONS);
	const hiddenVersions = data.versions.slice(MAX_LEGEND_VERSIONS);

	const colorByVersion = new Map<string, string>();
	visibleVersions.forEach((v, i) => {
		colorByVersion.set(v, PALETTE[i % PALETTE.length].varName);
	});
	const otherColor = PALETTE[Math.min(visibleVersions.length, PALETTE.length - 1)].varName;

	const weeks: WeekView[] = data.weeks.map((w) => {
		if (mode === "single") {
			return {
				weekStart: w.weekStart,
				total: w.total,
				segments: w.total > 0 ? [{ key: "total", value: w.total, color: PALETTE[0].varName }] : [],
				breakdown: [],
			};
		}
		const segments: Segment[] = [];
		const breakdown: Array<{ key: string; label: string; value: number }> = [];
		// Stack visible versions bottom-up in palette order, then "other".
		for (const v of visibleVersions) {
			const value = w.perVersion[v] ?? 0;
			if (value > 0) {
				const color = colorByVersion.get(v) ?? PALETTE[0].varName;
				segments.push({ key: v, value, color });
				breakdown.push({ key: v, label: v, value });
			}
		}
		if (hiddenVersions.length > 0) {
			let otherSum = 0;
			for (const v of hiddenVersions) otherSum += w.perVersion[v] ?? 0;
			if (otherSum > 0) {
				segments.push({ key: OTHER_KEY, value: otherSum, color: otherColor });
				breakdown.push({
					key: OTHER_KEY,
					label: `+${hiddenVersions.length} more`,
					value: otherSum,
				});
			}
		}
		return { weekStart: w.weekStart, total: w.total, segments, breakdown };
	});

	const maxTotal = weeks.reduce((m, w) => {
		// In stacked mode segments can exceed total when same user loads multiple
		// versions in one week; chart height must accommodate that.
		const segmentSum = w.segments.reduce((s, x) => s + x.value, 0);
		return Math.max(m, w.total, segmentSum);
	}, 0);

	const legend =
		mode === "stacked"
			? [
					...visibleVersions.map((v) => ({
						key: v,
						label: v,
						color: colorByVersion.get(v) ?? PALETTE[0].varName,
					})),
					...(hiddenVersions.length > 0
						? [{ key: OTHER_KEY, label: `+${hiddenVersions.length} more`, color: otherColor }]
						: []),
				]
			: [];

	return { mode, maxTotal, weeks, legend };
}

function Tooltip({ week, versionsMode }: { week: WeekView; versionsMode: boolean }) {
	return (
		<div className="pointer-events-none absolute right-0 top-0 z-10 rounded border border-edge-dim bg-surface-700 px-2 py-1.5 text-[11px] shadow-md">
			<p className="font-medium text-text-1">Week of {formatWeekTooltip(week.weekStart)}</p>
			<p className="text-text-3">
				{week.total} unique loader{week.total === 1 ? "" : "s"}
			</p>
			{versionsMode && week.breakdown.length > 0 && (
				<ul className="mt-1 space-y-0.5">
					{week.breakdown.map((b) => (
						<li key={b.key} className="flex items-center justify-between gap-3">
							<span className="font-mono text-text-2">{b.label}</span>
							<span className="tabular-nums text-text-1">{b.value}</span>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

function formatWeekLabel(iso: string): string {
	const d = new Date(`${iso}T00:00:00Z`);
	return d.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		timeZone: "UTC",
	});
}

function formatWeekTooltip(iso: string): string {
	const d = new Date(`${iso}T00:00:00Z`);
	return d.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		timeZone: "UTC",
	});
}
