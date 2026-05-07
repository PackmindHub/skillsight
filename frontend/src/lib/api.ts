import type {
	AllowedSkill,
	AuditResponse,
	Integration,
	Marketplace,
	ShadowSkill,
	SkillsTableResponse,
	Token,
	UsageResponse,
	User,
} from "@/types/api";

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
		usage: (days = 30) => apiFetch<UsageResponse>(`/api/skills/usage?days=${days}`),
		table: (days = 30) => apiFetch<SkillsTableResponse>(`/api/skills/usage/table?days=${days}`),
		shadow: () => apiFetch<ShadowSkill[]>("/api/skills/shadow"),
		allowed: {
			list: () => apiFetch<AllowedSkill[]>("/api/skills/allowed"),
			add: (skill_name: string) =>
				apiFetch<AllowedSkill>("/api/skills/allowed", {
					method: "POST",
					body: JSON.stringify({ skill_name }),
				}),
			remove: (name: string) =>
				apiFetch<void>(`/api/skills/allowed/${encodeURIComponent(name)}`, {
					method: "DELETE",
				}),
		},
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
		list: (page = 1, limit = 50) =>
			apiFetch<AuditResponse>(`/api/audit?page=${page}&limit=${limit}`),
	},
	config: {
		get: () => apiFetch<{ baseUrl: string }>("/api/config"),
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
	},
};
