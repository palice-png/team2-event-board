import { Ok, Err, type Result } from "../lib/result";
import type { UserRole } from "../auth/User";
import {
  EventNotFoundError,
  UnauthorizedError,
  InvalidEventStateError,
  UnexpectedDependencyError,
  type IRsvpToggleRepository,
  type RsvpToggleResult,
  type RsvpToggleStatus,
  type RsvpError,
} from "./RsvpToggle";
import type { IEventRepository } from "../event/EventRepository";

export interface RsvpStatusView {
  status: RsvpToggleStatus | "none";
  waitlistPosition: number | null;
}

export interface IRsvpToggleService {
  toggleRsvp(
    eventId: string,
    actingUserId: string,
    actingUserRole: UserRole,
  ): Promise<Result<RsvpToggleResult, RsvpError>>;
  getRsvpStatus(
    eventId: string,
    userId: string,
  ): Promise<Result<RsvpStatusView, RsvpError>>;
}

class RsvpToggleService implements IRsvpToggleService {
  constructor(
    private readonly rsvpRepo: IRsvpToggleRepository,
    private readonly eventRepo: IEventRepository,
  ) {}

  async getRsvpStatus(
    eventId: string,
    userId: string,
  ): Promise<Result<RsvpStatusView, RsvpError>> {
    const existingResult = await this.rsvpRepo.findByUserAndEvent(
      userId,
      eventId,
    );
    if (existingResult.ok === false) {
      return Err(UnexpectedDependencyError(existingResult.value.message));
    }

    const existing = existingResult.value;

    if (!existing || existing.status === "cancelled") {
      return Ok({ status: "none" as const, waitlistPosition: null });
    }

    if (existing.status === "waitlisted") {
      const positionResult = await this.rsvpRepo.getWaitlistPosition(
        userId,
        eventId,
      );
      if (positionResult.ok === false) {
        return Err(UnexpectedDependencyError(positionResult.value.message));
      }
      return Ok({ status: "waitlisted" as const, waitlistPosition: positionResult.value });
    }

    return Ok({ status: existing.status, waitlistPosition: null });
  }

  async toggleRsvp(
    eventId: string,
    actingUserId: string,
    actingUserRole: UserRole,
  ): Promise<Result<RsvpToggleResult, RsvpError>> {
    // Only members can RSVP
    if (actingUserRole !== "user") {
      return Err(UnauthorizedError("Only members can RSVP to events."));
    }

    // Look up the event
    const eventResult = await this.eventRepo.findById(eventId);
    if (eventResult.ok === false) {
      return Err(UnexpectedDependencyError(eventResult.value.message));
    }

    const event = eventResult.value;
    if (!event) {
      return Err(EventNotFoundError("Event not found."));
    }

    // Only published events can be RSVPed to
    if (event.status !== "published") {
      return Err(InvalidEventStateError("You can only RSVP to published events."));
    }

    // Check if user already has an RSVP
    const existingResult = await this.rsvpRepo.findByUserAndEvent(
      actingUserId,
      eventId,
    );
    if (existingResult.ok === false) {
      return Err(UnexpectedDependencyError(existingResult.value.message));
    }

    const existing = existingResult.value;

    // --- Case 1: No existing RSVP — create one ---
    if (!existing) {
      const activeResult = await this.rsvpRepo.findActiveForEvent(eventId);
      if (activeResult.ok === false) {
        return Err(UnexpectedDependencyError(activeResult.value.message));
      }

      const attendeeCount = activeResult.value.length;
      const isFull =
        event.capacity !== null && attendeeCount >= event.capacity;
      const newStatus = isFull ? "waitlisted" : "confirmed";

      const createResult = await this.rsvpRepo.createRsvp({
        eventId,
        userId: actingUserId,
        status: newStatus,
      });
      if (createResult.ok === false) {
        return Err(UnexpectedDependencyError(createResult.value.message));
      }

      return Ok({ rsvp: createResult.value, promoted: null });
    }

    // --- Case 2: Existing RSVP is cancelled — reactivate it ---
    if (existing.status === "cancelled") {
      const activeResult = await this.rsvpRepo.findActiveForEvent(eventId);
      if (activeResult.ok === false) {
        return Err(UnexpectedDependencyError(activeResult.value.message));
      }

      const attendeeCount = activeResult.value.length;
      const isFull =
        event.capacity !== null && attendeeCount >= event.capacity;
      const newStatus = isFull ? "waitlisted" : "confirmed";

      const updateResult = await this.rsvpRepo.updateStatus(
        existing.id,
        newStatus,
      );
      if (updateResult.ok === false) {
        return Err(UnexpectedDependencyError(updateResult.value.message));
      }

      return Ok({ rsvp: updateResult.value, promoted: null });
    }

    // --- Case 3: Existing RSVP is confirmed or waitlisted — cancel it ---
    const cancelResult = await this.rsvpRepo.updateStatus(
      existing.id,
      "cancelled",
    );
    if (cancelResult.ok === false) {
      return Err(UnexpectedDependencyError(cancelResult.value.message));
    }

    // Feature 9: If they were confirmed, promote the first waitlisted person
    let promoted = null;
    if (existing.status === "confirmed") {
      const waitlistResult = await this.rsvpRepo.findWaitlistedForEvent(eventId);
      if (waitlistResult.ok === false) {
        return Err(UnexpectedDependencyError(waitlistResult.value.message));
      }

      const next = waitlistResult.value[0];
      if (next) {
        const promoteResult = await this.rsvpRepo.updateStatus(
          next.id,
          "confirmed",
        );
        if (promoteResult.ok === false) {
          return Err(UnexpectedDependencyError(promoteResult.value.message));
        }
        promoted = promoteResult.value;
      }
    }

    return Ok({ rsvp: cancelResult.value, promoted });
  }
}

export function CreateRsvpToggleService(
  rsvpRepo: IRsvpToggleRepository,
  eventRepo: IEventRepository,
): IRsvpToggleService {
  return new RsvpToggleService(rsvpRepo, eventRepo);
}