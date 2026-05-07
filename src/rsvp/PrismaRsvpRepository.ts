import type { PrismaClient } from "@prisma/client";
import { Ok, Err, type Result } from "../lib/result";
import {
  UnexpectedDependencyError,
  type MyRsvpsError,
  type RsvpStatus,
  type EventStatus,
  type RsvpWithEvent,
} from "./Rsvp";
import type { IRsvpRepository } from "./RsvpRepository";

class PrismaRsvpRepository implements IRsvpRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByUserId(
    userId: string,
  ): Promise<Result<RsvpWithEvent[], MyRsvpsError>> {
    try {
      const rows = await this.prisma.rsvp.findMany({
        where: { userId },
        include: { event: true },
        orderBy: { createdAt: "asc" },
      });

      const joined: RsvpWithEvent[] = rows.map((row) => ({
        rsvpId: row.id,
        status: row.status as RsvpStatus,
        event: {
          id: row.event.id,
          title: row.event.title,
          date: row.event.startDatetime.toISOString(),
          location: row.event.location,
          status: row.event.status as EventStatus,
        },
      }));

      return Ok(joined);
    } catch {
      return Err(UnexpectedDependencyError("Unable to read RSVP data."));
    }
  }
}

export function CreatePrismaRsvpRepository(
  prisma: PrismaClient,
): IRsvpRepository {
  return new PrismaRsvpRepository(prisma);
}
