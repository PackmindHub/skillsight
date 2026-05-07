export interface LokiStreamResult {
	stream: Record<string, string>;
	values: [string, string][];
}

interface LokiQueryResponse {
	status: string;
	data: {
		resultType: string;
		result: LokiStreamResult[];
	};
}

export interface FetchLokiLogsOpts {
	url: string;
	authType: "none" | "basic";
	username?: string | null;
	password?: string | null;
	query: string;
	from: Date;
	to: Date;
}

export async function fetchLokiLogs(opts: FetchLokiLogsOpts): Promise<LokiStreamResult[]> {
	const { url, authType, username, password, query, from, to } = opts;

	const params = new URLSearchParams({
		query,
		start: (from.getTime() * 1_000_000).toString(),
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

	if (!res.ok) {
		throw new Error(`Loki responded with HTTP ${res.status}: ${await res.text()}`);
	}

	const body = (await res.json()) as LokiQueryResponse;
	return body.data?.result ?? [];
}
