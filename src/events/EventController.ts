import type { Request, Response } from "express";
import type { EventService, EventInput } from "./EventService";

export class EventController {
  constructor(private service: EventService) {}

  updateEvent = (req: Request, res: Response) => {
    
    const eventIdParam = req.params.eventId;
    const eventId = Array.isArray(eventIdParam)
      ? eventIdParam[0]
      : eventIdParam;

    if (!eventId) {
      return res.status(400).send("Missing eventId");
    }


    const session = req.session as {
      userId?: string;
      role?: "admin" | "staff" | "user";
    };

    if (!session.userId || !session.role) {
      return res.status(401).send("Not authenticated");
    }

   
    const eventInput: EventInput = req.body;

    
    const result = this.service.updateEvent(
      eventId,
      eventInput,
      session.userId,
      session.role
    );


    if (!result.ok) {
      const error = result.value;

      switch (error.name) {
        case "EventNotFoundError":
          return res.status(404).send(error.message);

        case "UnauthorizedError":
          return res.status(403).send(error.message);

        case "InvalidEventStateError":
          return res.status(400).send(error.message);

        case "ValidationError":
          return res.status(400).send(error.message);

        default:
          return res.status(500).send("Unknown error");
      }
    }

    return res.status(200).json(result.value);
  };
}