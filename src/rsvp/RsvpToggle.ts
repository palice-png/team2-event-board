import type { Result } from "../lib/result";

export type RsvpToggleStatus = "confirmed" | "waitlisted" | "cancelled";

export interface IRsvpToggleRecord {
  id: string;
  eventId: string;
  userId: string;
  status: RsvpToggleStatus;
  createdAt: string;
}

export interface RsvpToggleResult {
  rsvp: IRsvpToggleRecord;
  promoted: IRsvpToggleRecord | null;
}

export interface WaitlistPromotionResult {
  cancelled: IRsvpToggleRecord;
  promoted: IRsvpToggleRecord | null;
}

export type RsvpError =
  | { name: "EventNotFoundError"; message: string }
  | { name: "UnauthorizedError"; message: string }
  | { name: "InvalidEventStateError"; message: string }
  | { name: "UnexpectedDependencyError"; message: string };

export type WaitlistError =
  | { name: "EventNotFoundError"; message: string }
  | { name: "UnexpectedDependencyError"; message: string };

export const EventNotFoundError = (message: string): RsvpError => ({
  name: "EventNotFoundError",
  message,
});

export const UnauthorizedError = (message: string): RsvpError => ({
  name: "UnauthorizedError",
  message,
});

export const InvalidEventStateError = (message: string): RsvpError => ({
  name: "InvalidEventStateError",
  message,
});

export const UnexpectedDependencyError = (message: string): RsvpError => ({
  name: "UnexpectedDependencyError",
  message,
});

export const WaitlistEventNotFoundError = (message: string): WaitlistError => ({
  name: "EventNotFoundError",
  message,
});

export interface ICreateRsvpInput {
  eventId: string;
  userId: string;
  status: RsvpToggleStatus;
}

export interface IRsvpToggleRepository {
  createRsvp(input: ICreateRsvpInput): Promise<Result<IRsvpToggleRecord, RsvpError>>;
  findByUserAndEvent(
    userId: string,
    eventId: string,
  ): Promise<Result<IRsvpToggleRecord | null, RsvpError>>;
  updateStatus(
    rsvpId: string,
    status: RsvpToggleStatus,
  ): Promise<Result<IRsvpToggleRecord, RsvpError>>;
  findActiveForEvent(eventId: string): Promise<Result<IRsvpToggleRecord[], RsvpError>>;
  findWaitlistedForEvent(
    eventId: string,
  ): Promise<Result<IRsvpToggleRecord[], RsvpError>>;
  getWaitlistPosition(
    userId: string,
    eventId: string,
  ): Promise<Result<number | null, RsvpError>>;
}