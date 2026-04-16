import { Err, Ok, type Result } from "../lib/result";
import type { UserRole } from "../auth/User";
import { toEventSummary, type IEventSummary, type IEventRecord } from "./Event";
import type { IEventRepository } from "./EventRepository";
import {
  EventNotFoundError,
  InvalidEventStateError,
  UnauthorizedError,
  UnexpectedDependencyError,
  ValidationError,
  type CancelEventError,
  type CreateEventError,
  type PublishEventError,
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

export interface OrganizerDashboardEventItem {
  event: IEventRecord;
  attendeeCount: number;
}

export interface OrganizerDashboardView {
  published: OrganizerDashboardEventItem[];
  draft: OrganizerDashboardEventItem[];
  cancelledOrPast: OrganizerDashboardEventItem[];
}

export type DashboardError =
  | ReturnType<typeof UnauthorizedError>
  | ReturnType<typeof UnexpectedDependencyError>;

export interface IEventService {
  createEvent(
    eventInput: ICreateEventInput,
    actingUserId: string,
    actingUserRole: UserRole,
  ): Promise<Result<IEventSummary, CreateEventError>>;

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

class EventService implements IEventService {
  constructor(private readonly events: IEventRepository) {}

  async createEvent(
    eventInput: ICreateEventInput,
    actingUserId: string,
    actingUserRole: UserRole,
  ): Promise<Result<IEventSummary, CreateEventError>> {
    if (!this.canCreateEvents(actingUserRole)) {
      return Err(
        UnauthorizedError("Only organizers and admins can create events."),
      );
    }

    const organizerIdResult = this.normalizeActingUserId(actingUserId);
    if (organizerIdResult.ok === false) {
      return Err(organizerIdResult.value);
    }

    const titleResult = this.normalizeRequiredText(eventInput.title, "Title");
    if (titleResult.ok === false) {
      return Err(titleResult.value);
    }

    const descriptionResult = this.normalizeRequiredText(
      eventInput.description,
      "Description",
    );
    if (descriptionResult.ok === false) {
      return Err(descriptionResult.value);
    }

    const locationResult = this.normalizeRequiredText(
      eventInput.location,
      "Location",
    );
    if (locationResult.ok === false) {
      return Err(locationResult.value);
    }

    const categoryResult = this.normalizeRequiredText(
      eventInput.category,
      "Category",
    );
    if (categoryResult.ok === false) {
      return Err(categoryResult.value);
    }

    const datesResult = this.parseAndValidateDates(
      eventInput.startDatetime,
      eventInput.endDatetime,
    );
    if (datesResult.ok === false) {
      return Err(datesResult.value);
    }

    const capacityResult = this.parseAndValidateCapacity(eventInput.capacity);
    if (capacityResult.ok === false) {
      return Err(capacityResult.value);
    }

    const now = new Date().toISOString();

    const created = await this.events.createEvent({
      title: titleResult.value,
      description: descriptionResult.value,
      location: locationResult.value,
      category: categoryResult.value,
      status: "draft",
      capacity: capacityResult.value,
      startDatetime: datesResult.value.startDatetime,
      endDatetime: datesResult.value.endDatetime,
      organizerId: organizerIdResult.value,
      createdAt: now,
      updatedAt: now,
    });

    if (created.ok === false) {
      return Err(UnexpectedDependencyError(created.value.message));
    }

    return Ok(toEventSummary(created.value));
  }

  async getOrganizerDashboard(
    actingUserId: string,
    actingUserRole: UserRole,
  ): Promise<Result<OrganizerDashboardView, DashboardError>> {
    if (actingUserRole === "user") {
      return Err(
        UnauthorizedError("You are not allowed to access organizer dashboard."),
      );
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
      const attendeeCountResult = await this.events.countGoingByEventId(
        event.id,
      );
      if (attendeeCountResult.ok === false) {
        return Err(
          UnexpectedDependencyError(attendeeCountResult.value.message),
        );
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
      return Err(
        UnauthorizedError("You are not allowed to publish this event."),
      );
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
      return Err(
        UnauthorizedError("You are not allowed to cancel this event."),
      );
    }

    if (event.status !== "published") {
      return Err(
        InvalidEventStateError("Only published events can be cancelled."),
      );
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

  private canCreateEvents(role: UserRole): boolean {
    return role === "admin" || role === "staff";
  }

  private normalizeActingUserId(
    actingUserId: string,
  ): Result<string, CreateEventError> {
    const trimmed = actingUserId.trim();

    if (!trimmed) {
      return Err(UnauthorizedError("Missing authenticated user."));
    }

    return Ok(trimmed);
  }

  private normalizeRequiredText(
    value: string,
    fieldName: string,
  ): Result<string, CreateEventError> {
    const trimmed = value.trim();

    if (!trimmed) {
      return Err(ValidationError(`${fieldName} is required.`));
    }

    return Ok(trimmed);
  }

  private parseAndValidateDates(
    startDatetime: string,
    endDatetime: string,
  ): Result<{ startDatetime: string; endDatetime: string }, CreateEventError> {
    const start = new Date(startDatetime);
    const end = new Date(endDatetime);

    if (Number.isNaN(start.getTime())) {
      return Err(ValidationError("Start date and time are required."));
    }

    if (Number.isNaN(end.getTime())) {
      return Err(ValidationError("End date and time are required."));
    }

    if (end.getTime() <= start.getTime()) {
      return Err(
        ValidationError(
          "End date and time must be after the start date and time.",
        ),
      );
    }

    return Ok({
      startDatetime: start.toISOString(),
      endDatetime: end.toISOString(),
    });
  }

  private parseAndValidateCapacity(
    capacityInput: string,
  ): Result<number | null, CreateEventError> {
    const rawCapacity = capacityInput.trim();

    if (!rawCapacity) {
      return Ok(null);
    }

    const parsedCapacity = Number(rawCapacity);

    if (!Number.isInteger(parsedCapacity) || parsedCapacity <= 0) {
      return Err(ValidationError("Capacity must be a positive whole number."));
    }

    return Ok(parsedCapacity);
  }
}

export function CreateEventService(events: IEventRepository): IEventService {
  return new EventService(events);
}