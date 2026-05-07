import { cn } from "@/lib/utils";
import { NavLink, Outlet } from "react-router-dom";

const settingsNav = [{ to: "/settings/integrations", label: "Integrations" }];

export function SettingsLayout() {
	return (
		<div className="flex gap-6 h-full">
			<nav className="w-44 shrink-0">
				<p className="px-3 pb-2 text-xs font-medium text-text-4 uppercase tracking-wider">
					Settings
				</p>
				<div className="space-y-1">
					{settingsNav.map(({ to, label }) => (
						<NavLink
							key={to}
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
					))}
				</div>
			</nav>
			<div className="flex-1 min-w-0">
				<Outlet />
			</div>
		</div>
	);
}
