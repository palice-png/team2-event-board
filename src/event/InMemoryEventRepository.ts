import { Err, Ok, type Result } from "../lib/result";
import type { EventStatus, IEventRecord } from "./Event";
import type { EventRepositoryError, IEventRepository } from "./EventRepository";

export const DEMO_EVENTS: IEventRecord[] = [];
export type RsvpStatus = "going" | "waitlisted" | "cancelled";
export interface IRsvpRecord {
  id: string;
  eventId: string;
  userId: string;
  status: RsvpStatus;
  createdAt: string;
}
export const DEMO_RSVPS: IRsvpRecord[] = [];

function RepositoryError(message: string): EventRepositoryError {
  return {
    name: "EventRepositoryError",
    message,
  };
}

class InMemoryEventRepository implements IEventRepository {
  constructor(
    private readonly events: IEventRecord[],
    private readonly rsvps: IRsvpRecord[],
  ) {}

  async findById(eventId: string): Promise<Result<IEventRecord | null, EventRepositoryError>> {
    try {
      const match = this.events.find((event) => event.id === eventId) ?? null;
      return Ok(match);
    } catch {
      return Err(RepositoryError("Unable to read events from memory."));
    }
  }

  async listByOrganizerId(
    organizerId: string,
  ): Promise<Result<IEventRecord[], EventRepositoryError>> {
    try {
      const events = this.events.filter((event) => event.organizerId === organizerId);
      return Ok(events);
    } catch {
      return Err(RepositoryError("Unable to read organizer events from memory."));
    }
  }

  async listAll(): Promise<Result<IEventRecord[], EventRepositoryError>> {
    try {
      return Ok([...this.events]);
    } catch {
      return Err(RepositoryError("Unable to list events from memory."));
    }
  }

  async countGoingByEventId(eventId: string): Promise<Result<number, EventRepositoryError>> {
    try {
      const count = this.rsvps.filter(
        (rsvp) => rsvp.eventId === eventId && rsvp.status === "going",
      ).length;
      return Ok(count);
    } catch {
      return Err(RepositoryError("Unable to read attendee counts from memory."));
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
  return new InMemoryEventRepository(DEMO_EVENTS, DEMO_RSVPS);
}
