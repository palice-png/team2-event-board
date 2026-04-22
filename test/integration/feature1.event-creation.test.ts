import request from "supertest";
import type express from "express";
import { createComposedApp } from "../../src/composition";

type TestAgent = ReturnType<typeof request.agent>;

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

describe("Feature 1 HTTP integration: event creation", () => {
    let app: express.Express;

    beforeEach(() => {
        app = createComposedApp().getExpressApp();
    });

    it("staff creates an event successfully", async () => {
        const staffAgent = await loginAsStaff(app);
        const title = `f1-create-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

        const response = await staffAgent.post("/events").type("form").send({
        title,
        description: "Feature 1 integration test event",
        location: "Campus Hall",
        category: "Workshop",
        capacity: "25",
        startDatetime: "2026-05-10T10:00",
        endDatetime: "2026-05-10T12:00",
        });

        expect(response.status).toBe(302);
        expect(response.headers.location).toBe("/organizer/dashboard");

        const dashboardResponse = await staffAgent.get("/organizer/dashboard");
        expect(dashboardResponse.status).toBe(200);
        expect(dashboardResponse.text).toContain(title);
    });

    it("member user is rejected from creating an event", async () => {
        const memberAgent = await loginAsMember(app);

        const response = await memberAgent.post("/events").type("form").send({
        title: "member-should-fail",
        description: "Feature 1 integration test event",
        location: "Campus Hall",
        category: "Workshop",
        capacity: "25",
        startDatetime: "2026-05-10T10:00",
        endDatetime: "2026-05-10T12:00",
        });

        expect(response.status).toBe(403);
    });

    it("returns 400 when title is missing", async () => {
        const staffAgent = await loginAsStaff(app);

        const response = await staffAgent.post("/events").type("form").send({
        title: "",
        description: "Feature 1 integration test event",
        location: "Campus Hall",
        category: "Workshop",
        capacity: "25",
        startDatetime: "2026-05-10T10:00",
        endDatetime: "2026-05-10T12:00",
        });

        expect(response.status).toBe(400);
    });

    it("returns 400 when end time is before start time", async () => {
        const staffAgent = await loginAsStaff(app);

        const response = await staffAgent.post("/events").type("form").send({
            title: "invalid-time-event",
            description: "Feature 1 integration test event",
            location: "Campus Hall",
            category: "Workshop",
            capacity: "25",
            startDatetime: "2026-05-10T12:00",
            endDatetime: "2026-05-10T10:00",
        });

        expect(response.status).toBe(400);
    });
});