import type {
	AuditFilters,
	AuditResponse,
	DashboardPeriod,
	Integration,
	IntegrationPreviewEvent,
	Marketplace,
	MarketplaceSource,
	MonthlyTrendsResponse,
	Plugin,
	SkillDetail,
	SkillsTableResponse,
	Token,
	UsageResponse,
	User,
} from "@/types/api";

function buildAuditQuery(filters: AuditFilters, extras: Record<string, string> = {}): string {
	const params = new URLSearchParams();
	if (filters.actor) params.set("actor", filters.actor);
	if (filters.actions && filters.actions.length > 0) {
		for (const a of filters.actions) params.append("action", a);
	}
	if (filters.target) params.set("target", filters.target);
	if (filters.from) params.set("from", filters.from);
	if (filters.to) params.set("to", filters.to);
	if (filters.search) params.set("search", filters.search);
	for (const [k, v] of Object.entries(extras)) params.set(k, v);
	return params.toString();
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
	const res = await fetch(path, {
		...options,
		credentials: "include",
		headers: { "Content-Type": "application/json", ...options?.headers },
	});
	if (res.status === 401) {
		if (window.location.pathname !== "/login") {
			window.location.href = "/login";
		}
		throw new Error("Unauthorized");
	}
	if (!res.ok) {
		const text = await res.text().catch(() => "Unknown error");
		throw new Error(text || `HTTP ${res.status}`);
	}
	if (res.status === 204) return undefined as T;
	return res.json() as Promise<T>;
}

export const api = {
	auth: {
		login: (email: string, password: string) =>
			apiFetch<{ user: User; firstLogin: boolean }>("/api/auth/login", {
				method: "POST",
				body: JSON.stringify({ email, password }),
			}),
		logout: () => apiFetch<void>("/api/auth/logout", { method: "POST" }),
		me: () => apiFetch<{ user: User; firstLogin: boolean }>("/api/auth/me"),
		onboardingComplete: () => apiFetch<void>("/api/auth/onboarding-complete", { method: "POST" }),
	},
	skills: {
		usage: (period: DashboardPeriod = 30) =>
			apiFetch<UsageResponse>(`/api/skills/usage?days=${period}`),
		table: (period: DashboardPeriod = 30) =>
			apiFetch<SkillsTableResponse>(`/api/skills/usage/table?days=${period}`),
		detail: (skillName: string, period: DashboardPeriod = 30) =>
			apiFetch<SkillDetail>(
				`/api/skills/usage/detail?days=${period}&skill=${encodeURIComponent(skillName)}`,
			),
		monthlyTrends: () => apiFetch<MonthlyTrendsResponse>("/api/skills/usage/monthly"),
	},
	tokens: {
		list: () => apiFetch<Token[]>("/api/tokens"),
		create: (data: { name: string; userLabel?: string; expiresAt?: string }) =>
			apiFetch<Token & { jwt: string }>("/api/tokens", {
				method: "POST",
				body: JSON.stringify(data),
			}),
		revoke: (id: string) => apiFetch<void>(`/api/tokens/${id}`, { method: "DELETE" }),
	},
	audit: {
		list: (filters: AuditFilters = {}, page = 1, limit = 50) => {
			const qs = buildAuditQuery(filters, { page: String(page), limit: String(limit) });
			return apiFetch<AuditResponse>(`/api/audit?${qs}`);
		},
		actions: () => apiFetch<{ actions: string[] }>("/api/audit/actions"),
		exportUrl: (filters: AuditFilters = {}) => {
			const qs = buildAuditQuery(filters);
			return qs ? `/api/audit/export?${qs}` : "/api/audit/export";
		},
	},
	config: {
		get: () => apiFetch<{ baseUrl: string }>("/api/config"),
	},
	plugins: {
		list: () => apiFetch<{ plugins: Plugin[] }>("/api/plugins"),
	},
	marketplaces: {
		list: () => apiFetch<{ marketplaces: Marketplace[] }>("/api/marketplaces"),
		update: (
			name: string,
			body: { status?: string; url?: string | null; description?: string | null },
		) =>
			apiFetch<Marketplace>(`/api/marketplaces/${encodeURIComponent(name)}`, {
				method: "PATCH",
				body: JSON.stringify(body),
			}),
	},
	integrations: {
		list: () => apiFetch<Integration[]>("/api/integrations"),
		create: (data: {
			name: string;
			url: string;
			authType: "none" | "basic";
			authUsername?: string | null;
			authPassword?: string | null;
			lokiQuery?: string;
			syncIntervalMs?: number;
			enabled?: boolean;
		}) =>
			apiFetch<Integration>("/api/integrations", {
				method: "POST",
				body: JSON.stringify(data),
			}),
		update: (
			id: string,
			data: {
				name?: string;
				url?: string;
				authType?: "none" | "basic";
				authUsername?: string | null;
				authPassword?: string | null;
				lokiQuery?: string;
				syncIntervalMs?: number;
				enabled?: boolean;
			},
		) =>
			apiFetch<Integration>(`/api/integrations/${id}`, {
				method: "PUT",
				body: JSON.stringify(data),
			}),
		remove: (id: string) => apiFetch<void>(`/api/integrations/${id}`, { method: "DELETE" }),
		syncNow: (id: string) =>
			apiFetch<{ syncedAt: string | null; error: string | null }>(
				`/api/integrations/${id}/sync`,
				{ method: "POST" },
			),
		pause: (id: string) =>
			apiFetch<Integration>(`/api/integrations/${id}/pause`, { method: "POST" }),
		resume: (id: string) =>
			apiFetch<Integration>(`/api/integrations/${id}/resume`, { method: "POST" }),
		resetCursor: (id: string) =>
			apiFetch<void>(`/api/integrations/${id}/reset-cursor`, { method: "POST" }),
		clearData: (id: string) =>
			apiFetch<void>(`/api/integrations/${id}/data`, { method: "DELETE" }),
		preview: (data: {
			url: string;
			authType: string;
			authUsername?: string | null;
			authPassword?: string | null;
			lokiQuery: string;
			integrationId?: string | null;
		}) =>
			apiFetch<IntegrationPreviewEvent[]>("/api/integrations/preview", {
				method: "POST",
				body: JSON.stringify(data),
			}),
	},
	marketplaceSources: {
		list: () => apiFetch<MarketplaceSource[]>("/api/marketplace-sources"),
		create: (data: {
			gitUrl: string;
			accessToken?: string | null;
			branch?: string | null;
			syncIntervalMs?: number;
			enabled?: boolean;
			importPluginsAndSkills?: boolean;
		}) =>
			apiFetch<MarketplaceSource>("/api/marketplace-sources", {
				method: "POST",
				body: JSON.stringify(data),
			}),
		update: (
			id: string,
			data: {
				gitUrl?: string;
				accessToken?: string | null;
				branch?: string | null;
				syncIntervalMs?: number;
				enabled?: boolean;
				importPluginsAndSkills?: boolean;
			},
		) =>
			apiFetch<MarketplaceSource>(`/api/marketplace-sources/${id}`, {
				method: "PUT",
				body: JSON.stringify(data),
			}),
		remove: (id: string) => apiFetch<void>(`/api/marketplace-sources/${id}`, { method: "DELETE" }),
		syncNow: (id: string) =>
			apiFetch<{ syncedAt: string | null; pluginCount: number; skillCount: number; error: string | null }>(
				`/api/marketplace-sources/${id}/sync`,
				{ method: "POST" },
			),
		testConnection: (data: {
			gitUrl: string;
			accessToken?: string | null;
			branch?: string | null;
			sourceId?: string | null;
		}) =>
			apiFetch<
				| { ok: true; name: string; description?: string; pluginCount: number }
				| { ok: false; error: string }
			>("/api/marketplace-sources/test-connection", {
				method: "POST",
				body: JSON.stringify(data),
			}),
	},
};
