import { Err, Ok, type Result } from "../lib/result";
import type { UserRole } from "../auth/User";
import {
  UnauthorizedError,
  type MyRsvpsError,
  type MyRsvpsView,
  type RsvpWithEvent,
} from "./Rsvp";
import type { IRsvpRepository } from "./RsvpRepository";

export interface IRsvpService {
  getMyRsvps(actingUserId: string, actingUserRole: UserRole): Promise<Result<MyRsvpsView, MyRsvpsError>>;
}

class RsvpService implements IRsvpService {
  constructor(private readonly repo: IRsvpRepository) {}

  async getMyRsvps(
    actingUserId: string,
    actingUserRole: UserRole,
  ): Promise<Result<MyRsvpsView, MyRsvpsError>> {
    if (actingUserRole === "staff") {
      return Err(UnauthorizedError("Organizers do not have a My RSVPs dashboard."));
    }

    const result = await this.repo.findByUserId(actingUserId);
    if (!result.ok) {
      return Err(result.value as MyRsvpsError);
    }

    const now = new Date();
    const upcoming: RsvpWithEvent[] = [];
    const pastOrCancelled: RsvpWithEvent[] = [];

    for (const entry of result.value) {
      const isUpcoming =
        entry.event.status === "published" &&
        new Date(entry.event.date) > now &&
        (entry.status === "confirmed" || entry.status === "waitlisted");

      if (isUpcoming) {
        upcoming.push(entry);
      } else {
        pastOrCancelled.push(entry);
      }
    }

    upcoming.sort((a, b) => new Date(a.event.date).getTime() - new Date(b.event.date).getTime());
    pastOrCancelled.sort((a, b) => new Date(b.event.date).getTime() - new Date(a.event.date).getTime());

    return Ok({ upcoming, pastOrCancelled });
  }
}

export function CreateRsvpService(repo: IRsvpRepository): IRsvpService {
  return new RsvpService(repo);
}
