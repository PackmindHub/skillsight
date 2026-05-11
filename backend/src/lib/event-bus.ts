import { EventEmitter } from "node:events";
import type { Integration } from "@/domain/integration";
import type { MarketplaceStatus } from "@/domain/marketplace";

export interface MarketplaceStatusChangedEvent {
	name: string;
	newStatus: MarketplaceStatus;
	actorEmail: string | null;
}

export type IntegrationUpdatedEvent = Integration & { eventCount: number };

export interface IntegrationDeletedEvent {
	id: string;
}

class AppEventBus extends EventEmitter {
	emitMarketplaceStatusChanged(payload: MarketplaceStatusChangedEvent): void {
		this.emit("marketplace:statusChanged", payload);
	}

	onMarketplaceStatusChanged(
		listener: (payload: MarketplaceStatusChangedEvent) => void,
	): this {
		return this.on("marketplace:statusChanged", listener);
	}

	emitIntegrationUpdated(payload: IntegrationUpdatedEvent): void {
		this.emit("integration:updated", payload);
	}

	onIntegrationUpdated(listener: (payload: IntegrationUpdatedEvent) => void): this {
		return this.on("integration:updated", listener);
	}

	offIntegrationUpdated(listener: (payload: IntegrationUpdatedEvent) => void): this {
		return this.off("integration:updated", listener);
	}

	emitIntegrationDeleted(payload: IntegrationDeletedEvent): void {
		this.emit("integration:deleted", payload);
	}

	onIntegrationDeleted(listener: (payload: IntegrationDeletedEvent) => void): this {
		return this.on("integration:deleted", listener);
	}

	offIntegrationDeleted(listener: (payload: IntegrationDeletedEvent) => void): this {
		return this.off("integration:deleted", listener);
	}
}

export const eventBus = new AppEventBus();
// SSE subscribers (one per connected client) plus internal listeners can stack
// up quickly; raise the default ceiling so Node doesn't warn about leaks.
eventBus.setMaxListeners(0);
