import type { Result } from "../lib/result";
import type { EventStatus, IEventRecord } from "./Event";

export type EventRepositoryError = {
  name: "UnexpectedDependencyError";
  message: string;
};

export interface ICreateEventRecordInput {
  title: string;
  description: string;
  location: string;
  category: string;
  status: EventStatus;
  capacity: number | null;
  startDatetime: string;
  endDatetime: string;
  organizerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface IEventRepository {
  createEvent(
    input: ICreateEventRecordInput,
  ): Promise<Result<IEventRecord, EventRepositoryError>>;

  findById(
    eventId: string,
  ): Promise<Result<IEventRecord | null, EventRepositoryError>>;

  listEvents(): Promise<Result<IEventRecord[], EventRepositoryError>>;

  listByOrganizerId(
    organizerId: string,
  ): Promise<Result<IEventRecord[], EventRepositoryError>>;

  listAll(): Promise<Result<IEventRecord[], EventRepositoryError>>;

  countGoingByEventId(
    eventId: string,
  ): Promise<Result<number, EventRepositoryError>>;

  updateStatus(
    eventId: string,
    status: EventStatus,
    updatedAt: string,
  ): Promise<Result<IEventRecord | null, EventRepositoryError>>;

  // Returns all events with the given status
  listByStatus(
    status: EventStatus,
  ): Promise<Result<IEventRecord[], EventRepositoryError>>;

  // Transitions all non-terminal events whose endDatetime < now to "past".
  // Returns the count of records updated.
  transitionExpiredToStatus(
    now: string,
  ): Promise<Result<number, EventRepositoryError>>;
}