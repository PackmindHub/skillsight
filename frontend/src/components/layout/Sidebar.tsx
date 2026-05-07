import { cn } from "@/lib/utils";
import { NavLink } from "react-router-dom";

const mainLinks = [
	{ to: "/dashboard", label: "Dashboard" },
	{ to: "/skills", label: "Skills" },
	{ to: "/marketplaces", label: "Marketplaces" },
	{ to: "/shadow", label: "Shadow Detection" },
	{ to: "/allowlist", label: "Allowlist" },
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
					"relative block rounded-md px-3 py-2 text-sm transition-colors",
					isActive
						? "bg-gradient-to-r from-violet-600/20 to-transparent text-violet-300 font-medium before:absolute before:left-0 before:top-1 before:bottom-1 before:w-0.5 before:rounded-full before:bg-violet-500"
						: "text-slate-400 hover:bg-surface-800 hover:text-slate-200",
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
				<span className="flex items-center gap-2 text-sm font-semibold text-slate-100">
					<span className="text-violet-400 text-base leading-none">◈</span>
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
					<p className="px-3 pb-1 text-xs font-medium text-slate-600 uppercase tracking-wider">
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
