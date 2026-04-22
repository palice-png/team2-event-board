import { CreateEventService } from "../../src/event/EventService";
import { CreateInMemoryEventRepository } from "../../src/event/InMemoryEventRepository";

function makeService() {
  const repo = CreateInMemoryEventRepository();
  const service = CreateEventService(repo);
  return { repo, service };
}

async function createTestEvent(
  service: ReturnType<typeof CreateEventService>,
  overrides: Partial<{
    title: string;
    description: string;
    location: string;
    category: string;
    capacity: string;
    startDatetime: string;
    endDatetime: string;
    userId: string;
    role: "admin" | "staff" | "user";
  }> = {}
) {
  const result = await service.createEvent(
    {
      title: overrides.title ?? "Test Event",
      description: overrides.description ?? "A test event",
      location: overrides.location ?? "UMass",
      category: overrides.category ?? "Workshop",
      capacity: overrides.capacity ?? "10",
      startDatetime: overrides.startDatetime ?? "2027-01-01T10:00:00.000Z",
      endDatetime: overrides.endDatetime ?? "2027-01-01T12:00:00.000Z",
    },
    overrides.userId ?? "user-staff",
    overrides.role ?? "staff",
  );

  if (result.ok === false) throw new Error("Failed to create test event");
  return result.value;
}


describe("EventService.updateEvent", () => {

  //Happy Path

  it("allows the owner to update their own event", async () => {
    const { service } = makeService();
    const event = await createTestEvent(service, { userId: "user-staff" });

    const result = await service.updateEvent(
      event.id,
      {
        title: "Updated Title",
        description: "Updated description",
        location: "New Location",
        category: "Seminar",
        capacity: "20",
        startDatetime: "2027-02-01T10:00:00.000Z",
        endDatetime: "2027-02-01T12:00:00.000Z",
      },
      "user-staff",
      "staff",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.title).toBe("Updated Title");
      expect(result.value.location).toBe("New Location");
      expect(result.value.category).toBe("Seminar");
      expect(result.value.capacity).toBe(20);
    }
  });

  it("allows an admin to update any event", async () => {
    const { service } = makeService();
    const event = await createTestEvent(service, { userId: "user-staff" });

    const result = await service.updateEvent(
      event.id,
      {
        title: "Admin Updated Title",
        description: "Updated by admin",
        location: "Admin Location",
        category: "Workshop",
        capacity: "",
        startDatetime: "2027-02-01T10:00:00.000Z",
        endDatetime: "2027-02-01T12:00:00.000Z",
      },
      "user-admin",
      "admin",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.title).toBe("Admin Updated Title");
    }
  });

  it("allows updating with no capacity (unlimited)", async () => {
    const { service } = makeService();
    const event = await createTestEvent(service, { userId: "user-staff" });

    const result = await service.updateEvent(
      event.id,
      {
        title: "No Capacity Event",
        description: "No cap",
        location: "UMass",
        category: "Workshop",
        capacity: "",
        startDatetime: "2027-02-01T10:00:00.000Z",
        endDatetime: "2027-02-01T12:00:00.000Z",
      },
      "user-staff",
      "staff",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.capacity).toBeNull();
    }
  });

  //Error case

  it("returns EventNotFoundError when event does not exist", async () => {
    const { service } = makeService();

    const result = await service.updateEvent(
      "non-existent-id",
      {
        title: "Title",
        description: "Desc",
        location: "Location",
        category: "Category",
        capacity: "",
        startDatetime: "2027-02-01T10:00:00.000Z",
        endDatetime: "2027-02-01T12:00:00.000Z",
      },
      "user-staff",
      "staff",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.value.name).toBe("EventNotFoundError");
    }
  });

  it("returns UnauthorizedError when user is not the owner", async () => {
    const { service } = makeService();
    const event = await createTestEvent(service, { userId: "user-staff" });

    const result = await service.updateEvent(
      event.id,
      {
        title: "Stolen Edit",
        description: "Not my event",
        location: "UMass",
        category: "Workshop",
        capacity: "",
        startDatetime: "2027-02-01T10:00:00.000Z",
        endDatetime: "2027-02-01T12:00:00.000Z",
      },
      "different-user",
      "staff",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.value.name).toBe("UnauthorizedError");
    }
  });

  it("returns InvalidEventStateError when editing a cancelled event", async () => {
    const { service } = makeService();
    const event = await createTestEvent(service, { userId: "user-staff" });

    // First publish it, then cancel it
    await service.publishEvent(event.id, "user-staff", "staff");
    await service.cancelEvent(event.id, "user-staff", "staff");

    const result = await service.updateEvent(
      event.id,
      {
        title: "Edit Cancelled",
        description: "Should fail",
        location: "UMass",
        category: "Workshop",
        capacity: "",
        startDatetime: "2027-02-01T10:00:00.000Z",
        endDatetime: "2027-02-01T12:00:00.000Z",
      },
      "user-staff",
      "staff",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.value.name).toBe("InvalidEventStateError");
    }
  });

  it("returns ValidationError when title is empty", async () => {
    const { service } = makeService();
    const event = await createTestEvent(service, { userId: "user-staff" });

    const result = await service.updateEvent(
      event.id,
      {
        title: "",
        description: "Some description",
        location: "UMass",
        category: "Workshop",
        capacity: "",
        startDatetime: "2027-02-01T10:00:00.000Z",
        endDatetime: "2027-02-01T12:00:00.000Z",
      },
      "user-staff",
      "staff",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.value.name).toBe("ValidationError");
      expect(result.value.message).toContain("Title");
    }
  });

  it("returns ValidationError when end date is before start date", async () => {
    const { service } = makeService();
    const event = await createTestEvent(service, { userId: "user-staff" });

    const result = await service.updateEvent(
      event.id,
      {
        title: "Bad Dates",
        description: "End before start",
        location: "UMass",
        category: "Workshop",
        capacity: "",
        startDatetime: "2027-02-01T12:00:00.000Z",
        endDatetime: "2027-02-01T10:00:00.000Z",
      },
      "user-staff",
      "staff",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.value.name).toBe("ValidationError");
    }
  });

  it("returns ValidationError when capacity is not a positive number", async () => {
    const { service } = makeService();
    const event = await createTestEvent(service, { userId: "user-staff" });

    const result = await service.updateEvent(
      event.id,
      {
        title: "Bad Capacity",
        description: "Negative capacity",
        location: "UMass",
        category: "Workshop",
        capacity: "-5",
        startDatetime: "2027-02-01T10:00:00.000Z",
        endDatetime: "2027-02-01T12:00:00.000Z",
      },
      "user-staff",
      "staff",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.value.name).toBe("ValidationError");
    }
  });

  //Edge case

  it("preserves organizerId and createdAt after update", async () => {
    const { service } = makeService();
    const event = await createTestEvent(service, { userId: "user-staff" });

    const result = await service.updateEvent(
      event.id,
      {
        title: "Updated",
        description: "Updated desc",
        location: "Updated location",
        category: "Seminar",
        capacity: "5",
        startDatetime: "2027-02-01T10:00:00.000Z",
        endDatetime: "2027-02-01T12:00:00.000Z",
      },
      "user-staff",
      "staff",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.organizerId).toBe("user-staff");
      expect(result.value.createdAt).toBe(event.createdAt);
    }
  });
});