import { Err, Ok, type Result } from "../lib/result";
import type { EventStatus, IEventRecord } from "./Event";
import type { IEventRepository, ICreateEventRecordInput, EventRepositoryError } from "./EventRepository";

export const DEMO_EVENTS: IEventRecord[] = [
  {
    id: "event-1",
    title: "Draft Test Event",
    description: "Test draft event",
    location: "UMass",
    category: "Workshop",
    status: "draft",
    capacity: 20,
    startDatetime: "2026-04-20T18:00:00.000Z",
    endDatetime: "2026-04-20T20:00:00.000Z",
    organizerId: "user-staff",
    createdAt: "2026-04-15T12:00:00.000Z",
    updatedAt: "2026-04-15T12:00:00.000Z",
  },
  {
    id: "event-2",
    title: "Published Test Event",
    description: "Test published event",
    location: "UMass",
    category: "Seminar",
    status: "published",
    capacity: 10,
    startDatetime: "2026-04-21T18:00:00.000Z",
    endDatetime: "2026-04-21T19:00:00.000Z",
    organizerId: "user-staff",
    createdAt: "2026-04-15T12:00:00.000Z",
    updatedAt: "2026-04-15T12:00:00.000Z",
  },
];

export type RsvpStatus = "going" | "waitlisted" | "cancelled";

export interface IRsvpRecord {
  id: string;
  eventId: string;
  userId: string;
  status: RsvpStatus;
  createdAt: string;
}
export const DEMO_RSVPS: IRsvpRecord[] = [
  {
    id: "rsvp-1",
    eventId: "event-2",
    userId: "user-reader",
    status: "going",
    createdAt: "2026-04-15T12:10:00.000Z",
  },
];


const eventStore = new Map<string, IEventRecord>();
const rsvpStore: IRsvpRecord[] = [];

function UnexpectedDependencyError(message: string): EventRepositoryError {
  return {
    name: "UnexpectedDependencyError",
    message,
  };
}

class InMemoryEventRepository implements IEventRepository {
  async createEvent(
    input: ICreateEventRecordInput,
  ): Promise<Result<IEventRecord, EventRepositoryError>> {
    try {
      const id = crypto.randomUUID();

      const event: IEventRecord = {
        id,
        title: input.title,
        description: input.description,
        location: input.location,
        category: input.category,
        status: input.status,
        capacity: input.capacity,
        startDatetime: input.startDatetime,
        endDatetime: input.endDatetime,
        organizerId: input.organizerId,
        createdAt: input.createdAt,
        updatedAt: input.updatedAt,
      };

      eventStore.set(id, event);
      return Ok(event);
    } catch {
      return Err(UnexpectedDependencyError("Unable to create event."));
    }
  }

  async findById(
    eventId: string,
  ): Promise<Result<IEventRecord | null, EventRepositoryError>> {
    try {
      return Ok(eventStore.get(eventId) ?? null);
    } catch {
      return Err(UnexpectedDependencyError("Unable to read event."));
    }
  }

  async listEvents(): Promise<Result<IEventRecord[], EventRepositoryError>> {
    try {
      return Ok([...eventStore.values()]);
    } catch {
      return Err(UnexpectedDependencyError("Unable to list events."));
    }
  }

  async listByOrganizerId(
    organizerId: string,
  ): Promise<Result<IEventRecord[], EventRepositoryError>> {
    try {
      const events = [...eventStore.values()].filter(
        (event) => event.organizerId === organizerId,
      );
      return Ok(events);
    } catch {
      return Err(UnexpectedDependencyError("Unable to read organizer events."));
    }
  }

  async listAll(): Promise<Result<IEventRecord[], EventRepositoryError>> {
    try {
      return Ok([...eventStore.values()]);
    } catch {
      return Err(UnexpectedDependencyError("Unable to list all events."));
    }
  }

  async countGoingByEventId(
    eventId: string,
  ): Promise<Result<number, EventRepositoryError>> {
    try {
      const count = rsvpStore.filter(
        (rsvp) => rsvp.eventId === eventId && rsvp.status === "going",
      ).length;

      return Ok(count);
    } catch {
      return Err(UnexpectedDependencyError("Unable to read attendee counts."));
    }
  }

  async updateStatus(
    eventId: string,
    status: EventStatus,
    updatedAt: string,
  ): Promise<Result<IEventRecord | null, EventRepositoryError>> {
    try {
      const event = eventStore.get(eventId);
      if (!event) {
        return Ok(null);
      }

      const updated: IEventRecord = {
        ...event,
        status,
        updatedAt,
      };

      eventStore.set(eventId, updated);
      return Ok(updated);
    } catch {
      return Err(UnexpectedDependencyError("Unable to update event status."));
    }
  }

  async listByStatus(
    status: EventStatus,
  ): Promise<Result<IEventRecord[], EventRepositoryError>> {
    try {
      const events = [...eventStore.values()].filter(
        (event) => event.status === status,
      );
      return Ok(events);
    } catch {
      return Err(UnexpectedDependencyError("Unable to list events by status."));
    }
  }

  async transitionExpiredToStatus(
    now: Date,
  ): Promise<Result<number, EventRepositoryError>> {
    try {
      let count = 0;
      const updatedAt = now.toISOString();
 
      for (const [id, event] of eventStore) {
        if (
          event.status !== "cancelled" &&
          event.status !== "past" &&
          new Date(event.endDatetime) < now
        ) {
          eventStore.set(id, { ...event, status: "past", updatedAt });
          count++;
        }
      }
 
      return Ok(count);
    } catch {
      return Err(
        UnexpectedDependencyError("Unable to transition expired events."),
      );
    }
  }
  async update(
    event: IEventRecord,
  ): Promise<Result<IEventRecord, EventRepositoryError>> {
    try {
      eventStore.set(event.id, event);
      return Ok(event);
    } catch {
      return Err(UnexpectedDependencyError("Unable to update event."));
    }
  }
}


export function CreateInMemoryEventRepository(): IEventRepository {
  const repo = new InMemoryEventRepository();

  for (const event of DEMO_EVENTS) {
    eventStore.set(event.id, event);
  }

  return repo;
}