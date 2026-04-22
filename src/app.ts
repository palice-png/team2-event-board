import path from "node:path";
import express, { Request, RequestHandler, Response } from "express";
import session from "express-session";
import Layouts from "express-ejs-layouts";
import { IAuthController } from "./auth/AuthController";
import type { IRsvpController } from "./rsvp/RsvpController";
import { IEventController } from "./event/EventController";
import type { ICommentController } from "./comments/CommentController";
import {
  AuthenticationRequired,
  AuthorizationRequired,
} from "./auth/errors";
import type { UserRole } from "./auth/User";
import { IApp } from "./contracts";
import {
  getAuthenticatedUser,
  isAuthenticatedSession,
  AppSessionStore,
  recordPageView,
  touchAppSession,
} from "./session/AppSession";
import { ILoggingService } from "./service/LoggingService";
import { CreateInMemoryEventRepository } from "./event/InMemoryEventRepository";
import { CreateInMemoryRsvpRepository } from "./rsvp/InMemoryRsvpRepository";
import { CreateRsvpService } from "./rsvp/RsvpService";

type AsyncRequestHandler = RequestHandler;

function asyncHandler(fn: AsyncRequestHandler) {
  return function wrapped(
    req: Request,
    res: Response,
    next: (value?: unknown) => void,
  ) {
    return Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function sessionStore(req: Request): AppSessionStore {
  return req.session as AppSessionStore;
}

class ExpressApp implements IApp {
  private readonly app: express.Express;

  constructor(
    private readonly authController: IAuthController,

    private readonly rsvpController: IRsvpController,
    private readonly eventController: IEventController,
    private readonly commentController: ICommentController,
    private readonly logger: ILoggingService,
  ) {
    this.app = express();
    this.registerMiddleware();
    this.registerTemplating();
    this.registerRoutes();
  }

  private registerMiddleware(): void {
    this.app.use(express.static(path.join(process.cwd(), "src/static")));
    this.app.use(
      session({
        name: "app.sid",
        secret: process.env.SESSION_SECRET ?? "project-starter-demo-secret",
        resave: false,
        saveUninitialized: false,
        cookie: {
          httpOnly: true,
          sameSite: "lax",
        },
      }),
    );
    this.app.use(Layouts);
    this.app.use(express.urlencoded({ extended: true }));
  }

  private registerTemplating(): void {
    this.app.set("view engine", "ejs");
    this.app.set("views", path.join(process.cwd(), "src/views"));
    this.app.set("layout", "layouts/base");
  }

  private isHtmxRequest(req: Request): boolean {
    return req.get("HX-Request") === "true";
  }

  private requireAuthenticated(req: Request, res: Response): boolean {
    const store = sessionStore(req);
    touchAppSession(store);

    if (getAuthenticatedUser(store)) {
      return true;
    }

    this.logger.warn("Blocked unauthenticated request to a protected route");
    if (this.isHtmxRequest(req) || req.method !== "GET") {
      res.status(401).render("partials/error", {
        message: AuthenticationRequired("Please log in to continue.").message,
        layout: false,
      });
      return false;
    }

    res.redirect("/login");
    return false;
  }

  private requireRole(
    req: Request,
    res: Response,
    allowedRoles: UserRole[],
    message: string,
  ): boolean {
    if (!this.requireAuthenticated(req, res)) {
      return false;
    }

    const currentUser = getAuthenticatedUser(sessionStore(req));
    if (currentUser && allowedRoles.includes(currentUser.role)) {
      return true;
    }

    this.logger.warn(
      `Blocked unauthorized request for role ${currentUser?.role ?? "unknown"}`,
    );
    res.status(403).render("partials/error", {
      message: AuthorizationRequired(message).message,
      layout: false,
    });
    return false;
  }

  private registerRoutes(): void {
    this.app.get(
      "/",
      asyncHandler(async (req, res) => {
        this.logger.info("GET /");
        const store = sessionStore(req);
        res.redirect(isAuthenticatedSession(store) ? "/home" : "/login");
      }),
    );

    this.app.get(
      "/login",
      asyncHandler(async (req, res) => {
        const store = sessionStore(req);
        const browserSession = recordPageView(store);

        if (getAuthenticatedUser(store)) {
          res.redirect("/home");
          return;
        }

        await this.authController.showLogin(res, browserSession);
      }),
    );

    this.app.post(
      "/login",
      asyncHandler(async (req, res) => {
        const email = typeof req.body.email === "string" ? req.body.email : "";
        const password =
          typeof req.body.password === "string" ? req.body.password : "";
        await this.authController.loginFromForm(
          res,
          email,
          password,
          sessionStore(req),
        );
      }),
    );

    this.app.post(
      "/logout",
      asyncHandler(async (req, res) => {
        await this.authController.logoutFromForm(res, sessionStore(req));
      }),
    );

    this.app.get(
      "/events/new",
      asyncHandler(async (req, res) => {
        if (
          !this.requireRole(
            req,
            res,
            ["admin", "staff"],
            "Only organizers and admins can create events.",
          )
        ) {
          return;
        }

        const browserSession = recordPageView(sessionStore(req));
        await this.eventController.showCreateForm(
          res,
          sessionStore(req),
          browserSession,
        );
      }),
    );

    this.app.get(
      "/events/:id",
      asyncHandler(async (req, res) => {
        if (!this.requireAuthenticated(req, res)) {
          return;
        }

        const browserSession = recordPageView(sessionStore(req));
        await this.eventController.showEventDetail(
          res,
          typeof req.params.id === "string" ? req.params.id : "",
          sessionStore(req),
          browserSession,
        );
      }),
    );
    this.app.get(
      "/events/:id/edit",
      asyncHandler(async (req, res) => {
        if (
          !this.requireRole(
            req,
            res,
            ["admin", "staff"],
            "Only organizers and admins can edit events.",
          )
        ) {
          return;
        }

        const browserSession = recordPageView(sessionStore(req));
        await this.eventController.showEditForm(
          res,
          typeof req.params.id === "string" ? req.params.id : "",
          sessionStore(req),
          browserSession,
        );
      }),
    );

    this.app.post(
      "/events/:id/edit",
      asyncHandler(async (req, res) => {
        if (
          !this.requireRole(
            req,
            res,
            ["admin", "staff"],
            "Only organizers and admins can edit events.",
          )
        ) {
          return;
        }

        const browserSession = touchAppSession(sessionStore(req));
        await this.eventController.updateFromForm(
          res,
          typeof req.params.id === "string" ? req.params.id : "",
          {
            title: typeof req.body.title === "string" ? req.body.title : "",
            description: typeof req.body.description === "string" ? req.body.description : "",
            location: typeof req.body.location === "string" ? req.body.location : "",
            category: typeof req.body.category === "string" ? req.body.category : "",
            capacity: typeof req.body.capacity === "string" ? req.body.capacity : "",
            startDatetime: typeof req.body.startDatetime === "string" ? req.body.startDatetime : "",
            endDatetime: typeof req.body.endDatetime === "string" ? req.body.endDatetime : "",
          },
          sessionStore(req),
          browserSession,
        );
      }),
    );

    this.app.get(
      "/events/archive",
      asyncHandler(async (req, res) => {
        if (!this.requireAuthenticated(req, res)) return;
        const browserSession = recordPageView(sessionStore(req));
        const category = typeof req.query.category === "string" && req.query.category !== ""
          ? req.query.category
          : null;
        await this.eventController.showArchivePage(res, category, sessionStore(req), browserSession);
      }),
    );

    this.app.post(
      "/events",
      asyncHandler(async (req, res) => {
        if (
          !this.requireRole(
            req,
            res,
            ["admin", "staff"],
            "Only organizers and admins can create events.",
          )
        ) {
          return;
        }

        const browserSession = touchAppSession(sessionStore(req));

        await this.eventController.createFromForm(
          res,
          {
            title: typeof req.body.title === "string" ? req.body.title : "",
            description:
              typeof req.body.description === "string"
                ? req.body.description
                : "",
            location:
              typeof req.body.location === "string" ? req.body.location : "",
            category:
              typeof req.body.category === "string" ? req.body.category : "",
            capacity:
              typeof req.body.capacity === "string" ? req.body.capacity : "",
            startDatetime:
              typeof req.body.startDatetime === "string"
                ? req.body.startDatetime
                : "",
            endDatetime:
              typeof req.body.endDatetime === "string"
                ? req.body.endDatetime
                : "",
          },
          sessionStore(req),
          browserSession,
        );
      }),
    );

    this.app.post(
      "/events/:id/publish",
      asyncHandler(async (req, res) => {
        if (!this.requireAuthenticated(req, res)) {
          return;
        }

        await this.eventController.publishFromForm(
          res,
          typeof req.params.id === "string" ? req.params.id : "",
          sessionStore(req),
          {
            isHtmx: this.isHtmxRequest(req),
            viewSource:
              req.body && typeof req.body.viewSource === "string"
                ? req.body.viewSource
                : "",
          },
        );
      }),
    );

    this.app.post(
      "/events/:id/cancel",
      asyncHandler(async (req, res) => {
        if (!this.requireAuthenticated(req, res)) {
          return;
        }

        await this.eventController.cancelFromForm(
          res,
          typeof req.params.id === "string" ? req.params.id : "",
          sessionStore(req),
          {
            isHtmx: this.isHtmxRequest(req),
            viewSource:
              req.body && typeof req.body.viewSource === "string"
                ? req.body.viewSource
                : "",
          },
        );
      }),
    );

    this.app.post(
      "/events/:id/comments",
      asyncHandler(async (req, res) => {
        if (!this.requireAuthenticated(req, res)) {
          return;
        }

        const browserSession = touchAppSession(sessionStore(req));
        await this.commentController.postComment(
          res,
          typeof req.params.id === "string" ? req.params.id : "",
          typeof req.body.content === "string" ? req.body.content : "",
          sessionStore(req),
          browserSession,
        );
      }),
    );

    this.app.post(
      "/comments/:id/delete",
      asyncHandler(async (req, res) => {
        if (!this.requireAuthenticated(req, res)) {
          return;
        }

        await this.commentController.deleteComment(
          res,
          typeof req.params.id === "string" ? req.params.id : "",
          sessionStore(req),
        );
      }),
    );

    this.app.get(
      "/organizer/dashboard",
      asyncHandler(async (req, res) => {
        if (!this.requireAuthenticated(req, res)) {
          return;
        }

        const browserSession = recordPageView(sessionStore(req));
        await this.eventController.showOrganizerDashboard(
          res,
          sessionStore(req),
          browserSession,
        );
      }),
    );

    this.app.get(
      "/admin/users",
      asyncHandler(async (req, res) => {
        if (
          !this.requireRole(req, res, ["admin"], "Only Admin can manage users.")
        ) {
          return;
        }

        const browserSession = recordPageView(sessionStore(req));
        await this.authController.showAdminUsers(res, browserSession);
      }),
    );

    this.app.post(
      "/admin/users",
      asyncHandler(async (req, res) => {
        if (
          !this.requireRole(req, res, ["admin"], "Only Admin can manage users.")
        ) {
          return;
        }

        const roleValue = typeof req.body.role === "string" ? req.body.role : "user";
        const role: UserRole =
          roleValue === "admin" || roleValue === "staff" || roleValue === "user"
            ? roleValue
            : "user";

        await this.authController.createUserFromForm(
          res,
          {
            email: typeof req.body.email === "string" ? req.body.email : "",
            displayName:
              typeof req.body.displayName === "string"
                ? req.body.displayName
                : "",
            password:
              typeof req.body.password === "string" ? req.body.password : "",
            role,
          },
          touchAppSession(sessionStore(req)),
        );
      }),
    );

    this.app.post(
      "/admin/users/:id/delete",
      asyncHandler(async (req, res) => {
        if (
          !this.requireRole(req, res, ["admin"], "Only Admin can manage users.")
        ) {
          return;
        }

        const session = touchAppSession(sessionStore(req));
        const currentUser = getAuthenticatedUser(sessionStore(req));
        if (!currentUser) {
          res.status(401).render("partials/error", {
            message: AuthenticationRequired("Please log in to continue.").message,
            layout: false,
          });
          return;
        }

        await this.authController.deleteUserFromForm(
          res,
          typeof req.params.id === "string" ? req.params.id : "",
          currentUser.userId,
          session,
        );
      }),
    );

    // ── Member routes ────────────────────────────────────────────────

    this.app.get(
      "/my-rsvps",
      asyncHandler(async (req, res) => {
        if (!this.requireRole(req, res, ["user"], "This page is for members only.")) {
          return;
        }

        const browserSession = recordPageView(sessionStore(req));
        await this.rsvpController.showMyRsvps(res, browserSession);
      }),
    );

    // ── Authenticated home page ──────────────────────────────────────
    // TODO: Replace this placeholder with your project's main page.

    this.app.get(
      "/home",
      asyncHandler(async (req, res) => {
        if (!this.requireAuthenticated(req, res)) {
          return;
        }

        const browserSession = recordPageView(sessionStore(req));
        this.logger.info(`GET /home for ${browserSession.browserLabel}`);
        res.render("home", { session: browserSession, pageError: null });
      }),
    );

    this.app.use(
      (
        err: unknown,
        _req: Request,
        res: Response,
        _next: (value?: unknown) => void,
      ) => {
        const message =
          err instanceof Error ? err.message : "Unexpected server error.";
        this.logger.error(message);
        res.status(500).render("partials/error", {
          message: "Unexpected server error.",
          layout: false,
        });
      },
    );
  }

  getExpressApp(): express.Express {
    return this.app;
  }
}

export function CreateApp(
  authController: IAuthController,
  rsvpController: IRsvpController,
  eventController: IEventController,
  commentController: ICommentController,
  logger: ILoggingService,
): IApp {
  return new ExpressApp(authController, rsvpController, eventController, commentController, logger);
}
