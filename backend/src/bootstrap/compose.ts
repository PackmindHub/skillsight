import { db } from "@/db/client";
import { DrizzleUserRepository } from "@/infrastructure/repositories/drizzle-user-repository";
import { DrizzleAuditRepository } from "@/infrastructure/repositories/drizzle-audit-repository";
import { DrizzleTokenRepository } from "@/infrastructure/repositories/drizzle-token-repository";
import { DrizzleEventRepository } from "@/infrastructure/repositories/drizzle-event-repository";
import { DrizzleIntegrationRepository } from "@/infrastructure/repositories/drizzle-integration-repository";
import { DrizzleMarketplaceRepository } from "@/infrastructure/repositories/drizzle-marketplace-repository";
import { DrizzleSkillRepository } from "@/infrastructure/repositories/drizzle-skill-repository";
import { LokiHttpGateway } from "@/infrastructure/gateways/loki-http-gateway";

export function buildDeps() {
	return {
		users: new DrizzleUserRepository(db),
		audit: new DrizzleAuditRepository(db),
		tokens: new DrizzleTokenRepository(db),
		events: new DrizzleEventRepository(db),
		integrations: new DrizzleIntegrationRepository(db),
		marketplaces: new DrizzleMarketplaceRepository(db),
		skills: new DrizzleSkillRepository(db),
		loki: new LokiHttpGateway(),
	};
}

export type AppDeps = ReturnType<typeof buildDeps>;
