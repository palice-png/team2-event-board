import { Ok, Err, type Result } from "../lib/result";
import type { IEventRepository } from "../event/EventRepository";
import type {
  IRsvpToggleRepository,
  IRsvpToggleRecord,
  RsvpToggleResult,
  WaitlistPromotionResult,
  RsvpError,
  WaitlistError,
} from "./RsvpToggle";
import {
  EventNotFoundError,
  InvalidEventStateError,
  UnexpectedDependencyError,
  WaitlistEventNotFoundError,
} from "./RsvpToggle";
import type { UserRole } from "../auth/User";

export interface IRsvpService {
  toggleRsvp(
    eventId: string,
    actingUserId: string,
    actingUserRole: UserRole,
  ): Promise<Result<RsvpToggleResult, RsvpError>>;

  cancelRsvpAndPromoteWaitlist(
    eventId: string,
    actingUserId: string,
    actingUserRole: UserRole,
  ): Promise<Result<WaitlistPromotionResult, RsvpError>>;

  getWaitlistPosition(
    eventId: string,
    actingUserId: string,
  ): Promise<Result<number | null, WaitlistError>>;
}

export function CreateRsvpService(
  eventRepo: IEventRepository,
  rsvpRepo: IRsvpToggleRepository,
): IRsvpService {

  async function resolveNewStatus(
    eventId: string,
  ): Promise<"confirmed" | "waitlisted"> {
    const activeResult = await rsvpRepo.findActiveForEvent(eventId);
    if (!activeResult.ok) return "confirmed";
    const event = await eventRepo.findById(eventId);
    if (!event.ok || !event.value) return "confirmed";
    const capacity = event.value.capacity;
    if (capacity === null) return "confirmed";
    return activeResult.value.length >= capacity ? "waitlisted" : "confirmed";
  }

  async function toggleRsvp(
    eventId: string,
    actingUserId: string,
    actingUserRole: UserRole,
  ): Promise<Result<RsvpToggleResult, RsvpError>> {
    const eventResult = await eventRepo.findById(eventId);
    if (!eventResult.ok) {
      return Err(UnexpectedDependencyError(eventResult.value.message));
    }
    if (!eventResult.value) {
      return Err(EventNotFoundError(`Event "${eventId}" not found.`));
    }

    if (eventResult.value.status !== "published") {
      return Err(InvalidEventStateError("You can only RSVP to published events."));
    }

    const existingResult = await rsvpRepo.findByUserAndEvent(actingUserId, eventId);
    if (!existingResult.ok) {
      return Err(UnexpectedDependencyError(existingResult.value.message));
    }
    const existing = existingResult.value;

    if (!existing) {
      const status = await resolveNewStatus(eventId);
      const createResult = await rsvpRepo.createRsvp({
        eventId,
        userId: actingUserId,
        status,
      });
      if (!createResult.ok) return Err(createResult.value);
      return Ok({ rsvp: createResult.value, promoted: null });
    }

    if (existing.status === "confirmed") {
      const promotionResult = await cancelRsvpAndPromoteWaitlist(
        eventId,
        actingUserId,
        actingUserRole,
      );
      if (!promotionResult.ok) return Err(promotionResult.value);
      return Ok({
        rsvp: promotionResult.value.cancelled,
        promoted: promotionResult.value.promoted,
      });
    }

    if (existing.status === "waitlisted") {
      const cancelResult = await rsvpRepo.updateStatus(existing.id, "cancelled");
      if (!cancelResult.ok) return Err(cancelResult.value);
      return Ok({ rsvp: cancelResult.value, promoted: null });
    }

    if (existing.status === "cancelled") {
      const status = await resolveNewStatus(eventId);
      const updateResult = await rsvpRepo.updateStatus(existing.id, status);
      if (!updateResult.ok) return Err(updateResult.value);
      return Ok({ rsvp: updateResult.value, promoted: null });
    }

    return Err(UnexpectedDependencyError("Unrecognized RSVP state."));
  }

  async function cancelRsvpAndPromoteWaitlist(
    eventId: string,
    actingUserId: string,
    actingUserRole: UserRole,
  ): Promise<Result<WaitlistPromotionResult, RsvpError>> {
    const existingResult = await rsvpRepo.findByUserAndEvent(actingUserId, eventId);
    if (!existingResult.ok) {
      return Err(UnexpectedDependencyError(existingResult.value.message));
    }
    if (!existingResult.value) {
      return Err(EventNotFoundError("No active RSVP found to cancel."));
    }

    const cancelResult = await rsvpRepo.updateStatus(
      existingResult.value.id,
      "cancelled",
    );
    if (!cancelResult.ok) return Err(cancelResult.value);

    const waitlistResult = await rsvpRepo.findWaitlistedForEvent(eventId);
    if (!waitlistResult.ok) {
      return Ok({ cancelled: cancelResult.value, promoted: null });
    }

    let promoted: IRsvpToggleRecord | null = null;
    if (waitlistResult.value.length > 0) {
      const promoteResult = await rsvpRepo.updateStatus(
        waitlistResult.value[0].id,
        "confirmed",
      );
      if (promoteResult.ok) {
        promoted = promoteResult.value;
      }
    }

    return Ok({ cancelled: cancelResult.value, promoted });
  }

  async function getWaitlistPosition(
    eventId: string,
    actingUserId: string,
  ): Promise<Result<number | null, WaitlistError>> {
    const eventResult = await eventRepo.findById(eventId);
    if (!eventResult.ok || !eventResult.value) {
      return Err(WaitlistEventNotFoundError(`Event "${eventId}" not found.`));
    }

    const waitlistResult = await rsvpRepo.findWaitlistedForEvent(eventId);
    if (!waitlistResult.ok) {
      return Ok(null);
    }

    const index = waitlistResult.value.findIndex(
      (r) => r.userId === actingUserId,
    );
    return Ok(index === -1 ? null : index + 1);
  }

  return { toggleRsvp, cancelRsvpAndPromoteWaitlist, getWaitlistPosition };
}