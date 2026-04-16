import type { Result } from "../lib/result";
import type { MyRsvpsError, RsvpWithEvent } from "./Rsvp";

export interface IRsvpRepository {
  findByUserId(userId: string): Promise<Result<RsvpWithEvent[], MyRsvpsError>>;
}
