import { Err, Ok, type Result } from "../lib/result";
import type { UserRole } from "../auth/User";
import { toEventSummary, type IEventSummary } from "./Event";
import type { IEventRepository } from "./EventRepository";
import {
  UnauthorizedError,
  UnexpectedDependencyError,
  ValidationError,
  type CreateEventError,
} from "./errors";

export interface ICreateEventInput {
  title: string;
  description: string;
  location: string;
  category: string;
  capacity: string;
  startDatetime: string;
  endDatetime: string;
}

export interface IEventService {
  createEvent(
    eventInput: ICreateEventInput,
    actingUserId: string,
    actingUserRole: UserRole,
  ): Promise<Result<IEventSummary, CreateEventError>>;
}

class EventService implements IEventService {
  constructor(private readonly events: IEventRepository) {}

  async createEvent(
    eventInput: ICreateEventInput,
    actingUserId: string,
    actingUserRole: UserRole,
  ): Promise<Result<IEventSummary, CreateEventError>> {
    if (actingUserRole !== "admin" && actingUserRole !== "staff") {
      return Err(
        UnauthorizedError("Only organizers and admins can create events."),
      );
    }

    const title = eventInput.title.trim();
    const description = eventInput.description.trim();
    const location = eventInput.location.trim();
    const category = eventInput.category.trim();

    if (!title) {
      return Err(ValidationError("Title is required."));
    }

    if (!description) {
      return Err(ValidationError("Description is required."));
    }

    if (!location) {
      return Err(ValidationError("Location is required."));
    }

    if (!category) {
      return Err(ValidationError("Category is required."));
    }

    const start = new Date(eventInput.startDatetime);
    const end = new Date(eventInput.endDatetime);

    if (Number.isNaN(start.getTime())) {
      return Err(ValidationError("Start date and time are required."));
    }

    if (Number.isNaN(end.getTime())) {
      return Err(ValidationError("End date and time are required."));
    }

    if (end.getTime() <= start.getTime()) {
      return Err(
        ValidationError("End date and time must be after the start date and time."),
      );
    }

    const rawCapacity = eventInput.capacity.trim();
    let capacity: number | null = null;

    if (rawCapacity) {
      const parsedCapacity = Number(rawCapacity);

      if (!Number.isInteger(parsedCapacity) || parsedCapacity <= 0) {
        return Err(ValidationError("Capacity must be a positive whole number."));
      }

      capacity = parsedCapacity;
    }

    const now = new Date().toISOString();

    const created = await this.events.createEvent({
      title,
      description,
      location,
      category,
      status: "draft",
      capacity,
      startDatetime: start.toISOString(),
      endDatetime: end.toISOString(),
      organizerId: actingUserId,
      createdAt: now,
      updatedAt: now,
    });

    if (created.ok === false) {
      return Err(
        UnexpectedDependencyError(created.value.message),
      );
    }

    return Ok(toEventSummary(created.value));
  }
}

export function CreateEventService(events: IEventRepository): IEventService {
  return new EventService(events);
}