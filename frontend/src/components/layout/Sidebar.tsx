import { useIntegrationsHealth } from "@/context/IntegrationsHealthContext";
import { useMarketplaceSourcesHealth } from "@/context/MarketplaceSourcesHealthContext";
import { cn } from "@/lib/utils";
import { NavLink } from "react-router-dom";

const mainLinks = [
	{ to: "/dashboard", label: "Dashboard" },
	{ to: "/skills", label: "Skills" },
	{ to: "/marketplaces", label: "Marketplaces" },
	{ to: "/plugins", label: "Plugins" },
	{ to: "/tokens", label: "Tokens" },
	{ to: "/audit", label: "Audit Log" },
] as const;

interface NavBadge {
	count: number;
	tone: "danger";
}

function NavItem({ to, label, badge }: { to: string; label: string; badge?: NavBadge }) {
	return (
		<NavLink
			to={to}
			className={({ isActive }) =>
				cn(
					"flex items-center rounded-md px-3 py-2 text-sm transition-colors",
					isActive
						? "nav-active"
						: "text-text-3 hover:bg-surface-800 hover:text-text-1",
				)
			}
		>
			<span className="flex-1">{label}</span>
			{badge && badge.count > 0 && (
				<span
					className="ml-2 inline-flex min-w-[18px] items-center justify-center rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white"
					aria-label={`${badge.count} sync error(s)`}
				>
					{badge.count}
				</span>
			)}
		</NavLink>
	);
}

export function Sidebar() {
	const { errorCount: integrationsErrorCount } = useIntegrationsHealth();
	const { errorCount: marketplaceSourcesErrorCount } = useMarketplaceSourcesHealth();
	const integrationsBadge: NavBadge | undefined =
		integrationsErrorCount > 0 ? { count: integrationsErrorCount, tone: "danger" } : undefined;
	const marketplacesBadge: NavBadge | undefined =
		marketplaceSourcesErrorCount > 0
			? { count: marketplaceSourcesErrorCount, tone: "danger" }
			: undefined;

	const badgeFor = (to: string): NavBadge | undefined => {
		if (to === "/marketplaces") return marketplacesBadge;
		return undefined;
	};

	return (
		<aside className="w-56 shrink-0 bg-surface-900 border-r border-edge flex flex-col">
			<div className="px-5 py-4 border-b border-edge">
				<span className="flex items-center gap-2 text-sm font-semibold text-text-1">
					<span className="text-accent-soft text-base leading-none">◈</span>
					Skills Observability
				</span>
			</div>
			<nav className="flex-1 px-3 py-3 flex flex-col">
				<div className="space-y-1">
					{mainLinks.map(({ to, label }) => (
						<NavItem key={to} to={to} label={label} badge={badgeFor(to)} />
					))}
				</div>
				<div className="mt-auto pt-4 border-t border-edge-dim">
					<p className="px-3 pb-1 text-xs font-medium text-text-4 uppercase tracking-wider">
						Settings
					</p>
					<div className="space-y-1">
						<NavItem to="/settings/integrations" label="Integrations" badge={integrationsBadge} />
					</div>
				</div>
			</nav>
		</aside>
	);
}
