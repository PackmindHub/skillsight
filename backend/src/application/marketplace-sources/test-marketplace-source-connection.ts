import type { GitProvider } from "@/domain/marketplace-source";
import type { IGitMarketplaceGateway } from "@/domain/ports/git-marketplace-gateway";
import type { IMarketplaceSourceRepository } from "@/domain/ports/marketplace-source-repository";
import type { IPackmindCliGateway } from "@/domain/ports/packmind-cli-gateway";
import { decrypt } from "@/infrastructure/crypto/encrypt";

export type TestConnectionInput =
	| {
			kind?: "git";
			gitUrl: string;
			provider?: GitProvider | null;
			accessToken?: string | null;
			branch?: string | null;
			sourceId?: string | null;
	  }
	| {
			kind: "packmind";
			apiKey?: string | null;
			marketplaceName?: string | null;
			sourceId?: string | null;
	  };

export type TestConnectionResult =
	| {
			ok: true;
			kind: "git";
			name: string;
			description?: string;
			pluginCount: number;
			skillCount: number;
	  }
	| {
			ok: true;
			kind: "packmind";
			user: string;
			org: string;
			host: string;
	  }
	| { ok: false; error: string };

export async function testMarketplaceSourceConnection(
	deps: {
		marketplaceSources: IMarketplaceSourceRepository;
		gitMarketplace: IGitMarketplaceGateway;
		packmindCli: IPackmindCliGateway;
	},
	input: TestConnectionInput,
): Promise<TestConnectionResult> {
	const kind = input.kind ?? "git";

	if (kind === "packmind") {
		const packmindInput = input as Extract<TestConnectionInput, { kind: "packmind" }>;
		let apiKey: string | undefined;
		if (typeof packmindInput.apiKey === "string" && packmindInput.apiKey.length > 0) {
			apiKey = packmindInput.apiKey;
		} else if (packmindInput.sourceId) {
			const existing = await deps.marketplaceSources.findById(packmindInput.sourceId);
			if (existing?.accessTokenEncrypted) {
				apiKey = decrypt(existing.accessTokenEncrypted);
			}
		}
		if (!apiKey) {
			return { ok: false, error: "Packmind API key is required" };
		}
		try {
			const w = await deps.packmindCli.whoami(apiKey);
			return { ok: true, kind: "packmind", user: w.user, org: w.org, host: w.host };
		} catch (err) {
			return { ok: false, error: err instanceof Error ? err.message : String(err) };
		}
	}

	const gitInput = input as Extract<TestConnectionInput, { kind?: "git" }>;
	let token: string | undefined;
	let provider: GitProvider = gitInput.provider ?? "auto";
	if (typeof gitInput.accessToken === "string" && gitInput.accessToken.length > 0) {
		token = gitInput.accessToken;
	} else if (gitInput.sourceId) {
		const existing = await deps.marketplaceSources.findById(gitInput.sourceId);
		if (existing?.accessTokenEncrypted) {
			token = decrypt(existing.accessTokenEncrypted);
		}
		// Fall back to the saved provider when the caller didn't pin one inline.
		if (!gitInput.provider && existing) provider = existing.provider;
	}

	try {
		const data = await deps.gitMarketplace.fetchMarketplaceJson({
			gitUrl: gitInput.gitUrl,
			accessToken: token,
			branch: gitInput.branch ?? undefined,
			provider,
		});
		return {
			ok: true,
			kind: "git",
			name: data.name,
			description: data.description,
			pluginCount: data.plugins.length,
			skillCount: data.plugins.reduce((sum, p) => sum + (p.skills?.length ?? 0), 0),
		};
	} catch (err) {
		return { ok: false, error: err instanceof Error ? err.message : String(err) };
	}
}
