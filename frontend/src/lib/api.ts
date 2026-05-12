import type {
	AuditFilters,
	AuditResponse,
	CohortsResponse,
	DashboardPeriod,
	Integration,
	IntegrationPreviewEvent,
	LiveEventsResponse,
	LiveSkillActivatedEvent,
	Marketplace,
	MarketplaceDetailResponse,
	MarketplaceSource,
	MonthlyTrendsResponse,
	Plugin,
	PluginSkillsResponse,
	SkillDetail,
	SkillStatus,
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
		table: (period: DashboardPeriod = 30, opts: { includeIgnored?: boolean } = {}) => {
			const params = new URLSearchParams({ days: String(period) });
			if (opts.includeIgnored) params.set("includeIgnored", "1");
			return apiFetch<SkillsTableResponse>(`/api/skills/usage/table?${params.toString()}`);
		},
		detail: (skillName: string, period: DashboardPeriod = 30) =>
			apiFetch<SkillDetail>(
				`/api/skills/usage/detail?days=${period}&skill=${encodeURIComponent(skillName)}`,
			),
		monthlyTrends: () => apiFetch<MonthlyTrendsResponse>("/api/skills/usage/monthly"),
		deleteMany: (entries: Array<{ skillName: string; pluginName: string }>) =>
			apiFetch<{ skillsDeleted: number; eventsDeleted: number }>("/api/skills/delete", {
				method: "POST",
				body: JSON.stringify({ skills: entries }),
			}),
		updateStatus: (body: { skillName: string; pluginName: string; status: SkillStatus }) =>
			apiFetch<{
				skillName: string;
				pluginName: string;
				status: SkillStatus;
			}>("/api/skills/status", {
				method: "PATCH",
				body: JSON.stringify(body),
			}),
		updateStatusBulk: (body: {
			skills: Array<{ skillName: string; pluginName: string }>;
			status: SkillStatus;
		}) =>
			apiFetch<{ updated: number; skippedInherited: number; notFound: number }>(
				"/api/skills/status/bulk",
				{ method: "PATCH", body: JSON.stringify(body) },
			),
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
	events: {
		recent: (limit = 100) =>
			apiFetch<LiveEventsResponse>(`/api/events/recent?limit=${limit}`),
		openStream: (handlers: {
			onEvent?: (event: LiveSkillActivatedEvent) => void;
			onError?: () => void;
		}): (() => void) => {
			const source = new EventSource("/api/events/stream", {
				withCredentials: true,
			});
			source.addEventListener("skill.activated", (event) => {
				try {
					handlers.onEvent?.(
						JSON.parse((event as MessageEvent).data) as LiveSkillActivatedEvent,
					);
				} catch {
					// ignore malformed payload
				}
			});
			source.addEventListener("error", () => {
				if (source.readyState === EventSource.CLOSED) {
					handlers.onError?.();
				}
			});
			return () => source.close();
		},
	},
	cohorts: {
		list: (period: DashboardPeriod = "all") =>
			apiFetch<CohortsResponse>(`/api/cohorts?days=${period}`),
	},
	plugins: {
		list: (opts: { includeIgnored?: boolean } = {}) => {
			const qs = opts.includeIgnored ? "?includeIgnored=1" : "";
			return apiFetch<{ plugins: Plugin[] }>(`/api/plugins${qs}`);
		},
		skills: (pluginName: string) =>
			apiFetch<PluginSkillsResponse>(
				`/api/plugins/${encodeURIComponent(pluginName)}/skills`,
			),
		update: (pluginName: string, body: { status?: string }) =>
			apiFetch<Plugin>(`/api/plugins/${encodeURIComponent(pluginName)}`, {
				method: "PATCH",
				body: JSON.stringify(body),
			}),
	},
	marketplaces: {
		list: (opts: { includeIgnored?: boolean } = {}) => {
			const qs = opts.includeIgnored ? "?includeIgnored=1" : "";
			return apiFetch<{ marketplaces: Marketplace[] }>(`/api/marketplaces${qs}`);
		},
		detail: (name: string) =>
			apiFetch<MarketplaceDetailResponse>(
				`/api/marketplaces/${encodeURIComponent(name)}/detail`,
			),
		update: (
			name: string,
			body: { status?: string; url?: string | null; description?: string | null },
		) =>
			apiFetch<Marketplace>(`/api/marketplaces/${encodeURIComponent(name)}`, {
				method: "PATCH",
				body: JSON.stringify(body),
			}),
		remove: (
			name: string,
			opts?: { mode?: "orphan" | "cascade"; withSources?: boolean },
		) => {
			const params = new URLSearchParams({ mode: opts?.mode ?? "orphan" });
			if (opts?.withSources) params.set("withSources", "true");
			return apiFetch<void>(
				`/api/marketplaces/${encodeURIComponent(name)}?${params.toString()}`,
				{ method: "DELETE" },
			);
		},
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
		getDirectStats: () =>
			apiFetch<{ eventCount: number; lastEventAt: string | null }>(
				"/api/integrations/direct/stats",
			),
		clearDirectData: () =>
			apiFetch<void>("/api/integrations/direct/events", { method: "DELETE" }),
		openStream: (handlers: {
			onUpdate?: (integration: Integration) => void;
			onDelete?: (id: string) => void;
			onError?: () => void;
		}): (() => void) => {
			const source = new EventSource("/api/integrations/stream", {
				withCredentials: true,
			});
			source.addEventListener("integration.updated", (event) => {
				try {
					handlers.onUpdate?.(JSON.parse((event as MessageEvent).data) as Integration);
				} catch {
					// ignore malformed payload
				}
			});
			source.addEventListener("integration.deleted", (event) => {
				try {
					const payload = JSON.parse((event as MessageEvent).data) as { id: string };
					handlers.onDelete?.(payload.id);
				} catch {
					// ignore malformed payload
				}
			});
			source.addEventListener("error", () => {
				// EventSource auto-reconnects on transient errors. If the server
				// closed the socket because the session is invalid, reconnects
				// will keep 401-ing; surface that to the caller so they can
				// fall back to a manual refresh or redirect.
				if (source.readyState === EventSource.CLOSED) {
					handlers.onError?.();
				}
			});
			return () => source.close();
		},
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
			apiFetch<
				MarketplaceSource & {
					firstSync: {
						pluginCount: number;
						skillCount: number;
						error: string | null;
					} | null;
				}
			>("/api/marketplace-sources", {
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
		pause: (id: string) =>
			apiFetch<MarketplaceSource>(`/api/marketplace-sources/${id}/pause`, { method: "POST" }),
		resume: (id: string) =>
			apiFetch<MarketplaceSource>(`/api/marketplace-sources/${id}/resume`, { method: "POST" }),
		testConnection: (data: {
			gitUrl: string;
			accessToken?: string | null;
			branch?: string | null;
			sourceId?: string | null;
		}) =>
			apiFetch<
				| {
						ok: true;
						name: string;
						description?: string;
						pluginCount: number;
						skillCount: number;
				  }
				| { ok: false; error: string }
			>("/api/marketplace-sources/test-connection", {
				method: "POST",
				body: JSON.stringify(data),
			}),
	},
};
