import { useLocation } from "react-router-dom";

const PAGE_LABELS: Record<string, string> = {
	dashboard: "Dashboard",
	skills: "Skills",
	marketplaces: "Marketplaces",
	plugins: "Plugins",
	tokens: "Tokens",
	audit: "Audit Log",
	onboarding: "Onboarding",
	settings: "Settings",
	integrations: "Integrations",
};

function crumbsForPath(pathname: string): string[] {
	const segments = pathname.split("/").filter(Boolean);
	if (segments.length === 0) return ["Dashboard"];
	return segments.map((s) => PAGE_LABELS[s] ?? s);
}

export function TopBar() {
	const { pathname } = useLocation();
	const crumbs = crumbsForPath(pathname);

	return (
		<header
			className="flex h-14 shrink-0 items-center gap-3.5 border-b border-edge-dim px-5"
			style={{
				background: "color-mix(in srgb, var(--color-surface-900) 80%, transparent)",
				backdropFilter: "blur(8px)",
			}}
		>
			<nav
				aria-label="Breadcrumb"
				className="flex shrink-0 items-center gap-2 whitespace-nowrap font-mono text-[11px] tracking-[0.04em] text-text-3"
			>
				<span>Skillsight</span>
				{crumbs.map((c, i) => {
					const isLast = i === crumbs.length - 1;
					const key = `${crumbs.slice(0, i + 1).join("/")}`;
					return (
						<span key={key} className="flex items-center gap-2">
							<span className="text-text-4">/</span>
							<span className={isLast ? "text-text-1" : ""}>{c}</span>
						</span>
					);
				})}
			</nav>
		</header>
	);
}
