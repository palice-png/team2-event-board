export type RsvpStatus = "confirmed" | "waitlisted" | "cancelled";
export type EventStatus = "published" | "cancelled" | "past";

export interface IRsvpRecord {
  id: string;
  eventId: string;
  userId: string;
  status: RsvpStatus;
  createdAt: string;
}

// Minimal event shape needed for the dashboard join.
// Will be replaced by the shared EventRecord from Feature 1 once it lands.
export interface IEventStub {
  id: string;
  title: string;
  date: string; // ISO 8601, e.g. "2026-05-10T18:00:00Z"
  location: string;
  status: EventStatus;
}

export interface RsvpWithEvent {
  rsvpId: string;
  status: RsvpStatus;
  event: IEventStub;
}

export interface MyRsvpsView {
  upcoming: RsvpWithEvent[];
  pastOrCancelled: RsvpWithEvent[];
}

export type MyRsvpsError =
  | { name: "UnauthorizedError"; message: string }
  | { name: "UnexpectedDependencyError"; message: string };

export const UnauthorizedError = (message: string): MyRsvpsError =>
  ({ name: "UnauthorizedError", message });

export const UnexpectedDependencyError = (message: string): MyRsvpsError =>
  ({ name: "UnexpectedDependencyError", message });
