import { cn } from "@/lib/utils";
import { NavLink } from "react-router-dom";

const mainLinks = [
	{ to: "/dashboard", label: "Dashboard" },
	{ to: "/skills", label: "Skills" },
	{ to: "/marketplaces", label: "Marketplaces" },
	{ to: "/plugins", label: "Plugins" },
	{ to: "/tokens", label: "Tokens" },
	{ to: "/audit", label: "Audit Log" },
];

const settingsLinks = [{ to: "/settings/integrations", label: "Integrations" }];

function NavItem({ to, label }: { to: string; label: string }) {
	return (
		<NavLink
			to={to}
			className={({ isActive }) =>
				cn(
					"block rounded-md px-3 py-2 text-sm transition-colors",
					isActive
						? "nav-active"
						: "text-text-3 hover:bg-surface-800 hover:text-text-1",
				)
			}
		>
			{label}
		</NavLink>
	);
}

export function Sidebar() {
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
						<NavItem key={to} to={to} label={label} />
					))}
				</div>
				<div className="mt-auto pt-4 border-t border-edge-dim">
					<p className="px-3 pb-1 text-xs font-medium text-text-4 uppercase tracking-wider">
						Settings
					</p>
					<div className="space-y-1">
						{settingsLinks.map(({ to, label }) => (
							<NavItem key={to} to={to} label={label} />
						))}
					</div>
				</div>
			</nav>
		</aside>
	);
}
