import type { Response } from "express";
import type { AppSessionStore, IAppBrowserSession } from "../session/AppSession";
import { getAuthenticatedUser } from "../session/AppSession";
import type { ILoggingService } from "../service/LoggingService";
import type { ICommentService } from "./CommentService";

export interface ICommentController {
  postComment(
    res: Response,
    eventId: string,
    body: string,
    store: AppSessionStore,
    session: IAppBrowserSession,
    options?: { isHtmx?: boolean },
  ): Promise<void>;

  deleteComment(
    res: Response,
    commentId: string,
    eventId: string,
    eventOrganizerId: string,
    store: AppSessionStore,
    session: IAppBrowserSession,
    options?: { isHtmx?: boolean },
  ): Promise<void>;
}

class CommentController implements ICommentController {
  constructor(
    private readonly service: ICommentService,
    private readonly logger: ILoggingService,
  ) {}

  async postComment(
    res: Response,
    eventId: string,
    body: string,
    store: AppSessionStore,
    session: IAppBrowserSession,
    options?: { isHtmx?: boolean },
  ): Promise<void> {
    const currentUser = getAuthenticatedUser(store);
    if (!currentUser) {
      res.status(401).render("partials/error", {
        message: "Please log in to continue.",
        layout: false,
      });
      return;
    }

    const result = await this.service.createComment(
      eventId,
      body,
      currentUser.userId,
      currentUser.role,
    );

    if (result.ok === false) {
      const status = result.value.name === "UnauthorizedError" ? 403 : 400;
      this.logger.warn(`Post comment failed: ${result.value.message}`);
      res.status(status).render("partials/error", {
        message: result.value.message,
        layout: false,
      });
      return;
    }

    this.logger.info(`Comment posted on event ${eventId}`);

    if (options?.isHtmx) {
      const commentsResult = await this.service.listCommentsByEventId(eventId);
      const comments = commentsResult.ok ? commentsResult.value : [];
      res.render("events/partials/comments", {
        layout: false,
        comments,
        eventId,
        session,
      });
      return;
    }

    res.redirect(`/events/${eventId}`);
  }

  async deleteComment(
    res: Response,
    commentId: string,
    eventId: string,
    eventOrganizerId: string,
    store: AppSessionStore,
    session: IAppBrowserSession,
    options?: { isHtmx?: boolean },
  ): Promise<void> {
    const currentUser = getAuthenticatedUser(store);
    if (!currentUser) {
      res.status(401).render("partials/error", {
        message: "Please log in to continue.",
        layout: false,
      });
      return;
    }

    const result = await this.service.deleteComment(
      commentId,
      currentUser.userId,
      currentUser.role,
      eventOrganizerId,
    );

    if (result.ok === false) {
      const status =
        result.value.name === "CommentNotFoundError" ? 404 :
        result.value.name === "UnauthorizedError" ? 403 : 400;
      this.logger.warn(`Delete comment failed: ${result.value.message}`);
      res.status(status).render("partials/error", {
        message: result.value.message,
        layout: false,
      });
      return;
    }

    this.logger.info(`Deleted comment ${commentId}`);

    if (options?.isHtmx) {
      const commentsResult = await this.service.listCommentsByEventId(eventId);
      const comments = commentsResult.ok ? commentsResult.value : [];
      res.render("events/partials/comments", {
        layout: false,
        comments,
        eventId,
        session,
      });
      return;
    }

    res.redirect("back");
  }
}

export function CreateCommentController(
  service: ICommentService,
  logger: ILoggingService,
): ICommentController {
  return new CommentController(service, logger);
}