import type { NewEvent } from "@/domain/event";

export interface IEventRepository {
	insertMany(events: NewEvent[]): Promise<void>;
}
