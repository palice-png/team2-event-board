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
}