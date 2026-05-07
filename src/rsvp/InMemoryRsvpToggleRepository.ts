import { Ok, Err, type Result } from "../lib/result";
import {
  UnexpectedDependencyError,
  type IRsvpToggleRecord,
  type ICreateRsvpInput,
  type RsvpToggleStatus,
  type IRsvpToggleRepository,
  type RsvpError,
} from "./RsvpToggle";
import { randomUUID } from "node:crypto";

class InMemoryRsvpToggleRepository implements IRsvpToggleRepository {
  private rsvps: IRsvpToggleRecord[] = [];

  async createRsvp(
    input: ICreateRsvpInput,
  ): Promise<Result<IRsvpToggleRecord, RsvpError>> {
    try {
      const record: IRsvpToggleRecord = {
        id: randomUUID(),
        eventId: input.eventId,
        userId: input.userId,
        status: input.status,
        createdAt: new Date().toISOString(),
      };
      this.rsvps.push(record);
      return Ok(record);
    } catch {
      return Err(UnexpectedDependencyError("Failed to create RSVP."));
    }
  }

  async findByUserAndEvent(
    userId: string,
    eventId: string,
  ): Promise<Result<IRsvpToggleRecord | null, RsvpError>> {
    try {
      const record = this.rsvps.find(
        (r) => r.userId === userId && r.eventId === eventId,
      );
      return Ok(record ?? null);
    } catch {
      return Err(UnexpectedDependencyError("Failed to find RSVP."));
    }
  }

  async updateStatus(
    rsvpId: string,
    status: RsvpToggleStatus,
  ): Promise<Result<IRsvpToggleRecord, RsvpError>> {
    try {
      const index = this.rsvps.findIndex((r) => r.id === rsvpId);
      if (index === -1) {
        return Err(UnexpectedDependencyError("RSVP not found."));
      }
      this.rsvps[index] = { ...this.rsvps[index], status };
      return Ok(this.rsvps[index]);
    } catch {
      return Err(UnexpectedDependencyError("Failed to update RSVP status."));
    }
  }

  async findActiveForEvent(
    eventId: string,
  ): Promise<Result<IRsvpToggleRecord[], RsvpError>> {
    try {
      const records = this.rsvps.filter(
        (r) => r.eventId === eventId && r.status === "confirmed",
      );
      return Ok(records);
    } catch {
      return Err(UnexpectedDependencyError("Failed to find active RSVPs."));
    }
  }

  async findWaitlistedForEvent(
    eventId: string,
  ): Promise<Result<IRsvpToggleRecord[], RsvpError>> {
    try {
      const records = this.rsvps
        .filter((r) => r.eventId === eventId && r.status === "waitlisted")
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
      return Ok(records);
    } catch {
      return Err(UnexpectedDependencyError("Failed to find waitlisted RSVPs."));
    }
  }

  async getWaitlistPosition(
    userId: string,
    eventId: string,
  ): Promise<Result<number | null, RsvpError>> {
    try {
      const waitlisted = this.rsvps
        .filter((r) => r.eventId === eventId && r.status === "waitlisted")
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
      const index = waitlisted.findIndex((r) => r.userId === userId);
      return Ok(index === -1 ? null : index + 1);
    } catch {
      return Err(UnexpectedDependencyError("Failed to get waitlist position."));
    }
  }
}

export function CreateInMemoryRsvpToggleRepository(): IRsvpToggleRepository {
  return new InMemoryRsvpToggleRepository();
}