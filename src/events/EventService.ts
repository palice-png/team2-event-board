import { Ok, Err, type Result } from "../lib/result";

export type EventInput = {
  title: string;
  description: string;
  location: string;
  category: string;
  startDatetime: string;
  endDatetime: string;
};

export type EventSummary = {
  id: string;
  title: string;
  description: string;
  location: string;
  category: string;
  status: string;
  capacity: number | null;
  startDatetime: string;
  endDatetime: string;
  organizerId: string;
  createdAt: string;
  updatedAt: string;
};

export type UpdateEventError =
  | { name: "EventNotFoundError"; message: string }
  | { name: "UnauthorizedError"; message: string }
  | { name: "InvalidEventStateError"; message: string }
  | { name: "ValidationError"; message: string };

export interface IEventRepository {
  getById(id: string): EventSummary | null;
  update(event: EventSummary): void;
}

export class EventService {
  constructor(private repo: IEventRepository) {}

    validateEventInput(eventInput: EventInput): Result<EventInput, { name: "ValidationError"; message: string }> {
        if (!eventInput.title?.trim()) {
        return Err({ name: "ValidationError" as const, message: "Title is required" });
        }
    
        if (!eventInput.description?.trim()) {
        return Err({ name: "ValidationError" as const, message: "Description is required" });
        }
    
        if (!eventInput.location?.trim()) {
        return Err({ name: "ValidationError" as const, message: "Location is required" });
        }
    
        if (!eventInput.category?.trim()) {
        return Err({ name: "ValidationError" as const, message: "Category is required" });
        }
    
        const start = new Date(eventInput.startDatetime);
        const end = new Date(eventInput.endDatetime);
    
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return Err({ name: "ValidationError" as const, message: "Invalid dates" });
        }
    
        if (end <= start) {
        return Err({
            name: "ValidationError" as const,
            message: "End must be after start",
        });
        }
    
        return Ok(eventInput);
    }
        updateEvent(
            eventId: string,
            eventInput: EventInput,
            actingUserId: string,
            actingUserRole: UserRole
          ): Result<EventSummary, UpdateEventError> {
            const event = this.repo.getById(eventId);
        
            if (!event) {
              return Err({
                name: "EventNotFoundError",
                message: "Event not found",
              });
            }
        
            const isOwner = event.organizerId === actingUserId;
            const isAdmin = actingUserRole === "admin";
        
            if (!isOwner && !isAdmin) {
              return Err({
                name: "UnauthorizedError",
                message: "Not authorized to edit this event",
              });
            }
        
            if (event.status === "cancelled") {
              return Err({
                name: "InvalidEventStateError",
                message: "Cannot edit cancelled event",
              });
            }
        
            const validated = this.validateEventInput(eventInput);
        
            if (!validated.ok) {
              return validated;
            }
        
            const updated: EventSummary = {
                id: event.id,
                title: validated.value.title,
                description: validated.value.description,
                location: validated.value.location,
                category: validated.value.category,
                status: event.status,
                capacity: event.capacity,
                startDatetime: validated.value.startDatetime,
                endDatetime: validated.value.endDatetime,
                organizerId: event.organizerId,
                createdAt: event.createdAt,
                updatedAt: new Date().toISOString(),
            };
        
            this.repo.update(updated);
        
            return Ok(updated);
        }
}
    
    

