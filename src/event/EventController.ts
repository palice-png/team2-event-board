import type { Request, Response } from "express";
import {
  getAuthenticatedUser,
  type AppSessionStore,
  type IAppBrowserSession,
  type IAuthenticatedUserSession,
} from "../session/AppSession";
import type { ILoggingService } from "../service/LoggingService";
import type {
  DashboardError,
  EventDetailView,
  ICreateEventInput,
  IUpdateEventInput,
  IEventService,
} from "./EventService";
import type {
  CancelEventError,
  CreateEventError,
  GetEventError,
  PublishEventError,
  UpdateEventError,
} from "./errors";
import type { ICommentService } from "../comments/CommentService";

export interface IEventController {
  showCreateForm(
    res: Response,
    store: AppSessionStore,
    session: IAppBrowserSession,
  ): Promise<void>;

  createFromForm(
    req: Request,
    res: Response,
    eventInput: ICreateEventInput,
    store: AppSessionStore,
    session: IAppBrowserSession,
  ): Promise<void>;

  showOrganizerDashboard(
    res: Response,
    store: AppSessionStore,
    session: IAppBrowserSession,
  ): Promise<void>;

  publishFromForm(
    res: Response,
    eventId: string,
    store: AppSessionStore,
    options?: { isHtmx?: boolean; viewSource?: string },
  ): Promise<void>;

  cancelFromForm(
    res: Response,
    eventId: string,
    store: AppSessionStore,
    options?: { isHtmx?: boolean; viewSource?: string },
  ): Promise<void>;

  showEventDetail(
    res: Response,
    eventId: string,
    store: AppSessionStore,
    session: IAppBrowserSession,
  ): Promise<void>;

  showEditForm(
    res: Response,
    eventId: string,
    store: AppSessionStore,
    session: IAppBrowserSession,
  ): Promise<void>;

  updateFromForm(
    res: Response,
    eventId: string,
    eventInput: IUpdateEventInput,
    store: AppSessionStore,
    session: IAppBrowserSession,
  ): Promise<void>;

  showArchivePage(
    res: Response,
    category: string | null,
    store: AppSessionStore,
    session: IAppBrowserSession,
  ): Promise<void>;
}

class EventController implements IEventController {
  constructor(
    private readonly service: IEventService,
    private readonly logger: ILoggingService,
    private readonly commentService: ICommentService,
  ) {}

  private isHtmxRequest(req: Request): boolean {
    return req.get("HX-Request") === "true";
  }

  private getCurrentUser(
    store: AppSessionStore,
  ): IAuthenticatedUserSession | null {
    return getAuthenticatedUser(store);
  }

  private renderLoginRequired(res: Response): void {
    res.status(401).render("partials/error", {
      message: "Please log in to continue.",
      layout: false,
    });
  }

  private renderCreateLoginRequired(req: Request, res: Response): void {
    if (this.isHtmxRequest(req)) {
      res.status(401).render("events/partials/createEventResult", {
        successMessage: null,
        errorMessage: "Please log in to continue.",
        layout: false,
      });
      return;
    }

    this.renderLoginRequired(res);
  }

  private emptyCreateForm(): ICreateEventInput {
    return {
      title: "",
      description: "",
      location: "",
      category: "",
      capacity: "",
      startDatetime: "",
      endDatetime: "",
    };
  }

  private buildCreateViewModel(
    session: IAppBrowserSession,
    errorMessage: string | null,
    formData: ICreateEventInput,
  ) {
    return {
      errorMessage,
      session,
      formData,
    };
  }

  private mapErrorStatus(
    error:
      | CreateEventError
      | PublishEventError
      | CancelEventError
      | DashboardError,
  ): number {
    if (error.name === "ValidationError") return 400;
    if (error.name === "EventNotFoundError") return 404;
    if (error.name === "UnauthorizedError") return 403;
    if (error.name === "InvalidEventStateError") return 409;
    return 500;
  }

  private buildEventDetailViewModel(
    session: IAppBrowserSession,
    detail: EventDetailView,
  ): {
    pageError: null;
    session: IAppBrowserSession;
    event: EventDetailView["event"];
    attendeeCount: number;
  } {
    return {
      pageError: null,
      session,
      event: detail.event,
      attendeeCount: detail.attendeeCount,
    };
  }

  private renderError(
    res: Response,
    status: number,
    message: string,
  ): void {
    res.status(status).render("partials/error", {
      message,
      layout: false,
    });
  }

  async showCreateForm(
    res: Response,
    store: AppSessionStore,
    session: IAppBrowserSession,
  ): Promise<void> {
    const currentUser = this.getCurrentUser(store);

    if (!currentUser) {
      this.renderLoginRequired(res);
      return;
    }

    res.render(
      "events/new",
      this.buildCreateViewModel(session, null, this.emptyCreateForm()),
    );
  }

  async createFromForm(
    req: Request,
    res: Response,
    eventInput: ICreateEventInput,
    store: AppSessionStore,
    session: IAppBrowserSession,
  ): Promise<void> {
    const currentUser = this.getCurrentUser(store);

    if (!currentUser) {
      this.renderCreateLoginRequired(req, res);
      return;
    }

    const result = await this.service.createEvent(
      eventInput,
      currentUser.userId,
      currentUser.role,
    );

    if (result.ok === false) {
      const status = this.mapErrorStatus(result.value);
      const log = status >= 500 ? this.logger.error : this.logger.warn;
      log.call(this.logger, `Create event failed: ${result.value.message}`);

      if (this.isHtmxRequest(req)) {
        res.status(status).render("events/partials/createEventResult", {
          successMessage: null,
          errorMessage: result.value.message,
          layout: false,
        });
        return;
      }

      res.status(status).render(
        "events/new",
        this.buildCreateViewModel(session, result.value.message, eventInput),
      );
      return;
    }

    this.logger.info(`Created draft event ${result.value.id}`);

    if (this.isHtmxRequest(req)) {
      res.status(201).render("events/partials/createEventResult", {
        successMessage: "Event created successfully.",
        errorMessage: null,
        layout: false,
      });
      return;
    }

    res.redirect("/organizer/dashboard");
  }

  async showEventDetail(
    res: Response,
    eventId: string,
    store: AppSessionStore,
    session: IAppBrowserSession,
  ): Promise<void> {
    const currentUser = this.getCurrentUser(store);

    if (!currentUser) {
      this.renderLoginRequired(res);
      return;
    }

    const result = await this.service.getEventById(
      eventId,
      currentUser.userId,
      currentUser.role,
    );

    if (result.ok === false) {
      const status = this.mapErrorStatus(result.value as GetEventError);
      const log = status >= 500 ? this.logger.error : this.logger.warn;
      log.call(this.logger, `Load event detail failed: ${result.value.message}`);

      if (status === 404) {
        this.renderError(res, 404, "Event not found.");
        return;
      }

      this.renderError(res, status, result.value.message);
      return;
    }

    const commentsResult = await this.commentService.listCommentsByEventId(
      result.value.event.id,
    );
    const comments = commentsResult.ok ? commentsResult.value : [];

    res.render("events/detail", {
      pageError: null,
      session,
      event: result.value.event,
      attendeeCount: result.value.attendeeCount,
      comments,
    });
  }

  async showOrganizerDashboard(
    res: Response,
    store: AppSessionStore,
    session: IAppBrowserSession,
  ): Promise<void> {
    const currentUser = this.getCurrentUser(store);

    if (!currentUser) {
      this.renderLoginRequired(res);
      return;
    }

    const result = await this.service.getOrganizerDashboard(
      currentUser.userId,
      currentUser.role,
    );

    if (result.ok === false) {
      const status = this.mapErrorStatus(result.value);
      const log = status >= 500 ? this.logger.error : this.logger.warn;
      log.call(
        this.logger,
        `Load organizer dashboard failed: ${result.value.message}`,
      );

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

  async publishFromForm(
    res: Response,
    eventId: string,
    store: AppSessionStore,
    options?: { isHtmx?: boolean; viewSource?: string },
  ): Promise<void> {
    const currentUser = this.getCurrentUser(store);

    if (!currentUser) {
      this.renderLoginRequired(res);
      return;
    }

    const result = await this.service.publishEvent(
      eventId,
      currentUser.userId,
      currentUser.role,
    );

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

    if (options?.isHtmx && options.viewSource === "detail") {
      res.render("events/partials/detail-status-actions", {
        layout: false,
        event: result.value,
        actingUser: currentUser,
      });
      return;
    }

    if (options?.isHtmx && options.viewSource === "dashboard") {
      const detailResult = await this.service.getEventById(
        result.value.id,
        currentUser.userId,
        currentUser.role,
      );

      if (detailResult.ok === false) {
        const status = this.mapErrorStatus(detailResult.value as GetEventError);
        res.status(status).render("partials/error", {
          message: detailResult.value.message,
          layout: false,
        });
        return;
      }

      res.render("events/partials/dashboard-row", {
        layout: false,
        row: {
          event: detailResult.value.event,
          attendeeCount: detailResult.value.attendeeCount,
        },
      });
      return;
    }

    res.status(200).send("Event published.");
  }

  async cancelFromForm(
    res: Response,
    eventId: string,
    store: AppSessionStore,
    options?: { isHtmx?: boolean; viewSource?: string },
  ): Promise<void> {
    const currentUser = this.getCurrentUser(store);

    if (!currentUser) {
      this.renderLoginRequired(res);
      return;
    }

    const result = await this.service.cancelEvent(
      eventId,
      currentUser.userId,
      currentUser.role,
    );

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

    if (options?.isHtmx && options.viewSource === "detail") {
      res.render("events/partials/detail-status-actions", {
        layout: false,
        event: result.value,
        actingUser: currentUser,
      });
      return;
    }

    if (options?.isHtmx && options.viewSource === "dashboard") {
      const detailResult = await this.service.getEventById(
        result.value.id,
        currentUser.userId,
        currentUser.role,
      );

      if (detailResult.ok === false) {
        const status = this.mapErrorStatus(detailResult.value as GetEventError);
        res.status(status).render("partials/error", {
          message: detailResult.value.message,
          layout: false,
        });
        return;
      }

      res.render("events/partials/dashboard-row", {
        layout: false,
        row: {
          event: detailResult.value.event,
          attendeeCount: detailResult.value.attendeeCount,
        },
      });
      return;
    }

    res.status(200).send("Event cancelled.");
  }

  async showEditForm(
    res: Response,
    eventId: string,
    store: AppSessionStore,
    session: IAppBrowserSession,
  ): Promise<void> {
    const currentUser = this.getCurrentUser(store);

    if (!currentUser) {
      this.renderLoginRequired(res);
      return;
    }

    const result = await this.service.getEventById(
      eventId,
      currentUser.userId,
      currentUser.role,
    );

    if (result.ok === false) {
      const status = this.mapErrorStatus(result.value as GetEventError);
      this.renderError(res, status, result.value.message);
      return;
    }

    res.render("events/edit", {
      session,
      errorMessage: null,
      event: result.value.event,
    });
  }

  async updateFromForm(
    res: Response,
    eventId: string,
    eventInput: IUpdateEventInput,
    store: AppSessionStore,
    session: IAppBrowserSession,
  ): Promise<void> {
    const currentUser = this.getCurrentUser(store);

    if (!currentUser) {
      this.renderLoginRequired(res);
      return;
    }

    const result = await this.service.updateEvent(
      eventId,
      eventInput,
      currentUser.userId,
      currentUser.role,
    );

    if (result.ok === false) {
      const status = this.mapErrorStatus(result.value as UpdateEventError);
      const log = status >= 500 ? this.logger.error : this.logger.warn;
      log.call(this.logger, `Update event failed: ${result.value.message}`);

      if (res.req?.get("HX-Request") === "true") {
        res.status(status).render("events/partials/editEventResult", {
          errorMessage: result.value.message,
          successMessage: null,
          layout: false,
        });
        return;
      }
      res.status(status).render("events/edit", {
        session,
        errorMessage: result.value.message,
        event: { id: eventId, ...eventInput },
      });
      return;
    }

    this.logger.info(`Updated event ${result.value.id}`);

    if (res.req?.get("HX-Request") === "true") {
      res.render("events/partials/editEventResult", {
        errorMessage: null,
        successMessage: "Event updated successfully.",
        layout: false,
      });
      return;
    }
    
    res.redirect(`/events/${result.value.id}`);
  }

  async showArchivePage(
    res: Response,
    category: string | null,
    store: AppSessionStore,
    session: IAppBrowserSession,
  ): Promise<void> {
    const currentUser = this.getCurrentUser(store);

    if (!currentUser) {
      this.renderLoginRequired(res);
      return;
    }

    const transitionResult = await this.service.transitionExpiredEvents(
      new Date(),
    );

    if (transitionResult.ok === false) {
      this.logger.error(
        `Archive: transition expired events failed: ${transitionResult.value.message}`,
      );
    }

    const result = await this.service.getArchivedEvents(category);

    if (result.ok === false) {
      const status = result.value.name === "InvalidFilterError" ? 400 : 500;
      const log = status >= 500 ? this.logger.error : this.logger.warn;
      log.call(this.logger, `Load archive failed: ${result.value.message}`);

      res.status(status).render("events/archive", {
        session,
        events: [],
        category,
        pageError: result.value.message,
      });
      return;
    }

    res.render("events/archive", {
      session,
      events: result.value,
      category,
      pageError: null,
    });
  }
}

export function CreateEventController(
  service: IEventService,
  logger: ILoggingService,
  commentService: ICommentService,
): IEventController {
  return new EventController(service, logger, commentService);
}