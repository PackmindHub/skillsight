export interface LokiStreamResult {
	stream: Record<string, string>;
	values: [string, string][];
}

export interface ILokiGateway {
	fetchLogs(opts: {
		url: string;
		authType: "none" | "basic";
		username?: string | null;
		password?: string | null;
		query: string;
		from: Date;
		to: Date;
	}): Promise<LokiStreamResult[]>;
}
