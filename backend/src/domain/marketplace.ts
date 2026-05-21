import type { PluginStatus } from "@/domain/plugin";

export type MarketplaceStatus = "to_review" | "approved" | "denied" | "ignored";

export type MarketplaceProvider = "git" | "packmind";

export interface Marketplace {
	name: string;
	status: MarketplaceStatus;
	provider: MarketplaceProvider;
	url: string | null;
	description: string | null;
	firstSeenAt: Date;
	lastSeenAt: Date;
}

export interface MarketplaceWithStats extends Marketplace {
	activationCount: number;
	pluginInstallCount: number;
	skillActivatedLinkedCount: number;
	pluginCount: number;
	knownSkillCount: number;
	activatedSkillCount: number;
	totalActivationCount: number;
}

export interface MarketplacePluginRow {
	pluginName: string;
	status: PluginStatus;
	pluginVersion: string | null;
	installationCount: number;
	skillActivationCount: number;
}

export interface MarketplaceSkillRow {
	skillName: string;
	pluginName: string;
	activationCount: number;
}

export interface MarketplaceDetail {
	plugins: MarketplacePluginRow[];
	skills: MarketplaceSkillRow[];
}
