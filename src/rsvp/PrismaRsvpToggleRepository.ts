import { Ok, Err, type Result } from "../lib/result";
import {
  UnexpectedDependencyError,
  type IRsvpToggleRecord,
  type ICreateRsvpInput,
  type RsvpToggleStatus,
  type IRsvpToggleRepository,
  type RsvpError,
} from "./RsvpToggle";
import type { PrismaClient } from "@prisma/client";

function toRecord(row: {
  id: string;
  eventId: string;
  userId: string;
  status: string;
  createdAt: Date;
}): IRsvpToggleRecord {
  return {
    id: row.id,
    eventId: row.eventId,
    userId: row.userId,
    status: row.status as RsvpToggleStatus,
    createdAt: row.createdAt.toISOString(),
  };
}

class PrismaRsvpToggleRepository implements IRsvpToggleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createRsvp(
    input: ICreateRsvpInput,
  ): Promise<Result<IRsvpToggleRecord, RsvpError>> {
    try {
      const row = await this.prisma.rsvp.create({
        data: {
          eventId: input.eventId,
          userId: input.userId,
          status: input.status,
        },
      });
      return Ok(toRecord(row));
    } catch {
      return Err(UnexpectedDependencyError("Failed to create RSVP."));
    }
  }

  async findByUserAndEvent(
    userId: string,
    eventId: string,
  ): Promise<Result<IRsvpToggleRecord | null, RsvpError>> {
    try {
      const row = await this.prisma.rsvp.findUnique({
        where: { eventId_userId: { eventId, userId } },
      });
      return Ok(row ? toRecord(row) : null);
    } catch {
      return Err(UnexpectedDependencyError("Failed to find RSVP."));
    }
  }

  async updateStatus(
    rsvpId: string,
    status: RsvpToggleStatus,
  ): Promise<Result<IRsvpToggleRecord, RsvpError>> {
    try {
      const row = await this.prisma.rsvp.update({
        where: { id: rsvpId },
        data: { status },
      });
      return Ok(toRecord(row));
    } catch {
      return Err(UnexpectedDependencyError("Failed to update RSVP status."));
    }
  }

  async findActiveForEvent(
    eventId: string,
  ): Promise<Result<IRsvpToggleRecord[], RsvpError>> {
    try {
      const rows = await this.prisma.rsvp.findMany({
        where: { eventId, status: "confirmed" },
      });
      return Ok(rows.map(toRecord));
    } catch {
      return Err(UnexpectedDependencyError("Failed to find active RSVPs."));
    }
  }

  async findWaitlistedForEvent(
    eventId: string,
  ): Promise<Result<IRsvpToggleRecord[], RsvpError>> {
    try {
      const rows = await this.prisma.rsvp.findMany({
        where: { eventId, status: "waitlisted" },
        orderBy: { createdAt: "asc" },
      });
      return Ok(rows.map(toRecord));
    } catch {
      return Err(UnexpectedDependencyError("Failed to find waitlisted RSVPs."));
    }
  }

  async getWaitlistPosition(
    userId: string,
    eventId: string,
  ): Promise<Result<number | null, RsvpError>> {
    try {
      const rows = await this.prisma.rsvp.findMany({
        where: { eventId, status: "waitlisted" },
        orderBy: { createdAt: "asc" },
      });
      const index = rows.findIndex((r) => r.userId === userId);
      return Ok(index === -1 ? null : index + 1);
    } catch {
      return Err(UnexpectedDependencyError("Failed to get waitlist position."));
    }
  }
}

export function CreatePrismaRsvpToggleRepository(
  prisma: PrismaClient,
): IRsvpToggleRepository {
  return new PrismaRsvpToggleRepository(prisma);
}