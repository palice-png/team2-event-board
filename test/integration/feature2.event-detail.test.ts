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

async function loginAsAdmin(app: express.Express): Promise<TestAgent> {
    const agent = request.agent(app);
    const response = await agent.post("/login").type("form").send({
        email: "admin@app.test",
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
  titlePrefix: string,
): Promise<string> {
    const title = `${titlePrefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

    const createResponse = await agent.post("/events").type("form").send({
        title,
        description: "Feature 2 integration test event",
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

describe("Feature 2 HTTP integration: event detail", () => {
    let app: express.Express;

    beforeEach(() => {
        app = createComposedApp().getExpressApp();
    });

    it("published event detail is visible to a member", async () => {
        const staffAgent = await loginAsStaff(app);
        const memberAgent = await loginAsMember(app);

        const eventId = await createDraftEventAndGetId(
        app,
        staffAgent,
        "feature2-published",
        );

        const publishResponse = await staffAgent.post(`/events/${eventId}/publish`);
        expect(publishResponse.status).toBe(200);
        expect(publishResponse.text).toContain("Event published.");

        const detailResponse = await memberAgent.get(`/events/${eventId}`);

        expect(detailResponse.status).toBe(200);
        expect(detailResponse.text).toContain("Feature 2 integration test event");
        expect(detailResponse.text).toContain("Campus Hall");
        expect(detailResponse.text).toContain("Workshop");
    });

    it("missing event detail returns 404", async () => {
        const memberAgent = await loginAsMember(app);

        const response = await memberAgent.get("/events/not-found-event-id");

        expect(response.status).toBe(404);
        expect(response.text).toContain("Event not found.");
    });

    it("organizer can view their own draft event detail", async () => {
        const staffAgent = await loginAsStaff(app);

        const eventId = await createDraftEventAndGetId(
        app,
        staffAgent,
        "feature2-own-draft",
        );

        const response = await staffAgent.get(`/events/${eventId}`);

        expect(response.status).toBe(200);
        expect(response.text).toContain("Feature 2 integration test event");
        expect(response.text).toContain("Campus Hall");
    });
});