import { Err, Ok, type Result } from "../lib/result";
import type { EventStatus, IEventRecord } from "./Event";
import type { EventRepositoryError, IEventRepository } from "./EventRepository";

export const DEMO_EVENTS: IEventRecord[] = [];

function RepositoryError(message: string): EventRepositoryError {
  return {
    name: "EventRepositoryError",
    message,
  };
}

class InMemoryEventRepository implements IEventRepository {
  constructor(private readonly events: IEventRecord[]) {}

  async findById(eventId: string): Promise<Result<IEventRecord | null, EventRepositoryError>> {
    try {
      const match = this.events.find((event) => event.id === eventId) ?? null;
      return Ok(match);
    } catch {
      return Err(RepositoryError("Unable to read events from memory."));
    }
  }

  async updateStatus(
    eventId: string,
    status: EventStatus,
    updatedAt: string,
  ): Promise<Result<IEventRecord | null, EventRepositoryError>> {
    try {
      const index = this.events.findIndex((event) => event.id === eventId);
      if (index === -1) {
        return Ok(null);
      }

      const updatedEvent: IEventRecord = {
        ...this.events[index],
        status,
        updatedAt,
      };
      this.events[index] = updatedEvent;
      return Ok(updatedEvent);
    } catch {
      return Err(RepositoryError("Unable to update event status in memory."));
    }
  }
}

export function CreateInMemoryEventRepository(): IEventRepository {
  return new InMemoryEventRepository(DEMO_EVENTS);
}
