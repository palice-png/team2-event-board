import { Ok, Err } from "../../src/lib/result";
import { CreateRsvpService } from "../../src/rsvp/RsvpService";
import { CreateInMemoryRsvpRepository } from "../../src/rsvp/InMemoryRsvpRepository";
import { UnexpectedDependencyError } from "../../src/rsvp/Rsvp";
import type { IRsvpRepository } from "../../src/rsvp/RsvpRepository";

describe("RsvpService.getMyRsvps", () => {
  it("rejects staff role with UnauthorizedError", async () => {
    const service = CreateRsvpService(CreateInMemoryRsvpRepository());

    const result = await service.getMyRsvps("user-staff", "staff");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.value.name).toBe("UnauthorizedError");
      expect(result.value.message).toContain("Organizers");
    }
  });

  it("groups user-reader's RSVPs into upcoming and pastOrCancelled", async () => {
    const service = CreateRsvpService(CreateInMemoryRsvpRepository());

    const result = await service.getMyRsvps("user-reader", "user");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.upcoming).toHaveLength(2);
      expect(result.value.pastOrCancelled).toHaveLength(2);
    }
  });

  it("sorts upcoming events chronologically (earliest first)", async () => {
    const service = CreateRsvpService(CreateInMemoryRsvpRepository());

    const result = await service.getMyRsvps("user-reader", "user");

    expect(result.ok).toBe(true);
    if (result.ok) {
      const { upcoming } = result.value;
      expect(upcoming[0].event.id).toBe("event-1"); // 2026-05-15
      expect(upcoming[1].event.id).toBe("event-2"); // 2026-06-20
    }
  });

  it("sorts pastOrCancelled events in reverse chronological order (most recent first)", async () => {
    const service = CreateRsvpService(CreateInMemoryRsvpRepository());

    const result = await service.getMyRsvps("user-reader", "user");

    expect(result.ok).toBe(true);
    if (result.ok) {
      const { pastOrCancelled } = result.value;
      expect(pastOrCancelled[0].event.id).toBe("event-3"); // 2026-07-10, cancelled RSVP
      expect(pastOrCancelled[1].event.id).toBe("event-4"); // 2026-01-10, past event
    }
  });

  it("puts a cancelled RSVP on a future published event into pastOrCancelled", async () => {
    const service = CreateRsvpService(CreateInMemoryRsvpRepository());

    const result = await service.getMyRsvps("user-reader", "user");

    expect(result.ok).toBe(true);
    if (result.ok) {
      const cancelled = result.value.pastOrCancelled.find((r) => r.status === "cancelled");
      expect(cancelled).toBeDefined();
      expect(cancelled?.event.status).toBe("published");
    }
  });

  it("returns empty arrays for a user with no RSVPs", async () => {
    const emptyRepo: IRsvpRepository = {
      findByUserId: async () => Ok([]),
    };
    const service = CreateRsvpService(emptyRepo);

    const result = await service.getMyRsvps("user-nobody", "user");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.upcoming).toHaveLength(0);
      expect(result.value.pastOrCancelled).toHaveLength(0);
    }
  });

  it("propagates UnexpectedDependencyError when the repository fails", async () => {
    const failingRepo: IRsvpRepository = {
      findByUserId: async () => Err(UnexpectedDependencyError("db down")),
    };
    const service = CreateRsvpService(failingRepo);

    const result = await service.getMyRsvps("user-reader", "user");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.value.name).toBe("UnexpectedDependencyError");
    }
  });
});
