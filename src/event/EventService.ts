import { Err, Ok, type Result } from "../lib/result";
import type { UserRole } from "../auth/User";
import type { IEventRecord } from "./Event";
import type { IEventRepository } from "./EventRepository";
import {
  EventNotFoundError,
  InvalidEventStateError,
  UnauthorizedError,
  UnexpectedDependencyError,
  type CancelEventError,
  type PublishEventError,
} from "./errors";

export interface IEventService {
  publishEvent(
    eventId: string,
    actingUserId: string,
    actingUserRole: UserRole,
  ): Promise<Result<IEventRecord, PublishEventError>>;
  cancelEvent(
    eventId: string,
    actingUserId: string,
    actingUserRole: UserRole,
  ): Promise<Result<IEventRecord, CancelEventError>>;
}

class EventService implements IEventService {
  constructor(private readonly events: IEventRepository) {}

  async publishEvent(
    eventId: string,
    actingUserId: string,
    actingUserRole: UserRole,
  ): Promise<Result<IEventRecord, PublishEventError>> {
    const eventResult = await this.events.findById(eventId);
    if (eventResult.ok === false) {
      return Err(UnexpectedDependencyError(eventResult.value.message));
    }

    const event = eventResult.value;
    if (!event) {
      return Err(EventNotFoundError("Event not found."));
    }

    const canPublishAny = actingUserRole === "admin";
    const canPublishOwn =
      actingUserRole === "staff" && event.organizerId === actingUserId;
    if (!canPublishAny && !canPublishOwn) {
      return Err(UnauthorizedError("You are not allowed to publish this event."));
    }

    if (event.status !== "draft") {
      return Err(InvalidEventStateError("Only draft events can be published."));
    }

    const updatedResult = await this.events.updateStatus(
      event.id,
      "published",
      new Date().toISOString(),
    );
    if (updatedResult.ok === false) {
      return Err(UnexpectedDependencyError(updatedResult.value.message));
    }

    if (!updatedResult.value) {
      return Err(EventNotFoundError("Event not found."));
    }

    return Ok(updatedResult.value);
  }

  async cancelEvent(
    eventId: string,
    actingUserId: string,
    actingUserRole: UserRole,
  ): Promise<Result<IEventRecord, CancelEventError>> {
    const eventResult = await this.events.findById(eventId);
    if (eventResult.ok === false) {
      return Err(UnexpectedDependencyError(eventResult.value.message));
    }

    const event = eventResult.value;
    if (!event) {
      return Err(EventNotFoundError("Event not found."));
    }

    const canCancelAny = actingUserRole === "admin";
    const canCancelOwn =
      actingUserRole === "staff" && event.organizerId === actingUserId;
    if (!canCancelAny && !canCancelOwn) {
      return Err(UnauthorizedError("You are not allowed to cancel this event."));
    }

    if (event.status !== "published") {
      return Err(InvalidEventStateError("Only published events can be cancelled."));
    }

    const updatedResult = await this.events.updateStatus(
      event.id,
      "cancelled",
      new Date().toISOString(),
    );
    if (updatedResult.ok === false) {
      return Err(UnexpectedDependencyError(updatedResult.value.message));
    }

    if (!updatedResult.value) {
      return Err(EventNotFoundError("Event not found."));
    }

    return Ok(updatedResult.value);
  }
}

export function CreateEventService(events: IEventRepository): IEventService {
  return new EventService(events);
}
