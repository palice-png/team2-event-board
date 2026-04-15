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
  getOrganizerDashboard(
    actingUserId: string,
    actingUserRole: UserRole,
  ): Promise<Result<OrganizerDashboardView, DashboardError>>;
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

export interface OrganizerDashboardEventItem {
  event: IEventRecord;
  attendeeCount: number;
}

export interface OrganizerDashboardView {
  published: OrganizerDashboardEventItem[];
  draft: OrganizerDashboardEventItem[];
  cancelledOrPast: OrganizerDashboardEventItem[];
}

export type DashboardError = PublishEventError;

class EventService implements IEventService {
  constructor(private readonly events: IEventRepository) {}

  async getOrganizerDashboard(
    actingUserId: string,
    actingUserRole: UserRole,
  ): Promise<Result<OrganizerDashboardView, DashboardError>> {
    if (actingUserRole === "user") {
      return Err(UnauthorizedError("You are not allowed to access organizer dashboard."));
    }

    const eventsResult =
      actingUserRole === "admin"
        ? await this.events.listAll()
        : await this.events.listByOrganizerId(actingUserId);
    if (eventsResult.ok === false) {
      return Err(UnexpectedDependencyError(eventsResult.value.message));
    }

    const published: OrganizerDashboardEventItem[] = [];
    const draft: OrganizerDashboardEventItem[] = [];
    const cancelledOrPast: OrganizerDashboardEventItem[] = [];

    for (const event of eventsResult.value) {
      const attendeeCountResult = await this.events.countGoingByEventId(event.id);
      if (attendeeCountResult.ok === false) {
        return Err(UnexpectedDependencyError(attendeeCountResult.value.message));
      }

      const item: OrganizerDashboardEventItem = {
        event,
        attendeeCount: attendeeCountResult.value,
      };

      if (event.status === "published") {
        published.push(item);
      } else if (event.status === "draft") {
        draft.push(item);
      } else {
        cancelledOrPast.push(item);
      }
    }

    return Ok({
      published,
      draft,
      cancelledOrPast,
    });
  }

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
