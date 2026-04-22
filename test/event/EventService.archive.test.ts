import { Ok, Err } from "../../src/lib/result";
import { CreateEventService } from "../../src/event/EventService";
import type { IEventRepository, EventRepositoryError } from "../../src/event/EventRepository";
import type { IEventRecord } from "../../src/event/Event";

function makeStubRepo(overrides: {
    transitionExpiredToStatus?: IEventRepository["transitionExpiredToStatus"];
    listByStatus?: IEventRepository["listByStatus"];
  }): IEventRepository {
    const noop = (): never => {
      throw new Error("unexpected repository call");
    };
    return {
      createEvent: noop,
      findById: noop,
      listEvents: noop,
      listByOrganizerId: noop,
      listAll: noop,
      countGoingByEventId: noop,
      updateStatus: noop,
      update: noop,
      transitionExpiredToStatus: overrides.transitionExpiredToStatus ?? noop,
      listByStatus: overrides.listByStatus ?? noop,
    };
}

function makeEvent(overrides: Partial<IEventRecord> & { id: string }): IEventRecord {
    return {
      title: "Test Event",
      description: "A test event",
      location: "Room 1",
      category: "Workshop",
      status: "published",
      capacity: 20,
      startDatetime: "2026-01-10T10:00:00Z",
      endDatetime: "2026-01-10T12:00:00Z",
      organizerId: "user-staff",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
      ...overrides,
    };
}

describe("EventService.transitionExpiredEvents", () => {
    it("returns the count of events transitioned by the repository", async () => {
      const repo = makeStubRepo({
        transitionExpiredToStatus: async () => Ok(3),
      });
      const service = CreateEventService(repo);
  
      const result = await service.transitionExpiredEvents(new Date("2026-04-22T00:00:00Z"));
  
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(3);
      }
    });
  
    it("returns zero when no events are expired", async () => {
      const repo = makeStubRepo({
        transitionExpiredToStatus: async () => Ok(0),
      });
      const service = CreateEventService(repo);
  
      const result = await service.transitionExpiredEvents(new Date());
  
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(0);
      }
    });
  
    it("propagates UnexpectedDependencyError when the repository fails", async () => {
      const repoError: EventRepositoryError = {
        name: "UnexpectedDependencyError",
        message: "db down",
      };
      const repo = makeStubRepo({
        transitionExpiredToStatus: async () => Err(repoError),
      });
      const service = CreateEventService(repo);
  
      const result = await service.transitionExpiredEvents(new Date());
  
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.value.name).toBe("UnexpectedDependencyError");
      }
    });
});

describe("EventService.getArchivedEvents", () => {
    const pastEvents: IEventRecord[] = [
      makeEvent({ id: "e-1", category: "Workshop", startDatetime: "2026-02-01T10:00:00Z", status: "past" }),
      makeEvent({ id: "e-2", category: "Seminar", startDatetime: "2026-03-15T10:00:00Z", status: "past" }),
      makeEvent({ id: "e-3", category: "Workshop", startDatetime: "2026-01-05T10:00:00Z", status: "past" }),
    ];
  
    it("returns all past events when no category filter is provided", async () => {
      const repo = makeStubRepo({
        listByStatus: async () => Ok(pastEvents),
      });
      const service = CreateEventService(repo);
  
      const result = await service.getArchivedEvents(null);
  
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(3);
      }
    });
  
    it("filters events by category (case-insensitive)", async () => {
      const repo = makeStubRepo({
        listByStatus: async () => Ok(pastEvents),
      });
      const service = CreateEventService(repo);
  
      const result = await service.getArchivedEvents("workshop");
  
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
        expect(result.value.every((e) => e.category === "Workshop")).toBe(true);
      }
    });
  
    it("returns results sorted in reverse chronological order by startDatetime", async () => {
      const repo = makeStubRepo({
        listByStatus: async () => Ok(pastEvents),
      });
      const service = CreateEventService(repo);
  
      const result = await service.getArchivedEvents(null);
  
      expect(result.ok).toBe(true);
      if (result.ok) {
        const dates = result.value.map((e) => e.startDatetime);
        expect(dates[0]).toBe("2026-03-15T10:00:00Z");
        expect(dates[1]).toBe("2026-02-01T10:00:00Z");
        expect(dates[2]).toBe("2026-01-05T10:00:00Z");
      }
    });
  
    it("returns an empty list when no past events exist", async () => {
      const repo = makeStubRepo({
        listByStatus: async () => Ok([]),
      });
      const service = CreateEventService(repo);
  
      const result = await service.getArchivedEvents(null);
  
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(0);
      }
    });
  
    it("returns InvalidFilterError for an empty string category", async () => {
      const repo = makeStubRepo({});
      const service = CreateEventService(repo);
  
      const result = await service.getArchivedEvents("");
  
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.value.name).toBe("InvalidFilterError");
      }
    });
  
    it("returns an empty list when no events match the given category", async () => {
      const repo = makeStubRepo({
        listByStatus: async () => Ok(pastEvents),
      });
      const service = CreateEventService(repo);
  
      const result = await service.getArchivedEvents("Hackathon");
  
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(0);
      }
    });
  
    it("propagates UnexpectedDependencyError when the repository fails", async () => {
      const repoError: EventRepositoryError = {
        name: "UnexpectedDependencyError",
        message: "db down",
      };
      const repo = makeStubRepo({
        listByStatus: async () => Err(repoError),
      });
      const service = CreateEventService(repo);
  
      const result = await service.getArchivedEvents(null);
  
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.value.name).toBe("UnexpectedDependencyError");
      }
    });
  });

  