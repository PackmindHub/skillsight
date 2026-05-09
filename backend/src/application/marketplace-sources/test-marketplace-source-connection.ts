import type { IMarketplaceSourceRepository } from "@/domain/ports/marketplace-source-repository";
import type { IGitMarketplaceGateway } from "@/domain/ports/git-marketplace-gateway";
import { decrypt } from "@/infrastructure/crypto/encrypt";

export type TestConnectionInput = {
	gitUrl: string;
	accessToken?: string | null;
	branch?: string | null;
	sourceId?: string | null;
};

export type TestConnectionResult =
	| {
			ok: true;
			name: string;
			description?: string;
			pluginCount: number;
			skillCount: number;
	  }
	| { ok: false; error: string };

export async function testMarketplaceSourceConnection(
	deps: {
		marketplaceSources: IMarketplaceSourceRepository;
		gitMarketplace: IGitMarketplaceGateway;
	},
	input: TestConnectionInput,
): Promise<TestConnectionResult> {
	let token: string | undefined;
	if (typeof input.accessToken === "string" && input.accessToken.length > 0) {
		token = input.accessToken;
	} else if (input.sourceId) {
		const existing = await deps.marketplaceSources.findById(input.sourceId);
		if (existing?.accessTokenEncrypted) {
			token = decrypt(existing.accessTokenEncrypted);
		}
	}

	try {
		const data = await deps.gitMarketplace.fetchMarketplaceJson({
			gitUrl: input.gitUrl,
			accessToken: token,
			branch: input.branch ?? undefined,
		});
		return {
			ok: true,
			name: data.name,
			description: data.description,
			pluginCount: data.plugins.length,
			skillCount: data.plugins.reduce((sum, p) => sum + (p.skills?.length ?? 0), 0),
		};
	} catch (err) {
		return { ok: false, error: err instanceof Error ? err.message : String(err) };
	}
}
