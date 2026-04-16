import type { Result } from "../lib/result";

export type RsvpStatus = "going" | "waitlisted" | "cancelled";

export interface IRsvpRecord {
  id: string;
  eventId: string;
  userId: string;
  status: RsvpStatus;
  createdAt: string;
}

export interface RsvpToggleResult {
  rsvp: IRsvpRecord;
  promoted: IRsvpRecord | null;
}

export interface WaitlistPromotionResult {
  cancelled: IRsvpRecord;
  promoted: IRsvpRecord | null;
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
  status: RsvpStatus;
}

export interface IRsvpRepository {
  createRsvp(input: ICreateRsvpInput): Promise<Result<IRsvpRecord, RsvpError>>;
  findByUserAndEvent(
    userId: string,
    eventId: string,
  ): Promise<Result<IRsvpRecord | null, RsvpError>>;
  updateStatus(
    rsvpId: string,
    status: RsvpStatus,
  ): Promise<Result<IRsvpRecord, RsvpError>>;
  findActiveForEvent(eventId: string): Promise<Result<IRsvpRecord[], RsvpError>>;
  findWaitlistedForEvent(
    eventId: string,
  ): Promise<Result<IRsvpRecord[], RsvpError>>;
  findByUser(userId: string): Promise<Result<IRsvpRecord[], RsvpError>>;
}