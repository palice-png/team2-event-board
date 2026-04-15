import { Err, type Result } from "../lib/result";
import type { UserRole } from "../auth/User";
import type { IEventRecord } from "./Event";
import type { IEventRepository } from "./EventRepository";
import {
  UnexpectedDependencyError,
  type CancelEventError,
  type PublishEventError,
} from "./errors";

export interface IEventService {
  publishEvent(
    eventId: string,
    actingUserId: string,
    actingUserRole: UserRole,
  ): Promise<Result<IEventRecord, PublishEventError>>;
  cancelEvent(
    eventId: string,
    actingUserId: string,
    actingUserRole: UserRole,
  ): Promise<Result<IEventRecord, CancelEventError>>;
}

class EventService implements IEventService {
  constructor(private readonly events: IEventRepository) {}

  async publishEvent(
    eventId: string,
    actingUserId: string,
    actingUserRole: UserRole,
  ): Promise<Result<IEventRecord, PublishEventError>> {
    void eventId;
    void actingUserId;
    void actingUserRole;
    void this.events;
    return Err(UnexpectedDependencyError("publishEvent is not implemented yet."));
  }

  async cancelEvent(
    eventId: string,
    actingUserId: string,
    actingUserRole: UserRole,
  ): Promise<Result<IEventRecord, CancelEventError>> {
    void eventId;
    void actingUserId;
    void actingUserRole;
    void this.events;
    return Err(UnexpectedDependencyError("cancelEvent is not implemented yet."));
  }
}

export function CreateEventService(events: IEventRepository): IEventService {
  return new EventService(events);
}
