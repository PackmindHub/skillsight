import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { AppVariables } from "@/types";
import type { AppDeps } from "@/bootstrap/compose";
import { sessionAuth } from "@/middleware/session-auth";
import { eventBus, type SkillActivatedLiveEvent } from "@/lib/event-bus";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

export function createEventsRoute(deps: Pick<AppDeps, "events">) {
	const route = new Hono<{ Variables: AppVariables }>();
	route.use("*", sessionAuth);

	route.get("/recent", async (c) => {
		const limitParam = Number(c.req.query("limit") ?? DEFAULT_LIMIT);
		const limit = Math.max(
			1,
			Math.min(MAX_LIMIT, Number.isFinite(limitParam) ? limitParam : DEFAULT_LIMIT),
		);
		const rows = await deps.events.listRecentSkillActivations(limit);
		return c.json({
			events: rows.map((r) => ({
				id: r.id,
				timestamp: r.timestamp.toISOString(),
				userEmail: r.userEmail,
				sessionId: r.sessionId,
				skillName: r.skillName,
				pluginName: r.pluginName,
				marketplaceName: r.marketplaceName,
				trigger: r.trigger,
			})),
		});
	});

	route.get("/stream", (c) => {
		return streamSSE(c, async (stream) => {
			const onActivated = (payload: SkillActivatedLiveEvent) => {
				if (stream.aborted || stream.closed) return;
				stream
					.writeSSE({
						event: "skill.activated",
						data: JSON.stringify(payload),
					})
					.catch(() => {});
			};

			eventBus.onSkillActivated(onActivated);
			stream.onAbort(() => {
				eventBus.offSkillActivated(onActivated);
			});

			await stream.writeSSE({ event: "ready", data: JSON.stringify({ ts: Date.now() }) });

			while (!stream.aborted) {
				await stream.sleep(25_000);
				if (stream.aborted) break;
				await stream.writeSSE({ event: "heartbeat", data: "" });
			}
		});
	});

	return route;
}
