import type { ILokiGateway, LokiStreamResult } from "@/domain/ports/loki-gateway";

interface LokiQueryResponse {
	status: string;
	data: {
		resultType: string;
		result: LokiStreamResult[];
	};
}

// Most Loki deployments enforce a `max_query_length` (Grafana Cloud's default
// is 30d1h; OSS Loki's default is 721h). Querying from epoch trips that limit
// with a 400. Cap first-sync lookback below the common default; subsequent
// runs advance via the cursor + page-forward logic in sync-integration.ts.
const FIRST_SYNC_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;

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

		const startMs = from !== null ? from.getTime() : to.getTime() - FIRST_SYNC_LOOKBACK_MS;
		const params = new URLSearchParams({
			query,
			start: (startMs * 1_000_000).toString(),
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
			const detail = await readErrorDetail(res);
			throw new Error(
				`Loki responded with HTTP ${res.status}${detail ? `: ${detail}` : ""}.`,
			);
		}

		const body = (await res.json()) as LokiQueryResponse;
		return body.data?.result ?? [];
	}
}

// Loki error bodies are sometimes plain text, sometimes JSON like
// `{"status":"error","error":"…","errorType":"…"}`. Surface whichever we get,
// trimmed so a runaway body can't blow up a log line.
async function readErrorDetail(res: Response): Promise<string> {
	try {
		const text = (await res.text()).trim();
		if (!text) return "";
		try {
			const parsed = JSON.parse(text);
			const msg = parsed?.error ?? parsed?.message;
			if (typeof msg === "string" && msg.length > 0) return truncate(msg, 500);
		} catch {
			// not JSON — fall through to raw text
		}
		return truncate(text, 500);
	} catch {
		return "";
	}
}

function truncate(s: string, max: number): string {
	return s.length > max ? `${s.slice(0, max)}…` : s;
}
