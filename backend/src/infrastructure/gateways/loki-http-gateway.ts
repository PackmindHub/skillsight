import type { ILokiGateway, LokiStreamResult } from "@/domain/ports/loki-gateway";

interface LokiQueryResponse {
	status: string;
	data: {
		resultType: string;
		result: LokiStreamResult[];
	};
}

export class LokiHttpGateway implements ILokiGateway {
	async fetchLogs(opts: {
		url: string;
		authType: "none" | "basic";
		username?: string | null;
		password?: string | null;
		query: string;
		from: Date | null;
		to: Date;
	}): Promise<LokiStreamResult[]> {
		const { url, authType, username, password, query, from, to } = opts;

		// When `from` is null (first sync / no cursor) we want all historical data.
		// Loki's query_range defaults `start` to one hour before `end` when omitted,
		// which would silently cap the first import to the last hour. Pin start to
		// the epoch instead so we fetch everything Loki retains.
		const params = new URLSearchParams({
			query,
			start: (from !== null ? from.getTime() * 1_000_000 : 0).toString(),
			end: (to.getTime() * 1_000_000).toString(),
			limit: "5000",
			direction: "forward",
		});

		const headers: Record<string, string> = { "Content-Type": "application/json" };
		if (authType === "basic" && username && password) {
			const encoded = Buffer.from(`${username}:${password}`).toString("base64");
			headers.Authorization = `Basic ${encoded}`;
		}

		const res = await fetch(`${url.replace(/\/$/, "")}/loki/api/v1/query_range?${params}`, {
			headers,
			signal: AbortSignal.timeout(15_000),
		});

		if (res.status === 401 || res.status === 403) {
			throw new Error(
				`Loki authentication failed (HTTP ${res.status}). Check the username and password.`,
			);
		}
		if (res.status === 404) {
			throw new Error("Loki endpoint not found (HTTP 404). Check the URL.");
		}
		if (!res.ok) {
			throw new Error(`Loki responded with HTTP ${res.status}.`);
		}

		const body = (await res.json()) as LokiQueryResponse;
		return body.data?.result ?? [];
	}
}
