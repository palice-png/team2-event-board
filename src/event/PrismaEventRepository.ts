import { randomUUID } from "node:crypto";
import {
  PrismaClient,
  EventCategory as PrismaEventCategoryConst,
} from "@prisma/client";
import type {
  Event as PrismaEventRow,
  EventCategory as PrismaEventCategory,
} from "@prisma/client";
import { Err, Ok, type Result } from "../lib/result";
import type { EventStatus, IEventRecord } from "./Event";
import type {
  ICreateEventRecordInput,
  IEventRepository,
  EventRepositoryError,
} from "./EventRepository";

function UnexpectedDependencyError(message: string): EventRepositoryError {
  return {
    name: "UnexpectedDependencyError",
    message,
  };
}

const PRISMA_CATEGORY_VALUES = new Set<string>(
  Object.values(PrismaEventCategoryConst) as string[],
);

/**
 * Normalizes form and legacy category values into the Prisma EventCategory enum.
 * This keeps Sprint 2 form/tests compatible while persisting valid Sprint 3 data.
 */
const CATEGORY_ALIASES: Record<string, PrismaEventCategory> = {
  workshop: "educational",
  seminar: "educational",
  conference: "educational",
  training: "educational",
  meetup: "social",
  networking: "social",
  fundraiser: "volunteer",
  charity: "volunteer",
  game: "sports",
  fitness: "sports",
  music: "arts",
  theater: "arts",
  film: "arts",
};

function categoryStringToPrismaCategory(
  raw: string,
): Result<PrismaEventCategory, EventRepositoryError> {
  const trimmed = raw.trim();

  if (!trimmed) {
    return Err(
      UnexpectedDependencyError("Category is required for persistence."),
    );
  }

  const lower = trimmed.toLowerCase();

  if (PRISMA_CATEGORY_VALUES.has(lower)) {
    return Ok(lower as PrismaEventCategory);
  }

  const viaAlias = CATEGORY_ALIASES[lower];

  if (viaAlias) {
    return Ok(viaAlias);
  }

  return Err(
    UnexpectedDependencyError(
      "Unsupported event category for database persistence.",
    ),
  );
}

function isRecordNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "P2025"
  );
}

function mapPrismaEventToRecord(row: PrismaEventRow): IEventRecord {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    location: row.location,
    category: row.category as string,
    capacity: row.capacity,
    status: row.status as EventStatus,
    startDatetime: row.startDatetime.toISOString(),
    endDatetime: row.endDatetime.toISOString(),
    organizerId: row.organizerId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

class PrismaEventRepository implements IEventRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createEvent(
    input: ICreateEventRecordInput,
  ): Promise<Result<IEventRecord, EventRepositoryError>> {
    const categoryResult = categoryStringToPrismaCategory(input.category);

    if (categoryResult.ok === false) {
      return categoryResult;
    }

    try {
      const row = await this.prisma.event.create({
        data: {
          id: randomUUID(),
          title: input.title,
          description: input.description,
          location: input.location,
          category: categoryResult.value,
          status: input.status,
          capacity: input.capacity,
          startDatetime: new Date(input.startDatetime),
          endDatetime: new Date(input.endDatetime),
          organizerId: input.organizerId,
          createdAt: new Date(input.createdAt),
          updatedAt: new Date(input.updatedAt),
        },
      });

      return Ok(mapPrismaEventToRecord(row));
    } catch {
      return Err(UnexpectedDependencyError("Unable to create event."));
    }
  }

  async findById(
    eventId: string,
  ): Promise<Result<IEventRecord | null, EventRepositoryError>> {
    try {
      const row = await this.prisma.event.findUnique({
        where: { id: eventId },
      });

      return Ok(row ? mapPrismaEventToRecord(row) : null);
    } catch {
      return Err(UnexpectedDependencyError("Unable to read event."));
    }
  }

  async listEvents(): Promise<Result<IEventRecord[], EventRepositoryError>> {
    try {
      const rows = await this.prisma.event.findMany({
        orderBy: { startDatetime: "asc" },
      });

      return Ok(rows.map(mapPrismaEventToRecord));
    } catch {
      return Err(UnexpectedDependencyError("Unable to list events."));
    }
  }

  async listByOrganizerId(
    organizerId: string,
  ): Promise<Result<IEventRecord[], EventRepositoryError>> {
    try {
      const rows = await this.prisma.event.findMany({
        where: { organizerId },
        orderBy: { startDatetime: "asc" },
      });

      return Ok(rows.map(mapPrismaEventToRecord));
    } catch {
      return Err(UnexpectedDependencyError("Unable to read organizer events."));
    }
  }

  async listAll(): Promise<Result<IEventRecord[], EventRepositoryError>> {
    try {
      const rows = await this.prisma.event.findMany({
        orderBy: { startDatetime: "asc" },
      });

      return Ok(rows.map(mapPrismaEventToRecord));
    } catch {
      return Err(UnexpectedDependencyError("Unable to list all events."));
    }
  }

  async countGoingByEventId(
    eventId: string,
  ): Promise<Result<number, EventRepositoryError>> {
    try {
      const count = await this.prisma.rsvp.count({
        where: {
          eventId,
          status: "confirmed",
        },
      });

      return Ok(count);
    } catch {
      return Err(UnexpectedDependencyError("Unable to read attendee counts."));
    }
  }

  async updateStatus(
    eventId: string,
    status: EventStatus,
    updatedAt: string,
  ): Promise<Result<IEventRecord | null, EventRepositoryError>> {
    try {
      const row = await this.prisma.event.update({
        where: { id: eventId },
        data: {
          status,
          updatedAt: new Date(updatedAt),
        },
      });

      return Ok(mapPrismaEventToRecord(row));
    } catch (error) {
      if (isRecordNotFound(error)) {
        return Ok(null);
      }

      return Err(UnexpectedDependencyError("Unable to update event status."));
    }
  }

  async listByStatus(
    status: EventStatus,
  ): Promise<Result<IEventRecord[], EventRepositoryError>> {
    try {
      const rows = await this.prisma.event.findMany({
        where: { status },
        orderBy: { startDatetime: "asc" },
      });

      return Ok(rows.map(mapPrismaEventToRecord));
    } catch {
      return Err(UnexpectedDependencyError("Unable to list events by status."));
    }
  }

  async transitionExpiredToStatus(
    now: Date,
  ): Promise<Result<number, EventRepositoryError>> {
    try {
      const result = await this.prisma.event.updateMany({
        where: {
          endDatetime: { lt: now },
          status: { notIn: ["cancelled", "past"] },
        },
        data: {
          status: "past",
          updatedAt: now,
        },
      });

      return Ok(result.count);
    } catch {
      return Err(
        UnexpectedDependencyError("Unable to transition expired events."),
      );
    }
  }

  async update(
    event: IEventRecord,
  ): Promise<Result<IEventRecord, EventRepositoryError>> {
    const categoryResult = categoryStringToPrismaCategory(event.category);

    if (categoryResult.ok === false) {
      return categoryResult;
    }

    try {
      const row = await this.prisma.event.update({
        where: { id: event.id },
        data: {
          title: event.title,
          description: event.description,
          location: event.location,
          category: categoryResult.value,
          capacity: event.capacity,
          status: event.status,
          startDatetime: new Date(event.startDatetime),
          endDatetime: new Date(event.endDatetime),
          organizerId: event.organizerId,
          updatedAt: new Date(event.updatedAt),
        },
      });

      return Ok(mapPrismaEventToRecord(row));
    } catch {
      return Err(UnexpectedDependencyError("Unable to update event."));
    }
  }
}

export function CreatePrismaEventRepository(
  prisma: PrismaClient,
): IEventRepository {
  return new PrismaEventRepository(prisma);
}