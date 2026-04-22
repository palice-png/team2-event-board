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

async function createEvent(
  agent: TestAgent,
  title: string,
): Promise<void> {
  const response = await agent.post("/events").type("form").send({
    title,
    description: "Feature 8 integration test event",
    location: "Campus Hall",
    category: "Workshop",
    capacity: "25",
    startDatetime: "2026-05-10T10:00",
    endDatetime: "2026-05-10T12:00",
  });

  expect(response.status).toBe(302);
  expect(response.headers.location).toBe("/organizer/dashboard");
}

describe("Feature 8 HTTP integration: organizer dashboard", () => {
  let app: express.Express;

  beforeEach(() => {
    app = createComposedApp().getExpressApp();
  });

  it("unauthenticated dashboard access redirects to /login", async () => {
    const response = await request(app).get("/organizer/dashboard");

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/login");
  });

  it("member user is rejected with 403 and unauthorized message", async () => {
    const memberAgent = await loginAsMember(app);

    const response = await memberAgent.get("/organizer/dashboard");

    expect(response.status).toBe(403);
    expect(response.text).toContain(
      "You are not allowed to access organizer dashboard.",
    );
  });

  it("staff sees organizer dashboard with 200", async () => {
    const staffAgent = await loginAsStaff(app);

    const response = await staffAgent.get("/organizer/dashboard");

    expect(response.status).toBe(200);
    expect(response.text).toContain("Organizer dashboard");
  });

  it("staff sees only their own events", async () => {
    const staffAgent = await loginAsStaff(app);
    const adminAgent = await loginAsAdmin(app);
    const staffTitle = `f8-staff-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const adminTitle = `f8-admin-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

    await createEvent(staffAgent, staffTitle);
    await createEvent(adminAgent, adminTitle);

    const response = await staffAgent.get("/organizer/dashboard");

    expect(response.status).toBe(200);
    expect(response.text).toContain(staffTitle);
    expect(response.text).not.toContain(adminTitle);
  });

  it("admin sees all events", async () => {
    const staffAgent = await loginAsStaff(app);
    const adminAgent = await loginAsAdmin(app);
    const staffTitle = `f8-staff-all-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const adminTitle = `f8-admin-all-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

    await createEvent(staffAgent, staffTitle);
    await createEvent(adminAgent, adminTitle);

    const response = await adminAgent.get("/organizer/dashboard");

    expect(response.status).toBe(200);
    expect(response.text).toContain(staffTitle);
    expect(response.text).toContain(adminTitle);
  });

  it("attendee count rendering is correct for a newly created event", async () => {
    const staffAgent = await loginAsStaff(app);
    const title = `f8-count-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

    await createEvent(staffAgent, title);

    const response = await staffAgent.get("/organizer/dashboard");

    expect(response.status).toBe(200);
    const titleAndCountRegex = new RegExp(
      `${escapeRegExp(title)}[\\s\\S]*?Attending:[\\s\\S]*?0\\s*/\\s*25`,
    );
    expect(response.text).toMatch(titleAndCountRegex);
  });
});
