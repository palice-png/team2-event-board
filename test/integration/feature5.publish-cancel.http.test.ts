import request from "supertest";
import type express from "express";
import { createComposedApp } from "../../src/composition";

type TestAgent = ReturnType<typeof request.agent>;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function loginAsStaff(app: express.Express): Promise<TestAgent> {
  const agent = request.agent(app);
  const response = await agent.post("/login").type("form").send({
    email: "staff@app.test",
    password: "password123",
  });

  expect(response.status).toBe(302);
  expect(response.headers.location).toBe("/organizer/dashboard");
  return agent;
}

async function loginAsMember(app: express.Express): Promise<TestAgent> {
  const agent = request.agent(app);
  const response = await agent.post("/login").type("form").send({
    email: "user@app.test",
    password: "password123",
  });

  expect(response.status).toBe(302);
  expect(response.headers.location).toBe("/home");
  return agent;
}

async function createDraftEventAndGetId(
  app: express.Express,
  agent: TestAgent,
): Promise<string> {
  const title = `feature5-test-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const createResponse = await agent.post("/events").type("form").send({
    title,
    description: "Feature 5 integration test event",
    location: "Campus Hall",
    category: "Workshop",
    capacity: "25",
    startDatetime: "2026-05-10T10:00",
    endDatetime: "2026-05-10T12:00",
  });

  expect(createResponse.status).toBe(302);
  expect(createResponse.headers.location).toBe("/organizer/dashboard");

  const dashboardResponse = await agent.get("/organizer/dashboard");
  expect(dashboardResponse.status).toBe(200);

  const eventLinkRegex = new RegExp(
    `href="/events/([^"]+)"[^>]*>\\s*${escapeRegExp(title)}\\s*</a>`,
  );
  const match = dashboardResponse.text.match(eventLinkRegex);
  expect(match).not.toBeNull();
  return match![1];
}

describe("Feature 5 HTTP integration: publish and cancel", () => {
  let app: express.Express;

  beforeEach(() => {
    app = createComposedApp().getExpressApp();
  });

  it("unauthenticated publish returns 401", async () => {
    const response = await request(app).post("/events/unknown-event/publish");

    expect(response.status).toBe(401);
    expect(response.text).toContain("Please log in to continue.");
  });

  it("publish not found returns 404", async () => {
    const staffAgent = await loginAsStaff(app);
    const response = await staffAgent.post("/events/not-found-event-id/publish");

    expect(response.status).toBe(404);
    expect(response.text).toContain("Event not found.");
  });

  it('staff publishes own draft event and returns 200 with "Event published."', async () => {
    const staffAgent = await loginAsStaff(app);
    const eventId = await createDraftEventAndGetId(app, staffAgent);

    const response = await staffAgent.post(`/events/${eventId}/publish`);

    expect(response.status).toBe(200);
    expect(response.text).toContain("Event published.");
  });

  it("publish invalid transition returns 409", async () => {
    const staffAgent = await loginAsStaff(app);
    const eventId = await createDraftEventAndGetId(app, staffAgent);

    const firstPublish = await staffAgent.post(`/events/${eventId}/publish`);
    expect(firstPublish.status).toBe(200);

    const secondPublish = await staffAgent.post(`/events/${eventId}/publish`);
    expect(secondPublish.status).toBe(409);
    expect(secondPublish.text).toContain("Only draft events can be published.");
  });

  it("member user cannot publish an event and returns 403", async () => {
    const staffAgent = await loginAsStaff(app);
    const eventId = await createDraftEventAndGetId(app, staffAgent);
    const memberAgent = await loginAsMember(app);

    const response = await memberAgent.post(`/events/${eventId}/publish`);

    expect(response.status).toBe(403);
    expect(response.text).toContain("You are not allowed to publish this event.");
  });

  it("unauthenticated cancel returns 401", async () => {
    const response = await request(app).post("/events/unknown-event/cancel");

    expect(response.status).toBe(401);
    expect(response.text).toContain("Please log in to continue.");
  });

  it("cancel not found returns 404", async () => {
    const staffAgent = await loginAsStaff(app);
    const response = await staffAgent.post("/events/not-found-event-id/cancel");

    expect(response.status).toBe(404);
    expect(response.text).toContain("Event not found.");
  });

  it('staff cancels own published event and returns 200 with "Event cancelled."', async () => {
    const staffAgent = await loginAsStaff(app);
    const eventId = await createDraftEventAndGetId(app, staffAgent);

    const publishResponse = await staffAgent.post(`/events/${eventId}/publish`);
    expect(publishResponse.status).toBe(200);

    const cancelResponse = await staffAgent.post(`/events/${eventId}/cancel`);
    expect(cancelResponse.status).toBe(200);
    expect(cancelResponse.text).toContain("Event cancelled.");
  });

  it("cancel invalid transition returns 409", async () => {
    const staffAgent = await loginAsStaff(app);
    const eventId = await createDraftEventAndGetId(app, staffAgent);

    const cancelResponse = await staffAgent.post(`/events/${eventId}/cancel`);

    expect(cancelResponse.status).toBe(409);
    expect(cancelResponse.text).toContain("Only published events can be cancelled.");
  });

  it("member user cannot cancel an event and returns 403", async () => {
    const staffAgent = await loginAsStaff(app);
    const eventId = await createDraftEventAndGetId(app, staffAgent);
    const publishResponse = await staffAgent.post(`/events/${eventId}/publish`);
    expect(publishResponse.status).toBe(200);
    const memberAgent = await loginAsMember(app);

    const response = await memberAgent.post(`/events/${eventId}/cancel`);

    expect(response.status).toBe(403);
    expect(response.text).toContain("You are not allowed to cancel this event.");
  });
});
