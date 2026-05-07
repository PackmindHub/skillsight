import { AppShell } from "@/components/layout/AppShell";
import { SettingsLayout } from "@/components/layout/SettingsLayout";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import AuditLogPage from "@/pages/AuditLogPage";
import DashboardPage from "@/pages/DashboardPage";
import LoginPage from "@/pages/LoginPage";
import OnboardingPage from "@/pages/OnboardingPage";
import SkillsTablePage from "@/pages/SkillsTablePage";
import TokensPage from "@/pages/TokensPage";
import MarketplacesPage from "@/pages/MarketplacesPage";
import PluginsPage from "@/pages/PluginsPage";
import IntegrationsPage from "@/pages/settings/IntegrationsPage";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";

function ProtectedRoute() {
	const { user, loading } = useAuth();
	if (loading)
		return <div className="flex h-screen items-center justify-center text-gray-500">Loading…</div>;
	if (!user) return <Navigate to="/login" replace />;
	return (
		<AppShell>
			<Outlet />
		</AppShell>
	);
}

export default function App() {
	return (
		<BrowserRouter>
			<AuthProvider>
				<Routes>
					<Route path="/login" element={<LoginPage />} />
					<Route element={<ProtectedRoute />}>
						<Route index element={<Navigate to="/dashboard" replace />} />
						<Route path="/onboarding" element={<OnboardingPage />} />
						<Route path="/dashboard" element={<DashboardPage />} />
						<Route path="/skills" element={<SkillsTablePage />} />
						<Route path="/marketplaces" element={<MarketplacesPage />} />
						<Route path="/plugins" element={<PluginsPage />} />
						<Route path="/tokens" element={<TokensPage />} />
						<Route path="/audit" element={<AuditLogPage />} />
						<Route path="/settings" element={<SettingsLayout />}>
							<Route index element={<Navigate to="/settings/integrations" replace />} />
							<Route path="integrations" element={<IntegrationsPage />} />
						</Route>
					</Route>
					<Route path="*" element={<Navigate to="/dashboard" replace />} />
				</Routes>
			</AuthProvider>
		</BrowserRouter>
	);
}
