import { Err, Ok, type Result } from "../lib/result";
import { UnexpectedDependencyError, type MyRsvpsError, type IRsvpRecord, type IEventStub, type RsvpWithEvent } from "./Rsvp";
import type { IRsvpRepository } from "./RsvpRepository";

const DEMO_EVENTS: IEventStub[] = [
  {
    id: "event-1",
    title: "TypeScript Workshop",
    date: "2026-05-15T18:00:00Z",
    location: "Room 101",
    status: "published",
  },
  {
    id: "event-2",
    title: "Node.js Deep Dive",
    date: "2026-06-20T14:00:00Z",
    location: "Auditorium B",
    status: "published",
  },
  {
    id: "event-3",
    title: "React Fundamentals",
    date: "2026-07-10T10:00:00Z",
    location: "Online",
    status: "published",
  },
  {
    id: "event-4",
    title: "Intro to Databases",
    date: "2026-01-10T09:00:00Z",
    location: "Lab 3",
    status: "past",
  },
  {
    id: "event-5",
    title: "Staff-Only Meetup",
    date: "2026-06-01T17:00:00Z",
    location: "Conference Room A",
    status: "published",
  },
];

const DEMO_RSVPS: IRsvpRecord[] = [
  // user-reader: upcoming confirmed
  { id: "rsvp-1", eventId: "event-1", userId: "user-reader", status: "confirmed", createdAt: "2026-04-01T10:00:00Z" },
  // user-reader: upcoming waitlisted (further in future, so sorts after rsvp-1)
  { id: "rsvp-2", eventId: "event-2", userId: "user-reader", status: "waitlisted", createdAt: "2026-04-02T11:00:00Z" },
  // user-reader: cancelled RSVP on a future published event (goes to pastOrCancelled)
  { id: "rsvp-3", eventId: "event-3", userId: "user-reader", status: "cancelled", createdAt: "2026-04-03T12:00:00Z" },
  // user-reader: confirmed RSVP on a past event (goes to pastOrCancelled)
  { id: "rsvp-4", eventId: "event-4", userId: "user-reader", status: "confirmed", createdAt: "2025-12-20T09:00:00Z" },
  // different user — must NOT appear in user-reader's results
  { id: "rsvp-5", eventId: "event-5", userId: "user-staff", status: "confirmed", createdAt: "2026-04-05T14:00:00Z" },
];

class InMemoryRsvpRepository implements IRsvpRepository {
  constructor(
    private readonly rsvps: IRsvpRecord[],
    private readonly events: IEventStub[],
  ) {}

  async findByUserId(userId: string): Promise<Result<RsvpWithEvent[], MyRsvpsError>> {
    try {
      const userRsvps = this.rsvps.filter((r) => r.userId === userId);
      const joined: RsvpWithEvent[] = [];

      for (const rsvp of userRsvps) {
        const event = this.events.find((e) => e.id === rsvp.eventId);
        if (event) {
          joined.push({ rsvpId: rsvp.id, status: rsvp.status, event });
        }
      }

      return Ok(joined);
    } catch {
      return Err(UnexpectedDependencyError("Unable to read RSVP data."));
    }
  }
}

export function CreateInMemoryRsvpRepository(): IRsvpRepository {
  return new InMemoryRsvpRepository([...DEMO_RSVPS], [...DEMO_EVENTS]);
}
