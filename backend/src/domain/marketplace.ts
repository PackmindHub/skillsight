export type MarketplaceStatus = "to_review" | "approved" | "denied";

export interface Marketplace {
	name: string;
	status: MarketplaceStatus;
	url: string | null;
	description: string | null;
	firstSeenAt: Date;
	lastSeenAt: Date;
}

export interface MarketplaceWithStats extends Marketplace {
	activationCount: number;
}
