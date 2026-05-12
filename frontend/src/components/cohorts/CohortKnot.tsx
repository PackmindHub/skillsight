import { skillColor } from "./skill-color";

interface CohortKnotProps {
  skills: string[];
  size?: number;
}

export function CohortKnot({ skills, size = 52 }: CohortKnotProps) {
  const n = skills.length || 1;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.32;
  const nodeR = Math.max(4.5, 8 - n * 0.6);

  const positions = skills.map((skill, i) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    return {
      key: skill,
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
      color: skillColor(skill),
    };
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="cohort-knot"
      aria-hidden="true"
    >
      <circle
        cx={cx}
        cy={cy}
        r={r + 3}
        fill="none"
        stroke="var(--color-edge-dim)"
        strokeDasharray="2 3"
        opacity="0.5"
      />
      {positions.map((p) => (
        <line
          key={`l-${p.key}`}
          x1={cx}
          y1={cy}
          x2={p.x}
          y2={p.y}
          stroke={p.color}
          strokeOpacity={0.45}
          strokeWidth="1.2"
        />
      ))}
      {positions.map((p) => (
        <g key={`n-${p.key}`}>
          <circle cx={p.x} cy={p.y} r={nodeR + 2} fill={p.color} opacity="0.14" />
          <circle cx={p.x} cy={p.y} r={nodeR} fill={p.color} />
        </g>
      ))}
      <circle
        cx={cx}
        cy={cy}
        r="4"
        fill="var(--color-surface-950)"
        stroke="var(--color-text-2)"
        strokeWidth="1.2"
      />
      <circle cx={cx} cy={cy} r="1.6" fill="var(--color-text-1)" />
    </svg>
  );
}
