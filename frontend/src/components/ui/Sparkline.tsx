interface SparklineProps {
	values: number[];
	width?: number;
	height?: number;
	className?: string;
	strokeClass?: string;
	fillClass?: string;
	/**
	 * When true, the SVG renders with viewBox so it can be scaled via
	 * CSS (width: 100%, etc.). The width/height props then act as the
	 * internal coordinate space.
	 */
	responsive?: boolean;
}

export function Sparkline({
	values,
	width = 80,
	height = 20,
	className,
	strokeClass = "stroke-accent-bright",
	fillClass = "fill-accent-bright/15",
	responsive = false,
}: SparklineProps) {
	const svgProps = responsive
		? { viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: "none" as const }
		: { width, height };

	if (values.length === 0) {
		return (
			<svg {...svgProps} className={className} aria-hidden="true">
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

	return (
		<svg {...svgProps} className={className} aria-hidden="true">
			<title>{`${values.reduce((a, b) => a + b, 0)} activations across ${values.length} days`}</title>
			<path d={areaPath} className={fillClass} />
			<path d={linePath} className={strokeClass} strokeWidth="1.5" fill="none" strokeLinejoin="round" strokeLinecap="round" />
		</svg>
	);
}
