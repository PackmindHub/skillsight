import { useAuth } from "@/context/AuthContext";
import { useIntegrationsHealth } from "@/context/IntegrationsHealthContext";
import { useMarketplaceSourcesHealth } from "@/context/MarketplaceSourcesHealthContext";
import { cn } from "@/lib/utils";
import { version } from "../../../package.json";
import {
	Activity,
	Boxes,
	KeyRound,
	LayoutDashboard,
	LogOut,
	type LucideIcon,
	Network,
	Plug,
	ScrollText,
	Settings as SettingsIcon,
	Sparkles,
	Users,
} from "lucide-react";
import { useNavigate, NavLink } from "react-router-dom";

interface NavBadge {
	count: number;
	tone: "danger";
}

interface MainLink {
	to: string;
	label: string;
	icon: LucideIcon;
}

const mainLinks: MainLink[] = [
	{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
	{ to: "/skills", label: "Skills", icon: Sparkles },
	{ to: "/plugins", label: "Plugins", icon: Plug },
	{ to: "/marketplaces", label: "Marketplaces", icon: Boxes },
	{ to: "/cohorts", label: "Cohorts", icon: Users },
	{ to: "/co-usage", label: "Co-usage", icon: Network },
	{ to: "/events", label: "Events", icon: Activity },
	{ to: "/audit", label: "Audit Log", icon: ScrollText },
];

const settingsLinks: MainLink[] = [
	{ to: "/settings/integrations", label: "Integrations", icon: SettingsIcon },
	{ to: "/tokens", label: "Tokens", icon: KeyRound },
];

function NavItem({ to, label, icon: Icon, badge }: MainLink & { badge?: NavBadge }) {
	return (
		<NavLink
			to={to}
			className={({ isActive }) =>
				cn(
					"group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
					isActive
						? "nav-active"
						: "text-text-2 hover:bg-surface-800 hover:text-text-1",
				)
			}
		>
			<Icon size={16} className="shrink-0 opacity-80 group-hover:opacity-100" />
			<span className="flex-1 truncate">{label}</span>
			{badge && badge.count > 0 && (
				<span
					className="ml-auto inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1.5 text-[10px] font-semibold leading-none text-white shadow-[0_0_0_2px_color-mix(in_srgb,var(--color-danger)_25%,transparent)]"
					aria-label={`${badge.count} alert(s)`}
				>
					{badge.count}
				</span>
			)}
		</NavLink>
	);
}

function BrandMark() {
	return (
		<span
			aria-hidden="true"
			className="relative inline-block h-7 w-7 shrink-0 overflow-hidden rounded-lg"
			style={{
				background: "linear-gradient(135deg, var(--color-accent), var(--color-accent-2))",
				boxShadow:
					"0 0 24px color-mix(in srgb, var(--color-accent-bright) 25%, transparent), inset 0 0 0 1px rgba(255,255,255,0.08)",
			}}
		>
			<span
				className="absolute inset-[5px] rounded-[4px]"
				style={{
					background: "var(--color-surface-950)",
					backgroundImage:
						"linear-gradient(90deg, transparent 0 7px, var(--color-accent-soft) 7px 8px, transparent 8px 100%), linear-gradient(0deg, transparent 0 7px, var(--color-accent-2-soft) 7px 8px, transparent 8px 100%)",
				}}
			/>
		</span>
	);
}

function initialsOf(email: string | null | undefined): string {
	if (!email) return "??";
	const [user] = email.split("@");
	if (!user) return "??";
	const parts = user.split(/[._-]/).filter(Boolean);
	if (parts.length >= 2) {
		return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
	}
	return user.slice(0, 2).toUpperCase();
}

function UserCard() {
	const { user, logout } = useAuth();
	const navigate = useNavigate();
	const initials = initialsOf(user?.email);

	async function handleLogout() {
		await logout();
		navigate("/login");
	}

	return (
		<div className="flex items-center gap-2.5 px-1 py-1.5">
			<span
				className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold text-surface-950"
				style={{ background: "linear-gradient(135deg, var(--color-accent-2), var(--color-accent-bright))" }}
			>
				{initials}
			</span>
			<span className="min-w-0 flex-1 text-xs leading-tight">
				<span className="block truncate text-text-1">{user?.role ?? "user"}</span>
				<span className="block truncate text-[10px] text-text-4">{user?.email ?? ""}</span>
			</span>
			<button
				type="button"
				onClick={handleLogout}
				aria-label="Logout"
				title="Logout"
				className="rounded p-1 text-text-4 hover:bg-surface-800 hover:text-text-1"
			>
				<LogOut size={14} />
			</button>
		</div>
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
		if (to === "/settings/integrations") return integrationsBadge;
		return undefined;
	};

	return (
		<aside
			className="flex w-60 shrink-0 flex-col gap-4 border-r border-edge-dim p-[18px_14px_14px]"
			style={{ background: "linear-gradient(180deg, var(--color-surface-900), var(--color-surface-950))" }}
		>
			<div className="flex items-center gap-2.5 border-b border-edge-dim px-1.5 pb-3.5 pt-0.5">
				<BrandMark />
				<span className="flex min-w-0 flex-col">
					<span className="truncate text-[15px] font-semibold tracking-[-0.01em] text-text-1">
						Skillsight
					</span>
					<span className="-mt-0.5 truncate font-mono text-[9px] uppercase tracking-[0.06em] text-text-4">
						v{version} · self-hosted
					</span>
				</span>
			</div>

			<nav className="flex flex-col gap-0.5">
				{mainLinks.map((link) => (
					<NavItem key={link.to} {...link} badge={badgeFor(link.to)} />
				))}
			</nav>

			<div className="flex flex-col gap-0.5">
				<p className="px-2 pb-1.5 pt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-text-4">
					Settings
				</p>
				{settingsLinks.map((link) => (
					<NavItem key={link.to} {...link} badge={badgeFor(link.to)} />
				))}
			</div>

			<div className="mt-auto flex flex-col gap-2.5 border-t border-edge-dim pt-2.5">
				<UserCard />
			</div>
		</aside>
	);
}
