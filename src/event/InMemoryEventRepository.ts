import { randomUUID } from "node:crypto";
import { Err, Ok, type Result } from "../lib/result";
import type { IEventRecord } from "./Event";
import type {
  EventRepositoryError,
  ICreateEventRecordInput,
  IEventRepository,
} from "./EventRepository";

const eventStore = new Map<string, IEventRecord>();

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
      const event: IEventRecord = {
        id: randomUUID(),
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

      eventStore.set(event.id, event);
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
}

export function CreateInMemoryEventRepository(): IEventRepository {
  return new InMemoryEventRepository();
}