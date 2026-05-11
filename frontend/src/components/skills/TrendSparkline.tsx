import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface TrendSparklineProps {
	values: number[];
	width?: number;
	height?: number;
	strokeClass?: string;
	fillClass?: string;
	/** CSS color used for the highlighted-day count in the tooltip header. */
	highlightColor?: string;
	/** Number of days the values cover — shown as "{days}d total" in the tooltip. */
	days?: number;
}

const TIP_WIDTH = 240;
const TIP_MARGIN = 12;
const TIP_APPROX_HEIGHT = 160;

export function TrendSparkline({
	values,
	width = 80,
	height = 20,
	strokeClass = "stroke-accent-bright",
	fillClass = "fill-accent-bright/15",
	highlightColor = "var(--color-accent-bright)",
	days = 30,
}: TrendSparklineProps) {
	const wrapRef = useRef<HTMLDivElement>(null);
	const [hover, setHover] = useState<{
		idx: number;
		cx: number;
		cy: number;
	} | null>(null);
	const [tipPos, setTipPos] = useState<{ left: number; top: number } | null>(null);

	const total = values.reduce((a, b) => a + b, 0);
	const interactive = total > 0 && values.length > 1;

	useEffect(() => {
		if (!tipPos) return;
		const dismiss = () => {
			setHover(null);
			setTipPos(null);
		};
		window.addEventListener("scroll", dismiss, true);
		window.addEventListener("resize", dismiss);
		return () => {
			window.removeEventListener("scroll", dismiss, true);
			window.removeEventListener("resize", dismiss);
		};
	}, [tipPos]);

	if (values.length === 0) {
		return (
			<svg width={width} height={height} aria-hidden="true">
				<line
					x1="0"
					y1={height - 1}
					x2={width}
					y2={height - 1}
					className="stroke-edge-dim"
					strokeWidth="1"
				/>
			</svg>
		);
	}

	const max = Math.max(1, ...values);
	const stepX = values.length > 1 ? width / (values.length - 1) : 0;
	const points = values.map((v, i) => {
		const x = i * stepX;
		const y = height - 1 - (v / max) * (height - 2);
		return [x, y] as const;
	});
	const linePath = points
		.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`)
		.join(" ");
	const lastX = (points.length === 1 ? width : (points.length - 1) * stepX).toFixed(2);
	const inner = points.map(([x, y]) => `L ${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
	const areaPath = `M 0 ${height - 1} ${inner} L ${lastX} ${height - 1} Z`;

	function onMove(e: React.MouseEvent<HTMLDivElement>) {
		const el = wrapRef.current;
		if (!el) return;
		const rect = el.getBoundingClientRect();
		const ratio = (e.clientX - rect.left) / rect.width;
		let idx = Math.round(ratio * (values.length - 1));
		idx = Math.max(0, Math.min(values.length - 1, idx));
		const [cx, cy] = points[idx];
		setHover({ idx, cx, cy });

		const vw = window.innerWidth;
		const vh = window.innerHeight;
		const tooltipWidth = Math.min(TIP_WIDTH, vw - TIP_MARGIN * 2);
		// Anchor to the hovered data point on screen, not the chart edge —
		// otherwise wide charts (e.g. the dashboard hero) shove the tooltip far
		// from the cursor.
		const pointPageX = rect.left + (cx / width) * rect.width;
		const pointPageY = rect.top + (cy / height) * rect.height;
		const flipLeft = pointPageX + tooltipWidth + 10 + TIP_MARGIN > vw;
		let left = flipLeft ? pointPageX - tooltipWidth - 10 : pointPageX + 10;
		if (left < TIP_MARGIN) left = TIP_MARGIN;
		if (left + tooltipWidth > vw - TIP_MARGIN) {
			left = vw - tooltipWidth - TIP_MARGIN;
		}
		let top = pointPageY - TIP_APPROX_HEIGHT / 2;
		if (top < TIP_MARGIN) top = TIP_MARGIN;
		if (top + TIP_APPROX_HEIGHT > vh - TIP_MARGIN) {
			top = vh - TIP_APPROX_HEIGHT - TIP_MARGIN;
		}
		setTipPos({ left, top });
	}

	function onLeave() {
		setHover(null);
		setTipPos(null);
	}

	const cur = hover ? values[hover.idx] : null;
	const avg = total / values.length;
	const peak = Math.max(...values);
	const peakIdx = values.indexOf(peak);
	const peakDaysAgo = values.length - 1 - peakIdx;
	const peakLabel =
		peakDaysAgo === 0 ? "today" : peakDaysAgo === 1 ? "yesterday" : `${peakDaysAgo}d ago`;
	const last7 = values.slice(-7).reduce((a, b) => a + b, 0);
	const prev7 = values.slice(-14, -7).reduce((a, b) => a + b, 0);
	const delta7Pct = prev7 > 0 ? ((last7 - prev7) / prev7) * 100 : null;
	const curDaysAgo = hover ? values.length - 1 - hover.idx : 0;
	const dayLabel =
		curDaysAgo === 0 ? "Today" : curDaysAgo === 1 ? "Yesterday" : `${curDaysAgo}d ago`;

	return (
		<div
			ref={wrapRef}
			className={cn(
				"relative inline-block leading-none",
				interactive && "cursor-crosshair",
			)}
			onMouseMove={interactive ? onMove : undefined}
			onMouseLeave={interactive ? onLeave : undefined}
		>
			<svg width={width} height={height} aria-hidden="true">
				<title>{`${total} activations across ${values.length} days`}</title>
				<path d={areaPath} className={fillClass} />
				<path
					d={linePath}
					className={strokeClass}
					strokeWidth="1.5"
					fill="none"
					strokeLinejoin="round"
					strokeLinecap="round"
				/>
				{hover && (
					<g>
						<line
							x1={hover.cx}
							x2={hover.cx}
							y1={0}
							y2={height}
							className={strokeClass}
							strokeOpacity="0.4"
							strokeDasharray="2 2"
							strokeWidth="1"
						/>
						<circle
							cx={hover.cx}
							cy={hover.cy}
							r="2.5"
							className={cn(strokeClass, "fill-surface-900")}
							strokeWidth="1.4"
						/>
					</g>
				)}
			</svg>
			{interactive && hover && tipPos && cur !== null &&
				createPortal(
					<div
						role="tooltip"
						className="pointer-events-none fixed z-50 rounded-lg border border-edge bg-surface-800 px-3 py-2.5 shadow-[0_12px_30px_rgba(0,0,0,0.65)]"
						style={{ left: tipPos.left, top: tipPos.top, width: TIP_WIDTH }}
					>
						<div className="mb-1.5 flex items-baseline justify-between border-b border-edge-dim pb-1.5">
							<span className="font-mono text-[10px] uppercase tracking-[0.06em] text-text-3">
								{dayLabel}
							</span>
							<span
								className="font-mono text-base tabular-nums"
								style={{ color: highlightColor }}
							>
								{cur.toLocaleString("en-US")}
							</span>
						</div>
						<div className="space-y-0.5">
							<TipRow
								label="vs avg/day"
								value={`${cur >= avg ? "+" : ""}${Math.round(cur - avg).toLocaleString("en-US")}`}
								tone={cur >= avg ? "up" : "dn"}
							/>
							<TipRow label={`${days}d total`} value={total.toLocaleString("en-US")} />
							<TipRow label={`peak · ${peakLabel}`} value={peak.toLocaleString("en-US")} />
							{delta7Pct !== null && (
								<TipRow
									label="last 7d vs prior"
									value={`${delta7Pct >= 0 ? "+" : ""}${delta7Pct.toFixed(0)}%`}
									tone={delta7Pct >= 0 ? "up" : "dn"}
								/>
							)}
						</div>
					</div>,
					document.body,
				)}
		</div>
	);
}

function TipRow({
	label,
	value,
	tone,
}: {
	label: string;
	value: string;
	tone?: "up" | "dn";
}) {
	return (
		<div className="flex items-center justify-between py-0.5 font-mono text-[11px]">
			<span className="text-text-4">{label}</span>
			<span
				className={cn(
					"tabular-nums",
					tone === "up" && "text-success",
					tone === "dn" && "text-danger",
					!tone && "text-text-1",
				)}
			>
				{value}
			</span>
		</div>
	);
}
