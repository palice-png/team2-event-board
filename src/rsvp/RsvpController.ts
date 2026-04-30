import type { Response } from "express";
import type { IAppBrowserSession } from "../session/AppSession";
import type { ILoggingService } from "../service/LoggingService";
import type { IRsvpService } from "./RsvpService";

export interface IRsvpController {
  showMyRsvps(res: Response, session: IAppBrowserSession): Promise<void>;
}

class RsvpController implements IRsvpController {
  constructor(
    private readonly rsvpService: IRsvpService,
    private readonly logger: ILoggingService,
  ) {}

  async showMyRsvps(res: Response, session: IAppBrowserSession): Promise<void> {
    if (!session.authenticatedUser) {
      res.status(401).render("partials/error", {
        message: "Please log in to continue.",
        layout: false,
      });
      return;
    }

    const { userId, role } = session.authenticatedUser;
    const result = await this.rsvpService.getMyRsvps(userId, role);

    if (result.ok === false) {
      const error = result.value;
      this.logger.warn(`getMyRsvps failed: ${error.message}`);
      const status = error.name === "UnauthorizedError" ? 403 : 500;
      res.status(status).render("partials/error", {
        message: error.message,
        layout: false,
      });
      return;
    }

    this.logger.info(`GET /my-rsvps for user ${userId}`);
    res.render("rsvp/my-rsvps", { session, rsvps: result.value, pageError: null });
  }
}

export function CreateRsvpController(
  rsvpService: IRsvpService,
  logger: ILoggingService,
): IRsvpController {
  return new RsvpController(rsvpService, logger);
}
