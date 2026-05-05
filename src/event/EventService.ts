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
  type GetEventError,
  type PublishEventError,
  type UpdateEventError,
  type ArchiveError,
  InvalidFilterError,
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

export interface IUpdateEventInput {
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

export interface EventDetailView {
  event: IEventRecord;
  attendeeCount: number;
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

  getEventById(
    eventId: string,
    actingUserId: string,
    actingUserRole: UserRole,
  ): Promise<Result<EventDetailView, GetEventError>>;

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

  updateEvent(
    eventId: string,
    eventInput: IUpdateEventInput,
    actingUserId: string,
    actingUserRole: UserRole,
  ): Promise<Result<IEventRecord, UpdateEventError>>;

  transitionExpiredEvents(
    now: Date
  ): Promise<Result<number, ArchiveError>>;

  getArchivedEvents(
    category: string | null
  ): Promise<Result<IEventSummary[], ArchiveError | InvalidFilterError>>;
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

  async getEventById(
    eventId: string,
    actingUserId: string,
    actingUserRole: UserRole,
  ): Promise<Result<EventDetailView, GetEventError>> {
    const eventResult = await this.events.findById(eventId);
    if (eventResult.ok === false) {
      return Err(UnexpectedDependencyError(eventResult.value.message));
    }

    const event = eventResult.value;
        if (!event) {
      return Err(EventNotFoundError("Event not found."));
    }

    if (!this.canViewEventDetail(event, actingUserId, actingUserRole)) {
      return Err(EventNotFoundError("Event not found."));
    }

    const attendeeCountResult = await this.events.countGoingByEventId(event.id);
    if (attendeeCountResult.ok === false) {
      return Err(
        UnexpectedDependencyError(attendeeCountResult.value.message),
      );
    }

    const detailView: EventDetailView = {
      event,
      attendeeCount: attendeeCountResult.value,
    };

    return Ok(detailView);
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

  async updateEvent(
    eventId: string,
    eventInput: IUpdateEventInput,
    actingUserId: string,
    actingUserRole: UserRole,
  ): Promise<Result<IEventRecord, UpdateEventError>> {
    const eventResult = await this.events.findById(eventId);
    if (eventResult.ok === false) {
      return Err(UnexpectedDependencyError(eventResult.value.message));
    }

    const event = eventResult.value;
    if (!event) {
      return Err(EventNotFoundError("Event not found."));
    }

    const isOwner = event.organizerId === actingUserId;
    const isAdmin = actingUserRole === "admin";

    if (!isOwner && !isAdmin) {
      return Err(UnauthorizedError("You are not authorized to edit this event."));
    }

    if (event.status === "cancelled" || event.status == "past") {
      return Err(InvalidEventStateError("Cannot edit a cancelled event."));
    }

    const titleResult = this.normalizeRequiredText(eventInput.title, "Title");
    if (titleResult.ok === false) return Err(titleResult.value);

    const descriptionResult = this.normalizeRequiredText(eventInput.description, "Description");
    if (descriptionResult.ok === false) return Err(descriptionResult.value);

    const locationResult = this.normalizeRequiredText(eventInput.location, "Location");
    if (locationResult.ok === false) return Err(locationResult.value);

    const categoryResult = this.normalizeRequiredText(eventInput.category, "Category");
    if (categoryResult.ok === false) return Err(categoryResult.value);

    const datesResult = this.parseAndValidateDates(
      eventInput.startDatetime,
      eventInput.endDatetime,
    );
    if (datesResult.ok === false) return Err(datesResult.value);

    const capacityResult = this.parseAndValidateCapacity(eventInput.capacity);
    if (capacityResult.ok === false) return Err(capacityResult.value);

    const updated: IEventRecord = {
      ...event,
      title: titleResult.value,
      description: descriptionResult.value,
      location: locationResult.value,
      category: categoryResult.value,
      capacity: capacityResult.value,
      startDatetime: datesResult.value.startDatetime,
      endDatetime: datesResult.value.endDatetime,
      updatedAt: new Date().toISOString(),
    };

    const savedResult = await this.events.update(updated);
    if (savedResult.ok === false) {
      return Err(UnexpectedDependencyError(savedResult.value.message));
    }

    return Ok(savedResult.value);
  }

  private canCreateEvents(role: UserRole): boolean {
    return role === "admin" || role === "staff";
  }

  private canViewEventDetail(
    event: IEventRecord,
    actingUserId: string,
    actingUserRole: UserRole,
  ): boolean {
    if (event.status === "draft") {
      return (
        actingUserRole === "admin" || event.organizerId === actingUserId
      );
    }

    return true;
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

  async transitionExpiredEvents(
    now: Date
  ): Promise<Result<number, ArchiveError>> {
    const result = await this.events.transitionExpiredToStatus(now);
    if (result.ok === false) {
      return Err(UnexpectedDependencyError(result.value.message));
    }
    return Ok(result.value);
  }

  async getArchivedEvents(
    category: string | null
  ): Promise<Result<IEventSummary[], ArchiveError | InvalidFilterError>> {
    if (category === '') {
      return Err(InvalidFilterError('Category filter cannot be empty.'));
    }
 
    const result = await this.events.listByStatus('past');
    if (result.ok === false) {
      return Err(UnexpectedDependencyError(result.value.message));
    }
 
    let events = result.value;
 
    if (category !== null) {
      events = events.filter(
        (event) => event.category.toLowerCase() === category.toLowerCase(),
      );
    }
 
    events.sort(
      (a, b) =>
        new Date(b.startDatetime).getTime() -
        new Date(a.startDatetime).getTime(),
    );
 
    return Ok(events.map(toEventSummary));
  }
}

export function CreateEventService(events: IEventRepository): IEventService {
  return new EventService(events);
}