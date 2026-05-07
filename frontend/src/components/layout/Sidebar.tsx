import { cn } from "@/lib/utils";
import { NavLink } from "react-router-dom";

const mainLinks = [
	{ to: "/dashboard", label: "Dashboard" },
	{ to: "/skills", label: "Skills" },
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
					"block rounded-md px-3 py-2 text-sm",
					isActive
						? "bg-indigo-50 text-indigo-700 font-medium"
						: "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
				)
			}
		>
			{label}
		</NavLink>
	);
}

export function Sidebar() {
	return (
		<aside className="w-56 shrink-0 bg-white border-r border-gray-200 flex flex-col">
			<div className="px-5 py-4 border-b border-gray-200">
				<span className="text-sm font-semibold text-gray-900">Skills Observability</span>
			</div>
			<nav className="flex-1 px-3 py-3 flex flex-col">
				<div className="space-y-1">
					{mainLinks.map(({ to, label }) => (
						<NavItem key={to} to={to} label={label} />
					))}
				</div>
				<div className="mt-auto pt-4 border-t border-gray-100">
					<p className="px-3 pb-1 text-xs font-medium text-gray-400 uppercase tracking-wider">
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
