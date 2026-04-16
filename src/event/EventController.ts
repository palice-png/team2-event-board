import type { Request, Response } from "express";
import { AuthenticationRequired } from "../auth/errors";
import type { ICreateEventInput, IEventService } from "./EventService";
import { getAuthenticatedUser, type AppSessionStore } from "../session/AppSession";

function sessionStore(req: Request): AppSessionStore {
  return req.session as AppSessionStore;
}

export interface IEventController {
  showCreateEventForm(req: Request, res: Response): Promise<void>;
  createEventFromForm(req: Request, res: Response): Promise<void>;
}

class EventController implements IEventController {
  constructor(private readonly eventService: IEventService) {}

  async showCreateEventForm(_req: Request, res: Response): Promise<void> {
    res.render("events/new", {
      formData: {},
      errorMessage: null,
    });
  }

  async createEventFromForm(req: Request, res: Response): Promise<void> {
    const currentUser = getAuthenticatedUser(sessionStore(req));

    if (!currentUser) {
      res.status(401).render("partials/error", {
        message: AuthenticationRequired("Please log in to continue.").message,
        layout: false,
      });
      return;
    }

    const input: ICreateEventInput = {
      title: typeof req.body.title === "string" ? req.body.title : "",
      description: typeof req.body.description === "string" ? req.body.description : "",
      location: typeof req.body.location === "string" ? req.body.location : "",
      category: typeof req.body.category === "string" ? req.body.category : "",
      capacity: typeof req.body.capacity === "string" ? req.body.capacity : "",
      startDatetime:
        typeof req.body.startDatetime === "string" ? req.body.startDatetime : "",
      endDatetime: typeof req.body.endDatetime === "string" ? req.body.endDatetime : "",
    };

    const result = await this.eventService.createEvent(
      input,
      currentUser.userId,
      currentUser.role,
    );

    if (result.ok === false) {
      res.status(400).render("events/new", {
        formData: {},
        errorMessage: result.value.message,
      });
      return;
    }

    res.redirect(`/events/${result.value.id}`);
  }
}

export function CreateEventController(eventService: IEventService): IEventController {
  return new EventController(eventService);
}