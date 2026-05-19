import type {
	CohortsWindow,
	IEventRepository,
	SessionSkillActivation,
} from "@/domain/ports/event-repository";

export interface CoUsageSession {
	sessionId: string;
	userEmail: string | null;
	skills: { name: string; activations: number }[];
	lastSeenAt: string;
}

export interface CoUsageResponse {
	sessions: CoUsageSession[];
	totalUsers: number;
	totalMultiSkillSessions: number;
	totalSingleSkillSessions: number;
	windowDays: number | null;
}

export async function getCoUsage(
	deps: { events: IEventRepository },
	input: { window: CohortsWindow },
): Promise<CoUsageResponse> {
	const rows = await deps.events.listSessionSkillActivations(input.window);
	const sessions = buildSessions(rows);

	const multi = sessions.filter((s) => s.skills.length >= 2);
	const single = sessions.length - multi.length;
	const users = new Set<string>();
	for (const s of multi) {
		if (s.userEmail) users.add(s.userEmail);
	}

	return {
		sessions: multi,
		totalUsers: users.size,
		totalMultiSkillSessions: multi.length,
		totalSingleSkillSessions: single,
		windowDays: input.window === "all" ? null : input.window,
	};
}

export function buildSessions(rows: SessionSkillActivation[]): CoUsageSession[] {
	const bySession = new Map<
		string,
		{
			sessionId: string;
			userEmail: string | null;
			skills: Map<string, number>;
			lastSeen: Date;
		}
	>();
	for (const r of rows) {
		let bucket = bySession.get(r.sessionId);
		if (!bucket) {
			bucket = {
				sessionId: r.sessionId,
				userEmail: r.userEmail,
				skills: new Map(),
				lastSeen: r.lastActivatedAt,
			};
			bySession.set(r.sessionId, bucket);
		}
		bucket.skills.set(r.skillName, (bucket.skills.get(r.skillName) ?? 0) + r.activations);
		if (r.lastActivatedAt > bucket.lastSeen) bucket.lastSeen = r.lastActivatedAt;
		// Prefer non-null email when both are present for the same session.
		if (bucket.userEmail == null && r.userEmail != null) bucket.userEmail = r.userEmail;
	}

	return Array.from(bySession.values()).map((b) => ({
		sessionId: b.sessionId,
		userEmail: b.userEmail,
		skills: Array.from(b.skills.entries())
			.map(([name, activations]) => ({ name, activations }))
			.sort((a, b) => a.name.localeCompare(b.name)),
		lastSeenAt: b.lastSeen.toISOString(),
	}));
}
