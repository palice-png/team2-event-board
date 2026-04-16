import type { Response } from "express";
import {
  getAuthenticatedUser,
  type AppSessionStore,
  type IAppBrowserSession,
} from "../session/AppSession";
import type { ILoggingService } from "../service/LoggingService";
import type { DashboardError, IEventService } from "./EventService";
import type { CancelEventError, PublishEventError } from "./errors";

export interface IEventController {
  showOrganizerDashboard(
    res: Response,
    store: AppSessionStore,
    session: IAppBrowserSession,
  ): Promise<void>;
  publishFromForm(res: Response, eventId: string, store: AppSessionStore): Promise<void>;
  cancelFromForm(res: Response, eventId: string, store: AppSessionStore): Promise<void>;
}

class EventController implements IEventController {
  constructor(
    private readonly service: IEventService,
    private readonly logger: ILoggingService,
  ) {}

  private mapErrorStatus(
    error: PublishEventError | CancelEventError | DashboardError,
  ): number {
    if (error.name === "EventNotFoundError") return 404;
    if (error.name === "UnauthorizedError") return 403;
    if (error.name === "InvalidEventStateError") return 409;
    return 500;
  }

  async showOrganizerDashboard(
    res: Response,
    store: AppSessionStore,
    session: IAppBrowserSession,
  ): Promise<void> {
    const currentUser = getAuthenticatedUser(store);
    if (!currentUser) {
      res.status(401).render("partials/error", {
        message: "Please log in to continue.",
        layout: false,
      });
      return;
    }

    const result = await this.service.getOrganizerDashboard(
      currentUser.userId,
      currentUser.role,
    );
    if (result.ok === false) {
      const status = this.mapErrorStatus(result.value);
      const log = status >= 500 ? this.logger.error : this.logger.warn;
      log.call(this.logger, `Load organizer dashboard failed: ${result.value.message}`);
      if (status === 403) {
        res.status(status).render("partials/error", {
          message: result.value.message,
          layout: false,
        });
        return;
      }

      res.status(status).render("events/organizer-dashboard", {
        pageError: result.value.message,
        session,
        dashboard: { published: [], draft: [], cancelledOrPast: [] },
      });
      return;
    }

    res.render("events/organizer-dashboard", {
      pageError: null,
      session,
      dashboard: result.value,
    });
  }

  async publishFromForm(res: Response, eventId: string, store: AppSessionStore): Promise<void> {
    const currentUser = getAuthenticatedUser(store);
    if (!currentUser) {
      res.status(401).render("partials/error", {
        message: "Please log in to continue.",
        layout: false,
      });
      return;
    }

    const result = await this.service.publishEvent(eventId, currentUser.userId, currentUser.role);
    if (result.ok === false) {
      const status = this.mapErrorStatus(result.value);
      const log = status >= 500 ? this.logger.error : this.logger.warn;
      log.call(this.logger, `Publish event failed: ${result.value.message}`);
      res.status(status).render("partials/error", {
        message: result.value.message,
        layout: false,
      });
      return;
    }

    this.logger.info(`Published event ${result.value.id}`);
    res.status(200).send("Event published.");
  }

  async cancelFromForm(res: Response, eventId: string, store: AppSessionStore): Promise<void> {
    const currentUser = getAuthenticatedUser(store);
    if (!currentUser) {
      res.status(401).render("partials/error", {
        message: "Please log in to continue.",
        layout: false,
      });
      return;
    }

    const result = await this.service.cancelEvent(eventId, currentUser.userId, currentUser.role);
    if (result.ok === false) {
      const status = this.mapErrorStatus(result.value);
      const log = status >= 500 ? this.logger.error : this.logger.warn;
      log.call(this.logger, `Cancel event failed: ${result.value.message}`);
      res.status(status).render("partials/error", {
        message: result.value.message,
        layout: false,
      });
      return;
    }

    this.logger.info(`Cancelled event ${result.value.id}`);
    res.status(200).send("Event cancelled.");
  }
}

export function CreateEventController(
  service: IEventService,
  logger: ILoggingService,
): IEventController {
  return new EventController(service, logger);
}
