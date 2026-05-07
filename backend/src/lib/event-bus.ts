import { EventEmitter } from "node:events";
import type { MarketplaceStatus } from "@/domain/marketplace";

export interface MarketplaceStatusChangedEvent {
	name: string;
	newStatus: MarketplaceStatus;
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
}

export const eventBus = new AppEventBus();
