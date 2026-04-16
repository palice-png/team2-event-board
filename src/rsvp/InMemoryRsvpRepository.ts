import { randomUUID } from "node:crypto";
import { Ok, Err, type Result } from "../lib/result";
import type {
  IRsvpToggleRecord,
  RsvpToggleStatus,
  RsvpError,
  ICreateRsvpInput,
  IRsvpToggleRepository,
} from "./RsvpToggle";

function UnexpectedDependencyError(message: string): RsvpError {
  return { name: "UnexpectedDependencyError", message };
}

const rsvpStore = new Map<string, IRsvpToggleRecord>();

class InMemoryRsvpRepository implements IRsvpToggleRepository {
  async createRsvp(
    input: ICreateRsvpInput,
  ): Promise<Result<IRsvpToggleRecord, RsvpError>> {
    try {
      const rsvp: IRsvpToggleRecord = {
        id: randomUUID(),
        eventId: input.eventId,
        userId: input.userId,
        status: input.status,
        createdAt: new Date().toISOString(),
      };
      rsvpStore.set(rsvp.id, rsvp);
      return Ok(rsvp);
    } catch {
      return Err(UnexpectedDependencyError("Unable to create RSVP."));
    }
  }

  async findByUserAndEvent(
    userId: string,
    eventId: string,
  ): Promise<Result<IRsvpToggleRecord | null, RsvpError>> {
    try {
      for (const rsvp of rsvpStore.values()) {
        if (rsvp.userId === userId && rsvp.eventId === eventId) {
          return Ok(rsvp);
        }
      }
      return Ok(null);
    } catch {
      return Err(UnexpectedDependencyError("Unable to find RSVP."));
    }
  }

  async updateStatus(
    rsvpId: string,
    status: RsvpToggleStatus,
  ): Promise<Result<IRsvpToggleRecord, RsvpError>> {
    try {
      const rsvp = rsvpStore.get(rsvpId);
      if (!rsvp) {
        return Err(UnexpectedDependencyError("RSVP not found."));
      }
      rsvp.status = status;
      return Ok(rsvp);
    } catch {
      return Err(UnexpectedDependencyError("Unable to update RSVP."));
    }
  }

  async findActiveForEvent(
    eventId: string,
  ): Promise<Result<IRsvpToggleRecord[], RsvpError>> {
    try {
      const active = [...rsvpStore.values()].filter(
        (r) => r.eventId === eventId && r.status === "confirmed",
      );
      return Ok(active);
    } catch {
      return Err(UnexpectedDependencyError("Unable to list active RSVPs."));
    }
  }

  async findWaitlistedForEvent(
    eventId: string,
  ): Promise<Result<IRsvpToggleRecord[], RsvpError>> {
    try {
      const waitlisted = [...rsvpStore.values()]
        .filter((r) => r.eventId === eventId && r.status === "waitlisted")
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
      return Ok(waitlisted);
    } catch {
      return Err(UnexpectedDependencyError("Unable to list waitlisted RSVPs."));
    }
  }
}

export function CreateInMemoryRsvpRepository(): IRsvpToggleRepository {
  return new InMemoryRsvpRepository();
}