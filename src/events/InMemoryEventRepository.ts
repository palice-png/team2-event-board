import type { EventSummary } from "./EventService";

export interface IEventRepository {
  getById(id: string): EventSummary | null;
  update(event: EventSummary): void;
}

export function CreateInMemoryEventRepository(): IEventRepository {
  const events = new Map<string, EventSummary>();

  return {
    getById(id: string) {
      return events.get(id) ?? null;
    },

    update(event: EventSummary) {
      events.set(event.id, event);
    },
  };
}