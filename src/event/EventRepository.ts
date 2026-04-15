import type { Result } from "../lib/result";
import type { IEventRecord, EventStatus } from "./Event";

export interface EventRepositoryError {
  name: "EventRepositoryError";
  message: string;
}

export interface IEventRepository {
  findById(eventId: string): Promise<Result<IEventRecord | null, EventRepositoryError>>;
  updateStatus(
    eventId: string,
    status: EventStatus,
    updatedAt: string,
  ): Promise<Result<IEventRecord | null, EventRepositoryError>>;
}
