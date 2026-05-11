export type LokiStreamValue =
	| [tsNs: string, line: string]
	| [tsNs: string, line: string, structuredMetadata: Record<string, string>];

export interface LokiStreamResult {
	stream: Record<string, string>;
	values: LokiStreamValue[];
}

export interface ILokiGateway {
	fetchLogs(opts: {
		url: string;
		authType: "none" | "basic";
		username?: string | null;
		password?: string | null;
		query: string;
		from: Date | null;
		to: Date;
	}): Promise<LokiStreamResult[]>;
}
