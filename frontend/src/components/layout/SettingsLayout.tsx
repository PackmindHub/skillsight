import { cn } from "@/lib/utils";
import { NavLink, Outlet } from "react-router-dom";

const settingsNav = [{ to: "/settings/integrations", label: "Integrations" }];

export function SettingsLayout() {
	return (
		<div className="flex gap-6 h-full">
			<nav className="w-44 shrink-0">
				<p className="px-3 pb-2 text-xs font-medium text-gray-400 uppercase tracking-wider">
					Settings
				</p>
				<div className="space-y-1">
					{settingsNav.map(({ to, label }) => (
						<NavLink
							key={to}
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
					))}
				</div>
			</nav>
			<div className="flex-1 min-w-0">
				<Outlet />
			</div>
		</div>
	);
}
