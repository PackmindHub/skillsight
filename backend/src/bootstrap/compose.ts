import { db } from "@/db/client";
import { DrizzleUserRepository } from "@/infrastructure/repositories/drizzle-user-repository";
import { DrizzleAuditRepository } from "@/infrastructure/repositories/drizzle-audit-repository";
import { DrizzleTokenRepository } from "@/infrastructure/repositories/drizzle-token-repository";
import { DrizzleEventRepository } from "@/infrastructure/repositories/drizzle-event-repository";
import { DrizzleIntegrationRepository } from "@/infrastructure/repositories/drizzle-integration-repository";
import { DrizzleMarketplaceRepository } from "@/infrastructure/repositories/drizzle-marketplace-repository";
import { DrizzlePluginRepository } from "@/infrastructure/repositories/drizzle-plugin-repository";
import { DrizzlePluginSkillRepository } from "@/infrastructure/repositories/drizzle-plugin-skill-repository";
import { DrizzleSkillRepository } from "@/infrastructure/repositories/drizzle-skill-repository";
import { LokiHttpGateway } from "@/infrastructure/gateways/loki-http-gateway";
import { GitMarketplaceHttpGateway } from "@/infrastructure/gateways/git-marketplace-http-gateway";
import { DrizzleMarketplaceSourceRepository } from "@/infrastructure/repositories/drizzle-marketplace-source-repository";

export function buildDeps() {
	return {
		users: new DrizzleUserRepository(db),
		audit: new DrizzleAuditRepository(db),
		tokens: new DrizzleTokenRepository(db),
		events: new DrizzleEventRepository(db),
		integrations: new DrizzleIntegrationRepository(db),
		marketplaces: new DrizzleMarketplaceRepository(db),
		marketplaceSources: new DrizzleMarketplaceSourceRepository(db),
		plugins: new DrizzlePluginRepository(db),
		pluginSkills: new DrizzlePluginSkillRepository(db),
		skills: new DrizzleSkillRepository(db),
		loki: new LokiHttpGateway(),
		gitMarketplace: new GitMarketplaceHttpGateway(),
	};
}

export type AppDeps = ReturnType<typeof buildDeps>;
