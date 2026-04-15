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
      organizerId: actingUserId,
      createdAt: now,
      updatedAt: now,
    });

    if (created.ok === false) {
      return Err(UnexpectedDependencyError(created.value.message));
    }

    return Ok(toEventSummary(created.value));
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
  ): Result<
    { startDatetime: string; endDatetime: string },
    CreateEventError
  > {
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